const SUPABASE_URL = "https://mmgzuubrtyodhjtmjlvb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LYP_tofuZNutUaE-KfjT7Q_Uf5XcaIO";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const params = new URLSearchParams(location.search);

const LABS = ["OpenAI", "Anthropic", "Google", "xAI", "Meta", "DeepSeek", "Alibaba", "Mistral", "Moonshot", "Zhipu", "MiniMax", "NVIDIA"];
const DEFAULT_LABS = [...LABS];
const CAPABILITY_KEYS = ["reasoning", "coding", "vision", "voice", "agents", "long-context", "open-weights", "ai-news"];
const DEFAULT_CAPABILITIES = [...CAPABILITY_KEYS];
const CAPABILITIES = [
  ["reasoning", "Reasoning"],
  ["coding", "Coding"],
  ["vision", "Vision"],
  ["voice", "Voice"],
  ["agents", "Agents"],
  ["long-context", "Long context"],
  ["open-weights", "Open weights"],
  ["ai-news", "AI news"],
];

const MODELS = [
  {
    id: "gpt-5.5", lab: "OpenAI", released: "Apr 2026", context: "1M tokens",
    inputPrice: "$2.50 / 1M in", outputPrice: "$10 / 1M out", cachePrice: "$0.25 / 1M cached",
    subscription: "ChatGPT Plus ~$20/mo · Pro ~$200/mo", freeTier: "Limited free tier in ChatGPT",
    speed: "Fast", coding: "9/10 — agentic coding & tool loops", reasoning: "Frontier",
    tools: "Functions, code interpreter, web, computer use", apiModel: "gpt-5.5",
    openWeights: "No", access: "API + ChatGPT", latency: "~600–900ms TTFT",
    vibePick: "Your daily driver when you want reliable tools + codegen in one stack.",
    note: "Default pick for shipping features fast with strong tool use.",
  },
  {
    id: "claude-opus-4-8", lab: "Anthropic", released: "May 2026", context: "1M tokens",
    inputPrice: "$15 / 1M in", outputPrice: "$75 / 1M out", cachePrice: "$1.50 / 1M cached",
    subscription: "Claude Pro ~$20/mo · Max tiers higher", freeTier: "Free Claude with daily caps",
    speed: "Medium", coding: "9/10 — careful refactors & review", reasoning: "Frontier+",
    tools: "Tools, bash, computer use, MCP", apiModel: "claude-opus-4-8",
    openWeights: "No", access: "API + Claude", latency: "~1–2s TTFT",
    vibePick: "When code quality and long-context reasoning beat raw speed.",
    note: "Best for hard bugs, architecture reviews, and dense specs.",
  },
  {
    id: "gemini-3.5-flash", lab: "Google", released: "May 2026", context: "1M tokens",
    inputPrice: "$0.15 / 1M in", outputPrice: "$0.60 / 1M out", cachePrice: "$0.04 / 1M cached",
    subscription: "Google AI Pro bundles vary", freeTier: "Generous free tier in AI Studio",
    speed: "Very fast", coding: "7/10 — great for volume & multimodal", reasoning: "Strong mid-frontier",
    tools: "Functions, search grounding, vision", apiModel: "gemini-3.5-flash",
    openWeights: "No", access: "API + AI Studio", latency: "~300–500ms TTFT",
    vibePick: "Burn tokens on agents, classifiers, and UI-heavy prototypes.",
    note: "Price-per-token king for high-volume vibe coding loops.",
  },
  {
    id: "grok-4.3", lab: "xAI", released: "Apr 2026", context: "1M tokens",
    inputPrice: "$3 / 1M in", outputPrice: "$12 / 1M out", cachePrice: "—",
    subscription: "SuperGrok subscription", freeTier: "Limited free in Grok app",
    speed: "Fast", coding: "8/10 — strong chat + live context", reasoning: "Frontier",
    tools: "Tools, live search, X context", apiModel: "grok-4.3",
    openWeights: "No", access: "API + Grok", latency: "~700ms TTFT",
    vibePick: "News-aware apps and social-signal copilots.",
    note: "Watch for real-time / social-context workflows.",
  },
  {
    id: "DeepSeek-V4-Pro", lab: "DeepSeek", released: "Apr 2026", context: "256K tokens",
    inputPrice: "$0.55 / 1M in", outputPrice: "$2.19 / 1M out", cachePrice: "$0.14 / 1M cached",
    subscription: "—", freeTier: "Open-weight variants self-host",
    speed: "Fast", coding: "8/10 — math & efficient codegen", reasoning: "Strong value frontier",
    tools: "Functions, JSON mode", apiModel: "deepseek-v4-pro",
    openWeights: "Partial (open-weight family)", access: "API + open weights", latency: "~500–800ms TTFT",
    vibePick: "Maximum IQ per dollar on API bills.",
    note: "Benchmark when cost matters more than brand.",
  },
  {
    id: "Qwen3.7-Plus", lab: "Alibaba", released: "May 2026", context: "1M tokens",
    inputPrice: "$0.80 / 1M in", outputPrice: "$3.20 / 1M out", cachePrice: "$0.20 / 1M cached",
    subscription: "—", freeTier: "Trial credits on DashScope",
    speed: "Fast", coding: "8/10 — agents & multilingual", reasoning: "Strong",
    tools: "Functions, agents, vision", apiModel: "qwen3.7-plus",
    openWeights: "Partial", access: "API", latency: "~600ms TTFT",
    vibePick: "Enterprise agents with long context and multilingual UX.",
    note: "Major contender for agent pipelines outside US labs.",
  },
  {
    id: "Mistral-Medium-3.5", lab: "Mistral", released: "Apr 2026", context: "128K tokens",
    inputPrice: "$0.40 / 1M in", outputPrice: "$2 / 1M out", cachePrice: "—",
    subscription: "Le Chat tiers", freeTier: "Free Le Chat tier",
    speed: "Very fast", coding: "7/10 — EU-friendly generalist", reasoning: "Capable",
    tools: "Functions, JSON", apiModel: "mistral-medium-3.5",
    openWeights: "No", access: "API", latency: "~400ms TTFT",
    vibePick: "EU residency + fast iteration without OpenAI pricing.",
    note: "Good when data residency and latency both matter.",
  },
  {
    id: "Llama 4 family", lab: "Meta", released: "2026", context: "128K–1M (variant)",
    inputPrice: "Self-host / cloud GPU", outputPrice: "Varies by host", cachePrice: "—",
    subscription: "—", freeTier: "Weights free to download",
    speed: "Depends on hardware", coding: "7/10 — customizable stacks", reasoning: "Varies by size",
    tools: "Bring your own (vLLM, Ollama, etc.)", apiModel: "meta-llama/llama-4-*",
    openWeights: "Yes", access: "Open weights", latency: "Hardware-dependent",
    vibePick: "You own the stack — fine-tune, air-gap, or slash SaaS spend.",
    note: "Best when control beats managed API convenience.",
  },
];

const LIVE_MODEL_DEFAULTS = {
  context: "TBD", inputPrice: "Pricing pending", outputPrice: "—", cachePrice: "—",
  subscription: "—", freeTier: "—", speed: "TBD", coding: "TBD", reasoning: "TBD",
  tools: "TBD", apiModel: "", openWeights: "Unknown", access: "Detected signal",
  latency: "TBD", vibePick: "New drop — we're filling in benchmarks and pricing.",
  note: "Live DexlyyWatch detection. Specs update as sources confirm.",
};

