import { NextResponse } from "next/server";
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
  if (!(await consumeRateLimit(`paypal-capture:${auth.user.id}`, 20, 3600))) return NextResponse.json({ error: "Too many payment attempts." }, { status: 429 });
  const body = await readJsonBody<{ orderId?: string }>(request, 2_048);
  if (!body?.orderId) return NextResponse.json({ error: "Missing PayPal order ID." }, { status: 400 });
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from("paypal_orders").select("*").eq("paypal_order_id", body.orderId).eq("user_id", auth.user.id).single();
  if (orderError || !order) return NextResponse.json({ error: "Prepaid order not found." }, { status: 404 });
  if (order.status === "completed") return NextResponse.json({ ok: true, credits: order.interview_credits });
  try {
    const { body: capture } = await paypalRequest<{ status?: string; purchase_units?: Array<{ payments?: { captures?: Array<{ id?: string }> } }> }>(`/v2/checkout/orders/${encodeURIComponent(body.orderId)}/capture`, { method: "POST", body: JSON.stringify({}) });
    if (capture?.status !== "COMPLETED") return NextResponse.json({ error: "PayPal did not complete the payment." }, { status: 400 });
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    const { data: completion, error: completionError } = await admin.rpc("complete_prepaid_order", { p_order_id: order.id, p_capture_id: captureId });
    if (completionError) return NextResponse.json({ error: completionError.message }, { status: 500 });
    return NextResponse.json(completion || { ok: true, credits: order.interview_credits });
  } catch (error) {
    await admin.from("paypal_orders").update({ status: "failed" }).eq("id", order.id).eq("status", "created");
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal payment capture failed." }, { status: 502 });
  }
}
