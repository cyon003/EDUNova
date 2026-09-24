const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { uploadDirectory } = require("../config/storage");

const directories = new Set(["course-videos", "lesson-resources", "lesson-posters", "quiz-media"]);
function mediaFile(directory, storedName) {
  if (!directories.has(directory) || typeof storedName !== "string" || !storedName || storedName === "." || storedName === ".." || /[\\/\0]/.test(storedName)) return null;
  return { directory, storedName };
}
function uploadedUrlFile(url, directory) {
  const prefix = `/uploads/${directory}/`;
  // Only local generated upload paths, never arbitrary URLs or filesystem paths.
  if (typeof url !== "string" || !url.startsWith(prefix)) return null;
  return mediaFile(directory, url.slice(prefix.length));
}
const fileKey = file => `${file.directory}/${file.storedName}`;

function lessonMediaFiles(lesson) {
  return [
    mediaFile(lesson.primaryMedia?.storage, lesson.primaryMedia?.storedName),
    uploadedUrlFile(lesson.videoUrl, "course-videos"),
    uploadedUrlFile(lesson.posterUrl, "lesson-posters"),
    ...(lesson.resources || []).map(resource => mediaFile("lesson-resources", resource.storedName)),
    ...(lesson.quiz?.questions || []).map(question => mediaFile("quiz-media", question.media?.storedName)),
  ].filter(Boolean);
}

async function writeManifest(ticket) {
  const temporary = path.join(ticket.directory, "manifest.tmp");
  const handle = await fs.open(temporary, "w", 0o600);
  try { await handle.writeFile(JSON.stringify(ticket.manifest, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, path.join(ticket.directory, "manifest.json"));
}

// Uploads have generated names and are immutable. A hard link on the same upload
// filesystem preserves their bytes without copying multi-GB videos or moving the
// live file before MongoDB commits. No expiry/purge job runs automatically.
async function prepareMediaRecovery(files, metadata) {
  const root = uploadDirectory("media-recovery");
  await fs.chmod(root, 0o700);
  const directory = path.join(root, randomUUID());
  await fs.mkdir(directory, { mode: 0o700 });
  const ticket = { directory, manifest: { version: 1, state: "prepared", createdAt: new Date().toISOString(), ...metadata, files: [] } };
  await writeManifest(ticket);
  for (const file of new Map(files.filter(Boolean).map(file => [fileKey(file), file])).values()) {
    if (!mediaFile(file.directory, file.storedName)) throw new Error("Unsafe recovery file");
    const source = path.join(uploadDirectory(file.directory), file.storedName);
    const backupName = String(ticket.manifest.files.length);
    try {
      const stat = await fs.lstat(source);
      if (!stat.isFile()) throw new Error("Recovery source must be a regular file");
      await fs.link(source, path.join(directory, backupName));
      ticket.manifest.files.push({ ...file, backupName });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      ticket.manifest.files.push({ ...file, missing: true });
    }
    await writeManifest(ticket);
  }
  await writeManifest(ticket);
  return ticket;
}

async function finishMediaRecovery(ticket, remainingLessons) {
  if (!ticket) return;
  try {
    // If recording the commit fails, keep every live file. A prepared manifest
    // alone is never permission to remove files (commit outcome may be unknown).
    ticket.manifest.state = "committed";
    await writeManifest(ticket);
    const retained = new Set(remainingLessons.flatMap(lessonMediaFiles).map(fileKey));
    for (const file of ticket.manifest.files) {
      if (file.missing || retained.has(fileKey(file))) continue;
      try { await fs.unlink(path.join(uploadDirectory(file.directory), file.storedName)); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    ticket.manifest.state = "archived";
    await writeManifest(ticket);
  } catch (error) {
    // The database already committed. Do not turn successful deletion into a
    // misleading 500 or discard recovery copies when filesystem cleanup fails.
    console.error("Media cleanup deferred; retain recovery manifest:", ticket.directory, error.code || error.message);
  }
}

module.exports = { mediaFile, lessonMediaFiles, prepareMediaRecovery, finishMediaRecovery };
