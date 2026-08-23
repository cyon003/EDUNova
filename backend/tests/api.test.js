const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-jwt-secret-with-at-least-32-characters";

const app = require("../app");
const Course = require("../models/Course");
const User = require("../models/User");
const { hashResetToken } = require("../utils/passwordSecurity");

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test.beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

function signup(email = "student@example.com", password = "Student123") {
  return request(app).post("/api/auth/signup").send({ name: "Test Student", email, password, role: "admin" });
}

function login(email = "student@example.com", password = "Student123") {
  return request(app).post("/api/auth/login").send({ email, password });
}

test("health endpoint responds with security headers", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.ok(response.headers["x-content-type-options"]);
});

test("signup always creates a student and login returns a usable token", async () => {
  await signup().expect(201);
  const storedUser = await User.findOne({ email: "student@example.com" }).lean();
  assert.equal(storedUser.role, "student");

  const response = await login().expect(200);
  assert.equal(response.body.user.role, "student");
  assert.ok(response.body.token);

  await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${response.body.token}`)
    .expect(200);
});

test("student profile saves and favorites persist in MongoDB", async () => {
  await signup();
  const { body } = await login();
  const auth = { Authorization: `Bearer ${body.token}` };

  const profileResponse = await request(app)
    .patch("/api/profile")
    .set(auth)
    .send({ name: "Updated Student", username: "learner", bio: "Learning every day" })
    .expect(200);
  assert.equal(profileResponse.body.user.studentProfile.username, "learner");

  const course = await Course.create({
    slug: "secure-testing",
    name: "Secure Testing",
    category: "Technology",
    description: "Learn secure automated testing.",
    level: "Beginner",
    duration: "2 weeks",
    rating: 4.5,
    moderationStatus: "published",
  });

  await request(app).post(`/api/favorites/${course._id}`).set(auth).expect(200);
  const favorites = await request(app).get("/api/favorites").set(auth).expect(200);
  assert.equal(favorites.body.favorites.length, 1);
  assert.equal(favorites.body.favorites[0].slug, "secure-testing");

  await request(app).delete(`/api/favorites/${course._id}`).set(auth).expect(200);
  const empty = await request(app).get("/api/favorites").set(auth).expect(200);
  assert.equal(empty.body.favorites.length, 0);
});

test("unpublished courses stay private and cannot be favorited", async () => {
  await signup();
  const { body } = await login();
  const draft = await Course.create({
    slug: "private-draft",
    name: "Private Draft",
    category: "Technology",
    description: "Not approved yet.",
    level: "Beginner",
    duration: "1 week",
    rating: 0,
    moderationStatus: "unpublished",
  });

  await request(app).get("/api/courses/private-draft").expect(404);
  await request(app)
    .post(`/api/favorites/${draft._id}`)
    .set("Authorization", `Bearer ${body.token}`)
    .expect(404);
});

test("student-only routes reject tutors", async () => {
  await User.create({
    name: "Tutor",
    email: "tutor@example.com",
    password: await bcrypt.hash("Tutor123", 10),
    role: "tutor",
    accountStatus: "approved",
    tutorVerificationStatus: "APPROVED",
  });
  const { body } = await login("tutor@example.com", "Tutor123");
  await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${body.token}`)
    .expect(403);
});

test("forgot-password response does not reveal whether an account exists", async () => {
  await signup();
  const known = await request(app).post("/api/auth/forgot-password").send({ email: "student@example.com" }).expect(200);
  const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "missing@example.com" }).expect(200);
  assert.equal(known.body.message, unknown.body.message);
});

test("password reset is single-use and invalidates existing JWT sessions", async () => {
  await signup();
  const oldLogin = await login();
  const resetToken = "known-test-reset-token";
  await User.updateOne(
    { email: "student@example.com" },
    {
      passwordResetTokenHash: hashResetToken(resetToken),
      passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }
  );

  await request(app)
    .post(`/api/auth/reset-password/${resetToken}`)
    .send({ password: "NewStudent456" })
    .expect(200);

  await request(app)
    .post(`/api/auth/reset-password/${resetToken}`)
    .send({ password: "Another789A" })
    .expect(400);

  await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${oldLogin.body.token}`)
    .expect(401);

  await login("student@example.com", "Student123").expect(400);
  await login("student@example.com", "NewStudent456").expect(200);
});