const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // detectSessionInUrl is OFF: when it auto-processes a reused/invalid ?code= it
  // can deadlock the client's internal lock so getSession() never resolves and
  // the page hangs on "Loading". We exchange the code ourselves below instead.
  auth: { persistSession: true, detectSessionInUrl: false, flowType: "pkce" },
});

let signup = null;
let billingInterval = "monthly";

const PLAN_TIERS = [
  {
    key: "watch",
    name: "Watch",
    short: "Watch",
    features: [
      "Weekly digest of major model drops",
      "Email delivery",
      "Community coverage",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    short: "Pro",
    featured: true,
    monthly: { amount: "5", label: "$5 / month" },
    annual: { amount: "4", total: "50", label: "$4 / mo · $50 billed yearly" },
    features: [
      "Real-time alerts the moment a model drops",
      "AI news — Codex, ChatGPT & product releases",
      "Lab & capability filters",
      "Model comparison tool",
      "SMS & voice alerts",
    ],
  },
  {
    key: "ultra",
    name: "Ultra",
    short: "Ultra",
    featured: true,
    monthly: { amount: "9", label: "$9 / month" },
    annual: { amount: "8", total: "90", label: "$8 / mo · $90 billed yearly" },
    features: [
      "Everything in Pro",
      "Release radar — Polymarket-based drop windows",
      "Tracked models (GPT-5.6 first)",
      "Methodology + confidence labels",
      "Estimates refresh on a schedule",
    ],
  },
  {
    key: "squadron",
    name: "Squadron",
    short: "Squadron",
    monthly: { amount: "15", label: "$15 / month" },
    annual: { amount: "13", total: "150", label: "$13 / mo · $150 billed yearly" },
    features: [
      "Everything in Ultra",
      "Team routing — up to 10 seats",
      "Slack & generic webhooks",
      "Priority delivery",
    ],
  },
];

function tierCheckoutLabel(tier) {
  if (tier.key === "watch") return "";
  const p = billingInterval === "annual" ? tier.annual : tier.monthly;
  return billingInterval === "annual" ? `$${p.total}/year` : `$${p.amount}/mo`;
}

function tierPriceHtml(tier) {
  if (tier.key === "watch") return `<div class="plan-tier__price-block"><span class="plan-tier__price">Free</span></div>`;
  const annual = billingInterval === "annual";
  const p = annual ? tier.annual : tier.monthly;
  const per = annual ? "/ mo" : "/ month";
  const billed = annual
    ? `<span class="plan-tier__billed">$${p.total} billed yearly</span>`
    : "";
  return `<div class="plan-tier__price-block"><span class="plan-tier__price">$${p.amount}<small>${per}</small></span>${billed}</div>`;
}

function setBillingInterval(interval) {
  billingInterval = interval === "annual" ? "annual" : "monthly";
  const toggle = $("#dashBilling");
  if (toggle) {
    $$(".toggle__btn", toggle).forEach((b) => {
      b.classList.toggle("is-active", b.dataset.cycle === billingInterval);
    });
  }
  const note = $("#dashBillingNote");
  if (note) {
    note.textContent = billingInterval === "annual"
      ? "Annual billing: Pro $50/year · Ultra $90/year · Squadron $150/year (2 months free vs monthly)."
      : "Monthly billing: Pro $5/month · Ultra $9/month · Squadron $15/month. Cancel anytime.";
  }
  if (signup && !isPaid(signup)) renderFreeView(signup);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const PLAN_META = {
  watch: {
    tagline: "Free · weekly digest",
    perks: ["Weekly model digest", "Community coverage"],
  },
  pro: {
    tagline: "$5/mo · instant drop alerts",
    perks: ["Real-time model alerts", "AI news (Codex & product releases)", "Lab & capability filters", "Model comparison", "SMS & voice"],
    upgrade: { plan: "ultra", title: "Ultra", sub: "$9/mo · release window estimates" },
  },
  ultra: {
    tagline: "$9/mo · release radar",
    perks: ["Everything in Pro", "Polymarket-based drop windows", "Marginal odds between dates", "Methodology in-dashboard"],
    upgrade: { plan: "squadron", title: "Squadron", sub: "$15/mo · team routing & webhooks" },
    downgrade: { plan: "pro", title: "Pro", sub: "$5/mo · alerts without forecasts" },
  },
  squadron: {
    tagline: "$15/mo · team routing",
    perks: ["Everything in Ultra", "Up to 10 seats", "Slack & generic webhooks"],
    downgrade: { plan: "ultra", title: "Ultra", sub: "$9/mo · solo + release radar" },
  },
};

function updatePlanSidebar(signupRow) {
  const plan = signupRow?.plan || "watch";
  const paid = signupRow ? isPaid(signupRow) : false;
  const cancelled = signupRow?.status === "cancelled";
  const pending = signupRow?.pending_plan;
  const meta = PLAN_META[plan] || PLAN_META.watch;

  $("#planName").textContent = planLabel(plan);

  let state = meta.tagline;
  if (cancelled && hasPaidPlan(signupRow)) state = "Access until billing period ends";
  else if (pending) state = `${planLabel(pending)} checkout pending`;
  else if (!paid && plan === "watch") state = PLAN_META.watch.tagline;
  $("#planState").textContent = state;

  const badge = $("#planBadge");
  if (badge) {
    if (cancelled && hasPaidPlan(signupRow)) {
      badge.textContent = "Ending";
      badge.className = "dash-status__badge is-ending";
    } else if (pending) {
      badge.textContent = "Pending";
      badge.className = "dash-status__badge is-pending";
    } else if (paid) {
      badge.textContent = "Active";
      badge.className = "dash-status__badge is-active";
    } else {
      badge.textContent = "Free";
      badge.className = "dash-status__badge is-free";
    }
  }

  const perks = $("#planPerks");
  if (perks) {
    if (paid || plan === "watch") {
      perks.hidden = false;
      perks.innerHTML = meta.perks.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
    } else {
      perks.hidden = true;
      perks.innerHTML = "";
    }
  }
}

function planLabel(plan) {
  if (plan === "squadron") return "Squadron";
  if (plan === "ultra") return "Ultra";
  if (plan === "pro") return "Pro";
  return "Watch";
}

function hasPaidPlan(signupRow) {
  return Boolean(signupRow) && (signupRow.plan === "pro" || signupRow.plan === "ultra" || signupRow.plan === "squadron");
}

function hasForecasts(signupRow) {
  return hasPaidPlan(signupRow) && (signupRow.plan === "ultra" || signupRow.plan === "squadron");
}

// A user keeps paid access while their plan is pro/squadron and the subscription
// has not yet expired. "cancelled" means they cancelled but still have paid days
// left (PayPal sends EXPIRED -> plan:"watch", status:"expired" when access ends).
function isPaid(signupRow) {
  return hasPaidPlan(signupRow) && signupRow.status !== "expired";
}

// True only when the paid subscription is live (not cancelled) — used to decide
// which billing actions to show.
function isActivePaid(signupRow) {
  return hasPaidPlan(signupRow) && signupRow.status === "active";
}

function renderEmailState(signupRow) {
  const verified = Boolean(signupRow.alert_email_verified_at);
  const email = signupRow.alert_email || signupRow.email || "";
  const stateEl = $("#emailState");
  const hint = $("#emailHint");
  const resend = $("#resendConfirmBtn");
  if (stateEl) {
    stateEl.textContent = verified ? "Confirmed" : "Needs confirmation";
    stateEl.classList.toggle("is-ok", verified);
    stateEl.classList.toggle("is-warn", !verified);
  }
  if (hint) {
    hint.textContent = verified
      ? `Alerts go to ${email}.`
      : `We'll email a confirmation link to ${email}. Save settings or tap Resend below.`;
  }
  if (resend) resend.hidden = verified;
  const freeState = $("#freeEmailState");
  if (freeState) {
    freeState.textContent = verified ? "Email confirmed" : "Needs confirmation";
    freeState.classList.toggle("is-ok", verified);
    freeState.classList.toggle("is-warn", !verified);
  }
}

async function sendAlertEmailConfirmation(alertEmail) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to continue.");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-alert-email`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "send", alert_email: alertEmail }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || "Could not send confirmation.");
  return body;
}

async function confirmAlertFromUrl() {
  const token = params.get("confirm_alert");
  if (!token) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-alert-email`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || "Confirmation failed.");
    setMessage(body.message || "Alert email confirmed.", "is-success");
  } catch (err) {
    setMessage(err.message || "Could not confirm alert email.", "is-error");
  }
  history.replaceState({}, "", "watch-dashboard.html");
  if (signup) await loadSignup();
}

function setMessage(text, kind = "") {
  const el = $("#saveMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `dash-message ${kind}`.trim();
}

function setPaidFieldsEnabled(paid) {
  const lock = (sel, on) => {
    $$(sel).forEach((el) => {
      el.disabled = !on;
      el.closest(".dash-card")?.classList.toggle("dash-locked-feature", !on);
    });
  };
  lock("#labTags input, #capabilityTags input", paid);
  lock("#squadronCard input", paid && signup?.plan === "squadron");
  $("#compare").hidden = !paid;
  $("#filters")?.classList.toggle("dash-locked-feature", !paid);
  if (!paid) $("#squadronCard").hidden = true;
}

function showFeedbackPanel(visible, email = "") {
  const panel = $("#feedbackPanel");
  if (!panel) return;
  panel.hidden = !visible;
  const emailInput = $("#feedbackEmail");
  if (emailInput && email && !emailInput.value) emailInput.value = email;
}

function setAuthMessage(text, kind = "") {
  const el = $("#authMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `dash-message ${kind}`.trim();
}

function friendlyAuthError(err) {
  const message = err?.message || String(err || "");
  if (message.includes("FREE_SEATS_FULL")) {
    return "The 200 free Watch seats are full. Choose Pro, Ultra, or Squadron from the pricing page to join.";
  }
  return message || "Could not load dashboard.";
}

function selectedLabs(signupRow) {
  return signupRow?.labs?.length ? signupRow.labs : DEFAULT_LABS;
}

function selectedCapabilities(signupRow) {
  return signupRow?.capabilities?.length ? signupRow.capabilities : DEFAULT_CAPABILITIES;
}

async function applySignupDefaultsIfNeeded(signupRow) {
  const needsLabs = !signupRow.labs?.length;
  const needsCaps = !signupRow.capabilities?.length;
  const accountEmail = (signupRow.email || "").toLowerCase();
  const alertEmail = (signupRow.alert_email || "").toLowerCase();
  const needsAlertEmail = !alertEmail;
  if (!needsLabs && !needsCaps && !needsAlertEmail) return signupRow;

  const payload = { updated_at: new Date().toISOString() };
  if (needsLabs) payload.labs = DEFAULT_LABS;
  if (needsCaps) payload.capabilities = DEFAULT_CAPABILITIES;
  if (needsAlertEmail && accountEmail) payload.alert_email = accountEmail;

  const { data, error } = await supabase
    .from("dexlyywatch_signups")
    .update(payload)
    .eq("user_id", signupRow.user_id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || signupRow;
}

function renderTags(container, values, selected) {
  if (!container) return;
  container.innerHTML = values.map((entry) => {
    const value = Array.isArray(entry) ? entry[0] : entry;
    const label = Array.isArray(entry) ? entry[1] : entry;
    const checked = selected.includes(value) ? "checked" : "";
    return `<label class="dash-tag"><input type="checkbox" value="${escapeHtml(value)}" ${checked} /> ${escapeHtml(label)}</label>`;
  }).join("");
}

function readChecked(container) {
  return $$("input:checked", container).map((input) => input.value);
}

function renderBilling() {
  const panel = $("#billingPanel");
  const actions = $("#billingActions");
  const note = $("#billingNote");
  if (!panel || !actions || !signup) return;

  panel.hidden = false;
  actions.innerHTML = "";
  const plan = signup.plan || "watch";
  const status = signup.status || "active";

  if (plan === "watch" || status !== "active") {
    actions.innerHTML = `
      <a class="dash-billing__upgrade dash-billing__upgrade--primary" href="watch-checkout.html?plan=pro&interval=${billingInterval}">
        <span class="dash-billing__upgrade-title">Pro</span>
        <span class="dash-billing__upgrade-sub">$5/mo · real-time alerts &amp; compare</span>
      </a>
      <a class="dash-billing__upgrade" href="watch-checkout.html?plan=ultra&interval=${billingInterval}">
        <span class="dash-billing__upgrade-title">Ultra</span>
        <span class="dash-billing__upgrade-sub">$9/mo · release window estimates</span>
      </a>
      <a class="dash-billing__upgrade" href="watch-checkout.html?plan=squadron&interval=${billingInterval}">
        <span class="dash-billing__upgrade-title">Squadron</span>
        <span class="dash-billing__upgrade-sub">$15/mo · team routing</span>
      </a>`;
    note.textContent = plan === "watch"
      ? "Upgrade for first-in-line alerts, filters, and model comparison."
      : status === "cancelled"
        ? "Paid access continues until the period ends. Resume or pick a new plan anytime."
        : "Choose a paid plan to unlock Pro, Ultra, or Squadron.";
    return;
  }

  const meta = PLAN_META[plan];
  const upgrade = meta?.upgrade;
  const downgrade = meta?.downgrade;
  if (upgrade || downgrade) {
    const buttons = [];
    if (upgrade) {
      buttons.push(`<button type="button" class="dash-billing__upgrade dash-billing__upgrade--primary" data-change-plan="${upgrade.plan}">
        <span class="dash-billing__upgrade-title">${escapeHtml(upgrade.title)}</span>
        <span class="dash-billing__upgrade-sub">${escapeHtml(upgrade.sub)}</span>
      </button>`);
    }
    if (downgrade) {
      buttons.push(`<button type="button" class="dash-billing__upgrade" data-change-plan="${downgrade.plan}">
        <span class="dash-billing__upgrade-title">${escapeHtml(downgrade.title)}</span>
        <span class="dash-billing__upgrade-sub">${escapeHtml(downgrade.sub)}</span>
      </button>`);
    }
    buttons.push(`<button type="button" class="dash-billing__link" data-cancel-sub>Cancel subscription</button>`);
    actions.innerHTML = buttons.join("");
    note.textContent = signup.pending_plan
      ? `${planLabel(signup.pending_plan)} change scheduled for next billing date.`
      : plan === "pro"
        ? "Upgrade to Ultra for release estimates, or Squadron for teams."
        : plan === "ultra"
          ? "Upgrade to Squadron for team routing. Downgrades apply at renewal."
          : "Downgrade takes effect at renewal.";
  }

  actions.querySelectorAll("[data-cancel-sub]").forEach((el) => el.addEventListener("click", cancelSubscription));
  actions.querySelectorAll("[data-change-plan]").forEach((el) => {
    el.addEventListener("click", (e) => changePlan(e.currentTarget.dataset.changePlan));
  });
}

// Show nav links only for sections the current user can actually use, so a
// free user never clicks a link that scrolls to a hidden/locked section.
function setDashLinks(visible, paid = false) {
  $$(".js-dash-link").forEach((el) => {
    if (el.classList.contains("js-feedback-link")) {
      el.hidden = !visible;
      return;
    }
    if (el.classList.contains("js-forecasts-link")) {
      el.hidden = !visible || !paid;
      return;
    }
    if (el.classList.contains("js-ainews-link")) {
      el.hidden = !visible || !paid;
      return;
    }
    el.hidden = !visible || !paid;
  });
}

function setFreeEmailMsg(text, kind = "") {
  const el = $("#freeEmailMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `dash-message ${kind}`.trim();
}

function renderFreeView(signupRow) {
  $("#freePlanName").textContent = "Watch (Free)";
  const cancelled = signupRow.status === "cancelled";
  $("#freePlanStatus").textContent = signupRow.pending_plan
    ? `Checkout pending — ${planLabel(signupRow.pending_plan)}`
    : cancelled
      ? "Previous paid plan cancelled — now on free Watch"
      : "Active";
  $("#freePlanPill").textContent = "Free";

  const email = signupRow.alert_email || signupRow.email || "";
  $("#freeAlertEmail").value = email;
  renderEmailState(signupRow);

  // Plan comparison so free users can see exactly what each tier adds.
  const plansEl = $("#freePlansCompare");
  if (plansEl) {
    plansEl.innerHTML = PLAN_TIERS.map((t) => {
      const classes = ["plan-tier"];
      if (t.key === "watch") classes.push("plan-tier--current");
      if (t.featured) classes.push("plan-tier--featured");
      const price = tierPriceHtml(t);
      const checkoutLabel = tierCheckoutLabel(t);
      const cta = t.key === "watch"
        ? `<div class="plan-tier__foot"><span class="plan-tier__badge">Your plan</span></div>`
        : `<div class="plan-tier__foot"><button type="button" class="btn ${t.featured ? "btn--solid" : "btn--line"} btn--block plan-tier__btn js-upgrade-plan" data-plan="${t.key}">Choose ${escapeHtml(t.short)}</button><span class="plan-tier__checkout">${escapeHtml(checkoutLabel)} at checkout</span></div>`;
      return `
        <div class="${classes.join(" ")}">
          <div class="plan-tier__head">
            <h4>${escapeHtml(t.name)}</h4>
            ${price}
          </div>
          <ul class="plan-tier__list">
            ${t.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
          ${cta}
        </div>`;
    }).join("");
  }

  setFreeEmailMsg("");
}

function formatUsd(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

let forecastBundle = null;
let forecastLabFilter = "all";
let forecastSearchQuery = "";
let forecastActiveTab = "markets";
let forecastExpandedSlug = null;
let forecastSearchDebounce = null;

const LAB_ICON_CLASS = {
  ChatGPT: "pm-icon--openai",
  Claude: "pm-icon--anthropic",
  Gemini: "pm-icon--google",
  Grok: "pm-icon--xai",
  Kimi: "pm-icon--moonshot",
  Meta: "pm-icon--meta",
  DeepSeek: "pm-icon--deepseek",
  Qwen: "pm-icon--qwen",
  NVIDIA: "pm-icon--nvidia",
  GLM: "pm-icon--zhipu",
  MiniMax: "pm-icon--minimax",
  Cursor: "pm-icon--cursor",
};

function labIconClass(chip) {
  return LAB_ICON_CLASS[chip] || "pm-icon--default";
}

function formatPct(p) {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

function filteredMarkets() {
  if (!forecastBundle?.markets) return [];
  const q = forecastSearchQuery.trim().toLowerCase();
  return forecastBundle.markets.filter((m) => {
    if (forecastLabFilter !== "all" && m.lab_chip !== forecastLabFilter) return false;
    if (!q) return true;
    const hay = `${m.title} ${m.model} ${m.lab} ${m.lab_chip} ${m.subtitle}`.toLowerCase();
    return hay.includes(q);
  });
}

function forecastBySlug(slug) {
  return forecastBundle?.forecasts?.find((f) => f.slug === slug) ?? null;
}

function renderMarketDetail(f) {
  if (!f) return "";
  const windows = (f.estimate?.windows ?? []).slice(0, 4);
  const bars = windows.map((w) => {
    const pct = Math.round(w.probability * 100);
    return `<li class="forecast-bar">
      <div class="forecast-bar__head"><span>${escapeHtml(w.label)}</span><strong>${pct}%</strong></div>
      <div class="forecast-bar__track"><span style="width:${Math.max(4, pct)}%"></span></div>
    </li>`;
  }).join("");
  return `<div class="pm-detail">
    <p class="pm-detail__summary">${escapeHtml(f.estimate?.summary || "")}</p>
    ${bars ? `<ul class="forecast-bars">${bars}</ul>` : ""}
    <p class="pm-detail__foot">${formatUsd(f.total_volume)} volume · <a href="${escapeHtml(f.polymarket_url)}" target="_blank" rel="noopener noreferrer">Open on Polymarket ↗</a></p>
  </div>`;
}

function renderMarketRow(m) {
  const expanded = forecastExpandedSlug === m.slug;
  const detail = expanded ? renderMarketDetail(forecastBySlug(m.slug)) : "";
  const iconClass = labIconClass(m.lab_chip);
  const initial = m.lab_chip.slice(0, 1);

  return `<li class="pm-market${expanded ? " is-expanded" : ""}" data-slug="${escapeHtml(m.slug)}">
    <button type="button" class="pm-market__row" aria-expanded="${expanded}">
      <span class="pm-icon ${iconClass}" aria-hidden="true">${escapeHtml(initial)}</span>
      <span class="pm-market__title">${escapeHtml(m.title)}</span>
      <span class="pm-market__odds">
        <strong>${formatPct(m.probability)}</strong>
        <span>${escapeHtml(m.subtitle)}</span>
      </span>
    </button>
    ${detail}
  </li>`;
}

function renderForecastFilters() {
  const toolbar = $("#forecastsToolbar");
  const searchWrap = $("#forecastsSearchWrap");
  const filters = $("#forecastsFilters");
  if (!toolbar || !filters || !forecastBundle) return;

  if (searchWrap) searchWrap.hidden = false;
  toolbar.hidden = false;

  const chips = ["all", ...(forecastBundle.meta?.lab_chips ?? forecastBundle.meta?.labs ?? [])];
  filters.innerHTML = chips.map((chip) => {
    const active = chip === forecastLabFilter;
    const label = chip === "all" ? "All" : chip;
    return `<button type="button" class="forecasts__chip${active ? " is-active" : ""}" data-lab="${escapeHtml(chip)}" role="tab" aria-selected="${active}">${escapeHtml(label)}</button>`;
  }).join("");

  filters.querySelectorAll(".forecasts__chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      forecastLabFilter = btn.dataset.lab || "all";
      renderForecastFilters();
      renderMarketList();
    });
  });

  toolbar.querySelectorAll(".forecasts__tab").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      forecastActiveTab = btn.dataset.tab || "markets";
      toolbar.querySelectorAll(".forecasts__tab").forEach((t) => {
        const on = t.dataset.tab === forecastActiveTab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderMarketList();
      renderWatchlist();
    });
  });
}

function renderForecastMeta() {
  const el = $("#forecastsMeta");
  if (!el || !forecastBundle?.meta) return;
  const m = forecastBundle.meta;
  const parts = [
    m.query ? `Results for “${m.query}”` : `${m.market_count ?? m.active_count} markets`,
    m.accuracy?.label ? m.accuracy.label : null,
  ].filter(Boolean);
  el.hidden = false;
  el.textContent = parts.join(" · ");
  if (m.accuracy?.detail) el.title = m.accuracy.detail;
}

function renderWatchlist() {
  const section = $("#forecastsWatchlist");
  const grid = $("#forecastsWatchlistGrid");
  const panel = $("#forecastsPanel");
  const items = forecastBundle?.watchlist ?? [];
  if (!section || !grid) return;

  const showWatchTab = forecastActiveTab === "watchlist";
  section.hidden = !showWatchTab;
  if (panel) panel.hidden = showWatchTab;

  if (!showWatchTab || !items.length) {
    if (showWatchTab && panel) panel.hidden = true;
    if (!items.length) section.hidden = true;
    return;
  }

  grid.innerHTML = items.map((w) => `
    <li class="forecast-watch">
      <p class="eyebrow">${escapeHtml(w.lab)}</p>
      <h4>${escapeHtml(w.model)}</h4>
      <p>${escapeHtml(w.note)}</p>
    </li>
  `).join("");
}

function renderMarketList() {
  const panel = $("#forecastsPanel");
  const loading = $("#forecastsLoading");
  const section = $("#forecastsWatchlist");
  if (!panel) return;

  if (forecastActiveTab === "watchlist") {
    renderWatchlist();
    return;
  }

  if (section) section.hidden = true;
  panel.hidden = false;

  const list = filteredMarkets();
  if (!list.length) {
    panel.innerHTML = `<p class="dash-message">${forecastSearchQuery || forecastLabFilter !== "all"
      ? "No markets match — try another search or filter."
      : "No tracked release markets right now."}</p>`;
    return;
  }
  panel.innerHTML = `<ul class="pm-markets">${list.map(renderMarketRow).join("")}</ul>`;

  panel.querySelectorAll(".pm-market__row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.closest(".pm-market")?.dataset.slug;
      forecastExpandedSlug = forecastExpandedSlug === slug ? null : slug;
      renderMarketList();
    });
  });
}

function renderForecasts(bundle) {
  forecastBundle = bundle;
  forecastExpandedSlug = null;

  const search = $("#forecastsSearch");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", () => {
      forecastSearchQuery = search.value;
      clearTimeout(forecastSearchDebounce);
      forecastSearchDebounce = setTimeout(() => loadForecasts(forecastSearchQuery), 350);
    });
  }

  if (!bundle?.markets?.length && !bundle?.watchlist?.length) {
    const loading = $("#forecastsLoading");
    if (loading) loading.textContent = "No tracked release markets right now.";
    return;
  }

  renderForecastMeta();
  renderForecastFilters();
  renderMarketList();
  if (forecastActiveTab === "watchlist") renderWatchlist();
}

function showForecastsSection(signupRow) {
  const section = $("#forecasts");
  const lock = $("#forecastsLock");
  const panel = $("#forecastsPanel");
  if (!section) return;

  const paid = isPaid(signupRow);
  section.hidden = !paid;
  if (!paid) return;

  const unlocked = hasForecasts(signupRow);
  if (lock) lock.hidden = unlocked;
  if (panel) {
    panel.hidden = !unlocked;
    if (!unlocked && $("#forecastsLoading")) $("#forecastsLoading").hidden = true;
  }
  if (unlocked) loadForecasts();
}

async function loadForecasts(searchOverride) {
  const loading = $("#forecastsLoading");
  const q = (searchOverride ?? forecastSearchQuery ?? "").trim();
  if (loading) {
    loading.hidden = false;
    loading.textContent = q ? "Searching Polymarket…" : "Loading release markets…";
  }
  try {
    const url = q
      ? `${SUPABASE_URL}/functions/v1/dexlyywatch-forecasts?q=${encodeURIComponent(q)}`
      : `${SUPABASE_URL}/functions/v1/dexlyywatch-forecasts`;
    const res = await fetch(url, {
      method: "GET",
      headers: await authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load forecasts");
    if (q) forecastSearchQuery = q;
    renderForecasts(data);
  } catch (err) {
    if (loading) {
      loading.hidden = false;
      loading.textContent = err.message || "Forecasts unavailable right now.";
    }
  }
}

function renderSignup(signupRow) {
  signup = signupRow;
  const paid = isPaid(signupRow);

  $("#loadingPanel").hidden = true;
  $("#authPanel").hidden = true;
  $("#signOutBtn").hidden = false;
  setDashLinks(true, paid);

  // Free users get a focused plan + email view; paid users get the full dashboard.
  $("#freeView").hidden = paid;
  $("#dashboard").hidden = !paid;
  $("#compare").hidden = !paid;

  updatePlanSidebar(signupRow);

  if (!paid) {
    renderFreeView(signupRow);
    $("#billingPanel").hidden = true;
    showFeedbackPanel(true, signupRow.alert_email || signupRow.email || "");
    handleStatusParam();
    return;
  }

  $("#alertEmail").value = signupRow.alert_email || signupRow.email || "";
  renderEmailState(signupRow);

  renderTags($("#labTags"), LABS, selectedLabs(signupRow));
  renderTags($("#capabilityTags"), CAPABILITIES, selectedCapabilities(signupRow));

  const squadron = signupRow.plan === "squadron" && paid;
  $("#squadronCard").hidden = !squadron;
  $("#seatLimit").value = signupRow.seat_limit || 10;
  $("#slackWebhook").value = signupRow.slack_webhook_url || "";
  $("#webhookUrl").value = signupRow.webhook_url || "";

  setPaidFieldsEnabled(paid);
  renderBilling();
  showForecastsSection(signupRow);
  showFeedbackPanel(true, signupRow.alert_email || signupRow.email || "");
  handleStatusParam();
}

function handleStatusParam() {
  if (params.get("status") === "success") {
    setMessage("Payment approved — your plan activates once PayPal confirms (usually within a minute).", "is-success");
    history.replaceState({}, "", "watch-dashboard.html");
  } else if (params.get("status") === "plan_changed") {
    setMessage("Plan change submitted. Refresh in a moment if your badge hasn't updated.", "is-success");
    history.replaceState({}, "", "watch-dashboard.html");
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out. Check your connection and try again.`)), ms)),
  ]);
}

