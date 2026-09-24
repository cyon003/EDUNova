const mongoose = require("mongoose");
const Course = require("../models/Course");

// Mongoose propagates the session to every model operation inside connection
// transactions, including helpers and populate queries. Outside a transaction
// queries retain their normal behavior.
mongoose.set("transactionAsyncLocalStorage", true);
const staleMessage = "This course changed. Reload it before continuing; your unsaved work has not been submitted.";

function assertCourseVersion(req, course, required = true) {
  const supplied = req.get("X-Course-Version");
  if (!supplied && !required) return;
  if (supplied === undefined || !/^(0|[1-9]\d*)$/.test(supplied)) {
    throw Object.assign(new Error("Reload this course to obtain its current version."), { status: 428, code: "COURSE_VERSION_REQUIRED" });
  }
  if (Number(supplied) !== (course.__v || 0)) throw Object.assign(new Error(staleMessage), { status: 409, code: "COURSE_CHANGED" });
}

// Buffer the HTTP result until commit. The shared course write serializes these
// index-based student writes with lesson edits/deletions across server processes.
// Retried transactions re-read and revalidate the client's original revision.
function curriculumWrite(handler, courseSlug = req => req.params.slug) {
  return async (req, res) => {
    let result;
    try {
      await mongoose.connection.transaction(async () => {
        const slug = courseSlug(req);
        if (slug) {
          const course = await Course.findOne({ slug: String(slug).toLowerCase() });
          if (!course) throw Object.assign(new Error("Course not found"), { status: 404 });
          assertCourseVersion(req, course);
          await Course.updateOne({ _id: course._id }, { $inc: { enrollmentRevision: 1 } });
        }
        const buffered = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) {
          result = { status: this.statusCode, body };
          if (this.statusCode >= 400) throw Object.assign(new Error(body.message), { response: result });
          return this;
        } };
        await handler(req, buffered);
        if (result?.status >= 400) throw Object.assign(new Error(result.body.message), { response: result });
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      if (error.response) return res.status(error.response.status).json(error.response.body);
      return res.status(error.status || 503).json({ message: error.status ? error.message : "Unable to save safely. Please retry.", ...(error.code ? { code: error.code } : {}) });
    }
  };
}

module.exports = { assertCourseVersion, curriculumWrite };
