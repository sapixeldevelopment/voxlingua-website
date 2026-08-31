import { NextResponse } from "next/server";
import { BILLING_INTERVALS, BILLING_PLANS, PLAN_KEYS, type BillingInterval, type PlanKey } from "@/lib/billing";
import { paypalRequest } from "@/lib/paypal";
import { serverPlanId } from "@/lib/paypal-subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

function periodDates(interval: BillingInterval, nextBillingTime?: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthlyEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const fallbackSubscriptionEnd = new Date(Date.UTC(now.getUTCFullYear() + (interval === "year" ? 1 : 0), now.getUTCMonth() + (interval === "year" ? 0 : 1), 1));
  const subscriptionEnd = nextBillingTime ? new Date(nextBillingTime) : fallbackSubscriptionEnd;
  return {
    start: start.toISOString().slice(0, 10),
    monthlyEnd: (interval === "month" ? subscriptionEnd : monthlyEnd).toISOString().slice(0, 10),
    subscriptionEnd: subscriptionEnd.toISOString().slice(0, 10),
  };
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`paypal-activate:${auth.user.id}`, 12, 3600))) return noStoreJson({ error: "Too many subscription attempts." }, { status: 429 });
  const body = await readJsonBody<{ subscriptionId?: string; planKey?: string; billingInterval?: string }>(request, 4_096);
  if (!body?.subscriptionId || !PLAN_KEYS.includes(body.planKey as PlanKey) || !BILLING_INTERVALS.includes(body.billingInterval as BillingInterval)) return NextResponse.json({ error: "Invalid PayPal subscription details." }, { status: 400 });
  const planKey = body.planKey as PlanKey;
  const billingInterval = body.billingInterval as BillingInterval;
  const expectedPlanId = serverPlanId(planKey, billingInterval);
  if (!expectedPlanId) return NextResponse.json({ error: "This subscription plan is not configured yet." }, { status: 503 });
  try {
    const { body: subscription } = await paypalRequest<{ status?: string; plan_id?: string; custom_id?: string; subscriber?: { payer_id?: string }; billing_info?: { next_billing_time?: string } }>(`/v1/billing/subscriptions/${encodeURIComponent(body.subscriptionId)}`);
    if (subscription?.status !== "ACTIVE" || subscription.plan_id !== expectedPlanId || subscription.custom_id !== auth.user.id) {
      return NextResponse.json({ error: "PayPal did not confirm an active matching subscription." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: claimed } = await admin.from("owner_billing").select("user_id").eq("paypal_subscription_id", body.subscriptionId).maybeSingle();
    if (claimed && claimed.user_id !== auth.user.id) return noStoreJson({ error: "This PayPal subscription is already connected to another account." }, { status: 409 });
    const dates = periodDates(billingInterval, subscription.billing_info?.next_billing_time);
    const plan = BILLING_PLANS[planKey];
    const { error } = await admin.from("owner_billing").upsert({
      user_id: auth.user.id,
      plan_key: planKey,
      billing_interval: billingInterval,
      status: "active",
      paypal_subscription_id: body.subscriptionId,
      paypal_plan_id: expectedPlanId,
      paypal_payer_id: subscription.subscriber?.payer_id || null,
      monthly_interview_limit: plan.interviews,
      daily_interview_limit: plan.dailyInterviews,
      server_limit: plan.servers,
      staff_limit: plan.staff,
      monthly_interviews_used: 0,
      daily_interviews_used: 0,
      daily_period_start: new Date().toISOString().slice(0, 10),
      monthly_period_start: dates.start,
      monthly_period_end: dates.monthlyEnd,
      subscription_period_end: dates.subscriptionEnd,
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal subscription activation failed." }, { status: 502 });
  }
}
