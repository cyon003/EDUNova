import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canPreviewResource, getLessonPrimaryMedia, lessonReferences, supportingResources } from "../src/utils/lessonMedia.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("explicit and legacy uploaded media become primary while external links remain references", () => {
  const mp4 = { _id: "video", originalName: "lesson.mp4", mimeType: "video/mp4" };
  const pdf = { _id: "pdf", originalName: "guide.pdf", mimeType: "application/pdf" };
  assert.equal(getLessonPrimaryMedia({ primaryMedia: { storedName: "main.webm" }, resources: [mp4] }).storedName, "main.webm");
  assert.equal(getLessonPrimaryMedia({ resources: [pdf, mp4] }).resourceId, "video");
  assert.equal(getLessonPrimaryMedia({ videoUrl: "https://youtu.be/dQw4w9WgXcQ" }), null);
  assert.equal(getLessonPrimaryMedia({ primaryMediaRemoved: true, resources: [mp4] }), null);
  assert.equal(lessonReferences({ videoUrl: "https://youtu.be/dQw4w9WgXcQ" })[0].url, "https://youtu.be/dQw4w9WgXcQ");
  assert.deepEqual(supportingResources({ resources: [mp4, pdf] }).map((item) => item._id), ["pdf"]);
});

test("PDF, text and images support view while office formats remain download-only", () => {
  assert.equal(canPreviewResource({ originalName: "guide.pdf" }), true);
  assert.equal(canPreviewResource({ originalName: "notes.txt" }), true);
  assert.equal(canPreviewResource({ mimeType: "image/png" }), true);
  assert.equal(canPreviewResource({ originalName: "work.docx" }), false);
  assert.equal(canPreviewResource({ originalName: "data.xlsx" }), false);
});

test("student player uses authenticated backend media and never embeds references", async () => {
  const player = await source("src/pages/LessonPlayer.jsx");
  assert.match(player, /API_ROOT.*lessons\/\$\{lessonIndex\}\/media/);
  assert.match(player, /No lesson video has been uploaded\./);
  assert.match(player, /Downloadable Resources/);
  assert.match(player, /noopener noreferrer/);
  assert.doesNotMatch(player, /<iframe/);
  assert.doesNotMatch(player, /src=\{lesson\.videoUrl\}/);
});

test("Add Lesson uses an accessible modal and matching hidden-input upload cards", async () => {
  const manager = await source("src/components/LessonManager.jsx");
  const styles = await source("src/styles/TutorDashboard.css");
  assert.match(manager, /lesson-editor-heading/);
  assert.match(manager, /<FaPlus\/> New Lesson/);
  assert.match(manager, /role="dialog" aria-modal="true"/);
  assert.match(manager, /Upload lesson video/);
  assert.match(manager, /Upload documents/);
  assert.match(manager, /lesson-hidden-file/);
  assert.match(manager, /Discard unsaved lesson changes/);
  assert.match(manager, /setSelected\(Math\.max\(saved\.lessons\.length-1,0\)\)/);
  assert.doesNotMatch(manager, /<form className="form-grid lesson-builder" onSubmit=\{add\}/);
  assert.match(styles, /lesson-upload-grid\{display:grid;grid-template-columns:repeat\(2/);
  assert.match(styles, /@media\(max-width:700px\)\{\.lesson-upload-grid\{grid-template-columns:1fr\}/);
});

test("Edit Lesson header and bottom-right actions follow the requested layout", async () => {
  const manager = await source("src/components/LessonManager.jsx");
  const styles = await source("src/styles/TutorDashboard.css");
  assert.match(manager, /lesson-editor-heading wide[^]*<h2>Edit Lesson<\/h2>[^]*<FaPlus\/> New Lesson/);
  assert.match(manager, /References \(Optional\)[^]*lesson-editor-actions wide[^]*Cancel[^]*Save/);
  assert.match(styles, /lesson-editor-heading\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(styles, /lesson-editor-actions\{display:flex;justify-content:flex-end/);
  assert.match(manager, /<span>Title<\/span>/);
  assert.doesNotMatch(manager, /Lesson Title/);
  assert.match(manager, /setTimeout\(\(\)=>setToast\(""\),3000\)/);
});

test("pending publication can be cancelled by the tutor", async () => {
  const dashboard = await source("src/pages/TutorDashboard.jsx");
  assert.match(dashboard, /pending-actions[^]*disabled[^]*Pending[^]*pending-cancel[^]*act\(c,"unpublish"\)[^]*Cancel/);
  assert.doesNotMatch(dashboard, /Pending Admin Approval<\/button>/);
});

test("Edit Lesson preserves resources while replacing media and adding documents", async () => {
  const dashboard = await source("src/pages/TutorDashboard.jsx");
  const manager = await source("src/components/LessonManager.jsx");
  assert.match(dashboard, /main-media/);
  assert.match(dashboard, /lessonId\}\/resources/);
  assert.match(manager, /Replace lesson video/);
  assert.match(manager, /Add supporting documents/);
  assert.match(manager, /Existing supporting resources/);
  assert.match(manager, /View/);
  assert.match(manager, /Download/);
});
