export const REMEMBER_ME_COOKIE = "dexlyy-remember";
export const REMEMBER_ME_MAX_AGE = 400 * 24 * 60 * 60;

export function rememberMeEnabled(value?: string | null) {
  return value !== "0";
}

export function authCookieOptions(options: CookieOptions, rememberMe: boolean): CookieOptions {
  const result = { ...options };
  // SSR adds its default maxAge when writing cookies, after cookieOptions is
  // merged. Enforce the preference at the final write, preserving deletions.
  if (!rememberMe && !(typeof result.maxAge === "number" && result.maxAge <= 0)) {
    delete result.maxAge;
    delete result.expires;
  }
  if (process.env.NODE_ENV === "production") result.secure = true;
  return result;
}
import type { CookieOptions } from "@supabase/ssr";
