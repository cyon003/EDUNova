const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "weekly-goal-test-secret-at-least-32-characters";

const User = require("../models/User");
const LearningSignal = require("../models/LearningSignal");
const { weekStartUTC, summarizeWeeklyGoal } = require("../services/weeklyGoalService");
const app = require("../app");

const ids = {
  student: "507f1f77bcf86cd799439081",
  otherStudent: "507f1f77bcf86cd799439082",
  tutor: "507f1f77bcf86cd799439083",
};
const originals = {};
let users;
let signals;
let server;
let lastSignalFilter;
let lastGoalFilter;

const token = (id, role = "student") => jwt.sign({ id, role, tokenVersion: 0 }, process.env.JWT_SECRET);

function request(method, pathname, body, authToken) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const headers = payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const outgoing = http.request({ hostname: "127.0.0.1", port: server.address().port, path: pathname, method, headers }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
    });
    outgoing.on("error", reject);
    if (payload) outgoing.write(payload);
    outgoing.end();
  });
}

test.before(async () => {
  originals.userFind = User.findById;
  originals.userUpdate = User.findOneAndUpdate;
  originals.signalFind = LearningSignal.find;
  User.findById = (id) => ({ select: async () => users.get(String(id)) || null });
  User.findOneAndUpdate = async (filter, update) => {
    lastGoalFilter = filter;
    const user = users.get(String(filter._id));
    if (!user || user.role !== filter.role) return null;
    user.weeklyGoalMinutes = update.$set.weeklyGoalMinutes;
    return user;
  };
  LearningSignal.find = (filter) => ({ select: async () => {
    lastSignalFilter = filter;
    return signals.filter((item) => item.student === String(filter.student));
  } });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

test.after(async () => {
  User.findById = originals.userFind;
  User.findOneAndUpdate = originals.userUpdate;
  LearningSignal.find = originals.signalFind;
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => {
  users = new Map([
    [ids.student, { _id: ids.student, role: "student", accountStatus: "approved", tokenVersion: 0, weeklyGoalMinutes: null }],
    [ids.otherStudent, { _id: ids.otherStudent, role: "student", accountStatus: "approved", tokenVersion: 0, weeklyGoalMinutes: 60 }],
    [ids.tutor, { _id: ids.tutor, role: "tutor", accountStatus: "approved", tokenVersion: 0 }],
  ]);
  signals = [];
  lastSignalFilter = null;
  lastGoalFilter = null;
});

test("UTC Monday week rollover excludes study time from the previous week", () => {
  assert.equal(weekStartUTC("2026-09-20T23:59:59.000Z"), "2026-09-14");
  assert.equal(weekStartUTC("2026-09-21T00:00:00.000Z"), "2026-09-21");
  const records = [{ activeTimeSecondsByWeek: new Map([["2026-09-14", 5100], ["2026-09-21", 1200]]) }];
  const sunday = summarizeWeeklyGoal(120, records, "2026-09-20T23:59:59.000Z");
  assert.equal(sunday.learningMinutes, 85);
  assert.equal(sunday.remainingMinutes, 35);
  assert.equal(sunday.completionPercentage, 71);
  const monday = summarizeWeeklyGoal(120, records, "2026-09-21T00:00:00.000Z");
  assert.equal(monday.learningMinutes, 20);
  assert.equal(monday.remainingMinutes, 100);
  assert.equal(monday.weekStart, "2026-09-21");
});

test("weekly summary aggregates lessons, keeps minute math measurable, and reports goal reached", () => {
  const records = [
    { activeTimeSecondsByWeek: { "2026-09-14": 3600 } },
    { activeTimeSecondsByWeek: { "2026-09-14": 3600, "2026-09-07": 9000 } },
  ];
  const summary = summarizeWeeklyGoal(120, records, "2026-09-17T12:00:00.000Z");
  assert.equal(summary.learningSeconds, 7200);
  assert.equal(summary.learningMinutes, 120);
  assert.equal(summary.remainingMinutes, 0);
  assert.equal(summary.completionPercentage, 100);
  assert.equal(summary.goalStatus, "completed");
  assert.equal(summarizeWeeklyGoal(null, [], "2026-09-17T12:00:00.000Z").goalStatus, "not_set");
});

test("students can set and change only their own weekly goal", async () => {
  const studentToken = token(ids.student);
  const week = weekStartUTC();
  signals = [
    { student: ids.student, activeTimeSecondsByWeek: { [week]: 3000 } },
    { student: ids.student, activeTimeSecondsByWeek: { [week]: 2100 } },
    { student: ids.otherStudent, activeTimeSecondsByWeek: { [week]: 7200 } },
  ];
  const unset = await request("GET", "/api/weekly-goal/me", undefined, studentToken);
  assert.equal(unset.status, 200);
  assert.equal(unset.body.goalStatus, "not_set");
  assert.equal(unset.body.learningMinutes, 85);
  assert.equal(lastSignalFilter.student, ids.student);

  const saved = await request("PUT", "/api/weekly-goal/me", { weeklyGoalMinutes: 120 }, studentToken);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.weeklyGoalMinutes, 120);
  assert.equal(saved.body.remainingMinutes, 35);
  assert.equal(lastGoalFilter._id, ids.student);
  assert.equal(users.get(ids.otherStudent).weeklyGoalMinutes, 60);

  const changed = await request("PUT", "/api/weekly-goal/me", { weeklyGoalMinutes: 90 }, studentToken);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.weeklyGoalMinutes, 90);
  assert.equal(changed.body.remainingMinutes, 5);
  assert.equal((await request("GET", "/api/weekly-goal/me", undefined, studentToken)).body.weeklyGoalMinutes, 90);
  assert.equal((await request("GET", "/api/weekly-goal/me", undefined, token(ids.otherStudent))).body.learningMinutes, 120);
});

test("weekly goal routes reject anonymous, non-student and invalid updates", async () => {
  assert.equal((await request("GET", "/api/weekly-goal/me")).status, 401);
  assert.equal((await request("PUT", "/api/weekly-goal/me", { weeklyGoalMinutes: 30 }, token(ids.tutor, "tutor"))).status, 403);
  const studentToken = token(ids.student);
  for (const body of [
    { weeklyGoalMinutes: 0 }, { weeklyGoalMinutes: 10081 }, { weeklyGoalMinutes: 12.5 }, { weeklyGoalMinutes: "120" },
    { weeklyGoalMinutes: 60, studentId: ids.otherStudent }, {},
  ]) assert.equal((await request("PUT", "/api/weekly-goal/me", body, studentToken)).status, 400);
  assert.equal(users.get(ids.student).weeklyGoalMinutes, null);
});
