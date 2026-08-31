import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE, rememberMeEnabled } from "@/lib/supabase/session";

export async function createClient() {
  const cookieStore = await cookies();
  const rememberMe = rememberMeEnabled(cookieStore.get(REMEMBER_ME_COOKIE)?.value);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { maxAge: rememberMe ? REMEMBER_ME_MAX_AGE : undefined },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot always write cookies. Proxy/session refresh
            // can be added once the application is deployed behind a domain.
          }
        },
      },
    }
  );
}
