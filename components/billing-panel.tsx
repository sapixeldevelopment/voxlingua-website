"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CreditCard, ShieldCheck } from "lucide-react";
import { BILLING_INTERVALS, BILLING_PLANS, PREPAID_PACKS, getPlanPrice, type BillingInterval, type OwnerBilling, type PlanKey, type PrepaidPackKey } from "@/lib/billing";
import ConfirmModal from "@/components/confirm-modal";

type BillingResponse = {
  billing: OwnerBilling | null;
  paypal: { clientId: string; planIds: Record<BillingInterval, Record<PlanKey, string>>; customId: string };
};

type PayPalNamespace = {
  Buttons: (config: Record<string, unknown>) => { render: (selector: string) => Promise<void> };
};

declare global {
  interface Window { paypal?: PayPalNamespace; }
}

const scriptPromises: Partial<Record<"subscription" | "capture", Promise<void>>> = {};

function loadPayPalScript(clientId: string, mode: "subscription" | "capture") {
  if (scriptPromises[mode]) return scriptPromises[mode];
  scriptPromises[mode] = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-dexlyy-paypal="${mode}"]`);
    if (existing) {
      if (window.paypal) { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PayPal checkout could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.dexlyyPaypal = mode;
    script.src = mode === "subscription"
      ? `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&currency=USD&components=buttons`
      : `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&intent=capture&currency=USD&components=buttons`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal checkout could not load."));
    document.head.appendChild(script);
  });
  return scriptPromises[mode];
}

function PayPalButton({ mode, clientId, customId, planId, planKey, billingInterval, packKey, onDone }: { mode: "subscription" | "capture"; clientId: string; customId: string; planId?: string; planKey?: PlanKey; billingInterval?: BillingInterval; packKey?: PrepaidPackKey; onDone: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!container.current || !clientId || (mode === "subscription" && !planId) || (mode === "capture" && !packKey)) return;
      try {
        await loadPayPalScript(clientId, mode);
        if (cancelled || !container.current || !window.paypal) return;
        container.current.replaceChildren();
        const buttons = mode === "subscription"
          ? window.paypal.Buttons({
              style: { layout: "vertical", shape: "rect", label: "subscribe", height: 42 },
              createSubscription: (_data: unknown, actions: { subscription: { create: (details: { plan_id: string; custom_id: string }) => Promise<string> } }) => actions.subscription.create({ plan_id: planId!, custom_id: customId }),
              onApprove: async (data: { subscriptionID?: string }) => {
                const response = await fetch("/api/paypal/subscription/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: data.subscriptionID, planKey, billingInterval }) });
                const result = await response.json().catch(() => ({})) as { error?: string };
                if (!response.ok) throw new Error(result.error || "Subscription activation failed.");
                onDone();
              },
              onError: (reason: unknown) => setError(reason instanceof Error ? reason.message : "PayPal could not start the subscription."),
            })
          : window.paypal.Buttons({
              style: { layout: "vertical", shape: "rect", label: "pay", height: 42 },
              createOrder: async () => {
                const response = await fetch("/api/paypal/orders/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packKey }) });
                const result = await response.json() as { orderId?: string; error?: string };
                if (!response.ok || !result.orderId) throw new Error(result.error || "Could not create the PayPal order.");
                return result.orderId;
              },
              onApprove: async (data: { orderID?: string }) => {
                const response = await fetch("/api/paypal/orders/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.orderID }) });
                const result = await response.json().catch(() => ({})) as { error?: string };
                if (!response.ok) throw new Error(result.error || "PayPal could not capture the payment.");
                onDone();
              },
              onError: (reason: unknown) => setError(reason instanceof Error ? reason.message : "PayPal could not complete the payment."),
            });
        const containerId = `dexlyy-paypal-buttons-${mode}`;
        container.current.id = containerId;
        await buttons.render(`#${containerId}`);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "PayPal checkout could not load.");
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [billingInterval, clientId, customId, mode, packKey, planId, planKey, onDone]);
  return <div><div ref={container} />{error && <div className="form-error billing-error">{error}</div>}</div>;
}

