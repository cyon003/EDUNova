# Lesson deletion integrity and media recovery

This change is forward-only application behavior. It does not migrate schemas,
repair previously misassigned progress, or run against production automatically.
No lesson-editor redesign is included.

## Database behavior

Deleting a lesson requires transaction-capable MongoDB (Atlas or a replica set).
There is no unsafe standalone fallback. One transaction saves the shortened
course, remaps every enrollment's completion indexes/dates, playback-position
keys, active index and recent activity, detaches the deleted lesson's notes,
shifts surviving note indexes, and removes that lesson's learning signals.
Failure rolls back all database writes. Retry reloads the current course.

An active deleted lesson selects its successor, or the last remaining lesson;
an empty course uses index zero as the existing schema's sentinel. Study totals,
study dates and missions are unchanged. Student notes retain their title/body.
Watch records, exposure, confusion events and quiz attempts keep their stable
lesson IDs and historical snapshots. Removed index-based enrollment history and
the deleted lesson snapshot are retained in the private recovery manifest.

This fixes deletion-time remapping, not the broader legacy API design: clients
still address some progress endpoints by index. An already-open player should be
reloaded after curriculum edits. A future change should use stable lesson IDs
or a curriculum revision on those requests to reject stale client writes.

## Filesystem behavior

Before modifying saved lesson media, the backend creates a private directory at
`UPLOAD_ROOT/media-recovery/<operation-uuid>/`. It hard-links immutable generated
uploads into numbered recovery files and writes a manifest with original storage
directory/name, operation, course/lesson IDs and a lesson snapshot. Lesson
deletion also records enrollment and note mappings. Treat these as private data.
The existing Express/Nginx configuration does not serve this directory.

The filesystem must support hard links on the same volume as the source uploads.
If creating a recovery copy fails, the operation fails before saving the database
or unlinking live files. Missing legacy files are recorded as missing. Symlink
sources are rejected. Backups of UPLOAD_ROOT must include media-recovery.

Manifest states:

- `prepared`: recovery copies were being prepared or the database outcome is
  unconfirmed. Never infer that cleanup is safe from this state alone.
- `committed`: database save/transaction returned successfully; cleanup may be
  pending or partially finished.
- `archived`: post-commit cleanup finished, with recoverable copies retained.

Live media is unlinked only after a confirmed database commit. Files still used
by another lesson in the saved course are retained. A cleanup failure is logged
with the recovery directory; it does not turn a committed deletion into HTTP 500.
Process crashes and transaction retries may leave extra prepared directories.
There is no automatic retry, purge, retention expiry or restore job.

## Recovery procedure

1. Copy the recovery directory and take a current database/upload backup before
   any operator recovery. Check the actual course and enrollment state, especially
   for `prepared` operations or ambiguous commit outcomes.
2. Read each manifest file entry. Its numbered `backupName` contains the bytes
   formerly at `UPLOAD_ROOT/<directory>/<storedName>`. Restore only validated
   paths from the allowlisted directories, without overwriting an existing file.
   Do not expose the manifest or copies publicly.
3. Restore lesson metadata and dependent index mappings only through a separately
   reviewed, transactional repair. Do not blindly replay an old enrollment
   snapshot over newer student activity. Restoring file bytes alone does not
   restore a deleted lesson or its enrollment progress.
4. Retain the archive until recovery is verified and retention is explicitly
   approved. Hard links retain disk blocks after live paths are removed; monitor
   upload storage capacity. An archive on the same disk is not a disaster backup.

## Regression validation

`RUN_LESSON_DELETION_MONGO_TESTS=true node --test tests/lessonDeletionMongo.test.js`
from backend starts a disposable local replica set and temporary upload root.
It never loads application .env files. Tests cover first/middle/last deletion,
multiple enrollments, dates/positions/notes, stable watch IDs, authorization,
save failures, transaction rollback after progress writes, backup failure and
post-commit cleanup failure. `node --test tests/mediaRecovery.test.js` checks
path safety, symlink rejection, shared media and private archive permissions.
