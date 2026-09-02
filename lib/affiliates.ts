import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformStaff } from "@/lib/platform-staff";
import { REFERRAL_COOKIE, referralCode } from "@/lib/affiliate-policy";
import { consumeRateLimit, noStoreJson } from "@/lib/security";

export const PARTNER_FIELDS = "id,code,display_name,promotion,country,payout_email,payout_verified,payout_updated_at,status,created_at";
export const PAYOUT_FIELDS = "id,amount_cents,status,payout_email,payment_reference,created_at,paid_at";
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newReferralToken() { return randomBytes(32).toString("hex"); }
export async function ensureAffiliateCustomer(userId: string) {
  const admin = createAdminClient();
  const existing = await admin.from('affiliate_customers').select('user_id').eq('user_id', userId).maybeSingle();
  if (existing.error) throw new Error('Customer registry unavailable');
  if (existing.data) return;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error('Customer identity unavailable');
  const saved = await admin.from('affiliate_customers').upsert({ user_id: data.user.id, email: data.user.email?.toLowerCase() || null, joined_at: data.user.created_at }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (saved.error) throw new Error('Customer registry unavailable');
}

export async function affiliateAccess(request?: Request, adminOnly = false) {
  if (request && !["GET", "HEAD"].includes(request.method)) {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return { response: noStoreJson({ error: "Same-origin request required." }, { status: 403 }) };
    }
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { response: noStoreJson({ error: "Please sign in." }, { status: 401 }) };
  if (adminOnly && (await getPlatformStaff(auth.user.id))?.role !== "admin") {
    return { response: noStoreJson({ error: "Dexlyy platform administrator access required." }, { status: 403 }) };
  }
  if (request && !await consumeRateLimit(`affiliates:${adminOnly ? 'admin' : 'partner'}:${auth.user.id}`, 120, 3600)) {
    return { response: noStoreJson({ error: "Please wait before trying again." }, { status: 429 }) };
  }
  return { user: auth.user };
}

export async function attachReferral(userId: string, manualCode?: string) {
  const token = (await cookies()).get(REFERRAL_COOKIE)?.value || "";
  if (!manualCode && !/^[a-f0-9]{64}$/.test(token)) return false;
  await ensureAffiliateCustomer(userId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("affiliate_attach", {
    p_user: userId, p_code: manualCode ? referralCode(manualCode) : null,
    p_token_hash: manualCode ? null : tokenHash(token),
  });
  if (error) throw new Error("Referral service is temporarily unavailable.");
  return data === true;
}

export async function partnerData(id: string, page = 0) {
  const admin = createAdminClient();
  const [summary, entries, payouts] = await Promise.all([
    admin.rpc("affiliate_summary", { p_partner: id }),
    admin.from("affiliate_ledger").select("id,amount_cents,available_at,created_at,payout_id").eq("partner_id", id).order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 25),
    admin.from("affiliate_payouts").select(PAYOUT_FIELDS).eq("partner_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (summary.error || entries.error || payouts.error) throw new Error("Partner records could not be loaded.");
  return { summary: summary.data, entries: entries.data?.slice(0, 25), hasMore: (entries.data?.length || 0) > 25, payouts: payouts.data };
}