export default function BillingPanel({ onActivated, suppressCheckout = false }: { onActivated?: () => void; suppressCheckout?: boolean }) {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("starter");
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>("month");
  const [selectedPack, setSelectedPack] = useState<PrepaidPackKey>("pack_25");
  const [message, setMessage] = useState("");
  const [managePlan, setManagePlan] = useState<PlanKey | null>(null);
  const [manageInterval, setManageInterval] = useState<BillingInterval>("month");
  const [manageOpen, setManageOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/billing/status", { cache: "no-store" });
    const result = await response.json().catch(() => null) as BillingResponse | { error?: string } | null;
    if (response.ok && result && "paypal" in result) setData(result);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "changed") return;
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      const response = await fetch("/api/paypal/subscription/sync", { method: "POST", cache: "no-store" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) setManageError(result.error || "The plan changed in PayPal, but Dexlyy could not refresh it yet.");
      else setMessage("Plan updated. Your new limits are now active.");
      await load();
    })();
  }, [load]);
  const billing = data?.billing;
  const active = billing?.status === "active";
  const paused = billing?.status === "suspended";
  const available = active || paused;
  const plan = BILLING_PLANS[selectedPlan];
  const pack = PREPAID_PACKS[selectedPack];
  const selectedPlanId = data?.paypal.planIds[selectedInterval]?.[selectedPlan] || "";
  const currentBillingInterval = billing?.billing_interval || "month";
  const refreshAfterPayment = useCallback(() => { setMessage("Payment confirmed. Your Dexlyy credits are ready."); void load(); onActivated?.(); }, [load, onActivated]);

  async function changePlan() {
    if (!billing) return;
    const targetPlan = managePlan || billing.plan_key;
    if (targetPlan === billing.plan_key && manageInterval === currentBillingInterval) return;
    setManageBusy(true); setManageError(""); setMessage("");
    const response = await fetch("/api/paypal/subscription/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planKey: targetPlan, billingInterval: manageInterval }) });
    const result = await response.json().catch(() => ({})) as { error?: string; approvalUrl?: string; requiresApproval?: boolean };
    if (!response.ok) { setManageError(result.error || "Could not change the subscription plan."); setManageBusy(false); return; }
    if (result.approvalUrl) { window.location.assign(result.approvalUrl); return; }
    await fetch("/api/paypal/subscription/sync", { method: "POST", cache: "no-store" });
    await load();
    setMessage("Plan change requested. PayPal will apply the new price on the next billing cycle.");
    setManageBusy(false);
  }

  async function cancelPlan() {
    if (!billing) return;
    setManageBusy(true); setManageError(""); setMessage("");
    const response = await fetch("/api/paypal/subscription/cancel", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setManageError(result.error || "Could not pause the subscription."); setManageBusy(false); return; }
    setMessage("Subscription paused. Your portals stay available until the paid period ends, and no renewal will be taken.");
    await load();
    onActivated?.();
    setCancelOpen(false);
    setManageBusy(false);
  }

  async function resumePlan() {
    if (!billing) return;
    setManageBusy(true); setManageError(""); setMessage("");
    const response = await fetch("/api/paypal/subscription/resume", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setManageError(result.error || "Could not resume the subscription."); setManageBusy(false); return; }
    setMessage("Subscription resumed. Your existing paid period remains in place and billing continues on the next renewal date.");
    await load();
    onActivated?.();
    setManageBusy(false);
  }

  function formatDate(value?: string | null) {
    if (!value) return "Not available";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  if (loading) return <section className="billing-panel"><div className="empty-state">Loading billing…</div></section>;
  if (!data?.paypal.clientId) return <section className="billing-panel billing-setup"><div className="billing-heading"><div><span className="eyebrow">billing setup</span><h2>Connect PayPal before taking payments</h2><p className="subtle">Add the PayPal client ID to the environment before opening checkout.</p></div><ShieldCheck size={26} /></div><p className="billing-hint">Use sandbox while testing. Keep PayPal secrets server-only and never place them in browser code.</p></section>;

  return <section className="billing-panel">
    <div className="billing-heading"><div><span className="eyebrow">owner billing</span><h2>{active ? "Your Dexlyy plan" : paused ? "Your paused Dexlyy plan" : "Choose a plan to unlock your portal"}</h2><p className="subtle">Interview credits are counted only when an applicant submits. Abandoned or disconnected interviews cost nothing.</p></div><CreditCard size={26} /></div>
    {available ? <>
      <div className={`billing-current ${paused ? "billing-paused" : ""}`}><div><strong>{BILLING_PLANS[billing.plan_key].name} plan</strong><span>{paused ? `Paused · portal access until ${formatDate(billing.subscription_period_end)}` : `Active subscription · renews ${formatDate(billing.subscription_period_end)}`} · billed {currentBillingInterval === "year" ? "yearly" : "monthly"}</span>{paused && <button type="button" className="btn btn-primary btn-small billing-resume" onClick={() => void resumePlan()} disabled={manageBusy}>{manageBusy ? "Resuming…" : "Resume subscription"}</button>}</div><div className="billing-credit-count">{billing.prepaid_interviews}<small> prepaid credits</small></div></div>
      <div className="billing-details"><div><span>Monthly interviews</span><strong>{billing.monthly_interview_limit === -1 ? "Unlimited" : `${Math.max(0, billing.monthly_interview_limit - billing.monthly_interviews_used)} of ${billing.monthly_interview_limit} remaining`}</strong></div><div><span>Daily cap</span><strong>{billing.daily_interview_limit === -1 ? "None" : `${billing.daily_interview_limit} interviews/day`}</strong></div><div><span>Server allowance</span><strong>{billing.server_limit === -1 ? "Unlimited" : `${billing.server_limit} server${billing.server_limit === 1 ? "" : "s"}`}</strong></div><div><span>Next renewal</span><strong>{formatDate(billing.subscription_period_end)}</strong></div></div>
      {active && !suppressCheckout && <div className={`billing-management ${manageOpen ? "open" : ""}`}><button type="button" className="billing-management-toggle" onClick={() => { const opening = !manageOpen; if (opening) { setManageInterval(currentBillingInterval); setManagePlan(null); } setManageOpen(opening); setManageError(""); }} aria-expanded={manageOpen}><span className="billing-management-toggle-copy"><span className="eyebrow">manage subscription</span><strong>Change or pause your plan</strong><small>Upgrade, downgrade, switch billing cadence, or stop future renewals</small></span><ChevronDown size={18} /></button>{manageOpen && <div className="billing-management-body"><p className="subtle">Plan changes require PayPal confirmation and take effect on the next billing cycle. Yearly billing saves the equivalent of two months.</p><div className="billing-interval-toggle" role="group" aria-label="Billing cadence"><button type="button" className={manageInterval === "month" ? "selected" : ""} onClick={() => setManageInterval("month")} disabled={manageBusy}>Monthly</button><button type="button" className={manageInterval === "year" ? "selected" : ""} onClick={() => setManageInterval("year")} disabled={manageBusy}>Yearly <span>2 months free</span></button></div><div className="billing-manage-plans">{(Object.keys(BILLING_PLANS) as PlanKey[]).map(key => { const item = BILLING_PLANS[key]; const chosen = managePlan === key; const current = billing.plan_key === key; const configured = Boolean(data.paypal.planIds[manageInterval]?.[key]); const disabled = manageBusy || (!configured && !(current && manageInterval === currentBillingInterval)); return <button type="button" className={`billing-manage-plan ${chosen ? "selected" : ""} ${current && manageInterval === currentBillingInterval ? "current" : ""}`} key={key} onClick={() => setManagePlan(key)} disabled={disabled} title={!configured ? `${item.name} ${manageInterval === "year" ? "yearly" : "monthly"} checkout setup is pending` : undefined}><span><strong>{item.name}</strong>{current && manageInterval === currentBillingInterval && <small>Current</small>}{!configured && <small>Setup pending</small>}</span><span>${getPlanPrice(key, manageInterval)}<small>/{manageInterval === "year" ? "year" : "mo"}</small></span><em>{item.interviews === -1 ? "Unlimited" : item.interviews} interviews{item.dailyInterviews !== -1 ? ` · ${item.dailyInterviews}/day cap` : ""} · {item.servers} server{item.servers === 1 ? "" : "s"}</em></button>; })}</div>{((managePlan && managePlan !== billing.plan_key) || manageInterval !== currentBillingInterval) && <div className="billing-management-actions"><span>Switch to <strong>{BILLING_PLANS[managePlan || billing.plan_key].name}</strong> for ${getPlanPrice(managePlan || billing.plan_key, manageInterval)}/{manageInterval === "year" ? "year" : "month"}.</span><button type="button" className="btn btn-primary btn-small" onClick={() => void changePlan()} disabled={manageBusy}>{manageBusy ? "Opening PayPal…" : "Continue with PayPal"}</button></div>}<div className="billing-management-footer"><span>Need to stop renewing?</span><button type="button" className="btn btn-ghost btn-small billing-cancel" onClick={() => setCancelOpen(true)} disabled={manageBusy}>Pause subscription</button></div>{manageError && <div className="form-error billing-error">{manageError}</div>}</div>}</div>}
      {active && !suppressCheckout && <div className="billing-addon"><div><strong>Need more interviews?</strong><p className="subtle">Prepaid credits never expire and are used after your monthly allowance.</p></div><select className="select billing-select" value={selectedPack} onChange={event => setSelectedPack(event.target.value as PrepaidPackKey)}>{Object.entries(PREPAID_PACKS).map(([key, item]) => <option key={key} value={key}>{item.name} · ${item.price}</option>)}</select><PayPalButton mode="capture" clientId={data.paypal.clientId} customId={data.paypal.customId} packKey={selectedPack} onDone={refreshAfterPayment} /></div>}
    </> : <>
      {billing && <div className="billing-current billing-inactive"><div><strong>{BILLING_PLANS[billing.plan_key].name} plan</strong><span>Subscription {billing.status.replaceAll("_", " ")} · {(["cancelled", "expired"] as string[]).includes(billing.status) ? `last billing period ended ${formatDate(billing.subscription_period_end)}` : "complete checkout below to activate it"}</span></div></div>}
      <div className="billing-interval-toggle" role="group" aria-label="Billing cadence"><button type="button" className={selectedInterval === "month" ? "selected" : ""} onClick={() => setSelectedInterval("month")}>Monthly</button><button type="button" className={selectedInterval === "year" ? "selected" : ""} onClick={() => setSelectedInterval("year")}>Yearly <span>Save 2 months</span></button></div>
      <div className="billing-plan-grid">{(Object.keys(BILLING_PLANS) as PlanKey[]).map(key => { const item = BILLING_PLANS[key]; const chosen = selectedPlan === key; const configured = Boolean(data.paypal.planIds[selectedInterval]?.[key]); return <button type="button" className={`billing-plan ${chosen ? "selected" : ""}`} key={key} onClick={() => setSelectedPlan(key)}><span className="billing-plan-top"><strong>{item.name}</strong><span>${getPlanPrice(key, selectedInterval)}<small>/{selectedInterval === "year" ? "year" : "month"}</small></span></span><span className="billing-plan-limit">{item.interviews === -1 ? "Unlimited" : item.interviews} interviews/month{item.dailyInterviews !== -1 ? ` · ${item.dailyInterviews}/day cap` : ""}</span><span className="billing-plan-copy">{item.description}</span>{selectedInterval === "year" && <span className="billing-plan-savings">Save 2 months · ${item.price}/mo equivalent</span>}{!configured && <span className="billing-plan-setup">Checkout setup pending</span>}<span className="billing-check">{chosen && <Check size={14} />}</span></button>; })}</div>
      {!suppressCheckout && <div className="billing-checkout"><div><strong>Start the {plan.name} plan</strong><p className="subtle">{plan.interviews === -1 ? "Unlimited" : plan.interviews} submitted interviews each month{plan.dailyInterviews !== -1 ? ` · ${plan.dailyInterviews} interviews/day cap` : ""} · {plan.servers} server{plan.servers === 1 ? "" : "s"} · {plan.staff === -1 ? "Unlimited" : plan.staff} staff</p><span className="billing-checkout-price">${getPlanPrice(selectedPlan, selectedInterval)} billed {selectedInterval === "year" ? "yearly · 2 months free" : "monthly"}</span></div>{selectedPlanId ? <PayPalButton mode="subscription" clientId={data.paypal.clientId} customId={data.paypal.customId} planId={selectedPlanId} planKey={selectedPlan} billingInterval={selectedInterval} onDone={refreshAfterPayment} /> : <div className="billing-checkout-pending">Add the PayPal {plan.name} {selectedInterval === "year" ? "yearly" : "monthly"} plan ID to enable checkout.</div>}</div>}
    </>}
    {message && <div className="form-success">{message}</div>}
    {cancelOpen && billing && <ConfirmModal title="Pause your subscription?" description={`This stops future PayPal renewals. Your portals stay available until ${formatDate(billing.subscription_period_end)}, but configuration is locked while paused. You can resume before then without being charged again immediately.`} confirmLabel="Pause subscription" busy={manageBusy} onCancel={()=>setCancelOpen(false)} onConfirm={()=>void cancelPlan()} />}
  </section>;
}
