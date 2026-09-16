const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");

// Isolated replica set: never load .env or contact an application database.
test("Premium and course payments on a disposable MongoDB replica set", { skip: process.env.RUN_PAYMENT_MONGO_TESTS !== "true" }, async (t) => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "payment-integration-test-secret-at-least-32-characters";
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const User = require("../models/User");
  const Order = require("../models/Order");
  const Course = require("../models/Course");
  const Enrollment = require("../models/Enrollment");
  const Cart = require("../models/Cart");
  const Notification = require("../models/Notification");
  const AdminAudit = require("../models/AdminAudit");
  const PlatformSetting = require("../models/PlatformSetting");
  const service = require("../services/subscriptionService");
  const temp = await mkdtemp(path.join(os.tmpdir(), "edunova-payments-test-"));
  process.env.UPLOAD_ROOT = path.join(temp, "uploads");
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const mongo = spawn("mongod", ["--dbpath", temp, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "paymentTest", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  let server;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test MongoDB startup timed out")), 20000);
      mongo.once("error", error => { clearTimeout(timer); reject(error); });
      mongo.once("exit", code => { clearTimeout(timer); reject(new Error(`Test MongoDB exited ${code}`)); });
      mongo.stdout.on("data", chunk => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    });
    // Bootstrap before connecting Mongoose: automatic model creation must wait
    // until this disposable replica set has elected a writable primary.
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
      await bootstrap.connect();
      await bootstrap.db().admin().command({ replSetInitiate: { _id: "paymentTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      for (let i = 0; ; i++) {
        if ((await bootstrap.db().admin().command({ hello: 1 })).isWritablePrimary) break;
        if (i > 100) throw new Error("Replica set did not elect a primary");
        await delay(100);
      }
    } finally {
      await bootstrap.close();
    }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/payment_test?replicaSet=paymentTest`);
    await Promise.all([User, Order, Course, Enrollment, Cart, Notification, AdminAudit, PlatformSetting].map(model => model.init()));
    const admin = await User.create({ name: "Admin", email: "admin@payments.test", password: "unused", role: "admin" });
    const student = await User.create({ name: "Student", email: "student@payments.test", password: "unused" });
    const other = await User.create({ name: "Other", email: "other@payments.test", password: "unused" });
    server = require("../app").listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const request = async (method, route, body, user = student) => {
      const form = body instanceof FormData;
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
        method, headers: { ...(!form ? { "Content-Type": "application/json" } : {}), ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } : {}) },
        ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    };
    const checkout = async (cycle = "monthly") => {
      const result = await request("POST", "/subscription/upgrade", { billingCycle: cycle });
      assert.equal(result.status, 201); return result.data.order;
    };
    const slip = async (order, user = student, extra = {}) => {
      const form = new FormData();
      form.append("paymentSlip", new Blob(["%PDF-1.4 test slip"], { type: "application/pdf" }), "slip.pdf");
      for (const [key, value] of Object.entries(extra)) form.append(key, value);
      return request("POST", `/payment/${order._id}/slip`, form, user);
    };
    const approve = order => request("POST", `/admin/payment-verification/${order._id}/approve`, {}, admin);
    const reset = async () => { await Order.deleteMany({}); await User.updateOne({ _id: student._id }, { $unset: { subscription: "" } }); };

    await t.test("server prices, student authorization, fake-price rejection and concurrent checkout reuse", async () => {
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "monthly" }, null)).status, 401);
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "monthly" }, admin)).status, 403);
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "yearly", totalAmount: 1 })).status, 400);
      const results = await Promise.all(Array.from({ length: 5 }, () => request("POST", "/subscription/upgrade", { billingCycle: "monthly" })));
      assert.equal(results.filter(r => r.status === 201).length, 1);
      assert.equal(new Set(results.map(r => r.data.order._id)).size, 1);
      assert.equal(results[0].data.order.totalAmount, 99);
      assert.match(results[0].data.order.orderReference, /^EDU-PREM-/);
      const existing = await request("POST", "/subscription/upgrade", { billingCycle: "yearly" });
      assert.equal(existing.data.order.billingCycle, "monthly");
      assert.equal((await service.getSubscription(await User.findById(student._id))).plan, "free");
      await reset();
      assert.equal((await checkout("yearly")).totalAmount, 999);
    });

    await t.test("slip ownership, validation and submission cannot activate or alter Premium", async () => {
      await reset(); const order = await checkout();
      assert.equal((await slip(order, other)).status, 404);
      assert.equal((await approve(order)).status, 409);
      const invalid = new FormData(); invalid.append("paymentSlip", new Blob(["bad"], { type: "text/plain" }), "bad.txt");
      assert.equal((await request("POST", `/payment/${order._id}/slip`, invalid)).status, 400);
      const big = new FormData(); big.append("paymentSlip", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "application/pdf" }), "big.pdf");
      assert.equal((await request("POST", `/payment/${order._id}/slip`, big)).status, 400);
      const submitted = await slip(order, student, { billingCycle: "yearly", totalAmount: "1", paymentType: "course" });
      assert.equal(submitted.status, 200); assert.equal(submitted.data.order.status, "awaiting_verification");
      assert.equal((await service.getSubscription(await User.findById(student._id))).plan, "free");
      const stored = await Order.findById(order._id);
      assert.equal(stored.billingCycle, "monthly"); assert.equal(stored.totalAmount, 99); assert.equal(stored.paymentType, "subscription");
      assert.equal((await request("GET", "/subscription/me")).data.pendingPayment._id, order._id);
      assert.equal((await request("GET", `/orders/${order._id}`, undefined, other)).status, 404);
      assert.equal((await request("POST", `/admin/payment-verification/${order._id}/approve`, {})).status, 403);
      assert.equal((await request("POST", `/admin/payment-verification/${order._id}/approve`, {}, null)).status, 401);
      const review = await request("GET", "/admin/payment-verification", undefined, admin);
      assert.equal(review.data.orders[0].paymentType, "subscription");
    });

    await t.test("monthly/yearly approval activates correct calendar duration without enrolling", async () => {
      for (const cycle of ["monthly", "yearly"]) {
        await reset(); const order = await checkout(cycle); await slip(order);
        const result = await approve(order); assert.equal(result.status, 200);
        const user = await User.findById(student._id);
        assert.equal(user.subscription.startDate.toISOString(), result.data.order.verifiedAt);
        assert.equal(user.subscription.endDate.toISOString(), service.premiumSubscription(cycle, user.subscription.startDate).endDate.toISOString());
        assert.equal(service.allowance(user).limit, 500); assert.equal(service.allowance(user).period, "monthly");
        assert.equal(await Enrollment.countDocuments({ student: student._id }), 0);
        assert.equal((await request("GET", "/subscription/me")).data.pendingPayment, null);
      }
    });

    await t.test("active extension preserves time and competing/repeated approval applies once", async () => {
      await reset();
      const active = service.premiumSubscription("yearly");
      await User.updateOne({ _id: student._id }, { $set: { subscription: active } });
      const order = await checkout(); await slip(order);
      const results = await Promise.all([approve(order), approve(order)]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      const after = await User.findById(student._id);
      assert.equal(after.subscription.endDate.toISOString(), service.premiumSubscription("monthly", active.endDate).endDate.toISOString());
      assert.equal(after.subscription.startDate.toISOString(), active.startDate.toISOString());
      assert.equal((await approve(order)).status, 409);
      assert.equal((await User.findById(student._id)).subscription.endDate.toISOString(), after.subscription.endDate.toISOString());
    });

    await t.test("expired repurchase begins at approval; rejection permits resubmission", async () => {
      await reset();
      await User.updateOne({ _id: student._id }, { $set: { subscription: { plan: "premium", status: "active", billingCycle: "yearly", startDate: new Date(0), endDate: new Date(1) } } });
      assert.equal(service.allowance(await User.findById(student._id)).limit, 5);
      const order = await checkout(); await slip(order);
      assert.equal((await request("POST", `/admin/payment-verification/${order._id}/reject`, { reason: "Unreadable" }, admin)).status, 200);
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "monthly" })).data.order._id, order._id);
      assert.equal((await slip(order)).status, 200);
      const approved = await approve(order);
      const user = await User.findById(student._id);
      assert.equal(user.subscription.startDate.toISOString(), approved.data.order.verifiedAt);
      assert.equal(user.subscription.endDate.toISOString(), service.premiumSubscription("monthly", user.subscription.startDate).endDate.toISOString());
    });

    await t.test("approval transaction rolls back order decision if subscription data is invalid", async () => {
      await reset(); const order = await checkout(); await slip(order);
      await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(order._id) }, { $set: { totalAmount: 1 } });
      assert.equal((await approve(order)).status, 400);
      assert.equal((await Order.findById(order._id)).status, "awaiting_verification");
      assert.equal(service.currentSubscription(await User.findById(student._id)).plan, "free");
    });

    await t.test("existing paid/free course checkout and approval preserve enrollment and cart behavior", async () => {
      await reset();
      const makeCourse = (slug, price) => Course.create({ slug, name: slug, description: "Test", level: "Beginner", duration: "1:00", rating: 0, moderationStatus: "published", price });
      const paid = await makeCourse("paid-test", 250);
      const free = await makeCourse("free-test", 0);
      await Cart.create({ student: student._id, items: [{ course: paid._id }] });
      const pending = await request("POST", "/orders/checkout", { courseIds: [paid.id], totalAmount: 1, paymentType: "subscription" });
      assert.equal(pending.status, 201); assert.equal(pending.data.order.totalAmount, 250); assert.equal(pending.data.order.paymentType, "course");
      assert.equal((await request("POST", "/orders/buy-now", { courseId: paid.id })).data.order._id, pending.data.order._id);
      await slip(pending.data.order);
      assert.equal((await approve(pending.data.order)).status, 200);
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: paid._id }), 1);
      assert.equal((await Cart.findOne({ student: student._id })).items.length, 0);
      assert.equal(service.currentSubscription(await User.findById(student._id)).plan, "free");
      const freeResult = await request("POST", "/orders/buy-now", { courseId: free.id });
      assert.equal(freeResult.status, 201); assert.equal(freeResult.data.order.status, "completed");
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: free._id }), 1);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo.exitCode === null) { mongo.kill("SIGTERM"); await new Promise(resolve => mongo.once("exit", resolve)); }
    await rm(temp, { recursive: true, force: true });
  }
});