async function primeAuthClient(stored) {
  if (!stored?.access_token) return stored;
  try {
    const { data, error } = await withTimeout(
      supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token ?? "",
      }),
      4000,
      "Restoring session",
    );
    if (error) return stored;
    return data.session ?? stored;
  } catch (_e) {
    return stored;
  }
}

async function loadSignup(sessionHint) {
  const stored = readStoredSession();
  const uid = sessionHint?.uid || stored?.user?.id;
  const token = sessionHint?.token || stored?.access_token;
  if (!uid || !token) {
    let resolvedUid = uid;
    if (!resolvedUid) {
      const { data: sess } = await withTimeout(supabase.auth.getSession(), 5000, "Session check");
      resolvedUid = sess.session?.user?.id;
    }
    if (!resolvedUid) throw new Error("Not signed in.");
    const accessToken = token || await getAccessToken();
    if (!accessToken) throw new Error("Not signed in.");
    return loadSignup({ uid: resolvedUid, token: accessToken });
  }

  await withTimeout(ensureSignupWithToken(token), 12000, "Loading your profile");
  let data = await fetchSignupRow(uid, token);
  if (!data) throw new Error("Could not load your watch profile.");
  data = await applySignupDefaultsIfNeeded(data);
  renderSignup(data);
}

const SIGNUP_SELECT = [
  "user_id",
  "email",
  "plan",
  "status",
  "pending_plan",
  "pending_interval",
  "alert_email",
  "alert_email_verified_at",
  "phone_e164",
  "phone_verified_at",
  "labs",
  "capabilities",
  "sms_enabled",
  "call_enabled",
  "slack_webhook_url",
  "webhook_url",
  "seat_limit",
].join(",");

