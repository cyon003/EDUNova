const { curriculumWrite } = require("../services/curriculumGuard");
const express = require("express");
const mongoose = require("mongoose");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const Course = require("../models/Course");
const Note = require("../models/Note");
const Enrollment = require("../models/Enrollment");

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole("student"));

async function resolveCourse(courseSlug) {
  if (!courseSlug) return null;
  return Course.findOne({ slug: String(courseSlug).toLowerCase() });
}

router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const filter = { student: req.user._id };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ title: new RegExp(escaped, "i") }, { body: new RegExp(escaped, "i") }, { lessonTitle: new RegExp(escaped, "i") }];
    }
    const notes = await Note.find(filter).populate("course", "name slug").sort({ updatedAt: -1 });
    return res.json(notes);
  } catch (error) {
    if (error.response || error.hasErrorLabel?.("TransientTransactionError")) throw error;
    return res.status(500).json({ message: "Unable to load notes", error: error.message });
  }
});

router.post("/", curriculumWrite(async (req, res) => {
  try {
    const sourceType = req.body.sourceType || "personal";
    if (!["personal", "saved_from_summary"].includes(sourceType)) return res.status(400).json({ message: "Invalid note source" });
    const course = await resolveCourse(req.body.courseSlug);
    if (req.body.courseSlug && !course) return res.status(404).json({ message: "Course not found" });
    const lessonIndex = Number.isInteger(req.body.lessonIndex) && req.body.lessonIndex >= 0 ? req.body.lessonIndex : null;
    const lesson = lessonIndex === null ? null : course?.lessons?.[lessonIndex];
    const lessonTitle = lesson?.title || String(req.body.lessonTitle || "").trim();
    let title = req.body.title?.trim(), body = req.body.body?.trim();
    if (sourceType === "saved_from_summary") {
      if (!lesson?.summary?.trim()) return res.status(400).json({ message: "This lesson has no summary to save" });
      if (!await Enrollment.exists({ student: req.user._id, course: course._id })) return res.status(403).json({ message: "Enroll in this course before saving its summary" });
      title = lesson.title.slice(0, 160);
      body = lesson.summary.trim();
    }
    if (!title || !body) return res.status(400).json({ message: "Title and note content are required" });
    if (lessonIndex !== null && !lessonTitle) return res.status(400).json({ message: "Lesson title is required" });
    // The curriculum transaction serializes saves for this course, including double clicks.
    let note = sourceType === "saved_from_summary" ? await Note.findOne({ student: req.user._id, course: course._id, lessonIndex, sourceType }) : null;
    if (!note) note = await Note.create({ student: req.user._id, course: course?._id || null, lessonIndex, lessonTitle, title, body, sourceType });
    await note.populate("course", "name slug");
    return res.status(201).json(note);
  } catch (error) {
    if (error.response || error.hasErrorLabel?.("TransientTransactionError")) throw error;
    return res.status(500).json({ message: "Unable to create note", error: error.message });
  }
}, req => req.body.courseSlug));

router.patch("/:noteId", curriculumWrite(async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.noteId)) return res.status(400).json({ message: "Invalid note" });
    const note = await Note.findOne({ _id: req.params.noteId, student: req.user._id });
    if (!note) return res.status(404).json({ message: "Note not found" });
    const title = req.body.title?.trim();
    const body = req.body.body?.trim();
    if (!title || !body) return res.status(400).json({ message: "Title and note content are required" });
    const course = await resolveCourse(req.body.courseSlug);
    if (req.body.courseSlug && !course) return res.status(404).json({ message: "Course not found" });
    const lessonIndex = Number.isInteger(req.body.lessonIndex) && req.body.lessonIndex >= 0 ? req.body.lessonIndex : null;
    const lesson = lessonIndex === null ? null : course?.lessons?.[lessonIndex];
    const lessonTitle = lesson?.title || String(req.body.lessonTitle || "").trim();
    if (lessonIndex !== null && !lessonTitle) return res.status(400).json({ message: "Lesson title is required" });
    note.title = title;
    note.body = body;
    note.course = course?._id || null;
    note.lessonIndex = lessonIndex;
    note.lessonTitle = lessonTitle;
    await note.save();
    await note.populate("course", "name slug");
    return res.json(note);
  } catch (error) {
    if (error.response || error.hasErrorLabel?.("TransientTransactionError")) throw error;
    return res.status(500).json({ message: "Unable to update note", error: error.message });
  }
}, req => req.body.courseSlug));

router.delete("/:noteId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.noteId)) return res.status(400).json({ message: "Invalid note" });
    const note = await Note.findOneAndDelete({ _id: req.params.noteId, student: req.user._id });
    if (!note) return res.status(404).json({ message: "Note not found" });
    return res.json({ message: "Note deleted" });
  } catch (error) {
    if (error.response || error.hasErrorLabel?.("TransientTransactionError")) throw error;
    return res.status(500).json({ message: "Unable to delete note", error: error.message });
  }
});

module.exports = router;
