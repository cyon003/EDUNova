import { API_ROOT } from "./courseApi";

const AUTH_ROOT = `${API_ROOT}/auth`;

const TOKEN_MARKER = "managed-in-memory";

const SESSION_MESSAGE_KEY = "edunova_session_message";

const AUTH_EVENT = "edunova-auth-change";

let accessToken = null;

let refreshPromise = null;

let restorePromise = null;

let originalFetch = null;

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

function emitAuthChange(user) {
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT, {
      detail: { user },
    })
  );
}

export function establishSession(user, token) {
  if (!user || !token) return false;

  accessToken = token;

  localStorage.setItem("user", JSON.stringify(user));

  // Keep the legacy token marker for older parts of the application.
  // The real access token stays in memory.
  localStorage.setItem("token", TOKEN_MARKER);

  emitAuthChange(user);

  return true;
}

export function clearSession({ expired = false } = {}) {
  accessToken = null;

  restorePromise = null;

  localStorage.removeItem("user");
  localStorage.removeItem("token");

  if (expired) {
    sessionStorage.setItem(
      SESSION_MESSAGE_KEY,
      "Your session has expired. Please log in again."
    );
  }

  emitAuthChange(null);
}

function getNativeFetch() {
  return originalFetch || globalThis.fetch.bind(globalThis);
}

export function refreshSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = getNativeFetch()(`${AUTH_ROOT}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !establishSession(data.user, data.token)) {
        throw new Error(data.message || "Session refresh failed");
      }

      return data.user;
    })
    .catch((error) => {
      clearSession();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export function restoreSession() {
  if (!restorePromise) {
    restorePromise = refreshSession().catch(() => null);
  }

  return restorePromise;
}

export function consumeSessionMessage() {
  const message =
    sessionStorage.getItem(SESSION_MESSAGE_KEY) || "";

  sessionStorage.removeItem(SESSION_MESSAGE_KEY);

  return message;
}

function isApiUrl(input) {
  const value =
    typeof input === "string"
      ? input
      : input?.url || "";

  try {
    const url = new URL(value, window.location.origin);

    const api = new URL(
      API_ROOT,
      window.location.origin
    );

    return (
      url.origin === api.origin &&
      url.pathname.startsWith(`${api.pathname}/`)
    );
  } catch {
    return false;
  }
}

function isRefreshExcluded(input) {
  const value =
    typeof input === "string"
      ? input
      : input?.url || "";

  return /\/auth\/(login|signup|refresh|logout|forgot-password|reset-password)/.test(
    value
  );
}

async function authenticatedFetch(
  input,
  init = {},
  mayRetry = true
) {
  const apiRequest = isApiUrl(input);

  const options = {
    ...init,
  };

  const headers = new Headers(
    init.headers ||
      (input instanceof Request
        ? input.headers
        : undefined)
  );

  if (apiRequest) {
    options.credentials = "include";

    if (accessToken) {
      headers.set(
        "Authorization",
        `Bearer ${accessToken}`
      );
    } else if (
      headers.get("Authorization") ===
      `Bearer ${TOKEN_MARKER}`
    ) {
      headers.delete("Authorization");
    }
  }

  options.headers = headers;

  const response = await getNativeFetch()(
    input,
    options
  );

  if (
    response.status !== 401 ||
    !apiRequest ||
    !mayRetry ||
    isRefreshExcluded(input)
  ) {
    return response;
  }

  try {
    await refreshSession();

    return authenticatedFetch(
      input,
      init,
      false
    );
  } catch {
    clearSession({
      expired: true,
    });

    if (window.location.pathname !== "/auth") {
      window.location.replace("/auth");
    }

    return response;
  }
}

export function installAuthFetch() {
  if (originalFetch) {
    return;
  }

  originalFetch =
    globalThis.fetch.bind(globalThis);

  globalThis.fetch = authenticatedFetch;
}

export async function logout() {
  try {
    await getNativeFetch()(
      `${AUTH_ROOT}/logout`,
      {
        method: "POST",
        credentials: "include",
      }
    );
  } finally {
    clearSession();
  }
}

export async function logoutAll() {
  try {
    await authenticatedFetch(
      `${AUTH_ROOT}/logout-all`,
      {
        method: "POST",
      }
    );
  } finally {
    clearSession();
  }
}

export {
  AUTH_EVENT,
  storedUser,
};