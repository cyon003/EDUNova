const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const TutorApplication = require("../models/TutorApplication");

const statusMap = {
  incomplete: "DRAFT",
  pending_review: "UNDER_REVIEW",
  needs_changes: "MORE_INFORMATION_NEEDED",
  verified: "APPROVED",
  rejected: "REJECTED",
  suspended: "REJECTED",
};

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection("tutorapplications");
  const applications = await collection.find({ applicant: { $exists: false } }).toArray();

  for (const [legacyStatus, nextStatus] of Object.entries(statusMap)) {
    await User.updateMany({ tutorVerificationStatus: legacyStatus }, { $set: { tutorVerificationStatus: nextStatus } });
  }

  for (const application of applications) {
    const applicantId = application.tutor;
    const user = applicantId ? await User.findById(applicantId).lean() : null;
    if (!user) continue;

    await collection.updateOne(
      { _id: application._id },
      {
        $set: {
          applicant: applicantId,
          trackingTokenHash: require("crypto").createHash("sha256").update(require("crypto").randomBytes(32)).digest("hex"),
          fullName: application.legalName || user.name,
          email: user.email,
          phoneNumber: "",
          expertise: application.subjects?.join(", ") || "",
          teachingLevel: "",
          teachingExperience: application.professionalExperience || "",
          introduction: application.bio || "",
          institution: application.institution || "",
          major: application.fieldOfStudy || "",
          educationLevel: application.educationLevel || "",
          motivation: "",
          confirmed: false,
          status: statusMap[application.status] || "DRAFT",
        },
        $unset: {
          tutor: "",
          legalName: "",
          profilePhotoUrl: "",
          bio: "",
          subjects: "",
          degree: "",
          fieldOfStudy: "",
          graduationYear: "",
          teachingExperienceYears: "",
          professionalExperience: "",
          certifications: "",
          portfolioUrl: "",
          linkedInUrl: "",
          identityDocumentUrl: "",
          credentialDocumentUrls: "",
        },
      }
    );
    await User.findByIdAndUpdate(applicantId, { tutorVerificationStatus: statusMap[application.status] || "DRAFT" });
  }

  console.log(`Migrated ${applications.length} tutor application(s).`);
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
