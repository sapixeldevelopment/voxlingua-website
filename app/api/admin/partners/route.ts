import { affiliateAccess, PARTNER_FIELDS, partnerData } from "@/lib/affiliates";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, noStoreJson, readJsonBody } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const access = await affiliateAccess(request, true);
    if (access.response) return access.response;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const admin = createAdminClient();
    if (id) {
      if (!isUuid(id)) return noStoreJson({ error: "Invalid partner." }, { status: 400 });
      const { data: partner, error } = await admin.from("affiliate_partners").select(PARTNER_FIELDS).eq("id", id).maybeSingle();
      if (error || !partner) return noStoreJson({ error: "Partner unavailable." }, { status: 404 });
      const page = Math.max(0, Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 0)));
      const audit = await admin.from("affiliate_audit").select("id,action,details,created_at").eq("partner_id", id).order("created_at", { ascending: false }).limit(30);
      const reviews = await admin.from('affiliate_payments').select('transaction_id,gross_cents,refunded_cents,commission_cents,reversed_commission_cents,affiliate_referrals!inner(partner_id)').eq('review_required', true).eq('affiliate_referrals.partner_id', id).limit(100);
      if (audit.error || reviews.error) throw new Error('Review records unavailable');
      return noStoreJson({ partner, ...await partnerData(id, page), audit: audit.data || [], reviews: reviews.data || [] });
    }
    const page = Math.max(0, Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 0)));
    const filter = url.searchParams.get("status");
    let query = admin.from("affiliate_partners").select(PARTNER_FIELDS).order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 25);
    if (filter && ['pending','approved','suspended','rejected'].includes(filter)) query = query.eq("status", filter);
    const result = await query;
    if (result.error) throw result.error;
    const pending = await admin.from("affiliate_events").select("event_id", { count: "exact", head: true }).is("processed_at", null);
    return noStoreJson({ partners: result.data?.slice(0, 25), hasMore: (result.data?.length || 0) > 25, pendingEvents: pending.count || 0 });
  } catch { return noStoreJson({ error: "Partner administration is temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const access = await affiliateAccess(request, true);
    if (access.response) return access.response;
    const body = await readJsonBody<Record<string, unknown>>(request, 4096);
    const actions = ['approve','suspend','reject','verify_payout','reserve','paid','cancel_payout','review_refunds'];
    if (!isUuid(body?.partnerId) || typeof body?.action !== 'string' || !actions.includes(body.action)
      || typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1000 || body.confirm !== true
      || (['paid','cancel_payout'].includes(body.action) && !isUuid(body.payoutId))
      || (body.action === 'paid' && (typeof body.reference !== 'string' || !/^[A-Za-z0-9-]{8,100}$/.test(body.reference)))) {
      return noStoreJson({ error: "Confirm the action and provide an audit note. Paid records also require the actual payment reference." }, { status: 400 });
    }
    const { data, error } = await createAdminClient().rpc("affiliate_admin_action", {
      p_actor: access.user.id, p_partner: body.partnerId, p_action: body.action, p_note: body.note.trim(),
      p_payout: body.payoutId || null, p_reference: body.action === 'paid' ? body.reference : null,
    });
    if (error) {
      // Only expose our explicit business-rule messages, never SQL internals.
      const message = error.code === 'P0001' ? error.message : "Action could not be completed. Refresh and review the payout records.";
      return noStoreJson({ error: message }, { status: 409 });
    }
    return noStoreJson(data);
  } catch { return noStoreJson({ error: "The action could not be completed." }, { status: 503 }); }
}
