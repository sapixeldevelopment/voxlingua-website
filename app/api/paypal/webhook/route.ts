import { NextResponse } from "next/server";
import { planForPayPalId, planLimits } from "@/lib/paypal-subscriptions";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestAffiliateEvent } from "@/lib/affiliate-payments";

const statusMap: Record<string, string> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": "active",
  "BILLING.SUBSCRIPTION.UPDATED": "active",
  "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED": "active",
  "PAYMENT.SALE.COMPLETED": "active",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "past_due",
  "PAYMENT.SALE.REVERSED": "past_due",
  "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
  "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
  "BILLING.SUBSCRIPTION.EXPIRED": "expired",
};

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 262_144) return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 262_144) return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });
  let event: Record<string, unknown>;
  try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 }); }
  try {
    if (!(await verifyPayPalWebhook(request.headers, event))) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    // Financial events must not be discarded by the subscription status timestamp
    // filter below: older payments and refunds still belong in the ledger.
    await ingestAffiliateEvent(event);
    const eventId = typeof event.id === "string" ? event.id : null;
    const eventType = typeof event.event_type === "string" ? event.event_type : "";
    const occurredAt = typeof event.create_time === "string" && !Number.isNaN(Date.parse(event.create_time)) ? new Date(event.create_time).toISOString() : null;
    if (!eventId || eventId.length > 200) return NextResponse.json({ error: "Webhook event ID is missing." }, { status: 400 });

    const admin = createAdminClient();
    const { error: claimError } = await admin.from("paypal_webhook_events").insert({ event_id: eventId, event_type: eventType, occurred_at: occurredAt });
    if (claimError) {
      const { data: prior, error: priorError } = await admin.from("paypal_webhook_events").select("processed_at").eq("event_id", eventId).maybeSingle();
      if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
      if (priorError || !prior) return NextResponse.json({ error: "Webhook idempotency check failed." }, { status: 500 });
    }

    const resource = typeof event.resource === "object" && event.resource ? event.resource as Record<string, unknown> : null;
    const subscriptionId = resource
      ? (resource.billing_agreement_id || resource.id)
      : null;
    const nextStatus = statusMap[eventType];
    if (typeof subscriptionId !== "string" || !nextStatus) {
      await admin.from("paypal_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
      return NextResponse.json({ received: true });
    }
    const { data: currentBilling } = await admin.from("owner_billing").select("id,paypal_last_event_at").eq("paypal_subscription_id", subscriptionId).maybeSingle();
    if (!currentBilling) {
      await admin.from("paypal_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
      return NextResponse.json({ received: true, unmatched: true });
    }
    if (occurredAt && currentBilling.paypal_last_event_at && new Date(occurredAt) < new Date(currentBilling.paypal_last_event_at)) {
      await admin.from("paypal_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
      return NextResponse.json({ received: true, stale: true });
    }
    const billingInfo = resource && typeof resource.billing_info === "object" && resource.billing_info ? resource.billing_info as Record<string, unknown> : null;
    const nextBillingTime = typeof billingInfo?.next_billing_time === "string" ? billingInfo.next_billing_time : null;
    const patch: Record<string, string | number> = { status: nextStatus };
    if (occurredAt) patch.paypal_last_event_at = occurredAt;
    const plan = planForPayPalId(typeof resource?.plan_id === "string" ? resource.plan_id : null);
    if (nextBillingTime) {
      patch.subscription_period_end = new Date(nextBillingTime).toISOString().slice(0, 10);
      if (plan?.billingInterval === "month") patch.monthly_period_end = new Date(nextBillingTime).toISOString().slice(0, 10);
    }
    if (plan) Object.assign(patch, { paypal_plan_id: resource?.plan_id as string, billing_interval: plan.billingInterval, ...planLimits(plan.planKey) });
    const { error } = await admin.from("owner_billing").update(patch).eq("id", currentBilling.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("paypal_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 });
  }
}