async function fetchSignupRow(uid, token) {
  const res = await withTimeout(
    fetch(`${SUPABASE_URL}/rest/v1/dexlyywatch_signups?user_id=eq.${uid}&select=${SIGNUP_SELECT}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }),
    10000,
    "Loading your profile",
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Profile load failed (${res.status})`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function ensureSignupWithToken(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/watch_ensure_signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Could not create your profile");
  }
}

async function authHeaders() {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in.");
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function readStoredSession() {
  try {
    const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
    let raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          raw = localStorage.getItem(key);
          if (raw) break;
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession || parsed;
    if (!session?.access_token) return null;
    const expired = session.expires_at && Number(session.expires_at) * 1000 <= Date.now();
    if (expired && !session.refresh_token) return null;
    return session;
  } catch (_e) {
    return null;
  }
}

async function getAccessToken() {
  const stored = readStoredSession();
  if (stored?.access_token) return stored.access_token;
  const { data } = await withTimeout(supabase.auth.getSession(), 5000, "Session check");
  return data.session?.access_token ?? null;
}

async function startPayPalCheckout(plan, btn) {
  const label = btn?.dataset?.defaultLabel || btn?.textContent || `Choose ${planLabel(plan)}`;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Opening PayPal…";
  }
  try {
    const token = await getAccessToken();
    if (!token) {
      location.href = `watch-checkout.html?plan=${plan}&interval=${billingInterval}`;
      return;
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-checkout`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan, interval: billingInterval, origin: location.origin }),
    });
    const body = await res.json();
    if (body.ok && body.url) {
      location.href = body.url;
      return;
    }
    if (body.code === "NOT_CONFIGURED") {
      alert("Checkout isn't live yet — we'll email you when billing opens.");
      return;
    }
    throw new Error(body.error || "Checkout failed");
  } catch (err) {
    alert(err.message || "Could not start checkout.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

async function cancelSubscription() {
  if (!confirm("Cancel your DexlyyWatch subscription? You keep access until the current billing period ends.")) return;
  setMessage("Cancelling…");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-cancel-subscription`, {
      method: "POST",
      headers: await authHeaders(),
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Cancel failed");
    await loadSignup();
    setMessage("Subscription cancelled. Paid features remain until the period ends.", "is-success");
  } catch (err) {
    setMessage(err.message || "Could not cancel.", "is-error");
  }
}

async function changePlan(plan) {
  setMessage("Updating plan…");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-change-plan`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ plan, interval: billingInterval }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Plan change failed");
    if (data.needs_checkout) {
      location.href = `watch-checkout.html?plan=${plan}&interval=${billingInterval}`;
      return;
    }
    if (data.url) {
      location.href = data.url;
      return;
    }
    await loadSignup();
    setMessage(data.kind === "downgrade_scheduled" ? "Downgrade scheduled for next renewal." : "Plan updated.", "is-success");
  } catch (err) {
    setMessage(err.message || "Could not change plan.", "is-error");
  }
}

function showAuth() {
  $("#loadingPanel").hidden = true;
  $("#authPanel").hidden = false;
  $("#dashboard").hidden = true;
  $("#freeView").hidden = true;
  $("#compare").hidden = true;
  $("#feedbackPanel").hidden = true;
  $("#signOutBtn").hidden = true;
  setDashLinks(false);
  $("#planName").textContent = "Sign in required";
  $("#planState").textContent = "Create a free account or sign in";
  $("#billingPanel").hidden = true;
}

function showLoading(message = "Checking your signed-in session and preparing your Watch profile...") {
  $("#loadingPanel").hidden = false;
  $("#authPanel").hidden = true;
  $("#dashboard").hidden = true;
  $("#freeView").hidden = true;
  $("#compare").hidden = true;
  $("#feedbackPanel").hidden = true;
  $("#signOutBtn").hidden = true;
  setDashLinks(false);
  $("#loadingMsg").textContent = message;
  $("#planName").textContent = "Loading...";
  $("#planState").textContent = "Checking your account";
  $("#billingPanel").hidden = true;
}

function showSignedInError(err) {
  const message = friendlyAuthError(err);
  const seatsFull = String(err?.message || "").includes("FREE_SEATS_FULL");
  $("#loadingPanel").hidden = false;
  $("#authPanel").hidden = true;
  $("#dashboard").hidden = true;
  $("#freeView").hidden = true;
  $("#compare").hidden = true;
  $("#feedbackPanel").hidden = true;
  $("#signOutBtn").hidden = false;
  const action = seatsFull
    ? `<a href="watch.html#pricing">View paid plans</a> or use Sign out above.`
    : `<button type="button" class="btn btn--line" id="retryLoadBtn">Try again</button>`;
  $("#loadingMsg").innerHTML = `${escapeHtml(message)} ${action}`;
  $("#planName").textContent = "Signed in";
  $("#planState").textContent = "Could not finish profile setup";
  $("#billingPanel").hidden = true;
  $("#retryLoadBtn")?.addEventListener("click", () => { refreshAuth(); });
}

let authLoadInFlight = false;

async function refreshAuth() {
  if (authLoadInFlight) return;
  authLoadInFlight = true;
  try {
    showLoading();

    // Fast path on refresh: read localStorage directly so we never depend on
    // getSession(), which can hang when the auth client is mid-initialization.
    const stored = readStoredSession();
    if (stored?.user?.id && stored.access_token) {
      const session = await primeAuthClient(stored);
      $("#signOutBtn").hidden = false;
      showLoading("Signed in. Loading your Watch profile...");
      try {
        await loadSignup({ uid: session.user.id, token: session.access_token });
      } catch (err) {
        showSignedInError(err);
      }
      return;
    }

    let session = null;
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000, "Checking your session");
      session = data.session;
    } catch (err) {
      console.warn("getSession failed:", err);
      showAuth();
      return;
    }
    if (session?.user) {
      $("#signOutBtn").hidden = false;
      showLoading("Signed in. Loading your Watch profile...");
      try {
        await loadSignup({ uid: session.user.id, token: session.access_token });
      } catch (err) {
        showSignedInError(err);
      }
    } else {
      showAuth();
    }
  } finally {
    authLoadInFlight = false;
  }
}

$$("[data-auth-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
    const tab = btn.dataset.authTab;
    $("#authSignin").hidden = tab !== "signin";
    $("#authSignup").hidden = tab !== "signup";
    setAuthMessage("");
  });
});

$("#signInBtn")?.addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if (!email || !password) {
    setAuthMessage("Enter email and password.", "is-error");
    return;
  }
  setAuthMessage("Signing in…");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMessage(error.message, "is-error");
    return;
  }
  setAuthMessage("");
  await refreshAuth();
});

$("#signUpBtn")?.addEventListener("click", async () => {
  const email = $("#signupEmail").value.trim();
  const password = $("#signupPassword").value;
  if (!email || password.length < 8) {
    setAuthMessage("Enter a valid email and password (8+ characters).", "is-error");
    return;
  }
  setAuthMessage("Creating account…");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${location.origin}/watch-dashboard.html` },
  });
  if (error) {
    setAuthMessage(error.message, "is-error");
    return;
  }
  if (data.session) {
    await refreshAuth();
    return;
  }
  setAuthMessage("Check your email to confirm your account, then sign in.", "is-success");
});

