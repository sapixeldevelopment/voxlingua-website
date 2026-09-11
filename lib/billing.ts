export const REALTIME_PLAN_KEYS = ["starter", "small", "medium", "pro", "ultra"] as const;
export const GUIDED_PLAN_KEYS = ["free", "flexi", "flow", "boost", "scale", "network"] as const;
export const PLAN_KEYS = [...REALTIME_PLAN_KEYS, ...GUIDED_PLAN_KEYS] as const;
export function isGuidedPlan(key: string) { return (GUIDED_PLAN_KEYS as readonly string[]).includes(key); }
export function planFeatures(key: string) { return isGuidedPlan(key) ? "Text-to-speech questions · recorded answers · human review. No written transcripts, AI reviews, scores, voice analysis, or live AI conversation." : "GPT Realtime conversation · recording · transcript · AI review and voice analysis · human decision."; }
export type PlanKey = (typeof PLAN_KEYS)[number];
export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_PLANS: Record<PlanKey, { name: string; price: string; yearlyPrice: string; interviews: number; dailyInterviews: number; servers: number; staff: number; description: string }> = {
  free: { name: "Free", price: "0.00", yearlyPrice: "0.00", interviews: 5, dailyInterviews: -1, servers: 1, staff: 2, description: "Try guided voice with 5 interviews per month." },
  flexi: { name: "Flexi", price: "5.00", yearlyPrice: "50.00", interviews: 50, dailyInterviews: -1, servers: 1, staff: 2, description: "A simple start with recorded voice answers." },
  flow: { name: "Flow", price: "10.00", yearlyPrice: "100.00", interviews: 150, dailyInterviews: -1, servers: 1, staff: 5, description: "Keep applications moving at your own pace." },
  boost: { name: "Boost", price: "15.00", yearlyPrice: "150.00", interviews: 250, dailyInterviews: -1, servers: 1, staff: 15, description: "More capacity for a growing community." },
  scale: { name: "Scale", price: "25.00", yearlyPrice: "250.00", interviews: 500, dailyInterviews: -1, servers: 3, staff: 30, description: "Bring your review teams together." },
  network: { name: "Network", price: "50.00", yearlyPrice: "500.00", interviews: 1200, dailyInterviews: -1, servers: 15, staff: -1, description: "Recorded interviews across your network." },
  starter: { name: "Starter", price: "10.00", yearlyPrice: "100.00", interviews: 15, dailyInterviews: -1, servers: 1, staff: 2, description: "For new communities with a lighter application flow." },
  small: { name: "Small", price: "20.00", yearlyPrice: "200.00", interviews: 50, dailyInterviews: -1, servers: 1, staff: 5, description: "For growing communities getting started." },
  medium: { name: "Medium", price: "50.00", yearlyPrice: "500.00", interviews: 150, dailyInterviews: -1, servers: 1, staff: 15, description: "For busy communities with a steady queue." },
  pro: { name: "Pro", price: "80.00", yearlyPrice: "800.00", interviews: 300, dailyInterviews: -1, servers: 3, staff: 30, description: "For established communities that need room to grow." },
  ultra: { name: "Ultra", price: "180.00", yearlyPrice: "1800.00", interviews: 750, dailyInterviews: -1, servers: 15, staff: -1, description: "For large networks and multi-server teams." },
};

export const PREPAID_PACKS = {
  pack_10: { name: "10 extra interviews", credits: 10, price: "8.00" },
  pack_25: { name: "25 extra interviews", credits: 25, price: "17.00" },
  pack_50: { name: "50 extra interviews", credits: 50, price: "30.00" },
  pack_100: { name: "100 extra interviews", credits: 100, price: "50.00" },
} as const;

export type PrepaidPackKey = keyof typeof PREPAID_PACKS;

export function getPlanPrice(planKey: PlanKey, interval: BillingInterval) {
  const plan = BILLING_PLANS[planKey];
  return interval === "year" ? plan.yearlyPrice : plan.price;
}

export function getPublicPayPalPlanId(planKey: PlanKey, interval: BillingInterval = "month") {
  if (isGuidedPlan(planKey)) {
    const monthly: Record<string, string | undefined> = { flexi: process.env.NEXT_PUBLIC_PAYPAL_PLAN_FLEXI, flow: process.env.NEXT_PUBLIC_PAYPAL_PLAN_FLOW, boost: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BOOST, scale: process.env.NEXT_PUBLIC_PAYPAL_PLAN_SCALE, network: process.env.NEXT_PUBLIC_PAYPAL_PLAN_NETWORK };
    const yearly: Record<string, string | undefined> = { flexi: process.env.NEXT_PUBLIC_PAYPAL_PLAN_FLEXI_YEARLY, flow: process.env.NEXT_PUBLIC_PAYPAL_PLAN_FLOW_YEARLY, boost: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BOOST_YEARLY, scale: process.env.NEXT_PUBLIC_PAYPAL_PLAN_SCALE_YEARLY, network: process.env.NEXT_PUBLIC_PAYPAL_PLAN_NETWORK_YEARLY };
    return (interval === "year" ? yearly : monthly)[planKey] || "";
  }
  const ids = interval === "year"
    ? {
        starter: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER_YEARLY || "",
        small: process.env.NEXT_PUBLIC_PAYPAL_PLAN_SMALL_YEARLY || "",
        medium: process.env.NEXT_PUBLIC_PAYPAL_PLAN_MEDIUM_YEARLY || "",
        pro: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_YEARLY || "",
        ultra: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ULTRA_YEARLY || "",
      }
    : {
        starter: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER || "",
        small: process.env.NEXT_PUBLIC_PAYPAL_PLAN_SMALL || "",
        medium: process.env.NEXT_PUBLIC_PAYPAL_PLAN_MEDIUM || "",
        pro: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO || "",
        ultra: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ULTRA || "",
      };
  return ids[planKey as typeof REALTIME_PLAN_KEYS[number]];
}

export type OwnerBilling = {
  id: string;
  user_id: string;
  plan_key: PlanKey;
  billing_interval: BillingInterval;
  status: "pending" | "active" | "suspended" | "cancelled" | "expired" | "past_due";
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  paypal_payer_id: string | null;
  server_limit: number;
  staff_limit: number;
  monthly_interview_limit: number;
  monthly_interviews_used: number;
  daily_interview_limit: number;
  daily_interviews_used: number;
  daily_period_start: string;
  monthly_period_start: string;
  monthly_period_end: string;
  subscription_period_end: string;
  prepaid_interviews: number;
  created_at: string;
  updated_at: string;
};
