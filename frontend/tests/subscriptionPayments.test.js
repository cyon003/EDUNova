import test from "node:test";
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
  return new Function("React", ...Object.keys(scope), `${result.code}; return ${name};`)(React, ...Object.values(scope));
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

test("pending and rejected payments resume existing checkout without offering duplicate purchases", async () => {
  for (const status of ["pending", "awaiting_verification", "rejected"]) {
    const h = await harness({ ...free, pendingPayment: { _id: "pending-123", status } });
    assert.equal(h.button("Upgrade to Premium").props.disabled, true);
    assert.match(h.html(), /checkout\?orderId=pending-123&amp;from=subscription/);
    assert.match(h.html(), /Current Plan: Free/);
    assert.doesNotMatch(h.html(), /Premium Active/);
    if (status === "awaiting_verification") assert.match(h.html(), /awaiting admin approval/);
    if (status === "rejected") assert.match(h.html(), /submit a new slip/);
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

async function checkoutHtml(order) {
  let cursor = 0;
  const state = [order, null, "", false, false, false, null, "", ""];
  const scope = {
    useState: () => [state[cursor++], () => {}], useEffect() {},
    useNavigate: () => () => {}, useLocation: () => ({ search: `?orderId=${order._id}` }),
    API_ROOT: "/api", apiAssetUrl: value => value,
    formatCoursePrice: value => `THB ${value.toFixed(2)}`,
  };
  for (const name of ["FaArrowLeft", "FaCheckCircle", "FaCloudUploadAlt", "FaLock", "FaQrcode", "FaShoppingBag", "FaSpinner", "FaTimesCircle"]) scope[name] = () => React.createElement("svg");
  const Checkout = await compile("../src/pages/CheckoutPage.jsx", "CheckoutPage", scope);
  return renderToStaticMarkup(React.createElement(Checkout));
}

test("shared checkout renders monthly/yearly order and approved/pending subscription states", async () => {
  for (const [billingCycle, totalAmount, label] of [["monthly", 99, "Monthly"], ["yearly", 999, "Yearly"]]) {
    const order = { _id: "123", orderReference: "EDU-PREM-123", paymentType: "subscription", billingCycle, totalAmount, items: [], status: "pending" };
    const pending = await checkoutHtml(order);
    assert.match(pending, /YOUR ORDER/); assert.match(pending, /EDUNova Premium/);
    assert.ok(pending.includes(`${label} subscription`));
    assert.ok(pending.includes(`THB ${totalAmount.toFixed(2)}`));
    assert.match(pending, /Premium begins after admin approval/);
    const submitted = await checkoutHtml({ ...order, status: "awaiting_verification" });
    assert.match(submitted, /Premium payment submitted — awaiting admin approval/);
    assert.doesNotMatch(submitted, /Your course access is now available|PAYMENT APPROVED/);
    const approved = await checkoutHtml({ ...order, status: "completed" });
    assert.match(approved, /Premium time has been activated or extended/);
    assert.match(approved, /View subscription/);
  }
});

test("legacy course checkout keeps its course summary and approval messaging", async () => {
  const html = await checkoutHtml({ _id: "123", orderReference: "EDU-123", totalAmount: 250, status: "completed", items: [{ course: { _id: "course-123", name: "Algebra" }, price: 250 }] });
  assert.match(html, /Algebra/); assert.match(html, /THB 250.00/);
  assert.match(html, /Your course access is now available/);
  assert.match(html, /Go to my learning/); assert.doesNotMatch(html, /EDUNova Premium/);
});
