const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Note = require("../models/Note");
const Report = require("../models/Report");
const Announcement = require("../models/Announcement");
const PlatformSetting = require("../models/PlatformSetting");
const AdminAudit = require("../models/AdminAudit");
const TutorApplication = require("../models/TutorApplication");
const Notification = require("../models/Notification");
const authenticateToken = require(
  "../middleware/authMiddleware"
);
const requireRole = require(
  "../middleware/roleMiddleware"
);

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole("admin"));

const recordAudit = (admin, action, detail) => AdminAudit.create({ admin, action, detail });

router.get("/tutors", async (req, res) => {
  try {
    const tutors = await User.find({
      role: "tutor",
    })
      .select("-password")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(tutors);
  } catch (error) {
    console.error("Get tutors error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/tutor-applications", async (req, res) => {
  try {
    const applications = await TutorApplication.find()
      .populate("applicant", "name email accountStatus tutorVerificationStatus createdAt")
      .populate("reviewedBy", "name email")
      .sort({ submittedAt: -1, updatedAt: -1 });
    return res.json(applications);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load tutor applications", error: error.message });
  }
});

router.patch("/tutor-applications/:applicationId/review", async (req, res) => {
  try {
    const { status, reason = "" } = req.body;
    if (!["APPROVED", "MORE_INFORMATION_NEEDED", "REJECTED"].includes(status)) return res.status(400).json({ message: "Invalid application decision" });
    if (["MORE_INFORMATION_NEEDED", "REJECTED"].includes(status) && !reason.trim()) return res.status(400).json({ message: "A reason is required for this decision" });
    const application = await TutorApplication.findById(req.params.applicationId);
    if (!application) return res.status(404).json({ message: "Tutor application not found" });
    application.status = status;
    application.decisionReason = reason.trim();
    application.reviewedAt = new Date();
    application.reviewedBy = req.user._id;
    await application.save();
    if (application.applicant) {
      const userUpdate = { tutorVerificationStatus: status };
      if (status === "APPROVED") {
        userUpdate.role = "tutor";
        userUpdate.accountStatus = "approved";
      }
      await User.findByIdAndUpdate(application.applicant, userUpdate);
    }
    await recordAudit(req.user._id, `Tutor application ${status.toLowerCase().replaceAll("_", " ")}`, application.fullName);
    await application.populate("applicant", "name email accountStatus tutorVerificationStatus createdAt");
    await application.populate("reviewedBy", "name email");
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ message: "Unable to review tutor application", error: error.message });
  }
});

router.post("/tutor-applications/:applicationId/feedback", async (req, res) => {
  try {
    const feedback = req.body.feedback?.trim();
    if (!feedback) return res.status(400).json({ message: "Feedback is required" });
    const application = await TutorApplication.findById(req.params.applicationId);
    if (!application) return res.status(404).json({ message: "Tutor application not found" });
    application.decisionReason = feedback;
    application.status = "MORE_INFORMATION_NEEDED";
    application.reviewedAt = new Date();
    application.reviewedBy = req.user._id;
    await application.save();
    await recordAudit(req.user._id, "Saved tutor application feedback", `${application.fullName} (${application.email})`);
    await application.populate("applicant", "name email accountStatus tutorVerificationStatus createdAt");
    await application.populate("reviewedBy", "name email");
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ message: "Unable to save application feedback", error: error.message });
  }
});

