const Stripe = require("stripe");
let stripe;

function getStripe() {
  if (stripe) return stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw Object.assign(new Error("Stripe checkout is unavailable."), { status: 503 });
  }
  stripe = new Stripe(secretKey);
  return stripe;
}

// Initialize only when a Stripe endpoint is used, not while loading the app.
module.exports = { get checkout() { return getStripe().checkout; } };
