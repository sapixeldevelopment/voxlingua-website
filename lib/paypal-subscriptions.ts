import "server-only";

import { BILLING_INTERVALS, BILLING_PLANS, PLAN_KEYS, REALTIME_PLAN_KEYS, isGuidedPlan, getPublicPayPalPlanId, type BillingInterval, type PlanKey } from "@/lib/billing";

export function serverPlanId(planKey: PlanKey, interval: BillingInterval = "month") {
  if (isGuidedPlan(planKey)) return planKey === "free" ? "" : process.env[`PAYPAL_PLAN_${planKey.toUpperCase()}${interval === "year" ? "_YEARLY" : ""}`] || getPublicPayPalPlanId(planKey, interval);
  const ids = interval === "year"
    ? {
        starter: process.env.PAYPAL_PLAN_STARTER_YEARLY || process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER_YEARLY || "",
        small: process.env.PAYPAL_PLAN_SMALL_YEARLY || process.env.NEXT_PUBLIC_PAYPAL_PLAN_SMALL_YEARLY || "",
        medium: process.env.PAYPAL_PLAN_MEDIUM_YEARLY || process.env.NEXT_PUBLIC_PAYPAL_PLAN_MEDIUM_YEARLY || "",
        pro: process.env.PAYPAL_PLAN_PRO_YEARLY || process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_YEARLY || "",
        ultra: process.env.PAYPAL_PLAN_ULTRA_YEARLY || process.env.NEXT_PUBLIC_PAYPAL_PLAN_ULTRA_YEARLY || "",
      }
    : {
        starter: process.env.PAYPAL_PLAN_STARTER || process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER || "",
        small: process.env.PAYPAL_PLAN_SMALL || process.env.NEXT_PUBLIC_PAYPAL_PLAN_SMALL || "",
        medium: process.env.PAYPAL_PLAN_MEDIUM || process.env.NEXT_PUBLIC_PAYPAL_PLAN_MEDIUM || "",
        pro: process.env.PAYPAL_PLAN_PRO || process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO || "",
        ultra: process.env.PAYPAL_PLAN_ULTRA || process.env.NEXT_PUBLIC_PAYPAL_PLAN_ULTRA || "",
      };
  return ids[planKey as typeof REALTIME_PLAN_KEYS[number]];
}

export function planForPayPalId(planId?: string | null): { planKey: PlanKey; billingInterval: BillingInterval } | null {
  if (!planId) return null;
  for (const billingInterval of BILLING_INTERVALS) {
    const planKey = PLAN_KEYS.find((key) => serverPlanId(key, billingInterval) === planId);
    if (planKey) return { planKey, billingInterval };
  }
  return null;
}

export function planKeyForPayPalId(planId?: string | null): PlanKey | null {
  return planForPayPalId(planId)?.planKey || null;
}

export function subscriptionStatus(status?: string | null) {
  return ({
    ACTIVE: "active",
    APPROVAL_PENDING: "pending",
    APPROVED: "pending",
    SUSPENDED: "suspended",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
  } as const)[status || ""] || "pending";
}

export function planLimits(planKey: PlanKey) {
  const plan = BILLING_PLANS[planKey];
  return { plan_key: planKey, monthly_interview_limit: plan.interviews, daily_interview_limit: plan.dailyInterviews, server_limit: plan.servers, staff_limit: plan.staff };
}

export function dateFromPayPal(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}
