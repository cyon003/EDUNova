import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy AI chatbot route redirects to the primary General AI Tutor route", async () => {
  const app = await source("src/App.jsx");
  assert.match(app, /path="\/ai-tutor"/);
  assert.match(app, /path="\/ai-chatbot" element={<Navigate to="\/ai-tutor" replace \/>}/);
});

test("AskAI page has no course mode controls or grounded source presentation", async () => {
  const page = await source("src/pages/AiChatbot.jsx");
  assert.doesNotMatch(page, /Course Assistant|assistant-mode-selector|assistant-course|assistant-lesson|courseId|lessonId|confidence|assistant-sources/);
  assert.match(page, /mode: "general"/);
  assert.match(page, /AskAI/);
});

test("Course Assistant lesson tab and active navigation are absent", async () => {
  const lesson = await source("src/pages/LessonPlayer.jsx");
  assert.doesNotMatch(lesson, /Course Assistant|activeTool==="assistant"/);
  for (const path of ["src/pages/Home.jsx", "src/pages/UserHome.jsx"]) {
    const page = await source(path);
    assert.doesNotMatch(page, /to="\/ai-chatbot"|AI Chatbot|Course Assistant/, path);
    assert.match(page, /AskAI/, path);
  }
});

test("order-success thumbnails use the configured API asset helper", async () => {
  const page = await source("src/pages/OrderSuccess.jsx");
  assert.match(page, /import \{ apiAssetUrl \} from "\.\.\/utils\/courseApi"/);
  assert.match(page, /src=\{apiAssetUrl\(item\.course\.thumbnail\)\}/);
  assert.doesNotMatch(page, /localhost:5050/);
});
