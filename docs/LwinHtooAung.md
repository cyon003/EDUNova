# EDUNova Improvement Tasks — Teammate 1

## Area: Learning Progress, Learning Goals & Video Tracking

### Objective
Improve EDUNova so students can track their learning progress, set weekly learning goals, and cannot falsely complete videos by skipping forward.

---

## Task 1 — Course Learning Progress

### Goal
Each student must be able to see their own learning progress for every enrolled course.

### Requirements
- Track progress separately for each student and course.
- Track completed lessons.
- Display course completion percentage.
- Update progress when a lesson is completed.
- Progress must belong to the authenticated student.
- Students must not be able to modify another student's progress.

### Suggested Calculation

```text
Course Progress = (Completed Lessons / Total Lessons) × 100
```

### Example

```text
Web Development
7 / 10 lessons completed
Progress: 70%
```

### Suggested Data

```text
studentId
courseId
lessonId
completed
completedAt
lastAccessedAt
```

---

## Task 2 — Weekly Learning Goal

### Goal
Allow students to define how much time they plan to study each week.

### Example

```text
Weekly Goal: 120 minutes
Studied This Week: 85 minutes
Remaining: 35 minutes
```

### Requirements
- Ask student to set a weekly learning goal.
- Store the goal in minutes.
- Track actual learning time.
- Reset/calculate weekly statistics for each new week.
- Show:
  - Weekly goal
  - Time completed
  - Time remaining
  - Goal status
- Allow the student to change their goal.

### Suggested Goal Status

```text
85 / 120 min
71% of weekly goal completed
```

Avoid only showing "good" or "bad". Show measurable progress so the student understands their status.

### Suggested Data

```text
studentId
weeklyGoalMinutes
weekStart
learningMinutes
```

---

## Task 3 — Video Anti-Skip / Watch Tracking

### Goal
Students may rewind videos, but they must not skip forward beyond content they have actually watched.

### Required Behavior

Allowed:

```text
Current watched point: 08:30

08:30 -> 05:00  YES
05:00 -> 07:00  YES (already watched)
08:30 -> 15:00  NO  (not watched yet)
```

### Requirements
- Record the furthest valid watched position.
- Student can seek backward freely.
- Student can seek forward only up to the furthest watched position.
- Prevent dragging the player directly to unwatched content.
- Do not trust only frontend state.
- Save watch progress periodically to the backend.
- Restore progress when the student returns to the lesson.

### Suggested Data

```text
studentId
courseId
lessonId
furthestWatchedPosition
lastPosition
videoDuration
updatedAt
```

### Important
The frontend restriction improves the viewing experience, but completion data must also be validated/stored by the backend. Do not let a client request simply send `completed: true` and automatically trust it.

---

## Task 4 — Lesson Completion

### Goal
Connect video watching to lesson and course progress.

### Requirements
- Define a clear completion threshold.
- Mark the video/lesson complete only after the required amount has genuinely been watched.
- Store completion on the backend.
- Update course progress after completion.
- Avoid creating duplicate completion records.

### Suggested Workflow

```text
Student opens lesson
        ↓
Video starts
        ↓
Watch position is recorded
        ↓
Student cannot skip unwatched sections
        ↓
Completion requirement reached
        ↓
Lesson marked complete
        ↓
Course progress recalculated
        ↓
Dashboard updated
```

---

## Integration Checklist

Before merging:

- [ ] Progress is student-specific.
- [ ] Progress is course-specific.
- [ ] Weekly goal can be created and updated.
- [ ] Actual weekly learning time is recorded.
- [ ] Student can rewind video.
- [ ] Student cannot skip unwatched video sections.
- [ ] Video progress survives refresh/logout/login.
- [ ] Lesson completion updates course progress.
- [ ] API authorization prevents access to another student's tracking data.
- [ ] Existing authentication still works.
- [ ] Existing course/lesson functionality still works.

## Suggested Branch

```bash
git checkout main
git pull
git checkout -b feature/learning-progress-tracking
```

## Deliverable

A working student learning-tracking flow:

```text
Set Goal
   ↓
Watch Lessons
   ↓
Track Watch Time
   ↓
Complete Lessons
   ↓
Update Course Progress
   ↓
Compare Weekly Activity With Goal
```
