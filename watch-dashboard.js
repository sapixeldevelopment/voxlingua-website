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
  { id: "gpt-5.5", lab: "OpenAI", released: "Apr 2026", context: "1M tokens", pricing: "Premium API", strengths: "Agentic coding, terminal work, broad reasoning", access: "API + ChatGPT", note: "Best default when tool use and reliability matter." },
  { id: "claude-opus-4-8", lab: "Anthropic", released: "May 2026", context: "1M tokens", pricing: "Premium API", strengths: "Writing, code review, long documents, careful reasoning", access: "API + Claude", note: "Strong fit for analysis-heavy product and engineering work." },
  { id: "gemini-3.5-flash", lab: "Google", released: "May 2026", context: "1M tokens", pricing: "Cost-efficient", strengths: "Fast multimodal tasks, high-volume agents", access: "API + AI Studio", note: "Useful when latency and throughput matter." },
  { id: "grok-4.3", lab: "xAI", released: "Apr 2026", context: "1M tokens", pricing: "Premium API", strengths: "Real-time context, low-hallucination frontier chat", access: "API + Grok", note: "Watch closely for news-aware and social-context workflows." },
  { id: "DeepSeek-V4-Pro", lab: "DeepSeek", released: "Apr 2026", context: "256K tokens", pricing: "Aggressive API pricing", strengths: "Reasoning, math, efficient code tasks", access: "API + open-weight family", note: "Often the value benchmark when cost matters." },
  { id: "Qwen3.7-Plus", lab: "Alibaba", released: "May 2026", context: "1M tokens", pricing: "Enterprise API", strengths: "Agent workflows, multilingual work, long context", access: "API", note: "A major contender for enterprise agent pipelines." },
  { id: "Mistral-Medium-3.5", lab: "Mistral", released: "Apr 2026", context: "128K tokens", pricing: "Mid-market API", strengths: "European deployment, fast general-purpose inference", access: "API", note: "Good candidate when data residency and speed are priorities." },
  { id: "Llama 4 family", lab: "Meta", released: "2026", context: "Varies", pricing: "Open weights", strengths: "Self-hosting, customization, broad ecosystem", access: "Open weights", note: "Best when control and local deployment beat managed API ease." },
];

const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" },
});

let signup = null;
let billingInterval = "annual";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function planLabel(plan) {
  return plan === "squadron" ? "Squadron" : plan === "pro" ? "Pro" : "Watch";
}

