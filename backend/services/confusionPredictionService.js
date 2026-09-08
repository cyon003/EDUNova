const DEFAULT_URL = "http://127.0.0.1:5002";

async function requestPrediction(features) {
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(Number(process.env.PYTHON_CONFUSION_TIMEOUT_MS || 5000), 500), 30000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = String(process.env.PYTHON_CONFUSION_URL || DEFAULT_URL).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || "Prediction service rejected the request"), { status: 502 });
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(error, { status: error.name === "AbortError" ? 504 : 503 });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { requestPrediction };