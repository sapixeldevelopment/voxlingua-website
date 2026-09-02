import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { REMEMBER_ME_COOKIE, authCookieOptions, rememberMeEnabled } from "@/lib/supabase/session";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return typeof document === "undefined" ? [] : parseCookieHeader(document.cookie);
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          // Read at write-time: the singleton can predate the login selection.
          const rememberMe = rememberMeEnabled(parseCookieHeader(document.cookie)
            .find(({ name }) => name === REMEMBER_ME_COOKIE)?.value);
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(name, value, authCookieOptions(options, rememberMe));
          });
        },
      },
    }
  );
}
