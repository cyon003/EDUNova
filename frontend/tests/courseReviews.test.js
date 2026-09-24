import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const source = await readFile(new URL("../src/components/CourseReviews.jsx", import.meta.url), "utf8");
const compiled = await transformWithOxc(source.slice(source.indexOf("export default function")).replace("export default ", ""), "reviews.jsx", { jsx: { runtime: "classic" } });
function render(user, enrolled, reviews = [], editing = false) {
  const values = [reviews, false, editing, 4, "", "", false, 0];
  const Component = new Function("React", "useState", "useEffect", "useRef", "API_ROOT", `${compiled.code}; return CourseReviews;`)(React, () => [values.shift(), () => {}], () => {}, () => ({current: false}), "/api");
  return renderToStaticMarkup(React.createElement(Component, { slug: "science", user, enrolled, onRatingChange() {} }));
}
test("only enrolled students see review controls; ownership determines edit/delete", () => {
  assert.match(render({ id: "one", role: "student" }, true), /Write a Review/);
  assert.doesNotMatch(render({ id: "one", role: "student" }, false), /Write a Review/);
  assert.doesNotMatch(render({ id: "one", role: "tutor" }, true), /Write a Review/);
  const review = { student: "one", name: "Student", rating: 4, comment: "<script>unsafe</script>" };
  const own = render({ id: "one", role: "student" }, true, [review]);
  assert.match(own, /Edit your review/); assert.match(own, /Delete your review/);
  assert.match(own, /&lt;script&gt;/);
  assert.doesNotMatch(render({ id: "two", role: "student" }, true, [review]), /Delete your review/);
});
test("editor offers five accessible ratings and optional bounded comments", () => {
  const html = render({id: "one", role: "student"}, true, [], true);
  for (let stars = 1; stars <= 5; stars++) assert.match(html, new RegExp(`aria-label="${stars} star`));
  assert.match(html, /Comment \(optional\)/); assert.match(html, /maxLength="2000"/i);
});
test("review saves lock duplicate submissions, retain failed drafts and refresh totals", async () => {
  const body = source.slice(source.indexOf("  async function save("), source.indexOf('  return <section'));
  let resolve, calls = 0, error, editing = true, totals, reload = 0;
  const save = new Function("pending", "setBusy", "setError", "fetch", "API_ROOT", "slug", "rating", "comment", "onRatingChange", "setEditing", "setReload", "setLoading", `${body}; return save;`)({current:false}, () => {}, value => {error=value;}, (_url, options) => {calls++; assert.equal(options.method, "PUT"); assert.deepEqual(JSON.parse(options.body), {rating:4,comment:"Helpful"}); return new Promise(done => {resolve=done;});}, "/api", "science", 4, "Helpful", value => {totals=value;}, value => {editing=value;}, fn => {reload=fn(reload);}, () => {});
  const first = save(); await save(); assert.equal(calls, 1);
  resolve({ok:false,json:async()=>({message:"Try again"})}); await first;
  assert.equal(error,"Try again"); assert.equal(editing,true);
  const retry=save(); resolve({ok:true,json:async()=>({rating:4,reviewCount:1})}); await retry;
  assert.equal(editing,false); assert.deepEqual(totals,{rating:4,reviewCount:1}); assert.equal(reload,1);
});
