import { purchaseErrorMessage } from "../src/utils/purchaseCourse.js";
import test from "node:test";
import { setImmediate } from "node:timers";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

// Use the same JSX compilation and hook harness as the existing component tests.
async function compile(file, name, scope) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const clean = source.replace(/^import[\s\S]*?;\n/gm, "").replace("export default ", "");
  const result = await transformWithOxc(clean, `${name}.jsx`, { jsx: { runtime: "classic" } });
  return new Function("React", "purchaseErrorMessage", ...Object.keys(scope), `${result.code}; return ${name};`)(React, purchaseErrorMessage, ...Object.values(scope));
}
const Link = ({ to, children, ...props }) => React.createElement("a", { href: to, ...props }, children);
const Summary = await compile("../src/components/SubscriptionSummary.jsx", "SubscriptionSummary", { Link });
const free = { plan: "free", aiUsage: { used: 0, pending: 0, limit: 5, remaining: 5, period: "daily", resetAt: "2028-02-01", exempt: false } };
const premium = { ...free, plan: "premium", billingCycle: "yearly", endDate: "2029-01-31", aiUsage: { ...free.aiUsage, limit: 500, remaining: 500, period: "monthly" } };
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
async function harness(subscription = free, request = async () => ({ order: { _id: "order-123" } })) {
  const values = []; let cursor = 0;
  const calls = [], navigations = [], updates = [];
  const Component = await compile("../src/pages/Subscription.jsx", "Subscription", {
    Link, SubscriptionSummary: Summary,
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = value; }]; },
    useNavigate: () => path => navigations.push(path),
    useSubscription: () => ({ subscription, setSubscription: value => updates.push(value), refresh() {} }),
    subscriptionRequest: async (...args) => { calls.push(args); return request(...args); },
  });
  const view = () => { cursor = 0; return Component(); };
  return { calls, navigations, updates, view,
    button(label) { return nodes(view()).find(node => node.type === "button" && node.props.children === label); },
    html() { return renderToStaticMarkup(view()); },
  };
}

test("monthly and yearly Upgrade send only the selected cycle and navigate to shared checkout", async () => {
  for (const cycle of ["monthly", "yearly"]) {
    const h = await harness();
    if (cycle === "yearly") h.button("Yearly · ฿999").props.onClick();
    await h.button("Upgrade to Premium").props.onClick();
    assert.deepEqual(h.calls, [["/upgrade", { billingCycle: cycle }]]);
    assert.deepEqual(h.navigations, ["/checkout?orderId=order-123&from=subscription"]);
    assert.deepEqual(h.updates, []); // Checkout creation never promotes local plan state.
  }
});