$("#magicLinkBtn")?.addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  if (!email) {
    setAuthMessage("Enter your email first.", "is-error");
    return;
  }
  setAuthMessage("Sending link…");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/watch-dashboard.html` },
  });
  setAuthMessage(error ? error.message : "Check your email for the sign-in link.", error ? "is-error" : "is-success");
});

$("#googleBtn")?.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/watch-dashboard.html` },
  });
  if (error) setAuthMessage(error.message, "is-error");
});

$("#signOutBtn")?.addEventListener("click", async () => {
  const btn = $("#signOutBtn");
  btn.disabled = true;
  try {
    // local scope only signs out this tab and never needs a network round-trip,
    // so it can't hang. Guard with a timeout anyway as a safety net.
    await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000, "Sign out");
  } catch (_e) {
    // Fall through: clear any persisted session manually so the UI is correct.
    try {
      const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
      localStorage.removeItem(`sb-${ref}-auth-token`);
    } catch (_err) { /* ignore */ }
  } finally {
    signup = null;
    btn.disabled = false;
    showAuth();
  }
});

$("#saveFreeEmail")?.addEventListener("click", async () => {
  const btn = $("#saveFreeEmail");
  const email = $("#freeAlertEmail").value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFreeEmailMsg("Enter a valid email address.", "is-error");
    return;
  }
  if (!signup?.user_id) {
    setFreeEmailMsg("Could not load your account. Refresh and try again.", "is-error");
    return;
  }
  btn.disabled = true;
  setFreeEmailMsg("Saving…");
  try {
    await sendAlertEmailConfirmation(email);
    await loadSignup();
    setFreeEmailMsg(`Confirmation sent to ${email}. Click the link in that inbox to start your digest.`, "is-success");
  } catch (err) {
    setFreeEmailMsg(err.message || "Could not save your email.", "is-error");
  } finally {
    btn.disabled = false;
  }
});

