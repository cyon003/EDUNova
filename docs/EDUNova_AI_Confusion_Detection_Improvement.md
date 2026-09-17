# EDUNova AI Confusion Detection Improvement

## Feature
**Lesson-Level Confusion Hotspots + Real-Time "Confused? Ask AI" Recommendation**

## Objective

Improve the existing EDUNova confusion detection system so that it can:

1. Detect when a student may be confused while watching a lesson.
2. Record the exact part of the lesson where the confusion happened.
3. Prompt the student with **"Confused? Ask AI"** when appropriate.
4. Give the AI enough lesson context to help with that specific section.
5. Aggregate confusion events from multiple students.
6. Show tutors which specific parts of their lessons may need improvement.

---

# 1. Keep Existing Random Forest Confusion Model

The existing Random Forest remains responsible for predicting whether student behavior indicates possible confusion.

Do not replace the model initially.

The main improvement is to connect each prediction with:

- Student
- Course
- Lesson
- Current video timestamp
- Behavioral signals
- Confusion probability
- Detection time

Example:

```json
{
  "studentId": "student123",
  "courseId": "course123",
  "lessonId": "lesson5",
  "videoTimestamp": 527,
  "confusionProbability": 0.84,
  "isConfused": true
}
```

`527 seconds = 08:47`

---

# 2. Collect Video Interaction Signals

Track useful interaction signals while the student watches the lesson.

Possible signals include:

- Current video timestamp
- Pause duration
- Number of pauses in a recent window
- Rewind count
- Repeated viewing of the same section
- Playback activity
- Time spent around the current lesson section

These signals can be used by the existing confusion detection pipeline where appropriate.

## Important

A long pause alone must **not automatically mean the student is confused**.

The student may:

- Leave the computer
- Take notes
- Receive a phone call
- Pause intentionally

Use multiple signals and/or the Random Forest prediction before triggering a recommendation.

---

# 3. Detect Possible Real-Time Confusion

Example behavior:

```text
Student watches video
        ↓
Pauses for an unusual amount of time
        ↓
Has also replayed/rewound the section
        ↓
Behavioral features sent to confusion service
        ↓
Random Forest
        ↓
High confusion probability
```

The system can then create a confusion event.

Example:

```text
Lesson: Recursion
Timestamp: 08:47
Pause duration: 25 seconds
Recent rewinds: 2
Confusion probability: 84%
```

Thresholds should be configurable and validated during testing rather than treated as universal facts.

---

# 4. Show "Confused? Ask AI" Recommendation

When the system has sufficient evidence of possible confusion, display a small non-blocking recommendation.

Example:

```text
┌─────────────────────────────────────┐
│ Having trouble with this part?      │
│                                     │
│ Ask AI for help with this section.  │
│                                     │
│ [ Ask AI ]            [ Dismiss ]   │
└─────────────────────────────────────┘
```

Alternative short UI:

```text
Confused? Ask AI ✨
```

## Requirements

- Do not automatically open the chatbot.
- Student decides whether to use it.
- Include a Dismiss option.
- Do not repeatedly show the popup every few seconds.
- Add a cooldown after dismissal.
- Avoid interrupting normal video watching.
- Trigger only when the confusion criteria are met.

---

# 5. Pass Lesson Context to Ask AI

If the student clicks **Ask AI**, the chatbot should know:

- Course
- Lesson
- Current video timestamp
- Relevant lesson section/topic, if available
- Nearby transcript/content, if available

Example context:

```text
Course: Programming Fundamentals
Lesson: Recursion
Video position: 08:47
Current section: Recursive Base Cases
```

The student should not need to explain where they are in the lesson manually.

Example:

```text
Student clicks:

"Ask AI"

AI:
"It looks like you're around the section explaining
recursive base cases. What part would you like me to
explain?"
```

The AI should assist rather than claim that the student is definitely confused.

---

# 6. Store Confusion Events

Create or extend the confusion-event data structure.

Suggested fields:

```text
studentId
courseId
lessonId
videoTimestamp

confusionProbability
isConfused

pauseDuration
rewindCount
replayCount

aiRecommendationShown
aiRecommendationClicked
aiRecommendationDismissed

detectedAt
```

Only store behavioral fields that EDUNova actually uses and has a clear reason to retain.

---

# 7. Group Confusion by Video Section

Individual predictions should be aggregated into time windows.

Example window size:

```text
30 seconds
or
60 seconds
```

Example:

```text
Lesson 5

00:00–01:00     Low
01:00–02:00     Low
02:00–03:00     Low
...
08:00–09:00     HIGH
09:00–10:00     HIGH
10:00–11:00     Low
```

Possible hotspot metrics:

- Number of students with confusion events
- Percentage of active students affected
- Average confusion probability
- Pause frequency
- Rewind/replay frequency

Require a reasonable minimum number of observations/students before labeling a section as a class-wide hotspot.

---

# 8. Tutor Confusion Hotspot Dashboard

Tutors should see where students appear to struggle instead of only receiving one overall lesson confusion score.

Example:

```text
Lesson 5 — Recursion

00:00 ───────────────────────────── 15:00

🟢 🟢 🟢 🟢 🟡 🟡 🔴 🔴 🔴 🟡 🟢 🟢
                    ↑
               08:00–10:00

Potential Confusion Hotspot

Students affected: 12 / 18
Average model probability: 76%

Topic:
Recursive Base Cases
```

