import { NextResponse } from "next/server";
import { BILLING_INTERVALS, BILLING_PLANS, PREPAID_PACKS, getPublicPayPalPlanId, type BillingInterval, type PlanKey } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import {serverPlanId} from "@/lib/paypal-subscriptions";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const { data, error } = await supabase
    .from("owner_billing")
    .select("id,user_id,plan_key,billing_interval,status,server_limit,staff_limit,monthly_interview_limit,monthly_interviews_used,daily_interview_limit,daily_interviews_used,daily_period_start,monthly_period_start,monthly_period_end,subscription_period_end,prepaid_interviews,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const planIds = Object.fromEntries(BILLING_INTERVALS.map((interval: BillingInterval) => [
    interval,
    Object.fromEntries((Object.keys(BILLING_PLANS) as PlanKey[]).map((key) => [key, serverPlanId(key, interval)])),
  ]));
  return NextResponse.json({
    billing: data || null,
    plans: BILLING_PLANS,
    prepaidPacks: PREPAID_PACKS,
    paypal: { clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "", planIds, customId: auth.user.id },
  });
}
