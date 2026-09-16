import { API_ROOT } from "./courseApi.js";

export async function signup(details) {
  let response;
  try {
    response = await fetch(`${API_ROOT}/auth/signup`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Unable to reach EDUNova. Please try again shortly.", { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.message === "string" && data.message
      ? data.message
      : "EDUNova is temporarily unavailable. Please try again shortly.");
  }
  if (!data || typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("We couldn't confirm your signup. Try logging in, or try again shortly.");
  }
  return data;
}
