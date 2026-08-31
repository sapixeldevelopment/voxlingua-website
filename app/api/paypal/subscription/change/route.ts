import { NextResponse } from "next/server";
import { BILLING_INTERVALS, PLAN_KEYS, type BillingInterval, type PlanKey } from "@/lib/billing";
import { paypalRequest } from "@/lib/paypal";
import { serverPlanId } from "@/lib/paypal-subscriptions";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin, consumeRateLimit, readJsonBody, rejectCrossOrigin } from "@/lib/security";

type PayPalLink = { href?: string; rel?: string };

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`paypal-change:${auth.user.id}`, 12, 3600))) return NextResponse.json({ error: "Too many subscription requests." }, { status: 429 });

  const body = await readJsonBody<{ planKey?: string; billingInterval?: string }>(request, 2_048);
  if (!body?.planKey || !PLAN_KEYS.includes(body.planKey as PlanKey) || !BILLING_INTERVALS.includes(body.billingInterval as BillingInterval)) return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
  const planKey = body.planKey as PlanKey;
  const billingInterval = body.billingInterval as BillingInterval;
  const targetPlanId = serverPlanId(planKey, billingInterval);
  if (!targetPlanId) return NextResponse.json({ error: "This subscription plan is not configured yet." }, { status: 503 });

  const { data: billing, error: billingError } = await supabase.from("owner_billing").select("id,status,plan_key,billing_interval,paypal_subscription_id,paypal_plan_id").eq("user_id", auth.user.id).maybeSingle();
  if (billingError) return NextResponse.json({ error: billingError.message }, { status: 500 });
  if (!billing?.paypal_subscription_id || billing.status !== "active") return NextResponse.json({ error: "You need an active PayPal subscription before changing plans." }, { status: 400 });
  if ((billing.plan_key === planKey && billing.billing_interval === billingInterval) || billing.paypal_plan_id === targetPlanId) return NextResponse.json({ ok: true, unchanged: true });

  try {
    const origin = applicationOrigin(request);
    const { body: revised } = await paypalRequest<{ links?: PayPalLink[] }>(`/v1/billing/subscriptions/${encodeURIComponent(billing.paypal_subscription_id)}/revise`, {
      method: "POST",
      headers: { "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        plan_id: targetPlanId,
        application_context: {
          return_url: `${origin}/dashboard?billing=changed&plan=${planKey}`,
          cancel_url: `${origin}/dashboard?billing=cancelled`,
        },
      }),
    });
    const approvalUrl = revised?.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
    if (approvalUrl) return NextResponse.json({ requiresApproval: true, approvalUrl });
    return NextResponse.json({ ok: true, requiresApproval: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal could not change the subscription plan." }, { status: 502 });
  }
}
