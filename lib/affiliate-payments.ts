import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { paypalRequest } from "@/lib/paypal";
import { planForPayPalId } from "@/lib/paypal-subscriptions";
import { BILLING_PLANS } from "@/lib/billing";
import { cents } from "@/lib/affiliate-policy";
import { isUuid } from "@/lib/security";
import { ensureAffiliateCustomer } from "@/lib/affiliates";

type Obj = Record<string, unknown>;
function object(value: unknown): Obj { return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(value)) throw new Error('Invalid payment identifier');
  return value;
}
function environment() { return process.env.PAYPAL_ENVIRONMENT === 'live' ? 'live' : 'sandbox'; }
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now() + 300000) throw new Error('Invalid payment time');
  return new Date(value).toISOString();
}
export function relatedPayment(resource: Obj, kind: 'sale' | 'capture'): string {
  const related = object(object(resource.supplementary_data).related_ids);
  const direct = resource.sale_id || related.capture_id;
  if (direct) return id(direct);
  for (const link of Array.isArray(resource.links) ? resource.links : []) {
    const item = object(link);
    if (item.rel !== 'up' || typeof item.href !== 'string') continue;
    const url = new URL(item.href);
    if (!['api.paypal.com','api-m.paypal.com','api.sandbox.paypal.com','api-m.sandbox.paypal.com'].includes(url.hostname) || url.protocol !== 'https:') continue;
    const match = url.pathname.match(kind === 'sale' ? /^\/v1\/payments\/sale\/([A-Za-z0-9-]+)$/ : /^\/v2\/payments\/captures\/([A-Za-z0-9-]+)$/);
    if (match) return id(match[1]);
  }
  throw new Error('Original payment not identified');
}

