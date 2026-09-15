import { useCallback, useEffect, useState } from "react";
import { API_ROOT } from "../utils/courseApi";

export async function subscriptionRequest(path = "/me", body) {
  const response = await fetch(`${API_ROOT}/subscription${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to load subscription");
  return data;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const data = await subscriptionRequest(); setSubscription(data); setError(""); }
    catch (error) { if (error.name !== "AbortError") setError(error.message); }
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const data = await subscriptionRequest(); if (active) { setSubscription(data); setError(""); } }
      catch (error) { if (active && error.name !== "AbortError") setError(error.message); }
    };
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", load); };
  }, []);
  return { subscription, setSubscription, error, refresh };
}
