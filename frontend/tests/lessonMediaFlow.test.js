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

test("admin moderation preview can select and play protected lessons before approval", async () => {
  const preview = await source("src/pages/AdminCourses.jsx");
  assert.match(preview, /adm-moderation-classroom/);
  assert.match(preview, /lessons\/\$\{selected\}\/media-access/);
  assert.match(preview, /Authorization:`Bearer \$\{localStorage\.getItem\("token"\)\}`/);
  assert.match(preview, /<video[^]*controls preload="metadata"/);
  assert.match(preview, /Downloadable Resources/);
  assert.match(preview, /Lesson Summary/);
  assert.match(preview, /supportsLessonTranscript\(lesson\)/);
  assert.match(preview, /Reject[^]*Approve/);
  assert.doesNotMatch(preview, /<iframe/);
  assert.doesNotMatch(preview, /href=\{resource\.url\}/);
});

test("home course cards keep equal responsive dimensions with long names", async () => {
  const styles = await source("src/styles/Home.css");
  assert.match(styles, /\.content-courses[^]*grid-auto-rows: 1fr/);
  assert.match(styles, /\.course-card[^]*min-height: 390px/);
  assert.match(styles, /\.course-name[^]*-webkit-line-clamp: 2/);
  assert.match(styles, /@media \(max-width: 1100px\)[^]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 800px\)[^]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 600px\)[^]*grid-template-columns: 1fr/);
});

test("course catalog uses one dynamic section for popular, categories, and saved courses", async () => {
  const catalog = await source("src/pages/Courses.jsx");
  assert.match(catalog, /"Popular", "General Education", "Technology & Computing", "Business & Management", "Languages & Communication", "Other"/);
  assert.match(catalog, /sectionTitle = savedOnly \? "Saved Courses"[^]*"Popular Courses"/);
  assert.match(catalog, /setSavedOnly\(\(current\) => !current\); setCategory\("All"\)/);
  assert.match(catalog, /id="available"/);
  assert.doesNotMatch(catalog, /<select[^]*Sort courses/);
  assert.doesNotMatch(catalog, /popular-course-collection" id="popular"/);
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

test("course Edit scrolls the opened editor into view", async () => {
  const dashboard = await source("src/pages/TutorDashboard.jsx");
  assert.match(dashboard, /courseEditorRef=useRef\(null\)/);
  assert.match(dashboard, /scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
  assert.match(dashboard, /ref=\{editorRef\} className="panel form"/);
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