test("upgrade disables while processing and reports API failures without activating Premium", async () => {
  let reject;
  const h = await harness(free, () => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
  const pending = h.button("Upgrade to Premium").props.onClick();
  assert.equal(h.button("Upgrade to Premium").props.disabled, true);
  reject(new Error("Checkout unavailable")); await pending;
  assert.equal(h.button("Upgrade to Premium").props.disabled, false);
  assert.match(h.html(), /Checkout unavailable/);
  assert.deepEqual(h.navigations, []); assert.deepEqual(h.updates, []);
});

test("pending payments resume existing checkout without offering duplicate purchases", async () => {
  for (const status of ["pending"]) {
    const h = await harness({ ...free, pendingPayment: { _id: "pending-123", status } });
    assert.equal(h.button("Upgrade to Premium").props.disabled, true);
    assert.match(h.html(), /checkout\?orderId=pending-123&amp;from=subscription/);
    assert.match(h.html(), /Current Plan: Free/);
    assert.doesNotMatch(h.html(), /Premium Active/);
  }
});

test("active yearly Premium shows monthly quota, expiry and manual extension", async () => {
  const h = await harness(premium);
  assert.match(h.html(), /Premium Active/);
  assert.match(h.html(), /500 AI messages per month/);
  assert.match(h.html(), /Expires/); assert.doesNotMatch(h.html(), /Renews|6000|Cancel Premium|Cancel Subscription|Confirm switch to Free|Keep Premium/);
  assert.match(h.html(), /Premium expires automatically at the end of the paid period\. There is no automatic renewal\./);
  assert.equal(h.button("Extend Premium").props.disabled, false);
  await h.button("Extend Premium").props.onClick();
  assert.deepEqual(h.calls, [["/upgrade", { billingCycle: "monthly" }]]);
});

test("Free and staff status do not imply active Premium", async () => {
  const h = await harness(free);
  assert.match(h.html(), /Current Plan: Free/);
  assert.match(h.html(), /5 AI chatbot messages per day/);
  const staff = await harness({ ...free, aiUsage: { ...free.aiUsage, exempt: true } });
  assert.match(staff.html(), /Staff AI access/);
  assert.equal(staff.button("Upgrade to Premium"), undefined);
});

async function checkoutHarness(order, search = "?orderId=123", responses = []) {
  let cursor = 0;
  const state = [order, false, "", 0], effects = [], calls = [], redirects = [];
  const scope = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
    useEffect(fn) { effects.push(fn); },
    useNavigate: () => path => redirects.push(path), useLocation: () => ({ search }),
    API_ROOT: "/api", formatCoursePrice: value => `THB ${value.toFixed(2)}`,
    localStorage: { getItem: () => "test-token" }, window: { location: { assign: url => redirects.push(url) } },
    fetch: async (url, options) => { calls.push([url, options]); const result = responses.shift() || {}; return { ok: result.ok !== false, json: async () => result.data || {} }; },
  };
  const Component = await compile("../src/pages/StripeCheckout.jsx", "StripeCheckout", scope);
  const view = () => { cursor = 0; return Component(); };
  return { calls, redirects, effects, state, view,
    button(label) { return nodes(view()).find(node => node.type === "button" && node.props.children === label); },
    html() { return renderToStaticMarkup(view()); },
  };
}
const courseOrder = { _id: "123", orderReference: "EDU-123", paymentType: "course", paymentMethod: "stripe", totalAmount: 250, status: "pending", items: [{ price: 250, course: { name: "Algebra" } }] };
test("paid course and both Premium periods use Stripe with correct summary", async () => {
  for (const order of [courseOrder, ...["monthly", "yearly"].map(billingCycle => ({ ...courseOrder, paymentType: "subscription", billingCycle, totalAmount: billingCycle === "monthly" ? 99 : 999, items: [] }))]) {
    const h = await checkoutHarness(order, "?orderId=123", [{ data: { checkoutUrl: "https://checkout.stripe.com/test" } }]);
    assert.match(h.html(), /EDU-123/); assert.ok(h.html().includes(`THB ${order.totalAmount.toFixed(2)}`));
    assert.doesNotMatch(h.html(), /bank transfer|slip|admin approval|test mode/i);
    await h.button("Continue to Stripe").props.onClick();
    assert.equal(h.calls[0][0], "/api/stripe/create-checkout-session");
    assert.deepEqual(JSON.parse(h.calls[0][1].body), { orderId: "123" });
    assert.deepEqual(h.redirects, ["https://checkout.stripe.com/test"]);
  }
});
test("cancellation allows explicit retry and does not claim verified payment", async () => {
  const h = await checkoutHarness(courseOrder, "?orderId=123&payment=cancelled");
  assert.match(h.html(), /Checkout was canceled/); assert.ok(h.button("Try payment again"));
  assert.equal(h.calls.length, 0); assert.doesNotMatch(h.html(), /Purchase complete/);
});
test("failed checkout displays errors without redirecting or activating access", async () => {
  const h = await checkoutHarness(courseOrder, "?orderId=123", [{ ok: false, data: { message: "Stripe unavailable" } }]);
  await h.button("Continue to Stripe").props.onClick();
  assert.match(h.html(), /Stripe unavailable/); assert.equal(h.redirects.length, 0);
});
test("status checks activate UI only when the server confirms completion", async () => {
  const h = await checkoutHarness({ ...courseOrder, paymentReference: "cs_test" }, "?orderId=123", [
    { ok: false, data: { message: "Payment pending" } }, { data: { paid: true, order: { ...courseOrder, status: "completed" } } },
  ]);
  await h.button("Check payment status").props.onClick(); assert.match(h.html(), /Payment pending/); assert.doesNotMatch(h.html(), /Purchase complete/);
  await h.button("Check payment status").props.onClick(); assert.match(h.html(), /Purchase complete/); assert.ok(h.button("Go to my learning"));
});
test("free completion bypasses payment and historical pending orders remain read-only", async () => {
  const free = await checkoutHarness({ ...courseOrder, paymentMethod: "free", totalAmount: 0, status: "completed" });
  assert.equal(free.button("Continue to Stripe"), undefined); assert.match(free.html(), /Free/); assert.equal(free.calls.length, 0);
  const legacy = await checkoutHarness({ ...courseOrder, paymentMethod: "manual_qr" });
  assert.match(legacy.html(), /Historical payment record/); assert.equal(legacy.button("Continue to Stripe"), undefined);
  const premium = await checkoutHarness({ ...courseOrder, paymentType: "subscription", billingCycle: "yearly", status: "completed" });
  assert.match(premium.html(), /activated or extended/); assert.ok(premium.button("View subscription"));
});

test("cart checkout creates an order and success return verifies on the server", async () => {
  const cart = await checkoutHarness(null, "", [{ data: { order: courseOrder } }]);
  cart.view(); cart.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cart.calls[0][0], "/api/orders/checkout");
  assert.deepEqual(cart.redirects, ["/checkout?orderId=123&from=cart"]);
  const done = { ...courseOrder, status: "completed" };
  const success = await checkoutHarness(null, "?orderId=123&payment=success&session_id=cs_test", [{ data: { paid: true, order: done } }]);
  success.view(); success.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(success.calls[0][0], "/api/stripe/verify-session");
  assert.match(success.html(), /Purchase complete/);
  const pending = await checkoutHarness(null, "?orderId=123&payment=success&session_id=cs_test", [{ ok: false, data: { message: "Still pending" } }, { data: courseOrder }]);
  pending.view(); pending.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.match(pending.html(), /Still pending/); assert.doesNotMatch(pending.html(), /Purchase complete/);
});
