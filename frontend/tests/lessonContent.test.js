import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { supportsLessonTranscript } from "../src/utils/lessonMedia.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("student lesson summary and transcript use persisted lesson fields", async () => {
  const components = await source("src/components/Summaries.jsx");
  assert.match(components, /lesson\?\.summary/);
  assert.match(components, /lesson\?\.transcript/);
  assert.match(components, /Provided by the course tutor\./);
  assert.doesNotMatch(components, /localStorage|mock|Gemini|TF-IDF|fetch\(/i);
});

test("transcript tab is limited to supported media and missing transcripts are clear", async () => {
  assert.equal(supportsLessonTranscript({ videoUrl: "https://youtu.be/dQw4w9WgXcQ", transcript: "Tutor text" }), false);
  assert.equal(supportsLessonTranscript({ videoUrl: "https://example.com/video.mp4", transcript: "Tutor text" }), false);
  assert.equal(supportsLessonTranscript({ resources: [{ mimeType: "audio/mpeg" }], transcript: "Tutor text" }), true);
  assert.equal(supportsLessonTranscript({ resources: [{ mimeType: "audio/mpeg" }], transcript: "" }), false);
  assert.equal(supportsLessonTranscript({ resources: [{ mimeType: "application/pdf" }] }), false);
  assert.equal(supportsLessonTranscript({ videoUrl: "https://docs.google.com/forms/d/e/example/viewform" }), false);
  const player = await source("src/pages/LessonPlayer.jsx");
  const components = await source("src/components/Summaries.jsx");
  assert.match(player, /transcriptSupported\?\[\["transcript","Transcript"\]\]:\[\]/);
  assert.match(components, /A transcript has not been provided for this lesson\./);
});

test("tutor create and edit forms submit summary and transcript with limits", async () => {
  const dashboard = await source("src/pages/TutorDashboard.jsx");
  const manager = await source("src/components/LessonManager.jsx");
  assert.match(dashboard, /body\.append\("summary",lessonForm\.summary\)/);
  assert.match(dashboard, /body\.append\("transcript",lessonForm\.transcript\)/);
  assert.match(manager, /Summary \(Optional\)/);
  assert.match(manager, /Transcript \(Optional\)/);
  assert.match(manager, /maxLength="5000"/);
  assert.match(manager, /maxLength="50000"/);
  assert.match(dashboard, /method:"PATCH"/);
});

test("mock summary storage is removed and Personal Notes remains available", async () => {
  const player = await source("src/pages/LessonPlayer.jsx");
  const dashboard = await source("src/pages/StudentDashboard.jsx");
  assert.match(player, /Personal Notes/);
  assert.match(player, /Dashboard → Notes/);
  assert.doesNotMatch(dashboard, /const summarizedNotes/);
  await assert.rejects(source("src/utils/summaryService.js"));
});