router.post("/tutors", async (req, res) => {
  try {
    const { name, email, temporaryPassword } = req.body;

    if (!name || !email || !temporaryPassword) {
      return res.status(400).json({
        message:
          "Tutor name, email and temporary password are required",
      });
    }

    if (temporaryPassword.length < 6) {
      return res.status(400).json({
        message:
          "Temporary password must contain at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "This email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      10
    );

    const tutor = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "tutor",
      accountStatus: "approved",
      tutorVerificationStatus: "APPROVED",
      createdBy: req.user._id,
    });

    await recordAudit(req.user._id, "Created tutor", `${tutor.name} (${tutor.email})`);

    return res.status(201).json({
      message:
        "Tutor account created successfully. Give the temporary password to the tutor.",
      tutor: {
        id: tutor._id,
        name: tutor.name,
        email: tutor.email,
        role: tutor.role,
        accountStatus: tutor.accountStatus,
      },
    });
  } catch (error) {
    console.error("Create tutor error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/tutors/:tutorId", async (req, res) => {
  try {
    const { name, email } = req.body;

    const tutor = await User.findOne({
      _id: req.params.tutorId,
      role: "tutor",
    });

    if (!tutor) {
      return res.status(404).json({
        message: "Tutor not found",
      });
    }

    if (name) {
      tutor.name = name.trim();
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();

      const emailOwner = await User.findOne({
        email: normalizedEmail,
        _id: {
          $ne: tutor._id,
        },
      });

      if (emailOwner) {
        return res.status(400).json({
          message: "This email is already registered",
        });
      }

      tutor.email = normalizedEmail;
    }

    await tutor.save();

    await recordAudit(req.user._id, "Updated tutor", `${tutor.name} (${tutor.email})`);

    return res.status(200).json({
      message: "Tutor account updated successfully",
      tutor: {
        id: tutor._id,
        name: tutor.name,
        email: tutor.email,
        role: tutor.role,
        accountStatus: tutor.accountStatus,
      },
    });
  } catch (error) {
    console.error("Update tutor error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch(
  "/tutors/:tutorId/reset-password",
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          message:
            "New password must contain at least 6 characters",
        });
      }

      const tutor = await User.findOne({
        _id: req.params.tutorId,
        role: "tutor",
      });

      if (!tutor) {
        return res.status(404).json({
          message: "Tutor not found",
        });
      }

      tutor.password = await bcrypt.hash(newPassword, 10);

      await tutor.save();

      await recordAudit(req.user._id, "Reset tutor password", `${tutor.name} (${tutor.email})`);

      return res.status(200).json({
        message: "Tutor password reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

router.patch(
  "/tutors/:tutorId/suspend",
  async (req, res) => {
    try {
      const tutor = await User.findOneAndUpdate(
        {
          _id: req.params.tutorId,
          role: "tutor",
        },
        {
          accountStatus: "suspended",
        },
        {
          new: true,
        }
      ).select("-password");

      if (!tutor) {
        return res.status(404).json({
          message: "Tutor not found",
        });
      }

      await recordAudit(req.user._id, "Suspended tutor", `${tutor.name} (${tutor.email})`);

      return res.status(200).json({
        message: "Tutor account suspended",
        tutor,
      });
    } catch (error) {
      console.error("Suspend tutor error:", error);

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

router.patch(
  "/tutors/:tutorId/activate",
  async (req, res) => {
    try {
      const tutor = await User.findOneAndUpdate(
        {
          _id: req.params.tutorId,
          role: "tutor",
        },
        {
          accountStatus: "approved",
        },
        {
          new: true,
        }
      ).select("-password");

      if (!tutor) {
        return res.status(404).json({
          message: "Tutor not found",
        });
      }

      await recordAudit(req.user._id, "Reactivated tutor", `${tutor.name} (${tutor.email})`);

      return res.status(200).json({
        message: "Tutor account activated",
        tutor,
      });
    } catch (error) {
      console.error("Activate tutor error:", error);

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

router.delete("/tutors/:tutorId", async (req, res) => {
  try {
    const tutor = await User.findOne({
      _id: req.params.tutorId,
      role: "tutor",
      accountStatus: "suspended",
    });
    if (!tutor) return res.status(404).json({ message: "Only suspended tutor accounts can be removed" });

    await Course.updateMany({ tutor: tutor._id }, { $set: { tutor: null } });
    await Report.updateMany({ reporter: tutor._id }, { $set: { reporter: null } });
    await recordAudit(req.user._id, "Removed suspended tutor", `${tutor.name} (${tutor.email})`);
    await tutor.deleteOne();
    return res.json({ message: "Tutor account removed permanently" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to remove tutor", error: error.message });
  }
});

router.get("/students", async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).select("-password").sort({ createdAt: -1 }).lean();
    const enrollmentStats = await Enrollment.aggregate([{ $group: { _id: "$student", enrolled: { $sum: 1 }, completedLessons: { $sum: { $size: "$completedLessons" } }, lastActive: { $max: "$lastAccessedAt" } } }]);
    const stats = new Map(enrollmentStats.map((item) => [String(item._id), item]));
    return res.json(students.map((student) => ({ ...student, enrollmentStats: stats.get(String(student._id)) || { enrolled: 0, completedLessons: 0, lastActive: student.updatedAt } })));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load students", error: error.message });
  }
});

router.patch("/students/:studentId/status", async (req, res) => {
  try {
    const accountStatus = req.body.accountStatus;
    if (!["approved", "suspended"].includes(accountStatus)) return res.status(400).json({ message: "Invalid account status" });
    const student = await User.findOneAndUpdate({ _id: req.params.studentId, role: "student" }, { accountStatus }, { new: true }).select("-password");
    if (!student) return res.status(404).json({ message: "Student not found" });
    await recordAudit(req.user._id, `${accountStatus === "suspended" ? "Suspended" : "Reactivated"} student`, `${student.name} (${student.email})`);
    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update student", error: error.message });
  }
});

router.patch("/students/:studentId/reset-password", async (req, res) => {
  try {
    const newPassword = req.body.newPassword;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters" });
    const student = await User.findOne({ _id: req.params.studentId, role: "student" });
    if (!student) return res.status(404).json({ message: "Student not found" });
    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();
    await recordAudit(req.user._id, "Reset student password", `${student.name} (${student.email})`);
    return res.json({ message: "Student password reset" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to reset password", error: error.message });
  }
});

router.delete("/students/:studentId", async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.studentId,
      role: "student",
      accountStatus: "suspended",
    });
    if (!student) return res.status(404).json({ message: "Only suspended student accounts can be removed" });

    await Enrollment.deleteMany({ student: student._id });
    await Note.deleteMany({ student: student._id });
    await Report.updateMany({ reporter: student._id }, { $set: { reporter: null } });
    await recordAudit(req.user._id, "Removed suspended student", `${student.name} (${student.email})`);
    await student.deleteOne();
    return res.json({ message: "Student account and learning data removed permanently" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to remove student", error: error.message });
  }
});

router.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find().populate("tutor", "name email accountStatus tutorVerificationStatus").sort({ updatedAt: -1 }).lean();
    const counts = await Enrollment.aggregate([{ $group: { _id: "$course", students: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.students]));
    return res.json(courses.map((course) => ({
      ...course,
      moderationStatus: course.moderationStatus || "unpublished",
      students: countMap.get(String(course._id)) || 0,
    })));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load courses", error: error.message });
  }
});

router.patch("/courses/:courseId/moderation", async (req, res) => {
  try {
    const moderationStatus = req.body.moderationStatus;
    if (!["published", "rejected"].includes(moderationStatus)) return res.status(400).json({ message: "Admins can only approve or reject courses" });
    const existingCourse = await Course.findById(req.params.courseId);
    if (!existingCourse) return res.status(404).json({ message: "Course not found" });
    if (existingCourse.moderationStatus !== "pending") return res.status(409).json({ message: "Only pending courses can be approved or rejected" });
    if (moderationStatus === "rejected") {
      const feedback = String(req.body.feedback || "").trim();
      if (!feedback) return res.status(400).json({ message: "Rejection feedback is required" });
      existingCourse.moderationStatus = "rejected";
      existingCourse.reviewFeedback = feedback;
      existingCourse.reviewedAt = new Date();
      await existingCourse.save();
      await Notification.create({ user: existingCourse.tutor, course: existingCourse._id, source: "ADMIN", title: "Course Rejected", message: `Your course \"${existingCourse.name}\" was not approved. Reason: ${feedback}` });
      await recordAudit(req.user._id, "Course rejected", existingCourse.name);
      return res.json(await existingCourse.populate("tutor", "name email accountStatus tutorVerificationStatus"));
    }
    const lessonsAreComplete = existingCourse.lessons.length > 0 && existingCourse.lessons.every((lesson) => lesson.title?.trim() && (lesson.videoUrl?.trim() || lesson.resources?.length));
    if (!existingCourse.name?.trim() || !existingCourse.description?.trim() || !existingCourse.category?.trim() || !existingCourse.tutor || !lessonsAreComplete) {
      return res.status(400).json({ message: "Assign a tutor and complete all required course and lesson information before approval" });
    }
    const assignedTutor = await User.findOne({ _id: existingCourse.tutor, role: "tutor" }).select("tutorVerificationStatus accountStatus");
    if (!assignedTutor || assignedTutor.accountStatus !== "approved" || assignedTutor.tutorVerificationStatus !== "APPROVED") {
      return res.status(403).json({ message: "Only courses assigned to an active verified tutor can be approved" });
    }
    existingCourse.moderationStatus = moderationStatus;
    existingCourse.reviewFeedback = "";
    existingCourse.reviewedAt = new Date();
    await existingCourse.save();
    const course = await existingCourse.populate("tutor", "name email accountStatus tutorVerificationStatus");
    if (!course) return res.status(404).json({ message: "Course not found" });
    await recordAudit(req.user._id, `Course ${moderationStatus}`, course.name);
    await Notification.create({ user: existingCourse.tutor, course: existingCourse._id, source: "ADMIN", title: "Course Approved", message: `Your course \"${existingCourse.name}\" has been approved and is now visible to students.` });
    return res.json(course);
  } catch (error) {
    return res.status(500).json({ message: "Unable to moderate course", error: error.message });
  }
});

router.delete("/courses/:courseId", async (req,res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    await Promise.all([Enrollment.deleteMany({ course: course._id }), Note.deleteMany({ course: course._id }), Notification.deleteMany({ course: course._id })]);
    await recordAudit(req.user._id, "Deleted course", course.name);
    await course.deleteOne();
    return res.json({ message: "Course deleted permanently" });
  } catch (error) { return res.status(500).json({ message: "Unable to delete course", error: error.message }); }
});

router.patch("/courses/:courseId", async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.category === "string" && req.body.category.trim()) update.category = req.body.category.trim();
    if (req.body.tutorId === null || req.body.tutorId) update.tutor = req.body.tutorId || null;
    if (Object.hasOwn(req.body, "price")) {
      if (req.body.price === "" || req.body.price === null || typeof req.body.price === "boolean") {
        return res.status(400).json({ message: "Price must be a number of 0 or more" });
      }
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ message: "Price must be a number of 0 or more" });
      }
      update.price = price;
    }
    if (!Object.keys(update).length) return res.status(400).json({ message: "No valid course changes were provided" });
    const course = await Course.findByIdAndUpdate(req.params.courseId, update, { new: true, runValidators: true }).populate("tutor", "name email accountStatus tutorVerificationStatus");
    if (!course) return res.status(404).json({ message: "Course not found" });
    await recordAudit(req.user._id, "Updated course", course.name);
    return res.json(course);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update course", error: error.message });
  }
});

router.get("/overview", async (req, res) => {
  try {
    const [students, tutors, courses, enrollments, suspended, recentUsers, pendingReports, pendingCourses] = await Promise.all([
      User.countDocuments({ role: "student" }), User.countDocuments({ role: "tutor" }), Course.countDocuments(), Enrollment.find().populate("course", "lessons").lean(), User.countDocuments({ accountStatus: "suspended" }), User.find({ role: { $in: ["student", "tutor"] } }).select("name email role accountStatus createdAt").sort({ createdAt: -1 }).limit(100).lean(), Report.countDocuments({ status: "pending" }), Course.countDocuments({ moderationStatus: "pending" }),
    ]);
    const completedCourses = enrollments.filter((item) => item.course?.lessons?.length && item.completedLessons.length >= item.course.lessons.length).length;
    const totalStudySeconds = enrollments.reduce((total, item) => total + (item.studySeconds || 0), 0);
    return res.json({ students, tutors, courses, enrollments: enrollments.length, completedCourses, totalStudySeconds, suspended, pendingReports, pendingCourses, recentUsers });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load analytics", error: error.message });
  }
});

router.get("/reports", async (req, res) => {
  try {
    return res.json(await Report.find().populate("course", "name slug").populate("reporter", "name email").populate("targetUser", "name email role").sort({ createdAt: -1 }));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load reports", error: error.message });
  }
});

router.patch("/reports/:reportId", async (req, res) => {
  try {
    if (!["resolved", "dismissed", "reviewing", "pending"].includes(req.body.status)) return res.status(400).json({ message: "Invalid report status" });
    if (req.body.priority && !["low", "medium", "high", "urgent"].includes(req.body.priority)) return res.status(400).json({ message: "Invalid report priority" });
    const update = { status: req.body.status, reviewedBy: req.user._id };
    if (req.body.priority) update.priority = req.body.priority;
    if (typeof req.body.adminNote === "string") update.adminNote = req.body.adminNote.trim();
    const report = await Report.findByIdAndUpdate(req.params.reportId, update, { new: true, runValidators: true }).populate("course", "name slug").populate("reporter", "name email").populate("targetUser", "name email role");
    if (!report) return res.status(404).json({ message: "Report not found" });
    await recordAudit(req.user._id, `Report ${req.body.status}`, report.type);
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update report", error: error.message });
  }
});

router.get("/settings", async (req, res) => {
  try {
    return res.json(await PlatformSetting.findOneAndUpdate({ key: "platform" }, { $setOnInsert: { key: "platform" } }, { new: true, upsert: true, setDefaultsOnInsert: true }));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load settings", error: error.message });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const allowed = ["maxEnrollment", "minPassScore", "approvalRequired", "allowSelfEnroll", "sessionTimeout", "maxLoginAttempts", "categories"];
    const update = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const settings = await PlatformSetting.findOneAndUpdate({ key: "platform" }, update, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    await recordAudit(req.user._id, "Updated platform settings", Object.keys(update).join(", "));
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update settings", error: error.message });
  }
});

router.get("/announcements", async (req, res) => {
  try { return res.json(await Announcement.find().sort({ createdAt: -1 })); }
  catch (error) { return res.status(500).json({ message: "Unable to load announcements", error: error.message }); }
});

router.post("/announcements", async (req, res) => {
  try {
    if (!req.body.title?.trim()) return res.status(400).json({ message: "Announcement title is required" });
    const announcement = await Announcement.create({ title: req.body.title.trim(), audience: req.body.audience, createdBy: req.user._id });
    await recordAudit(req.user._id, "Posted announcement", announcement.title);
    return res.status(201).json(announcement);
  } catch (error) { return res.status(500).json({ message: "Unable to create announcement", error: error.message }); }
});

router.delete("/announcements/:announcementId", async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.announcementId);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    await recordAudit(req.user._id, "Deleted announcement", announcement.title);
    return res.json({ message: "Announcement deleted" });
  } catch (error) { return res.status(500).json({ message: "Unable to delete announcement", error: error.message }); }
});

