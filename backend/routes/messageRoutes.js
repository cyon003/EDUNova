const express = require("express");
const mongoose = require("mongoose");
const authenticateToken = require("../middleware/authMiddleware");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Message = require("../models/Message");

const router = express.Router();

router.use(authenticateToken);

function addContact(contactMap, user, course) {
  if (!user || !course) return;
  const userId = String(user._id);
  const existing = contactMap.get(userId) || {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    courses: [],
  };
  if (!existing.courses.some((item) => String(item._id) === String(course._id))) {
    existing.courses.push({ _id: course._id, name: course.name, slug: course.slug });
  }
  contactMap.set(userId, existing);
}

async function availableContacts(user) {
  const contactMap = new Map();

  if (user.role === "student") {
    const enrollments = await Enrollment.find({ student: user._id })
      .select("course")
      .populate({
        path: "course",
        select: "name slug tutor",
        populate: { path: "tutor", select: "name email role accountStatus" },
      })
      .lean();

    for (const enrollment of enrollments) {
      const course = enrollment.course;
      if (course?.tutor?.role === "tutor" && course.tutor.accountStatus === "approved") {
        addContact(contactMap, course.tutor, course);
      }
   }
  }

  if (user.role === "tutor") {
    const courses = await Course.find({ tutor: user._id }).select("name slug").lean();
    const coursesById = new Map(courses.map((course) => [String(course._id), course]));
    const enrollments = await Enrollment.find({ course: { $in: courses.map((course) => course._id) } })
      .select("student course")
      .populate("student", "name email role accountStatus")
      .lean();

    for (const enrollment of enrollments) {
      const course = coursesById.get(String(enrollment.course));
      if (enrollment.student?.role === "student" && enrollment.student.accountStatus === "approved") {
        addContact(contactMap, enrollment.student, course);
      }
    }
  }

  return [...contactMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function contactRelationship(user, contactId) {
  if (!mongoose.isValidObjectId(contactId) || String(user._id) === String(contactId)) return null;
  const contacts = await availableContacts(user);
  return contacts.find((contact) => String(contact._id) === String(contactId)) || null;
}

async function contactsWithMessageSummary(user) {
  const contacts = await availableContacts(user);
  return Promise.all(contacts.map(async (contact) => {
    const conversationFilter = {
      deletedAt: null,
      $or: [
        { sender: user._id, recipient: contact._id },
        { sender: contact._id, recipient: user._id },
      ],
    };
    const [lastMessage, unreadCount] = await Promise.all([
      Message.findOne(conversationFilter)
        .select("sender content read createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Message.countDocuments({
        sender: contact._id,
        recipient: user._id,
        read: false,
        deletedAt: null,
      }),
    ]);
    return { ...contact, lastMessage, unreadCount };
  }));
}

router.get("/contacts", async (req, res) => {
  try {
    if (!["student", "tutor"].includes(req.user.role)) return res.json([]);
    return res.json(await contactsWithMessageSummary(req.user));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load contacts", error: error.message });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    if (!["student", "tutor"].includes(req.user.role)) return res.json({ count: 0 });
    const count = await Message.countDocuments({
      recipient: req.user._id,
      read: false,
      deletedAt: null,
    });
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load unread message count", error: error.message });
  }
});

router.get("/:contactId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contactId)) return res.status(400).json({ message: "Invalid contact" });
    if (!["student", "tutor"].includes(req.user.role)) return res.status(403).json({ message: "Messaging is available only to students and tutors" });
    const contact = await contactRelationship(req.user, req.params.contactId);
    if (!contact) return res.status(403).json({ message: "You can message only people connected to your courses" });
    const readAt = new Date();
    await Message.updateMany(
      { sender: req.params.contactId, recipient: req.user._id, read: false, deletedAt: null },
      { $set: { read: true, readAt } }
    );
    const messages = await Message.find({
      deletedAt: null,
      $or: [
        { sender: req.user._id, recipient: req.params.contactId },
        { sender: req.params.contactId, recipient: req.user._id },
      ],
    }).sort({ createdAt: 1 }).limit(200);
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load messages", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!["student", "tutor"].includes(req.user.role)) return res.status(403).json({ message: "Messaging is available only to students and tutors" });
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    const recipientId = req.body.recipientId;
    if (!mongoose.isValidObjectId(recipientId)) return res.status(400).json({ message: "A valid recipient is required" });
    if (!content) return res.status(400).json({ message: "Message content is required" });
    if (content.length > 2000) return res.status(400).json({ message: "Message cannot exceed 2000 characters" });

    const contact = await contactRelationship(req.user, recipientId);
    if (!contact) return res.status(403).json({ message: "You can message only people connected to your courses" });

    const requestedCourseId = req.body.courseId;
    const course = requestedCourseId
      ? contact.courses.find((item) => String(item._id) === String(requestedCourseId))
      : contact.courses[0];
    if (!course) return res.status(403).json({ message: "This course conversation is unavailable" });

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      course: course._id,
      content,
    });
    return res.status(201).json(message);
  } catch (error) {
    return res.status(500).json({ message: "Unable to send message", error: error.message });
  }
});

router.patch("/:messageId/read", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json({ message: "Invalid message" });
    if (!["student", "tutor"].includes(req.user.role)) return res.status(403).json({ message: "Messaging is available only to students and tutors" });

    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.messageId,
        recipient: req.user._id,
        deletedAt: null,
      },
      { $set: { read: true, readAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!message) return res.status(404).json({ message: "Message not found" });
    return res.json(message);
  } catch (error) {
    return res.status(500).json({ message: "Unable to mark message as read", error: error.message });
  }
});

router.delete("/:messageId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json({ message: "Invalid message" });
    if (!["student", "tutor"].includes(req.user.role)) return res.status(403).json({ message: "Messaging is available only to students and tutors" });

    const deletedAt = new Date();
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.messageId,
        sender: req.user._id,
        deletedAt: null,
      },
      { $set: { deletedAt, deletedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (!message) return res.status(404).json({ message: "Message not found or you are not allowed to delete it" });
    return res.json({ message: "Message deleted", messageId: message._id, deletedAt });
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete message", error: error.message });
  }
});

module.exports = router;
