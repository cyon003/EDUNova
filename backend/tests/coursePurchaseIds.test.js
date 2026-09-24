const test = require("node:test");
const assert = require("node:assert/strict");
const Course = require("../models/Course");
const { restrictCourseContent } = require("../utils/courseAccess");

test("restricted course detail preserves database IDs through JSON and content filtering", () => {
  const course = new Course({ name: "Algorithm", slug: "algorithm", rating: 0, lessons: [{ title: "One" }, { title: "Two", videoUrl: "private", resources: [] }] });
  for (const input of [course, course.toJSON(), JSON.parse(JSON.stringify(course))]) {
    const response = JSON.parse(JSON.stringify(restrictCourseContent(input)));
    assert.equal(response._id, String(course._id));
    assert.match(response._id, /^[a-f\d]{24}$/i);
    assert.equal(response.lessons[1]._id, String(course.lessons[1]._id));
    assert.equal(response.lessons[1].videoUrl, "");
    assert.deepEqual(response.lessons[1].resources, []);
  }
  assert.equal(course.lessons[1].videoUrl, "private");
});
