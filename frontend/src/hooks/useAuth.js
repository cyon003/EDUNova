import { useSyncExternalStore } from "react";
import { getAuthSnapshot, subscribeAuth } from "../utils/authClient.js";

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);
}
