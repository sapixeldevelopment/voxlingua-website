export const AFFILIATE_TERMS_VERSION = "2026-09-02";
export const REFERRAL_COOKIE = "dexlyy_referral";
export const REFERRAL_SECONDS = 30 * 24 * 60 * 60;
export const COMMISSION_BPS = 1500;
export const PAYOUT_MINIMUM_CENTS = 2500;

export function referralCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const code = value.trim().toLowerCase();
  return /^[a-z0-9]{12}$/.test(code) ? code : "";
}
export function payoutEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) ? email : "";
}
export function cents(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) throw new Error("Invalid USD amount");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result > 100_000_000) throw new Error("Amount exceeds review limit");
  return result;
}
export function commissionCents(base: number): number {
  if (!Number.isSafeInteger(base) || base < 0 || base > 100_000_000) throw new Error("Invalid commission base");
  return Math.round(base * COMMISSION_BPS / 10000);
}
export function usd(value: number | string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) / 100);
}
export function safeNext(value: string | null): string {
  return value && /^\/(?!\/)[a-zA-Z0-9/_?=&%-]*$/.test(value) && !/%(?:2f|5c|0[ad])/i.test(value) ? value : "/dashboard";
}
export type Partner = {
  id: string; code: string; display_name: string; promotion: string; country: string;
  payout_email: string; payout_verified: boolean; payout_updated_at: string;
  status: "pending" | "approved" | "suspended" | "rejected"; created_at: string;
};
export type AffiliateSummary = { referrals: number; customers: number; pending_cents: number; available_cents: number; reserved_cents: number; paid_cents: number; referred_revenue_cents: number };
export type AffiliatePayout = { id: string; amount_cents: number; status: "reserved" | "paid" | "cancelled"; payout_email: string; payment_reference: string | null; created_at: string; paid_at: string | null };
export type AffiliateEntry = { id: string; amount_cents: number; available_at: string; created_at: string; payout_id: string | null };
export type PartnerData = { partner: Partner | null; summary?: AffiliateSummary; entries?: AffiliateEntry[]; payouts?: AffiliatePayout[]; hasMore?: boolean };