export async function recordAffiliatePayment(kind: 'sale' | 'capture', transaction: string) {
  transaction = id(transaction);
  const admin = createAdminClient();
  const { body: raw } = await paypalRequest(kind === 'sale' ? `/v1/payments/sale/${transaction}` : `/v2/payments/captures/${transaction}`);
  const payment = object(raw);
  const state = String(payment.state || payment.status).toUpperCase();
  if (!['COMPLETED','REFUNDED','PARTIALLY_REFUNDED','REVERSED'].includes(state)) throw new Error('Payment has not completed');
  const amount = object(payment.amount);
  if ((amount.currency || amount.currency_code) !== 'USD') throw new Error('Non-USD payment requires review');
  const gross = cents(amount.total || amount.value);
  let tax = cents(object(amount.details).tax || '0');
  let userId: string, label: string, subscriptionId: string | null = null, payerEmail: string | null = null, payerId: string | null = null;
  if (kind === 'sale') {
    subscriptionId = id(payment.billing_agreement_id);
    const { body: rawSubscription } = await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`);
    const subscription = object(rawSubscription);
    const plan = planForPayPalId(typeof subscription.plan_id === 'string' ? subscription.plan_id : null);
    if (!plan || !isUuid(subscription.custom_id)) throw new Error('Subscription does not match a Dexlyy customer and plan');
    userId = subscription.custom_id;
    label = `${BILLING_PLANS[plan.planKey].name} · ${plan.billingInterval === 'year' ? 'Annual' : 'Monthly'}`;
    const subscriber = object(subscription.subscriber);
    payerEmail = typeof subscriber.email_address === 'string' ? subscriber.email_address : null;
    payerId = typeof subscriber.payer_id === 'string' ? subscriber.payer_id : null;
  } else {
    const orderId = id(object(object(payment.supplementary_data).related_ids).order_id);
    const order = await admin.from('paypal_orders').select('user_id,amount,currency,add_on_key').eq('paypal_order_id', orderId).maybeSingle();
    if (order.error || !order.data) throw new Error('Order not yet mapped');
    if (order.data.currency !== 'USD' || cents(String(order.data.amount)) !== gross) throw new Error('Order amount mismatch');
    const { body: rawOrder } = await paypalRequest(`/v2/checkout/orders/${orderId}`);
    const providerOrder = object(rawOrder);
    const units = Array.isArray(providerOrder.purchase_units) ? providerOrder.purchase_units : [];
    const unit = units.map(object).find(unit => {
      const captures = object(unit.payments).captures;
      return Array.isArray(captures) && captures.some(capture => object(capture).id === transaction);
    });
    if (!unit || unit.custom_id !== order.data.user_id) throw new Error('Order ownership mismatch');
    tax = cents(object(object(object(unit.amount).breakdown).tax_total).value || '0');
    userId = order.data.user_id;
    label = `Interview pack · ${order.data.add_on_key.replace('pack_', '')} interviews`;
    payerEmail = typeof object(providerOrder.payer).email_address === 'string' ? String(object(providerOrder.payer).email_address) : null;
    payerId = typeof object(providerOrder.payer).payer_id === 'string' ? String(object(providerOrder.payer).payer_id) : null;
  }
  if (tax > gross || gross <= 0) throw new Error('Payment amount requires review');
  await ensureAffiliateCustomer(userId);
  const { data, error } = await admin.rpc('affiliate_record_payment', {
    p_environment: environment(), p_kind: kind, p_transaction: transaction, p_user: userId,
    p_gross: gross, p_base: gross - tax, p_paid_at: timestamp(payment.create_time), p_label: label,
    p_subscription: subscriptionId, p_payer_email: payerEmail, p_payer_id: payerId, p_review: state === 'PARTIALLY_REFUNDED',
  });
  if (error) throw new Error('Commission could not be recorded');
  // A sale/capture in PARTIALLY_REFUNDED state does not reliably include a
  // complete refund history. Block payout until an admin reconciles that history.
  if (['REFUNDED','REVERSED'].includes(state)) {
    const reversed = await admin.rpc('affiliate_record_refund', { p_environment: environment(), p_kind: kind, p_transaction: transaction, p_refund: `full-${transaction}`, p_cents: gross, p_full: true });
    if (reversed.error) throw new Error('Payment reversal requires retry');
    const cleared = await admin.from('affiliate_payments').update({ review_required: false }).eq('id', data);
    if (cleared.error) throw new Error('Refund review could not be finalised');
  }
  return data;
}

const TYPES = new Set(['PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED','PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED']);

export async function processAffiliateEvent(event: Obj) {
  const type = String(event.event_type);
  if (!TYPES.has(type)) return;
  const resource = object(event.resource);
  const kind = type.includes('.SALE.') ? 'sale' : 'capture';
  if (type.endsWith('.COMPLETED')) { await recordAffiliatePayment(kind, id(resource.id)); return; }
  const full = type.endsWith('.REVERSED');
  const transaction = full ? id(resource.id) : relatedPayment(resource, kind);
  // A refund may arrive before the original payment notification.
  const admin = createAdminClient();
  const known = await admin.from('affiliate_payments').select('id').eq('environment', environment()).eq('kind', kind).eq('transaction_id', transaction).maybeSingle();
  if (known.error) throw new Error('Original payment could not be checked');
  if (!known.data) await recordAffiliatePayment(kind, transaction);
  const amount = object(resource.amount);
  if (!full && (amount.currency || amount.currency_code) !== 'USD') throw new Error('Refund currency requires review');
  const { error } = await createAdminClient().rpc('affiliate_record_refund', {
    p_environment: environment(), p_kind: kind, p_transaction: transaction,
    p_refund: full ? `reversal-${id(resource.id)}` : id(resource.id),
    p_cents: full ? 0 : cents(amount.total || amount.value), p_full: full,
  });
  if (error) throw new Error('Refund requires retry');
}

// Only call with a signature-verified webhook or a server-confirmed capture.
export async function ingestAffiliateEvent(event: Obj) {
  if (!TYPES.has(String(event.event_type))) return;
  const admin = createAdminClient();
  const eventId = `${environment()}:${id(event.id)}`;
  const saved = await admin.from('affiliate_events').upsert({ event_id: eventId, payload: event }, { onConflict: 'event_id', ignoreDuplicates: true });
  if (saved.error) throw new Error('Financial event could not be stored');
  const prior = await admin.from('affiliate_events').select('processed_at').eq('event_id', eventId).single();
  if (prior.error) throw new Error('Financial event could not be checked');
  if (prior.data.processed_at) return;
  await runStoredEvent(eventId, event);
}

async function runStoredEvent(eventId: string, event: Obj) {
  const admin = createAdminClient();
  try {
    await processAffiliateEvent(event);
    const saved = await admin.from('affiliate_events').update({ processed_at: new Date().toISOString(), last_error: null }).eq('event_id', eventId);
    if (saved.error) throw new Error('Financial event could not be finalised');
  } catch {
    await admin.from('affiliate_events').update({ last_error: 'Payment verification or matching requires retry.', next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString() }).eq('event_id', eventId);
    throw new Error('Financial event queued for retry');
  }
}
export async function retryAffiliateEvents() {
  const admin = createAdminClient();
  const result = await admin.from('affiliate_events').select('event_id,payload,attempts').like('event_id', `${environment()}:%`).is('processed_at', null).lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(10);
  if (result.error) throw new Error('Retry queue unavailable');
  let processed = 0;
  for (const row of result.data || []) {
    await admin.from('affiliate_events').update({ attempts: row.attempts + 1, next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString() }).eq('event_id', row.event_id);
    try { await runStoredEvent(row.event_id, row.payload); processed++; } catch { /* Keep durable retry state. */ }
  }
  await admin.from('affiliate_visits').delete().lt('expires_at', new Date().toISOString());
  return { checked: result.data?.length || 0, processed };
}
