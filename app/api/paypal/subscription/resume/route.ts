import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`paypal-resume:${auth.user.id}`, 6, 3600))) return NextResponse.json({ error: "Too many subscription requests." }, { status: 429 });

  const { data: billing, error: billingError } = await supabase.from("owner_billing").select("id,status,paypal_subscription_id,subscription_period_end").eq("user_id", auth.user.id).maybeSingle();
  if (billingError) return NextResponse.json({ error: billingError.message }, { status: 500 });
  if (!billing?.paypal_subscription_id) return NextResponse.json({ error: "No paused PayPal subscription is connected to this account." }, { status: 400 });
  if (billing.status === "active") return NextResponse.json({ ok: true, alreadyActive: true });
  if (billing.status !== "suspended") return NextResponse.json({ error: "Only a paused subscription can be resumed. Please choose a plan again." }, { status: 400 });
  if (billing.subscription_period_end && new Date(`${billing.subscription_period_end}T00:00:00Z`) <= new Date()) return NextResponse.json({ error: "This paid billing period has ended. Choose a plan to start a new subscription." }, { status: 400 });

  try {
    await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(billing.paypal_subscription_id)}/activate`, {
      method: "POST",
      body: JSON.stringify({ reason: "Dexlyy subscription resumed by the account owner." }),
    });
    const admin = createAdminClient();
    const { error } = await admin.from("owner_billing").update({ status: "active" }).eq("id", billing.id).eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: `PayPal resumed the subscription, but Dexlyy could not update its status: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal could not resume the subscription." }, { status: 502 });
  }
}