$("#resendConfirmBtn")?.addEventListener("click", async () => {
  const btn = $("#resendConfirmBtn");
  const email = $("#alertEmail").value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMessage("Enter a valid alert email first.", "is-error");
    return;
  }
  btn.disabled = true;
  setMessage("Sending confirmation…");
  try {
    await sendAlertEmailConfirmation(email);
    await loadSignup();
    setMessage(`Confirmation resent to ${email}.`, "is-success");
  } catch (err) {
    setMessage(err.message || "Could not resend confirmation.", "is-error");
  } finally {
    btn.disabled = false;
  }
});

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

$("#saveSettings")?.addEventListener("click", async () => {
  const btn = $("#saveSettings");
  btn.disabled = true;
  setMessage("Saving…");
  const paid = isPaid(signup);
  const email = $("#alertEmail").value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    btn.disabled = false;
    setMessage("Enter a valid alert email.", "is-error");
    return;
  }

  const currentEmail = (signup.alert_email || signup.email || "").toLowerCase();
  const needsConfirm = email !== currentEmail || !signup.alert_email_verified_at;

  try {
    if (needsConfirm) {
      await sendAlertEmailConfirmation(email);
    }

    if (paid) {
      const slackWebhook = $("#slackWebhook").value.trim();
      const webhookUrl = $("#webhookUrl").value.trim();
      if (slackWebhook && !isHttpsUrl(slackWebhook)) {
        btn.disabled = false;
        setMessage("Slack webhook must be an https:// URL.", "is-error");
        return;
      }
      if (webhookUrl && !isHttpsUrl(webhookUrl)) {
        btn.disabled = false;
        setMessage("Webhook URL must be an https:// URL.", "is-error");
        return;
      }
      const payload = {
        updated_at: new Date().toISOString(),
        sms_enabled: Boolean(signup.sms_enabled),
        call_enabled: Boolean(signup.call_enabled),
        labs: readChecked($("#labTags")),
        capabilities: readChecked($("#capabilityTags")),
        seat_limit: Number($("#seatLimit").value) || 10,
        slack_webhook_url: slackWebhook || null,
        webhook_url: webhookUrl || null,
      };
      if (!needsConfirm) payload.alert_email = email;
      const { data, error } = await supabase.from("dexlyywatch_signups").update(payload).eq("user_id", signup.user_id).select().maybeSingle();
      if (error) throw error;
      renderSignup(data);
    } else {
      await loadSignup();
    }

    if (needsConfirm) {
      setMessage(`Confirmation sent to ${email}. Alerts start after you confirm that inbox.`, "is-success");
    } else {
      setMessage("Settings saved.", "is-success");
    }
  } catch (err) {
    setMessage(err.message || "Could not save.", "is-error");
  } finally {
    btn.disabled = false;
  }
});

