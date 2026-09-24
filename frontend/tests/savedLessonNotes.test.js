import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/components/Summaries.jsx", import.meta.url), "utf8");
const body = source.slice(source.indexOf("  async function saveSummary()"), source.indexOf('  const summary ='));

test("summary save deduplicates clicks, sends lesson identity and retries after failure", async () => {
  let calls = 0, resolve, status, saving;
  const pending = { current: false };
  const fetch = (_url, options) => {
    calls++;
    assert.equal(options.headers["X-Course-Version"], "3");
    assert.deepEqual(JSON.parse(options.body), { sourceType: "saved_from_summary", courseSlug: "science", lessonIndex: 1 });
    return new Promise(done => { resolve = done; });
  };
  const save = new Function("fetch", "pending", "setSaving", "setStatus", "API_ROOT", "courseVersion", "courseSlug", "lessonIndex", "window", `${body}; return saveSummary;`)(fetch, pending, value => { saving = value; }, value => { status = value; }, "/api", 3, "science", 1, { dispatchEvent() {} });
  const first = save(); await save();
  assert.equal(calls, 1); assert.equal(saving, true);
  resolve({ ok: false, json: async () => ({ message: "Try again" }) }); await first;
  assert.equal(status, "Try again"); assert.equal(saving, false);
  const retry = save(); resolve({ ok: true, json: async () => ({ _id: "saved" }) }); await retry;
  assert.equal(calls, 2); assert.match(status, /Saved to Lesson Notes/);
});

test("notebook keeps persisted summaries separate and explains where they come from", async () => {
  const dashboard = await readFile(new URL("../src/pages/StudentDashboard.jsx", import.meta.url), "utf8");
  const player = await readFile(new URL("../src/pages/LessonPlayer.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /sourceType === "saved_from_summary"/);
  assert.match(dashboard, /sourceType !== "saved_from_summary"/);
  assert.match(dashboard, /Open a lesson, choose Summary/);
  assert.match(dashboard, /note\.lessonTitle/);
  assert.match(dashboard, /loadNotes\(\)/);
  assert.match(player, /item\.sourceType !== "saved_from_summary"/);
  assert.match(player, />Understood<\/button>/);
  assert.match(player, />Need Clarification<\/button>/);
  assert.match(player, /saveFeedback\("clear"\)/);
  assert.match(player, /saveFeedback\("confused"\)/);
  assert.match(player, /separate from the Predicted Confusion Level/);
});