router.get("/audit", async (req, res) => {
  try { return res.json(await AdminAudit.find().populate("admin", "name email").sort({ createdAt: -1 }).limit(200)); }
  catch (error) { return res.status(500).json({ message: "Unable to load audit log", error: error.message }); }
});

router.get("/notifications", async (req, res) => {
  try {
    const [users, applications] = await Promise.all([
      User.find({ role: { $in: ["student", "tutor"] } }).select("name email role createdAt").sort({ createdAt: -1 }).limit(20).lean(),
      TutorApplication.find({ status: { $ne: "DRAFT" } }).select("fullName email status submittedAt updatedAt").sort({ submittedAt: -1 }).limit(20).lean(),
    ]);
    const userNotifications = users.map((user) => ({
      id: user._id,
      type: "new_user",
      title: `New ${user.role} registered`,
      detail: `${user.name} (${user.email})`,
      createdAt: user.createdAt,
      role: user.role,
    }));
    const applicationNotifications = applications.map((application) => ({
      id: application._id,
      type: "tutor_application",
      title: "New tutor application",
      detail: `${application.fullName} (${application.email})`,
      createdAt: application.submittedAt || application.updatedAt,
      status: application.status,
    }));
    return res.json([...applicationNotifications, ...userNotifications]
      .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
      .slice(0, 20));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load notifications", error: error.message });
  }
});

module.exports = router;
