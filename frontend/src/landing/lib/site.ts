/** Where things live, stated once so every link on the page agrees. */
export const PRODUCT = "Zener ID";
export const SITE = import.meta.env.VITE_SITE_URL ?? "https://zenerid.com";

/** The API clients call. */
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "https://api.zenerid.com");

/**
 * The client dashboard. In this app the landing, sign-in, register and dashboard
 * live together, so it is a path. (In the separate Next.js `landing` repo it was
 * another site, reached through a shared session cookie.)
 */
export const DASHBOARD_URL = "/app";
export const SIGN_IN_HREF = "/login";
export const SIGN_UP_HREF = "/signup";

/** Where "Contact sales" writes to. */
export const CONTACT_EMAIL = "hello@zenerid.com";
export const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Zener ID")}`;

export const PRIVACY_URL = "/privacy";
export const TERMS_URL = "/terms";
