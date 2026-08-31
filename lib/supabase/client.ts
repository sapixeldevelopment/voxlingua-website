import { createBrowserClient } from "@supabase/ssr";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE, rememberMeEnabled } from "@/lib/supabase/session";

export function createClient() {
  const rememberMe = typeof document === "undefined"
    ? true
    : rememberMeEnabled(document.cookie.split("; ").find((cookie) => cookie.startsWith(`${REMEMBER_ME_COOKIE}=`))?.split("=")[1]);
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { maxAge: rememberMe ? REMEMBER_ME_MAX_AGE : undefined } }
  );
}
