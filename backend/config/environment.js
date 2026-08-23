function requiredVariables() {
  const required = ["MONGO_URI", "JWT_SECRET"];
  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL && !process.env.CORS_ORIGINS) {
    required.push("FRONTEND_URL or CORS_ORIGINS");
  }
  return required;
}

function validateEnvironment() {
  const missing = requiredVariables().filter((key) => {
    if (key === "FRONTEND_URL or CORS_ORIGINS") return true;
    return !String(process.env[key] || "").trim();
  });

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const port = Number(process.env.PORT || 5050);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return { port };
}

function allowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set(configured);
}

module.exports = { validateEnvironment, allowedOrigins };
