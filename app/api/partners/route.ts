import { randomBytes } from "node:crypto";
import { affiliateAccess, PARTNER_FIELDS, partnerData, ensureAffiliateCustomer } from "@/lib/affiliates";
import { AFFILIATE_TERMS_VERSION, payoutEmail } from "@/lib/affiliate-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { noStoreJson, readJsonBody } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const access = await affiliateAccess(request);
    if (access.response) return access.response;
    const { data: partner, error } = await createAdminClient().from("affiliate_partners").select(PARTNER_FIELDS).eq("user_id", access.user.id).maybeSingle();
    if (error) throw error;
    const page = Math.min(10000, Math.max(0, Number(new URL(request.url).searchParams.get("page")) || 0));
    return noStoreJson({ partner, ...(partner ? await partnerData(partner.id, Math.floor(page)) : {}) });
  } catch { return noStoreJson({ error: "Partner records are temporarily unavailable." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const access = await affiliateAccess(request);
    if (access.response) return access.response;
    const body = await readJsonBody<Record<string, unknown>>(request, 4096);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const promotion = typeof body?.promotion === "string" ? body.promotion.trim() : "";
    const country = typeof body?.country === "string" ? body.country.trim().toUpperCase() : "";
    const email = payoutEmail(body?.email);
    if (!email || name.length < 2 || name.length > 80 || promotion.length < 20 || promotion.length > 1500 || !/^[A-Z]{2}$/.test(country) || body?.terms !== AFFILIATE_TERMS_VERSION) {
      return noStoreJson({ error: "Complete all fields and accept the partner terms." }, { status: 400 });
    }
    await ensureAffiliateCustomer(access.user.id);
    const { error } = await createAdminClient().from("affiliate_partners").insert({ user_id: access.user.id, code: randomBytes(6).toString("hex"), display_name: name, promotion, country, payout_email: email, terms_version: AFFILIATE_TERMS_VERSION });
    if (error) return noStoreJson({ error: error.code === "23505" ? "You already have a partner application. Refresh to view it." : "Application could not be saved." }, { status: 409 });
    return noStoreJson({ ok: true });
  } catch { return noStoreJson({ error: "Application could not be saved. Please try again." }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  try {
    const access = await affiliateAccess(request);
    if (access.response) return access.response;
    const body = await readJsonBody<Record<string, unknown>>(request, 1024);
    const email = payoutEmail(body?.email);
    if (!email) return noStoreJson({ error: "Enter a valid PayPal email address." }, { status: 400 });
    const { error } = await createAdminClient().rpc("affiliate_update_payout", { p_user: access.user.id, p_email: email });
    if (error) return noStoreJson({ error: "Payout details could not be changed. Contact support if a payout is in progress." }, { status: 409 });
    return noStoreJson({ ok: true });
  } catch { return noStoreJson({ error: "Unable to update payout details." }, { status: 503 }); }
}
