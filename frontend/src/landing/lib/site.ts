/** Where things live, stated once so every link on the page agrees. */
export const PRODUCT = "Zener ID";
export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zenerid.com";

/** The API clients call. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.zenerid.com";

/**
 * The company dashboard. The landing, sign-in, register and dashboard live in
 * this one Next.js app, so these are paths.
 */
export const DASHBOARD_URL = "/dashboard";
export const SIGN_IN_HREF = "/login";
export const SIGN_UP_HREF = "/register";

/** Where "Contact sales" writes to. */
export const CONTACT_EMAIL = "hello@zenerid.com";
export const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Zener ID")}`;

export const PRIVACY_URL = "/privacy";
export const TERMS_URL = "/terms";
