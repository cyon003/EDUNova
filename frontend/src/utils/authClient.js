import { API_ROOT } from "./courseApi.js";

const AUTH_ROOT = `${API_ROOT}/auth`;
const TOKEN_MARKER = "managed-in-memory";
const SESSION_MESSAGE_KEY = "edunova_session_message";
const AUTH_EVENT = "edunova-auth-change";
let accessToken = null;
let snapshot = { user: null, version: 0 };
let refreshPromise = null;
let restorePromise = null;
let originalFetch = null;
let sessionOperations = Promise.resolve();

export const getAuthSnapshot = () => snapshot;
export const isCurrentSession = (version) => snapshot.version === version;
export const subscribeAuth = (listener) => {
  window.addEventListener(AUTH_EVENT, listener);
  return () => window.removeEventListener(AUTH_EVENT, listener);
};

function storedUser() {
  return snapshot.user;
}

function emitAuthChange(user, version = snapshot.version) {
  snapshot = { user, version };
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: snapshot }));
}

function sessionChanged() {
  return new DOMException("The signed-in account changed. Please try again.", "AbortError");
}

function assertCurrentSession(version) {
  if (!isCurrentSession(version)) throw sessionChanged();
}

function saveSession(user, token, version) {
  accessToken = token;
  localStorage.setItem("user", JSON.stringify(user));
  // Compatibility marker only: never use this value as a token or an identity.
  localStorage.setItem("token", TOKEN_MARKER);
  sessionStorage.removeItem(SESSION_MESSAGE_KEY);
  emitAuthChange(user, version);
}

export function establishSession(user, token) {
  if (!user?.id || !token) return false;
  refreshPromise = null;
  restorePromise = null;
  saveSession(user, token, snapshot.version + 1);
  return true;
}

export function clearSession({ expired = false } = {}) {
  accessToken = null;
  refreshPromise = null;
  restorePromise = null;
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  if (expired) sessionStorage.setItem(SESSION_MESSAGE_KEY, "Your session has expired. Please log in again.");
  else sessionStorage.removeItem(SESSION_MESSAGE_KEY);
  emitAuthChange(null, snapshot.version + 1);
}

function getNativeFetch() {
  return originalFetch || globalThis.fetch.bind(globalThis);
}

// Serialize cookie-changing requests. A late refresh must finish before logout
// clears its cookie, and logout must finish before another login sets a new one.
function sessionOperation(operation) {
  const result = sessionOperations.then(operation);
  sessionOperations = result.catch(() => {});
  return result;
}

export async function login(credentials) {
  clearSession();
  const version = snapshot.version;
  return sessionOperation(async () => {
    assertCurrentSession(version);
    const response = await getNativeFetch()(`${AUTH_ROOT}/login`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = await response.json().catch(() => ({}));
    assertCurrentSession(version);
    if (!response.ok || !data.user?.id || !data.token) throw new Error(data.message || "Unable to log in.");
    establishSession(data.user, data.token);
    return data;
  });
}

export function refreshSession() {
  if (refreshPromise) return refreshPromise;
  const version = snapshot.version;
  const pending = sessionOperation(async () => {
    assertCurrentSession(version);
    const response = await getNativeFetch()(`${AUTH_ROOT}/refresh`, {
      method: "POST", credentials: "include", headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    assertCurrentSession(version);
    if (!response.ok || !data.user?.id || !data.token) throw new Error(data.message || "Session refresh failed");
    // A refresh may renew this account, never silently switch to another one.
    if (snapshot.user && String(snapshot.user.id) !== String(data.user.id)) throw sessionChanged();
    saveSession(data.user, data.token, version);
    return data.user;
  }).catch((error) => {
    if (isCurrentSession(version)) clearSession({ expired: true });
    throw error;
  }).finally(() => {
    if (refreshPromise === pending) refreshPromise = null;
  });
  refreshPromise = pending;
  return pending;
}

export function restoreSession() {
  if (!restorePromise) restorePromise = refreshSession().catch(() => null);
  return restorePromise;
}

export function consumeSessionMessage() {
  const message = sessionStorage.getItem(SESSION_MESSAGE_KEY) || "";
  sessionStorage.removeItem(SESSION_MESSAGE_KEY);
  return message;
}

function isApiUrl(input) {
  const value = typeof input === "string" ? input : input?.url || "";
  try {
    const url = new URL(value, window.location.origin);
    const api = new URL(API_ROOT, window.location.origin);
    return url.origin === api.origin && url.pathname.startsWith(`${api.pathname}/`);
  } catch { return false; }
}

function isRefreshExcluded(input) {
  const value = typeof input === "string" ? input : input?.url || "";
  return /\/auth\/(login|signup|refresh|logout|forgot-password|reset-password)/.test(value);
}

async function authenticatedFetch(input, init = {}, mayRetry = true, version = snapshot.version) {
  const apiRequest = isApiUrl(input);
  const options = { ...init };
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  const hadToken = Boolean(accessToken);
  if (apiRequest) {
    assertCurrentSession(version);
    options.credentials = "include";
    // Always replace legacy/cached Authorization values, even after logout.
    headers.delete("Authorization");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  }
  options.headers = headers;
  const response = await getNativeFetch()(input, options);
  if (!apiRequest) return response;
  assertCurrentSession(version);
  if (response.status !== 401 || !mayRetry || !hadToken || isRefreshExcluded(input)) return response;
  try {
    await refreshSession();
  } catch (error) {
    if (snapshot.user) throw error;
    return response;
  }
  assertCurrentSession(version);
  return authenticatedFetch(input, init, false, version);
}

// A batch belongs to the account active when it was collected, not whichever
// account happens to be active when an effect cleanup or retry sends it.
export function sessionFetch(input, init, version) {
  assertCurrentSession(version);
  return authenticatedFetch(input, init, true, version);
}

export function installAuthFetch() {
  if (originalFetch) return;
  originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => authenticatedFetch(input, init);
}

function endSession(all) {
  const token = accessToken;
  clearSession();
  return sessionOperation(async () => {
    const response = await getNativeFetch()(`${AUTH_ROOT}/${all ? "logout-all" : "logout"}`, {
      method: "POST", credentials: "include",
      headers: all && token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error("Unable to revoke the server session. Please retry logout.");
  });
}

export const logout = () => endSession(false);
export const logoutAll = () => endSession(true);
export { AUTH_EVENT, storedUser };
