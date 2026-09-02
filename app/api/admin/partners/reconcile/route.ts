import { affiliateAccess } from "@/lib/affiliates";
import { recordAffiliatePayment, retryAffiliateEvents } from "@/lib/affiliate-payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { paypalRequest } from "@/lib/paypal";
import { noStoreJson, readJsonBody } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const access = await affiliateAccess(request, true);
    if (access.response) return access.response;
    const body = await readJsonBody<Record<string, unknown>>(request, 2048);
    if (!body) return noStoreJson({ error: "Choose a reconciliation action." }, { status: 400 });
    if (body.action === 'retry') return noStoreJson(await retryAffiliateEvents());
    if (body.action === 'transaction' && (body.kind === 'sale' || body.kind === 'capture') && typeof body.transaction === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(body.transaction)) {
      await recordAffiliatePayment(body.kind, body.transaction);
    } else if (body.action === 'subscription' && typeof body.subscription === 'string' && /^I-[A-Za-z0-9]+$/.test(body.subscription)) {
      const end = new Date(), start = new Date(end.getTime() - 30 * 86400000);
      const { body: result } = await paypalRequest<{ transactions?: Array<{ id: string; status: string }>; total_items?: number }>(`/v1/billing/subscriptions/${encodeURIComponent(body.subscription)}/transactions?start_time=${encodeURIComponent(start.toISOString())}&end_time=${encodeURIComponent(end.toISOString())}`);
      const transactions = result?.transactions || [];
      if (transactions.length > 25 || (result?.total_items || 0) > transactions.length) return noStoreJson({ error: "This history requires individual transaction reconciliation." }, { status: 409 });
      for (const transaction of transactions) if (['COMPLETED','REFUNDED','PARTIALLY_REFUNDED','REVERSED'].includes(transaction.status)) await recordAffiliatePayment('sale', transaction.id);
    } else return noStoreJson({ error: "Enter a valid transaction or subscription ID." }, { status: 400 });
    await createAdminClient().from('affiliate_audit').insert({ actor_id: access.user.id, action: 'reconcile', details: { action: body.action, transaction: body.transaction || body.subscription } });
    return noStoreJson({ ok: true });
  } catch { return noStoreJson({ error: "Reconciliation requires review. Check the PayPal ID, environment, and payment state; no unverified earnings were added." }, { status: 409 }); }
}
