import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attachReferral } from "@/lib/affiliates";
import { safeNext } from "@/lib/affiliate-policy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") || "/dashboard";
  const next = safeNext(requestedNext);
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(new URL(`/auth/auth-code-error?message=${encodeURIComponent(providerError)}`, url.origin));
  }
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/auth/auth-code-error?message=${encodeURIComponent(error.message)}`, url.origin));
    }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      // Do not break sign-in if referral storage is unavailable. Checkout retries it.
      try { await attachReferral(auth.user.id); } catch { console.warn("Referral attachment deferred to checkout"); }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
