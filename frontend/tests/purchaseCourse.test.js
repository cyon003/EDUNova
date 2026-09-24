import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { purchaseCourseId, purchaseErrorMessage, COURSE_RELOAD_MESSAGE } from "../src/utils/purchaseCourse.js";

test("purchase identity uses only the database ID, never a slug or converted object", () => {
  const id = "507f1f77bcf86cd799439074";
  assert.equal(purchaseCourseId({_id:id,slug:"algorithm"}),id);
  for (const _id of [undefined, null, "algorithm", "undefined", {}, {buffer:{0:1}}, "123"]) assert.throws(()=>purchaseCourseId({_id}), {message:COURSE_RELOAD_MESSAGE});
});
test("ID validation failures become actionable messages while policy errors are preserved", () => {
  for(const message of ["Provide valid course IDs", "courseId is required", 'Cast to ObjectId failed for value']) assert.equal(purchaseErrorMessage(message),COURSE_RELOAD_MESSAGE);
  assert.equal(purchaseErrorMessage("You are already enrolled in this course"),"You are already enrolled in this course");
});
test("buy-now and cart send the validated ID; checkout passes order identity separately", async () => {
  const detail=await readFile(new URL("../src/pages/CourseDetail.jsx",import.meta.url),"utf8");
  const cartSection=detail.slice(detail.indexOf("const toggleCart"),detail.indexOf("const enrollCourse"));
  assert.match(cartSection,/const courseId = purchaseCourseId\(course\)/);
  assert.match(cartSection,/JSON.stringify\(\{\s*courseId,/);
  assert.match(detail,/courseId: purchaseCourseId\(course\)/);
  const checkout=await readFile(new URL("../src/pages/StripeCheckout.jsx",import.meta.url),"utf8");
  assert.match(checkout,/orders\/checkout", \{\}/);
  assert.match(checkout,/orderId: order\._id/);
  assert.match(checkout,/purchaseErrorMessage\(data.message/);
});