## Tutor Requirements

Tutor should be able to:

- View confusion hotspots for each lesson.
- See the relevant video time range.
- See aggregated statistics.
- Click a hotspot to jump to that video position.
- Use the information to decide whether the lesson section should be clarified or improved.

Avoid presenting the model output as proof that a section is objectively bad. It is an indicator for the tutor.

---

# 9. Optional: Timestamped Transcript

After the basic hotspot system works, add timestamped transcription.

Example:

```text
[08:10–08:35]
"Now we need to define the base case..."

[08:35–09:20]
"The base case determines when recursion stops..."
```

This allows EDUNova to map:

```text
Confusion hotspot
08:00–10:00
        ↓
Transcript timestamps
        ↓
Topic:
Recursive Base Cases
```

Then the tutor dashboard can show:

```text
Potential high-confusion section:
08:00–10:00

Topic:
Recursive Base Cases
```

---

# 10. Complete Student Workflow

```text
Student opens lesson
        ↓
Watches video
        ↓
EDUNova tracks video interaction
        ↓
Pause / rewind / replay behavior occurs
        ↓
Behavioral features evaluated
        ↓
Random Forest predicts possible confusion
        ↓
Confusion event saved with video timestamp
        ↓
"Confused? Ask AI" shown
        ↓
      Student Choice
       /          \
   Ask AI        Dismiss
      ↓
AI receives lesson +
timestamp context
      ↓
AI helps with that section
```

---

# 11. Complete Tutor Workflow

```text
Many students watch lesson
        ↓
Confusion events collected
        ↓
Events grouped by lesson + timestamp
        ↓
Confusion hotspots calculated
        ↓
Tutor Dashboard
        ↓
Tutor sees:

Lesson 5
08:00–10:00
Potential High Confusion
Topic: Recursive Base Cases
        ↓
Tutor reviews/improves lesson section
```

---

# 12. System Architecture

```text
                  STUDENT
                     |
                Video Player
                     |
        +------------+-------------+
        |                          |
        v                          v
Interaction Signals         Video Timestamp
        |
        v
Confusion Feature Data
        |
        v
Existing Random Forest
        |
        v
Confusion Probability
        |
        +--------------------------+
                     |
                     v
              Confusion Event
                     |
                     v
                   MongoDB
                  /       \
                 /         \
                v           v
       Student Prompt    Aggregation
      "Confused? Ask AI"     |
                |            v
                v      Confusion Hotspots
             Ask AI          |
                             v
                      Tutor Dashboard
```

---

# 13. Acceptance Criteria

## Confusion Detection

- [ ] Existing Random Forest remains integrated.
- [ ] Confusion predictions are associated with course and lesson.
- [ ] Current video timestamp is recorded with relevant confusion events.
- [ ] Pause/rewind/replay signals are available where required.
- [ ] A long pause alone does not automatically classify confusion.

## Student Recommendation

- [ ] System can show a "Confused? Ask AI" recommendation.
- [ ] Recommendation appears only when configured confusion criteria are met.
- [ ] Student can dismiss it.
- [ ] Popup has a cooldown to prevent spam.
- [ ] Student chooses whether to open Ask AI.
- [ ] Ask AI receives the current lesson/timestamp context.

## Confusion Hotspots

- [ ] Confusion events are grouped by lesson and time range.
- [ ] Multiple students' events can be aggregated.
- [ ] Hotspot calculations use documented thresholds/minimum samples.
- [ ] Tutor can see specific confusing video sections.
- [ ] Tutor can see how many students were affected.
- [ ] Tutor can jump to the relevant video timestamp.

## Security & Privacy

- [ ] Students cannot access another student's raw confusion records.
- [ ] Tutor only sees data for authorized courses.
- [ ] Tutor dashboard favors aggregated data rather than unnecessary individual-level behavioral details.
- [ ] APIs verify authenticated user and role.
- [ ] Stored behavioral data is limited to what the feature needs.

## Regression

- [ ] Existing confusion detection still works.
- [ ] Existing Ask AI functionality still works.
- [ ] Existing video player still works.
- [ ] Existing course/lesson functionality still works.

---

# 14. Recommended Implementation Order

```text
1. Add lesson + video timestamp to confusion events
                  ↓
2. Connect video interaction signals
                  ↓
3. Trigger real-time confusion evaluation
                  ↓
4. Add "Confused? Ask AI" recommendation
                  ↓
5. Pass lesson/timestamp context to Ask AI
                  ↓
6. Aggregate confusion events by time window
                  ↓
7. Build tutor confusion hotspot dashboard
                  ↓
8. Add transcript/topic mapping (optional enhancement)
```

---

# Final Target

EDUNova should move from:

```text
"Students are confused in Lesson 5."
```

to:

```text
"Students showed elevated confusion signals around
08:00–10:00 of Lesson 5, during the Recursive Base
Cases section."
```

At the same time, an individual student who appears to struggle around that section can receive:

```text
"Confused? Ask AI"
```

so EDUNova supports both:

- **Students immediately**, through contextual AI assistance.
- **Tutors over time**, through aggregated lesson-improvement insights.