function modelLabel(model) {
  return `${model.lab} · ${model.id}`;
}

function modelField(model, key) {
  return model[key] || LIVE_MODEL_DEFAULTS[key] || "—";
}

function compareCell(value, mono = false) {
  const cls = mono ? " compare-cell--mono" : "";
  return `<div class="compare-cell${cls}">${escapeHtml(value)}</div>`;
}

function compareRow(label, a, b, opts = {}) {
  return `<div class="compare-row${opts.mono ? " compare-row--mono" : ""}"><div class="compare-row__label">${escapeHtml(label)}</div>${compareCell(a, opts.mono)}${compareCell(b, opts.mono)}</div>`;
}

function compareSection(title, rows, a, b) {
  const body = rows.map((row) => compareRow(row.label, modelField(a, row.key), modelField(b, row.key), { mono: row.mono })).join("");
  return `<div class="compare-section"><h3 class="compare-section__title">${escapeHtml(title)}</h3>${body}</div>`;
}

function compareSummary(model) {
  return `
    <article class="compare-summary">
      <p class="compare-summary__lab">${escapeHtml(model.lab)}</p>
      <h3 class="compare-summary__name">${escapeHtml(model.id)}</h3>
      <p class="compare-summary__vibe">${escapeHtml(modelField(model, "vibePick"))}</p>
      <dl class="compare-summary__stats">
        <div><dt>Input</dt><dd>${escapeHtml(modelField(model, "inputPrice"))}</dd></div>
        <div><dt>Output</dt><dd>${escapeHtml(modelField(model, "outputPrice"))}</dd></div>
        <div><dt>Coding</dt><dd>${escapeHtml(modelField(model, "coding"))}</dd></div>
        <div><dt>Speed</dt><dd>${escapeHtml(modelField(model, "speed"))}</dd></div>
      </dl>
      <p class="compare-summary__api"><span>API model</span> <code>${escapeHtml(modelField(model, "apiModel") || model.id)}</code></p>
    </article>`;
}

