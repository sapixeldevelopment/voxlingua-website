const SUPABASE_URL = "https://mmgzuubrtyodhjtmjlvb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LYP_tofuZNutUaE-KfjT7Q_Uf5XcaIO";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const params = new URLSearchParams(location.search);

const LABS = ["OpenAI", "Anthropic", "Google", "xAI", "Meta", "DeepSeek", "Alibaba", "Mistral", "Moonshot", "Zhipu", "MiniMax", "NVIDIA"];
const CAPABILITIES = [
  ["reasoning", "Reasoning"],
  ["coding", "Coding"],
  ["vision", "Vision"],
  ["voice", "Voice"],
  ["agents", "Agents"],
  ["long-context", "Long context"],
  ["open-weights", "Open weights"],
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
      "Lab & capability filters",
      "Model comparison tool",
      "SMS & voice alerts (coming soon)",
    ],
  },
  {
    key: "squadron",
    name: "Squadron",
    short: "Squadron",
    monthly: { amount: "15", label: "$15 / month" },
    annual: { amount: "13", total: "150", label: "$13 / mo · $150 billed yearly" },
    features: [
      "Everything in Pro",
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
      ? "Annual billing: Pro $50/year · Squadron $150/year (2 months free vs monthly)."
      : "Monthly billing: Pro $5/month · Squadron $15/month. Cancel anytime.";
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
    perks: ["Real-time email alerts", "Lab & capability filters", "Model comparison"],
    upgrade: { plan: "squadron", title: "Squadron", sub: "$15/mo · team routing & webhooks" },
  },
  squadron: {
    tagline: "$15/mo · team routing",
    perks: ["Everything in Pro", "Up to 10 seats", "Slack & generic webhooks"],
    upgrade: { plan: "pro", title: "Pro", sub: "$5/mo · solo alerts & compare" },
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
  return plan === "squadron" ? "Squadron" : plan === "pro" ? "Pro" : "Watch";
}

function hasPaidPlan(signupRow) {
  return Boolean(signupRow) && (signupRow.plan === "pro" || signupRow.plan === "squadron");
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
    return "The 200 free Watch seats are full. Choose Pro or Squadron from the pricing page to join.";
  }
  return message || "Could not load dashboard.";
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
      <a class="dash-billing__upgrade" href="watch-checkout.html?plan=squadron&interval=${billingInterval}">
        <span class="dash-billing__upgrade-title">Squadron</span>
        <span class="dash-billing__upgrade-sub">$15/mo · team routing</span>
      </a>`;
    note.textContent = plan === "watch"
      ? "Upgrade for first-in-line alerts, filters, and model comparison."
      : status === "cancelled"
        ? "Paid access continues until the period ends. Resume or pick a new plan anytime."
        : "Choose a paid plan to unlock Pro or Squadron.";
    return;
  }

  const meta = PLAN_META[plan];
  const upgrade = meta?.upgrade;
  if (upgrade) {
    actions.innerHTML = `
      <button type="button" class="dash-billing__upgrade" data-change-plan="${upgrade.plan}">
        <span class="dash-billing__upgrade-title">${escapeHtml(upgrade.title)}</span>
        <span class="dash-billing__upgrade-sub">${upgrade.sub}</span>
      </button>
      <button type="button" class="dash-billing__link" data-cancel-sub>Cancel subscription</button>`;
    note.textContent = signup.pending_plan
      ? `${planLabel(signup.pending_plan)} change scheduled for next billing date.`
      : plan === "pro"
        ? "Upgrade anytime. Downgrades apply at renewal."
        : "Downgrade to Pro takes effect at renewal.";
  }

  actions.querySelector("[data-cancel-sub]")?.addEventListener("click", cancelSubscription);
  actions.querySelector("[data-change-plan]")?.addEventListener("click", (e) => {
    changePlan(e.currentTarget.dataset.changePlan);
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
  const verified = Boolean(signupRow.alert_email_verified_at);
  $("#freeEmailState").textContent = verified ? "Email confirmed" : "Email pending";
  $("#freeEmailState").classList.toggle("is-ok", verified);

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

  const cancelledWithAccess = hasPaidPlan(signupRow) && signupRow.status === "cancelled";
  updatePlanSidebar(signupRow);

  if (!paid) {
    renderFreeView(signupRow);
    $("#billingPanel").hidden = true;
    showFeedbackPanel(true, signupRow.alert_email || signupRow.email || "");
    handleStatusParam();
    return;
  }

  $("#alertEmail").value = signupRow.alert_email || signupRow.email || "";
  $("#emailState").textContent = signupRow.alert_email_verified_at ? "Email confirmed" : "Email unconfirmed";
  $("#emailState").classList.toggle("is-ok", Boolean(signupRow.alert_email_verified_at));

  renderTags($("#labTags"), LABS, signupRow.labs?.length ? signupRow.labs : LABS.slice(0, 6));
  renderTags($("#capabilityTags"), CAPABILITIES, signupRow.capabilities || ["reasoning", "coding", "agents"]);

  const squadron = signupRow.plan === "squadron" && paid;
  $("#squadronCard").hidden = !squadron;
  $("#seatLimit").value = signupRow.seat_limit || 10;
  $("#slackWebhook").value = signupRow.slack_webhook_url || "";
  $("#webhookUrl").value = signupRow.webhook_url || "";

  setPaidFieldsEnabled(paid);
  renderBilling();
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

  let data = await fetchSignupRow(uid, token);
  if (!data) {
    await withTimeout(ensureSignupWithToken(token), 12000, "Creating your profile");
    data = await fetchSignupRow(uid, token);
  }
  if (!data) throw new Error("Could not load your watch profile.");
  renderSignup(data);
}

async function fetchSignupRow(uid, token) {
  const res = await withTimeout(
    fetch(`${SUPABASE_URL}/rest/v1/dexlyywatch_signups?user_id=eq.${uid}&select=*`, {
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
  // Updating the stored alert_email is all that's needed: the alert sender reads
  // this column fresh each run, so the old address stops receiving alerts and the
  // new one starts immediately — no separate contact list to clean up.
  const { data, error } = await supabase
    .from("dexlyywatch_signups")
    .update({ alert_email: email, updated_at: new Date().toISOString() })
    .eq("user_id", signup.user_id)
    .select()
    .maybeSingle();
  btn.disabled = false;
  if (error) {
    setFreeEmailMsg(error.message || "Could not save your email.", "is-error");
    return;
  }
  renderSignup(data);
  setFreeEmailMsg("Saved. Your digest now goes to this address; the old one was removed.", "is-success");
});

$("#saveSettings")?.addEventListener("click", async () => {
  const btn = $("#saveSettings");
  btn.disabled = true;
  setMessage("Saving…");
  const paid = isPaid(signup);
  const payload = {
    alert_email: $("#alertEmail").value.trim().toLowerCase(),
    updated_at: new Date().toISOString(),
  };
  if (paid) {
    Object.assign(payload, {
      sms_enabled: false,
      call_enabled: false,
      labs: readChecked($("#labTags")),
      capabilities: readChecked($("#capabilityTags")),
      seat_limit: Number($("#seatLimit").value) || 10,
      slack_webhook_url: $("#slackWebhook").value.trim() || null,
      webhook_url: $("#webhookUrl").value.trim() || null,
    });
  }

  const { data, error } = await supabase.from("dexlyywatch_signups").update(payload).eq("user_id", signup.user_id).select().maybeSingle();
  btn.disabled = false;
  if (error) {
    setMessage(error.message || "Could not save.", "is-error");
    return;
  }
  renderSignup(data);
  setMessage(paid ? "Settings saved." : "Alert email saved for your free weekly digest.", "is-success");
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
  await refreshAuth();
} catch (err) {
  // Never leave the page blank: fall back to the sign-in view on any init error.
  console.error("dashboard init failed:", err);
  showAuth();
}
