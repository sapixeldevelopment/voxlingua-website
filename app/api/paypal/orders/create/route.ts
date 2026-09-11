import { NextResponse } from "next/server";
import { isGuidedPlan, PREPAID_PACKS, type PrepaidPackKey } from "@/lib/billing";
import { paypalRequest } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, readJsonBody, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`paypal-order:${auth.user.id}`, 20, 3600))) return NextResponse.json({ error: "Too many payment attempts." }, { status: 429 });
  const body = await readJsonBody<{ packKey?: string }>(request, 2_048);
  const packKey = body?.packKey as PrepaidPackKey;
  if (!packKey || !Object.prototype.hasOwnProperty.call(PREPAID_PACKS, packKey)) return NextResponse.json({ error: "Invalid prepaid pack." }, { status: 400 });
  const { data: billing, error: billingError } = await supabase.from("owner_billing").select("status,plan_key").eq("user_id", auth.user.id).maybeSingle();
  if (billingError) return NextResponse.json({ error: billingError.message }, { status: 500 });
  if (billing?.status !== "active") return NextResponse.json({ error: "An active monthly subscription is required before buying extra interview credits." }, { status: 402 });
  if (isGuidedPlan(billing.plan_key)) return NextResponse.json({ error: "Extra interview credit packs are only available for Conversational AI plans. Upgrade your Guided Voice plan for a larger allowance." }, { status: 400 });
  const pack = PREPAID_PACKS[packKey];
  try {
    const { body: order } = await paypalRequest<{ id?: string }>("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: auth.user.id,
          description: `Dexlyy ${pack.name}`,
          amount: { currency_code: "USD", value: pack.price },
        }],
      }),
    });
    if (!order?.id) return NextResponse.json({ error: "PayPal did not create an order." }, { status: 502 });
    const admin = createAdminClient();
    const { error } = await admin.from("paypal_orders").insert({ paypal_order_id: order.id, user_id: auth.user.id, add_on_key: packKey, interview_credits: pack.credits, amount: pack.price, currency: "USD", status: "created" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal order creation failed." }, { status: 502 });
  }
}