const COMPARE_SECTIONS = [
  {
    title: "Pricing & access",
    rows: [
      { key: "inputPrice", label: "API input", mono: true },
      { key: "outputPrice", label: "API output", mono: true },
      { key: "cachePrice", label: "Cached input", mono: true },
      { key: "subscription", label: "Chat subscriptions" },
      { key: "freeTier", label: "Free tier" },
      { key: "openWeights", label: "Open weights" },
      { key: "access", label: "How to use" },
    ],
  },
  {
    title: "Vibe-coder fit",
    rows: [
      { key: "vibePick", label: "Pick this if…" },
      { key: "coding", label: "Coding & agents" },
      { key: "reasoning", label: "Reasoning tier" },
      { key: "speed", label: "Speed feel" },
      { key: "latency", label: "Typical latency", mono: true },
      { key: "tools", label: "Tools & integrations" },
    ],
  },
  {
    title: "Specs",
    rows: [
      { key: "released", label: "Released" },
      { key: "context", label: "Context window" },
      { key: "apiModel", label: "API model ID", mono: true },
      { key: "note", label: "DexlyyWatch take" },
    ],
  },
];

function renderCompare() {
  const a = MODELS[Number($("#modelA").value)] || MODELS[0];
  const b = MODELS[Number($("#modelB").value)] || MODELS[1];
  const table = $("#compareTable");
  if (!table) return;
  table.innerHTML = `
    <div class="compare__summaries">
      ${compareSummary(a)}
      ${compareSummary(b)}
    </div>
    <div class="compare__sections">
      ${COMPARE_SECTIONS.map((section) => compareSection(section.title, section.rows, a, b)).join("")}
    </div>`;
}

async function loadLiveModels() {
  try {
    const { data: drops } = await supabase.rpc("dexlyywatch_drops", { p_limit: 20 });
    const seen = new Set(MODELS.map((m) => `${m.lab}|${m.id}`.toLowerCase()));
    (drops || []).forEach((drop) => {
      const key = `${drop.lab}|${drop.model_id}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      MODELS.push({
        ...LIVE_MODEL_DEFAULTS,
        id: drop.model_id,
        lab: drop.lab,
        apiModel: drop.model_id,
        released: drop.released_at ? new Date(drop.released_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Detected",
        access: drop.url ? `Source · ${drop.url}` : "Detected signal",
      });
    });
    fillModelSelects();
    renderCompare();
  } catch {
    /* static catalog is enough */
  }
}

function fillModelSelects() {
  const html = MODELS.map((m, i) => `<option value="${i}">${escapeHtml(modelLabel(m))}</option>`).join("");
  $("#modelA").innerHTML = html;
  $("#modelB").innerHTML = html;
  if (!$("#modelA").value) $("#modelA").value = "0";
  if (!$("#modelB").value) $("#modelB").value = String(Math.min(1, MODELS.length - 1));
}

function setFeedbackMessage(text, kind = "") {
  const el = $("#feedbackMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `dash-message ${kind}`.trim();
}

$("#modelA")?.addEventListener("change", renderCompare);
$("#modelB")?.addEventListener("change", renderCompare);

fillModelSelects();
renderCompare();
loadLiveModels();

$("#freePlansCompare")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".js-upgrade-plan");
  if (!btn?.dataset.plan) return;
  startPayPalCheckout(btn.dataset.plan, btn);
});

$("#dashBilling")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cycle]");
  if (!btn) return;
  setBillingInterval(btn.dataset.cycle);
});

setBillingInterval(billingInterval);

$("#feedbackForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#feedbackSubmit");
  const email = $("#feedbackEmail").value.trim().toLowerCase();
  const kind = $("#feedbackKind").value;
  const message = $("#feedbackMessage").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFeedbackMessage("Enter a valid email so we can follow up.", "is-error");
    return;
  }
  if (message.length < 10) {
    setFeedbackMessage("Give us a bit more detail (at least 10 characters).", "is-error");
    return;
  }
  const original = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
  setFeedbackMessage("Sending to Dexlyy support…");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-contact`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        email,
        note: message,
        plan: signup?.plan || "unknown",
        page: "watch-dashboard",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || "Could not send feedback.");
    $("#feedbackForm").reset();
    if ($("#feedbackEmail")) $("#feedbackEmail").value = email;
    setFeedbackMessage("Thanks — we got it. Dexlyy support will read every submission.", "is-success");
  } catch (err) {
    setFeedbackMessage(err.message || "Could not send. Email support@dexlyy.com instead.", "is-error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original || "Send feedback"; }
  }
});

if (params.get("signout") === "1") {
  try {
    await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000, "Sign out");
  } catch (_e) {
    try {
      const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
      localStorage.removeItem(`sb-${ref}-auth-token`);
    } catch (_err) { /* ignore */ }
  }
  history.replaceState({}, "", "watch-dashboard.html");
}

// OAuth / magic-link return with a PKCE ?code=. We do the exchange ourselves
// (detectSessionInUrl is off) so a bad/reused code can't deadlock the client.
async function settleAuthFromUrl() {
  const code = params.get("code");
  if (!code) return;
  showLoading("Finishing sign-in...");
  try {
    const { error } = await withTimeout(
      supabase.auth.exchangeCodeForSession(code),
      12000,
      "Finishing sign-in",
    );
    if (error) console.warn("code exchange error:", error.message);
  } catch (err) {
    // Reused/expired code or timeout — fall through; refreshAuth shows the right
    // state (existing session loads the dashboard; none shows the sign-in form).
    console.warn("code exchange failed:", err);
  }
  history.replaceState({}, "", "watch-dashboard.html");
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    signup = null;
    showAuth();
  }
});
try {
  await settleAuthFromUrl();
  await confirmAlertFromUrl();
  await refreshAuth();
} catch (err) {
  // Never leave the page blank: fall back to the sign-in view on any init error.
  console.error("dashboard init failed:", err);
  showAuth();
}