function isPaid(signupRow) {
  return signupRow && (signupRow.plan === "pro" || signupRow.plan === "squadron") && signupRow.status === "active";
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
      <a class="btn btn--solid" href="watch-checkout.html?plan=pro&interval=${billingInterval}">Upgrade to Pro</a>
      <a class="btn btn--line" href="watch-checkout.html?plan=squadron&interval=${billingInterval}">Upgrade to Squadron</a>`;
    note.textContent = plan === "watch"
      ? "Free Watch includes the weekly digest. Upgrade for first-in-line alerts, filters, and model comparison."
      : status === "cancelled"
        ? "Your paid access continues until the billing period ends. You can resume or start a new plan anytime."
        : "Choose a paid plan to unlock Pro or Squadron features.";
    return;
  }

  if (plan === "pro") {
    actions.innerHTML = `
      <button type="button" class="btn btn--line" data-change-plan="squadron">Upgrade to Squadron</button>
      <button type="button" class="btn btn--ghost" data-cancel-sub>Cancel subscription</button>`;
    note.textContent = signup.pending_plan
      ? `Downgrade to ${planLabel(signup.pending_plan)} scheduled for your next billing date.`
      : "Manage billing here — downgrade takes effect at renewal.";
  } else if (plan === "squadron") {
    actions.innerHTML = `
      <button type="button" class="btn btn--line" data-change-plan="pro">Downgrade to Pro</button>
      <button type="button" class="btn btn--ghost" data-cancel-sub>Cancel subscription</button>`;
    note.textContent = signup.pending_plan
      ? `Downgrade to ${planLabel(signup.pending_plan)} scheduled for your next billing date.`
      : "Squadron includes team routing and up to 10 seats.";
  }

  actions.querySelector("[data-cancel-sub]")?.addEventListener("click", cancelSubscription);
  actions.querySelector("[data-change-plan]")?.addEventListener("click", (e) => {
    changePlan(e.target.dataset.changePlan);
  });
}

function renderSignup(signupRow) {
  signup = signupRow;
  const paid = isPaid(signupRow);

  $("#loadingPanel").hidden = true;
  $("#authPanel").hidden = true;
  $("#dashboard").hidden = false;
  $("#signOutBtn").hidden = false;
  $("#planName").textContent = `DexlyyWatch ${planLabel(signupRow.plan)}`;
  $("#planState").textContent = paid
    ? "Active paid plan"
    : signupRow.pending_plan
      ? `Checkout pending — ${planLabel(signupRow.pending_plan)}`
      : signupRow.status === "cancelled"
        ? "Subscription cancelled"
        : "Free watch — weekly digest";

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

  if (params.get("status") === "success") {
    setMessage("Payment approved — your plan activates once PayPal confirms (usually within a minute).", "is-success");
    history.replaceState({}, "", "watch-dashboard.html");
  } else if (params.get("status") === "plan_changed") {
    setMessage("Plan change submitted. Refresh in a moment if your badge hasn't updated.", "is-success");
    history.replaceState({}, "", "watch-dashboard.html");
  }
}

async function ensureSignup() {
  const { data, error } = await supabase.rpc("watch_ensure_signup");
  if (error) throw error;
  return data;
}

async function loadSignup() {
  await ensureSignup();
  const { data, error } = await supabase.from("dexlyywatch_signups").select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Could not load your watch profile.");
  renderSignup(data);
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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
  $("#signOutBtn").hidden = true;
  $("#planName").textContent = "Sign in required";
  $("#planState").textContent = "Create a free account or sign in";
  $("#billingPanel").hidden = true;
}

function showLoading(message = "Checking your signed-in session and preparing your Watch profile...") {
  $("#loadingPanel").hidden = false;
  $("#authPanel").hidden = true;
  $("#dashboard").hidden = true;
  $("#signOutBtn").hidden = true;
  $("#loadingMsg").textContent = message;
  $("#planName").textContent = "Loading...";
  $("#planState").textContent = "Checking your account";
  $("#billingPanel").hidden = true;
}

function showSignedInError(err) {
  const message = friendlyAuthError(err);
  $("#loadingPanel").hidden = false;
  $("#authPanel").hidden = true;
  $("#dashboard").hidden = true;
  $("#signOutBtn").hidden = false;
  $("#loadingMsg").innerHTML = `${escapeHtml(message)} <a href="watch.html#pricing">View paid plans</a> or use Sign out above.`;
  $("#planName").textContent = "Signed in";
  $("#planState").textContent = "Could not finish profile setup";
  $("#billingPanel").hidden = true;
}

async function refreshAuth() {
  showLoading();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    $("#signOutBtn").hidden = false;
    showLoading("Signed in. Loading your Watch profile...");
    try {
      await loadSignup();
    } catch (err) {
      showSignedInError(err);
    }
  } else {
    showAuth();
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
  await supabase.auth.signOut();
  showAuth();
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

function fillModelSelects() {
  const html = MODELS.map((m, i) => `<option value="${i}">${escapeHtml(modelLabel(m))}</option>`).join("");
  $("#modelA").innerHTML = html;
  $("#modelB").innerHTML = html;
  $("#modelA").value = "0";
  $("#modelB").value = "1";
}

function compareRow(label, a, b) {
  return `<div class="compare-row"><div class="compare-row__label">${escapeHtml(label)}</div><div>${escapeHtml(a)}</div><div>${escapeHtml(b)}</div></div>`;
}

function renderCompare() {
  const a = MODELS[Number($("#modelA").value)] || MODELS[0];
  const b = MODELS[Number($("#modelB").value)] || MODELS[1];
  $("#compareTable").innerHTML = `
    <div class="compare-row compare-row--head"><div></div><div>${escapeHtml(modelLabel(a))}</div><div>${escapeHtml(modelLabel(b))}</div></div>
    ${compareRow("Released", a.released, b.released)}
    ${compareRow("Context", a.context, b.context)}
    ${compareRow("Pricing posture", a.pricing, b.pricing)}
    ${compareRow("Best at", a.strengths, b.strengths)}
    ${compareRow("Access", a.access, b.access)}
    ${compareRow("DexlyyWatch read", a.note, b.note)}`;
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
        id: drop.model_id,
        lab: drop.lab,
        released: drop.released_at ? new Date(drop.released_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Detected",
        context: "TBD",
        pricing: "TBD",
        strengths: drop.source_kind === "huggingface" ? "Open-weight release detected" : "Announcement detected",
        access: drop.url ? "Source linked" : "Detected signal",
        note: "Live DexlyyWatch detection. Benchmark and pricing snapshot pending.",
      });
    });
    fillModelSelects();
    renderCompare();
  } catch {
    /* static catalog is enough */
  }
}

$("#modelA")?.addEventListener("change", renderCompare);
$("#modelB")?.addEventListener("change", renderCompare);

fillModelSelects();
renderCompare();
loadLiveModels();

if (params.get("signout") === "1") {
  await supabase.auth.signOut();
  history.replaceState({}, "", "watch-dashboard.html");
}

supabase.auth.onAuthStateChange(() => refreshAuth());
await refreshAuth();
