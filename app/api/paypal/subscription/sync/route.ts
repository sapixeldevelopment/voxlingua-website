import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { dateFromPayPal, planForPayPalId, planLimits, subscriptionStatus } from "@/lib/paypal-subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, noStoreJson, rejectCrossOrigin } from "@/lib/security";

type PayPalSubscription = {
  status?: string;
  plan_id?: string;
  billing_info?: { next_billing_time?: string };
};

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`paypal-sync:${auth.user.id}`, 30, 600))) return noStoreJson({ error: "Too many billing refresh requests." }, { status: 429 });
  const { data: billing, error: billingError } = await supabase.from("owner_billing").select("id,paypal_subscription_id").eq("user_id", auth.user.id).maybeSingle();
  if (billingError) return NextResponse.json({ error: billingError.message }, { status: 500 });
  if (!billing?.paypal_subscription_id) return NextResponse.json({ ok: true, billing: null });

  try {
    const { body: subscription } = await paypalRequest<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(billing.paypal_subscription_id)}`);
    const plan = planForPayPalId(subscription?.plan_id);
    const patch: Record<string, string | number | null> = { status: subscriptionStatus(subscription?.status) };
    if (subscription?.plan_id) patch.paypal_plan_id = subscription.plan_id;
    if (plan) Object.assign(patch, { ...planLimits(plan.planKey), billing_interval: plan.billingInterval });
    const nextBillingDate = dateFromPayPal(subscription?.billing_info?.next_billing_time);
    if (nextBillingDate) {
      patch.subscription_period_end = nextBillingDate;
      if (plan?.billingInterval === "month") patch.monthly_period_end = nextBillingDate;
    }
    const admin = createAdminClient();
    const { error } = await admin.from("owner_billing").update(patch).eq("id", billing.id).eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal subscription sync failed." }, { status: 502 });
  }
}
