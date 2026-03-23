// src/utils/routeEncrypt.ts

/**
 * Encodes a plain-text route segment to a Base64-safe string.
 * e.g. "dashboard" → "ZGFzaGJvYXJk"
 */
export const encryptRoute = (path: string): string => {
  return btoa(path).replace(/=/g, ""); // strip padding for cleaner URLs
};

/**
 * Decodes a Base64-encoded route segment back to plain text.
 * e.g. "ZGFzaGJvYXJk" → "dashboard"
 */
export const decryptRoute = (encoded: string): string => {
  try {
    // Re-pad if needed before decoding
    const padded = encoded + "==".slice(0, (4 - (encoded.length % 4)) % 4);
    return atob(padded);
  } catch {
    return "";
  }
};

/**
 * Central route registry.
 * Define all your routes here — they get encrypted automatically.
 *
 * ADMIN ROUTES (prefix: /admin)
 * USER ROUTES  (prefix: /user)
 */
const ADMIN_ROUTES = {
  login:      "/login",
  dashboard:  "/dashboard",
  candidates: "/candidates",
  tests:      "/tests",
  video:      "/video",
  reports:    "/reports",
  settings:    "/settings"
} as const;

const USER_ROUTES = {
  login:          "/user/login",
  loginWithId:    "/user/login/:id",
  systemCheck:    "/user/:id/system-check",
  identity:       "/user/:id/Identity-verification",
  selfie:         "/user/:id/selfie-verification",
  instructions:   "/user/:id/interview-instruction",
  mcq:            "/user/:id/mcq-assessment",
  videoInterview: "/user/:id/video-interview",
  complete:       "/user/:id/assessment-complete",
  sessionEnd:     "/user/:id/session-end",
} as const;

/**
 * Encrypts a route path while preserving dynamic segments like :id
 * Dynamic segments (starting with :) are left unencoded.
 *
 * e.g. "/user/:id/system-check"
 *   → "/dXNlcg/:id/c3lzdGVtLWNoZWNr"
 */
const encryptPath = (path: string): string => {
  return path
    .split("/")
    .map((segment) => {
      if (segment === "" || segment.startsWith(":")) return segment; // keep empty & params
      return encryptRoute(segment);
    })
    .join("/");
};

/**
 * Fully encrypted route maps — use these in your <Route path="..." /> definitions.
 */
export const ENCRYPTED_ADMIN_ROUTES = Object.fromEntries(
  Object.entries(ADMIN_ROUTES).map(([key, value]) => [key, encryptPath(value)])
) as Record<keyof typeof ADMIN_ROUTES, string>;

export const ENCRYPTED_USER_ROUTES = Object.fromEntries(
  Object.entries(USER_ROUTES).map(([key, value]) => [key, encryptPath(value)])
) as Record<keyof typeof USER_ROUTES, string>;

/**
 * Navigation helpers — use these instead of hardcoding paths in navigate() or <Link to="...">
 *
 * Example:
 *   navigate(adminPath("dashboard"))        → navigates to encrypted dashboard path
 *   navigate(userPath("systemCheck", "42")) → navigates to encrypted system-check path with id=42
 */
export const adminPath = (key: keyof typeof ADMIN_ROUTES): string => {
  return ENCRYPTED_ADMIN_ROUTES[key];
};

export const userPath = (
  key: keyof typeof USER_ROUTES,
  id?: string
): string => {
  const path = ENCRYPTED_USER_ROUTES[key];
  return id ? path.replace(":id", id) : path;
};