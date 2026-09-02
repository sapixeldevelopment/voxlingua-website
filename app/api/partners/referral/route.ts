import { cookies } from "next/headers";
import { affiliateAccess, attachReferral, newReferralToken, tokenHash } from "@/lib/affiliates";
import { referralCode, REFERRAL_COOKIE, REFERRAL_SECONDS } from "@/lib/affiliate-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, noStoreJson, readJsonBody } from "@/lib/security";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return noStoreJson({ error: "Same-origin request required." }, { status: 403 });
    const body = await readJsonBody<Record<string, unknown>>(request, 1024);
    const code = referralCode(body?.code);
    if (!code) return noStoreJson({ error: "A valid referral code is required." }, { status: 400 });
    if (body?.attach === true) {
      const access = await affiliateAccess(request);
      if (access.response) return access.response;
      const ok = await attachReferral(access.user.id, code);
      return noStoreJson(ok ? { ok: true } : { error: "This referral is unavailable or this account is not eligible. Referrals cannot be changed after assignment." }, { status: ok ? 200 : 409 });
    }
    // Cloudflare supplies this header; no IPs are retained by the rate limiter.
    const ip = request.headers.get("cf-connecting-ip") || "local";
    if (!await consumeRateLimit(`affiliate-visit:${ip}`, 30, 3600)) return noStoreJson({ error: "Please wait before trying again." }, { status: 429 });
    const admin = createAdminClient();
    const { data: partner, error } = await admin.from("affiliate_partners").select("id").eq("code", code).eq("status", "approved").maybeSingle();
    if (error) throw error;
    if (!partner) return noStoreJson({ error: "This partner link is not active." }, { status: 404 });
    const token = newReferralToken();
    const saved = await admin.from("affiliate_visits").insert({ token_hash: tokenHash(token), partner_id: partner.id });
    if (saved.error) throw saved.error;
    (await cookies()).set(REFERRAL_COOKIE, token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: REFERRAL_SECONDS });
    return noStoreJson({ ok: true });
  } catch { return noStoreJson({ error: "Referral could not be saved. You can enter the code before purchasing." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  try {
    const access = await affiliateAccess(request);
    if (access.response) return access.response;
    await attachReferral(access.user.id);
    return noStoreJson({ ok: true });
  } catch { return noStoreJson({ error: "Referral could not be checked. Please retry before checkout." }, { status: 503 }); }
}
