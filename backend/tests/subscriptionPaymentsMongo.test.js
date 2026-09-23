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
    const Stripe = require("stripe");
    const stripeService = require("../services/stripePaymentService");
    const sessions = new Map(), keys = new Map();
    const created = [];
    const fakeCheckout = { sessions: {
      async create(params, options) {
        if (keys.has(options.idempotencyKey)) return sessions.get(keys.get(options.idempotencyKey));
        const id = `cs_test_${created.length + 1}`;
        const value = { ...params, id, url: `https://checkout.stripe.com/${id}`, status: "open", payment_status: "unpaid", currency: "thb", amount_total: params.line_items.reduce((sum, item) => sum + item.price_data.unit_amount, 0) };
        sessions.set(id, value); keys.set(options.idempotencyKey, id); created.push(value); return value;
      },
      async retrieve(id) { if (!sessions.has(id)) throw new Error("Unknown session"); return sessions.get(id); },
    } };
    Object.defineProperty(stripeService, "checkout", { value: fakeCheckout });
    Object.defineProperty(stripeService, "webhooks", { value: new Stripe("sk_test_local_fixture").webhooks });
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_local_fixture";
    const start = async order => {
      const result = await request("POST", "/stripe/create-checkout-session", { orderId: order._id });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      return sessions.get(result.data.sessionId);
    };
    const verify = (session, user = student) => request("POST", "/stripe/verify-session", { sessionId: session.id }, user);
    const paid = session => Object.assign(session, { status: "complete", payment_status: "paid", url: null });
    const webhook = async (session, type = "checkout.session.completed", valid = true) => {
      const payload = JSON.stringify({ id: `evt_${session.id}`, type, data: { object: { id: session.id } } });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: valid ? process.env.STRIPE_WEBHOOK_SECRET : "wrong" });
      return fetch(`http://127.0.0.1:${server.address().port}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: payload });
    };
    const reset = async () => { await Order.deleteMany({}); await Notification.deleteMany({}); await User.updateOne({ _id: student._id }, { $unset: { subscription: "" } }); };
    const makeCourse = (slug, price) => Course.create({ slug, name: slug, description: "Test", level: "Beginner", duration: "1:00", rating: 0, moderationStatus: "published", price });

    await t.test("Premium authorization, immutable server prices and concurrent checkout/session reuse", async () => {
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "monthly" }, null)).status, 401);
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "monthly" }, admin)).status, 403);
      assert.equal((await request("POST", "/subscription/upgrade", { billingCycle: "yearly", totalAmount: 1 })).status, 400);
      const results = await Promise.all(Array.from({ length: 4 }, () => request("POST", "/subscription/upgrade", { billingCycle: "monthly" })));
      assert.equal(results.filter(r => r.status === 201).length, 1);
      assert.equal(new Set(results.map(r => r.data.order._id)).size, 1);
      const order = results[0].data.order;
      const checkouts = await Promise.all([start(order), start(order), start(order)]);
      assert.equal(new Set(checkouts.map(item => item.id)).size, 1);
      assert.equal(checkouts[0].amount_total, 9900);
      assert.equal(checkouts[0].mode, "payment");
      assert.equal(checkouts[0].payment_method_types, undefined);
      assert.equal(checkouts[0].metadata.orderReference, order.orderReference);
      assert.match(checkouts[0].cancel_url, /payment=cancelled/);
      assert.equal((await verify(checkouts[0])).status, 402);
      assert.equal((await verify(checkouts[0], other)).status, 403);
      assert.equal((await request("POST", "/stripe/create-checkout-session", { orderId: order._id }, other)).status, 404);
      assert.equal(service.currentSubscription(await User.findById(student._id)).plan, "free");
      await reset();
    });

    await t.test("both Premium periods fulfill exactly once across parallel verification and signed webhook replays", async () => {
      for (const cycle of ["monthly", "yearly"]) {
        await reset();
        const order = await checkout(cycle), session = await start(order);
        assert.equal(session.amount_total, cycle === "monthly" ? 9900 : 99900);
        assert.equal((await webhook(session, undefined, false)).status, 400);
        assert.equal((await webhook(session)).status, 200); // unpaid completion waits for async success
        assert.equal(service.currentSubscription(await User.findById(student._id)).plan, "free");
        paid(session);
        const results = await Promise.all([verify(session), verify(session), webhook(session), webhook(session, "checkout.session.async_payment_succeeded")]);
        assert.ok(results.every(result => result.status === 200));
        const user = await User.findById(student._id);
        const end = user.subscription.endDate.toISOString();
        assert.equal(service.currentSubscription(user).plan, "premium");
        assert.equal(service.allowance(user).limit, 500);
        assert.equal(service.currentSubscription(user, user.subscription.endDate).plan, "free");
        await verify(session); await webhook(session);
        assert.equal((await User.findById(student._id)).subscription.endDate.toISOString(), end);
        assert.equal(await Notification.countDocuments({ order: order._id }), 1);
        assert.equal((await Order.findById(order._id)).status, "completed");
      }
    });

    await t.test("existing Premium retains paid time and quota when extended", async () => {
      await reset();
      const original = service.premiumSubscription("yearly");
      await User.updateOne({ _id: student._id }, { $set: { subscription: original } });
      const order = await checkout(), session = await start(order);
      assert.equal((await User.findById(student._id)).subscription.endDate.toISOString(), original.endDate.toISOString());
      paid(session); assert.equal((await verify(session)).status, 200);
      const updated = await User.findById(student._id);
      assert.equal(updated.subscription.startDate.toISOString(), original.startDate.toISOString());
      assert.ok(updated.subscription.endDate > original.endDate);
      assert.equal(service.allowance(updated).limit, 500);
    });

    await t.test("failed async payment and expired/canceled checkout can retry without access", async () => {
      await reset(); const order = await checkout(), session = await start(order);
      assert.equal((await start(order)).id, session.id); // canceled browser can resume open checkout
      session.status = "expired"; session.url = null;
      const retry = await start(order); assert.notEqual(retry.id, session.id);
      retry.status = "complete"; retry.url = null;
      assert.equal((await verify(retry)).status, 402);
      assert.equal((await webhook(retry, "checkout.session.async_payment_failed")).status, 200);
      const retry2 = await start(order); assert.notEqual(retry2.id, retry.id);
      assert.equal(service.currentSubscription(await User.findById(student._id)).plan, "free");
      assert.equal(await Notification.countDocuments({ order: order._id }), 0);
    });

    await t.test("payment identity, currency and amount mismatch never fulfill, including completed-order replays", async () => {
      await reset(); const order = await checkout(), session = paid(await start(order));
      for (const [field, value] of [["amount_total", 1], ["currency", "usd"], ["mode", "subscription"], ["client_reference_id", "wrong"], ["id", "cs_other"]]) {
        const original = session[field]; session[field] = value;
        assert.equal((await verify({ id: [...sessions.entries()].find(([, item]) => item === session)[0] })).status, 409);
        session[field] = original;
      }
      assert.equal((await verify(session)).status, 200);
      session.currency = "usd"; assert.equal((await verify(session)).status, 409); session.currency = "thb";
    });

    await t.test("cart mixed prices, buy-now, free enrollment and paid-access enforcement", async () => {
      await reset(); const course = await makeCourse("paid-test", 250.25), free = await makeCourse("free-test", 0);
      await Cart.create({ student: student._id, items: [{ course: course._id }, { course: free._id }] });
      assert.equal((await request("POST", `/enrollments/${course.slug}`, {})).status, 402);
      const result = await request("POST", "/orders/checkout", { totalAmount: 1 });
      assert.equal(result.status, 201); assert.equal(result.data.order.totalAmount, 250.25);
      const order = result.data.order;
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: free._id }), 1, "mixed-cart free course bypasses Stripe");
      assert.equal((await request("POST", "/orders/buy-now", { courseId: course.id })).data.order._id, order._id);
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: course._id }), 0);
      const session = await start(order); assert.equal(session.amount_total, 25025); assert.equal(session.line_items.length, 2);
      paid(session); await webhook(session); await verify(session);
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: course._id }), 1);
      assert.equal((await Cart.findOne({ student: student._id })).items.length, 0);
      const free2 = await makeCourse("free-only", 0);
      const count = created.length;
      const freeResult = await request("POST", "/orders/buy-now", { courseId: free2.id });
      assert.equal(freeResult.data.order.status, "completed"); assert.equal(freeResult.data.order.paymentMethod, "free");
      assert.equal(created.length, count);
      assert.equal((await request("POST", "/stripe/create-checkout-session", { orderId: freeResult.data.order._id })).status, 409);
      const free3 = await makeCourse("free-direct", 0);
      assert.equal((await request("POST", `/enrollments/${free3.slug}`, {})).status, 200);
      const course2 = await makeCourse("buy-now", 100);
      const buy = await request("POST", "/orders/buy-now", { courseId: course2.id });
      paid(await start(buy.data.order)); await verify(sessions.get((await Order.findById(buy.data.order._id)).paymentReference));
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: course2._id }), 1);
    });

    await t.test("fulfillment failure rolls back all effects and webhook retry succeeds", async () => {
      await reset();
      const course = await makeCourse("retry-fulfillment", 123);
      const result = await request("POST", "/orders/buy-now", { courseId: course.id });
      const session = paid(await start(result.data.order));
      await Course.updateOne({ _id: course._id }, { $set: { moderationStatus: "draft" } });
      assert.equal((await webhook(session)).status, 500);
      assert.equal((await Order.findById(result.data.order._id)).status, "pending");
      assert.equal(await Notification.countDocuments({ order: result.data.order._id }), 0);
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: course._id }), 0);
      await Course.updateOne({ _id: course._id }, { $set: { moderationStatus: "published" } });
      assert.equal((await webhook(session)).status, 200);
      assert.equal(await Enrollment.countDocuments({ student: student._id, course: course._id }), 1);
    });

    await t.test("historical manual records and paid enrollments remain; removed endpoints cannot approve", async () => {
      const before = await Enrollment.countDocuments({ student: student._id });
      const old = await Order.create({ student: student._id, paymentType: "subscription", billingCycle: "monthly", totalAmount: 99, orderReference: "LEGACY", paymentMethod: "manual_qr", status: "awaiting_verification", paymentSlip: { storedName: "historical.pdf" } });
      const snapshot = old.toObject();
      for (const route of [`/payment/${old.id}/slip`, `/admin/payment-verification/${old.id}/approve`, "/payment-settings", "/admin/payment-settings"]) {
        assert.equal((await request("POST", route, {}, admin)).status, 404);
      }
      assert.equal((await request("POST", "/stripe/create-checkout-session", { orderId: old.id })).status, 409);
      assert.deepEqual((await Order.findById(old.id)).toObject(), snapshot);
      assert.equal(await Enrollment.countDocuments({ student: student._id }), before);
      assert.equal((await request("GET", `/orders/${old.id}`)).status, 200);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo.exitCode === null) { mongo.kill("SIGTERM"); await new Promise(resolve => mongo.once("exit", resolve)); }
    await rm(temp, { recursive: true, force: true });
  }
});
