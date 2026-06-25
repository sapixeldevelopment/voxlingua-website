/* DexlyyWatch marketing page — radar, timeline, pricing, live stats */
(function () {
  "use strict";

  const SUPABASE_URL = "https://mmgzuubrtyodhjtmjlvb.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_LYP_tofuZNutUaE-KfjT7Q_Uf5XcaIO";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* =======================================================
     Curated baseline — accurate as of June 2026. The live
     detection engine (Supabase) enhances this at runtime:
     coverage is overridden only when a NEWER model is
     detected, and live open-weight drops are merged into the
     timeline. Closed-lab flagships (GPT, Claude, Gemini,
     Grok) that never hit Hugging Face stay curated & dated.
     ======================================================= */
  const LABS = [
    { name: "OpenAI",          liveKey: "OpenAI",   initial: "O", family: "GPT",     latest: "gpt-5.5",            date: "Apr 23, 2026" },
    { name: "Anthropic",       liveKey: null,        initial: "A", family: "Claude",  latest: "claude-opus-4-8",    date: "May 28, 2026" },
    { name: "Google DeepMind", liveKey: "Google",    initial: "G", family: "Gemini",  latest: "gemini-3.5-flash",   date: "May 19, 2026" },
    { name: "xAI",             liveKey: null,        initial: "x", family: "Grok",    latest: "grok-4.3",           date: "Apr 17, 2026" },
    { name: "DeepSeek",        liveKey: "DeepSeek",  initial: "D", family: "DeepSeek", latest: "DeepSeek-V4-Pro",    date: "Apr 24, 2026" },
    { name: "Alibaba",         liveKey: "Alibaba",   initial: "Q", family: "Qwen",    latest: "Qwen3.7-Plus",       date: "May 31, 2026" },
    { name: "Mistral",         liveKey: "Mistral",   initial: "M", family: "Mistral", latest: "Mistral-Medium-3.5", date: "Apr 28, 2026" },
    { name: "Meta",            liveKey: "Meta",      initial: "M", family: "Llama",   latest: "Muse Spark",         date: "Apr 8, 2026" },
  ];

  // Radar rows (hero card) — labs we monitor + latest id seen
  const RADAR = LABS.slice(0, 6).map((l) => ({ lab: l.name, model: l.latest }));

  // Marquee closed-lab launches the HF/RSS sensors can't see (API/UI-only).
  // Live open-weight detections are merged in on top of these at runtime.
  const CLOSED_DROPS = [
    { date: new Date("2026-06-09"), lab: "Anthropic", title: "Claude Fable 5", tag: "new", note: "The first publicly available Mythos-class model. Access was suspended on Jun 12 pending an export-control review." },
    { date: new Date("2026-05-31"), lab: "Alibaba", title: "Qwen3.7-Plus", tag: "new", note: "Proprietary agentic API flagship — Alibaba's strongest Qwen release, following the text-only Qwen3.7-Max." },
    { date: new Date("2026-05-28"), lab: "Anthropic", title: "Claude Opus 4.8", tag: "new", note: "Frontier leader on the Artificial Analysis Intelligence Index (61.4) with a 1M-token context window." },
    { date: new Date("2026-05-19"), lab: "Google", title: "Gemini 3.5 Flash", tag: "new", note: "General availability of Google's high-speed model tuned for agentic tasks and coding." },
    { date: new Date("2026-04-23"), lab: "OpenAI", title: "GPT-5.5", tag: "new", note: "OpenAI's terminal-native agentic flagship — 82.7% on Terminal-Bench 2.0, a ground-up retrain." },
    { date: new Date("2026-04-17"), lab: "xAI", title: "Grok 4.3", tag: "new", note: "Lowest hallucination rate among frontier models, 1M-token context, configurable reasoning effort." },
  ];

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDay = (d) => `${MON[d.getMonth()]} ${d.getDate()}`;
  const fmtDate = (iso) => { const d = new Date(iso); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };

  // Working copy that the live feed fills in; starts from curated marquee.
  let DROPS = CLOSED_DROPS.map((d) => ({ day: fmtDay(d.date), year: String(d.date.getFullYear()), lab: d.lab, title: d.title, tag: d.tag, note: d.note }));

  /* ---------------- Nav ---------------- */
  const nav = $("#nav");
  const onScroll = () => nav && nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#burger");
  burger && burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  $$(".nav__links a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    burger && burger.setAttribute("aria-expanded", "false");
  }));

  /* ---------------- Coverage grid ---------------- */
  const labsEl = $("#labs");
  function renderLabs() {
    if (!labsEl) return;
    labsEl.innerHTML = LABS.map((l) => `
      <article class="lab reveal">
        <div class="lab__top">
          <span class="lab__logo">${l.initial}</span>
          <span class="lab__chip"><i></i> Tracking</span>
        </div>
        <h3>${l.name}</h3>
        <p class="lab__model">${l.family} · ${l.latest}</p>
        <p class="lab__date">Latest: ${l.date}</p>
      </article>`).join("");
    observeReveals();
  }

  /* ---------------- Radar list ---------------- */
  const radarList = $("#radarList");
  function renderRadar() {
    if (!radarList) return;
    radarList.innerHTML = RADAR.map((r, i) => `
      <li class="rrow" data-i="${i}">
        <div>
          <div class="rrow__lab">${r.lab}</div>
          <div class="rrow__model">${r.model}</div>
        </div>
        <span class="rrow__status"><i></i> Tracking</span>
      </li>`).join("");
  }
  renderRadar();

  /* ---------------- Coverage ticker ---------------- */
  const ticker = $("#ticker");
  if (ticker) {
    const names = ["OpenAI", "Anthropic", "Google DeepMind", "xAI", "Meta", "DeepSeek", "Mistral", "Qwen", "Moonshot", "Zhipu", "MiniMax", "Cohere"];
    const seq = names.map((n) => `<span>${n}</span><span class="dot">✳</span>`).join("");
    ticker.innerHTML = seq + seq;
  }

  /* ---------------- Recent drops timeline ---------------- */
  const timeline = $("#timeline");
  const tagLabel = { new: "New release", open: "Open weights", announced: "Announced" };
  const tagClass = { new: "tl__tag--new", open: "tl__tag--open", announced: "tl__tag--open" };
  function renderTimeline() {
    if (!timeline) return;
    timeline.innerHTML = DROPS.map((d) => `
      <li class="tl reveal">
        <div class="tl__when"><b>${d.day}</b>${d.year} · ${d.lab}</div>
        <div class="tl__body">
          <h3>${d.title} <span class="tl__tag ${tagClass[d.tag] || ""}">${tagLabel[d.tag] || "Update"}</span></h3>
          <p>${d.note}</p>
        </div>
      </li>`).join("");
    observeReveals();
  }

  /* ---------------- Radar countdown + sweep ---------------- */
  const radarBar = $("#radarBar");
  const radarNext = $("#radarNext");
  let secs = 60;
  setInterval(() => {
    secs -= 1;
    if (secs < 0) secs = 60;
    if (radarBar) radarBar.style.width = ((60 - secs) / 60 * 100) + "%";
    if (radarNext) radarNext.textContent = "next sweep in " + secs + "s";
  }, 1000);

  /* ---------------- Detected toast (cycles real recent drops) ---------------- */
  const toast = $("#toast");
  const toastModel = $("#toastModel");
  const toastTitle = $("#toastTitle");
  let toastIdx = 0;
  function showToast() {
    if (!toast || !toastModel) return;
    const d = DROPS[toastIdx % DROPS.length];
    toastIdx++;
    toastModel.textContent = `${d.lab} · ${d.title}`;
    if (toastTitle) toastTitle.textContent = `Detected · ${d.day}`;

    // briefly highlight a matching radar row if present
    const rowIdx = RADAR.findIndex((r) => r.lab === d.lab);
    const row = rowIdx >= 0 && radarList ? radarList.querySelector(`[data-i="${rowIdx}"]`) : null;
    if (row) { row.classList.add("is-hit"); setTimeout(() => row.classList.remove("is-hit"), 4600); }

    toast.classList.add("is-show");
    setTimeout(() => toast.classList.remove("is-show"), 4800);
  }
  setTimeout(showToast, 4500);
  setInterval(showToast, 14000);

  /* ---------------- Pricing toggle ---------------- */
  const billing = $("#billing");
  if (billing) {
    billing.addEventListener("click", (e) => {
      const btn = e.target.closest(".toggle__btn");
      if (!btn) return;
      $$(".toggle__btn", billing).forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      const cycle = btn.dataset.cycle;
      $$("[data-monthly]").forEach((el) => { el.textContent = cycle === "annual" ? el.dataset.annual : el.dataset.monthly; });
      currentCycle = cycle;
    });
  }
  let currentCycle = "monthly";

  /* ---------------- Plan CTAs ---------------- */
  $$(".plan__cta").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-disabled-free")) {
        $("#pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const plan = btn.dataset.plan;
      if (plan === "watch") {
        location.href = "watch-dashboard.html";
        return;
      }
      location.href = `watch-checkout.html?plan=${plan}&interval=${currentCycle}`;
    });
  });

  /* ---------------- Coverage request -> Dexlyy support ---------------- */
  const requestForm = $("#requestForm");
  const requestNote = $("#requestNote");
  if (requestForm) {
    requestForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(requestForm).entries());
      const email = String(data.email || "").trim();
      const lab = String(data.lab || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        requestNote.textContent = "Enter a valid email so we can reply.";
        requestNote.className = "request__note is-error";
        requestForm.querySelector("[name='email']").focus();
        return;
      }
      if (!lab && !String(data.note || "").trim()) {
        requestNote.textContent = "Tell us which lab, model or source to track.";
        requestNote.className = "request__note is-error";
        requestForm.querySelector("[name='lab']").focus();
        return;
      }

      const btn = requestForm.querySelector("button");
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Sending...";
      requestNote.textContent = "Sending your request to Dexlyy support...";
      requestNote.className = "request__note";

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/dexlyywatch-contact`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          if (body.code === "RATE_LIMITED") {
            throw new Error("Too many requests — try again in about an hour.");
          }
          throw new Error(body.error || "Could not send request.");
        }
        requestForm.reset();
        requestNote.textContent = "Request sent. Dexlyy support has it.";
        requestNote.className = "request__note is-success";
      } catch (err) {
        requestNote.innerHTML = `Could not send here. Email us directly at <a href="mailto:support@dexlyy.com?subject=DexlyyWatch%20source%20request">support@dexlyy.com</a>.`;
        requestNote.className = "request__note is-error";
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  /* ---------------- Watch count ---------------- */
  const watchCount = $("#watchCount");
  const planWatchCount = $("#planWatchCount");
  const freeSeatLive = $("#freeSeatLive");
  const freeSeatFull = $("#freeSeatFull");
  const freeSeatNote = $("#freeSeatNote");
  const ctaNote = $("#ctaNote");
  const freeCtas = $$(".js-free-cta");

  function updateFreeSeatUi(stats) {
    const watching = Math.max(0, Number(stats?.watching_count) || 0);
    const full = Boolean(stats?.free_tier_full);

    if (watchCount) watchCount.textContent = watching.toLocaleString();
    if (planWatchCount) planWatchCount.textContent = watching.toLocaleString();
    if (freeSeatNote) {
      if (full) {
        freeSeatNote.classList.add("is-full");
        freeSeatNote.classList.remove("plan__note--live");
        if (freeSeatLive) freeSeatLive.hidden = true;
        if (freeSeatFull) freeSeatFull.hidden = false;
      } else {
        freeSeatNote.classList.remove("is-full");
        freeSeatNote.classList.add("plan__note--live");
        if (freeSeatLive) freeSeatLive.hidden = false;
        if (freeSeatFull) freeSeatFull.hidden = true;
      }
    }
    if (ctaNote) {
      ctaNote.textContent = full
        ? "Free tier full · Pro and Squadron are open now."
        : "Free forever · every major drop · dashboard included.";
    }
    freeCtas.forEach((el) => {
      if (!el.dataset.defaultLabel) {
        el.dataset.defaultLabel = el.textContent.trim();
        if (el.getAttribute("href")) el.dataset.defaultHref = el.getAttribute("href");
      }
      if (full) {
        el.textContent = "See paid plans";
        el.classList.add("is-disabled-free");
        if (el.tagName === "A") el.setAttribute("href", "#pricing");
      } else {
        el.textContent = el.dataset.defaultLabel;
        el.classList.remove("is-disabled-free");
        if (el.tagName === "A" && el.dataset.defaultHref) el.setAttribute("href", el.dataset.defaultHref);
      }
    });
  }

  /* ---------------- Reveal on scroll (re-observes injected nodes) ---------------- */
  let _io = null;
  function observeReveals() {
    const els = $$(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-visible")); return; }
    if (!_io) {
      _io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); _io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    }
    els.forEach((e) => _io.observe(e));
  }

  /* ---------------- Live data from Supabase (progressive enhancement) ---------------- */
  async function rpc(name, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return res.json();
  }

  async function loadLive() {
    try {
      const [cov, drops] = await Promise.all([
        rpc("dexlyywatch_coverage"),
        rpc("dexlyywatch_drops", { p_limit: 16 }),
      ]);

      // Coverage: override curated ONLY when the detected model is newer.
      const covMap = {};
      (cov || []).forEach((r) => { covMap[r.lab] = r; });
      LABS.forEach((l) => {
        const m = l.liveKey && covMap[l.liveKey];
        if (m && m.released_at && new Date(m.released_at) > new Date(l.date)) {
          l.latest = m.model_id; l.date = fmtDate(m.released_at); l.url = m.url;
        }
      });
      renderLabs();

      // Drops: merge curated marquee + live detections, dedupe, newest first.
      const live = (drops || []).filter((d) => d.released_at).map((d) => ({
        date: new Date(d.released_at), lab: d.lab, title: d.model_id,
        tag: d.source_kind === "rss" ? "announced" : "open",
        note: d.source_kind === "rss"
          ? `Announced via the ${d.lab} newsroom — detected automatically.`
          : "Open weights published on Hugging Face — detected automatically.",
      }));
      const all = [...CLOSED_DROPS.map((c) => ({ ...c })), ...live].sort((a, b) => b.date - a.date);
      const seen = new Set();
      const merged = [];
      for (const d of all) {
        const k = (d.lab + "|" + d.title).toLowerCase().replace(/[^a-z0-9|]/g, "");
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(d);
        if (merged.length >= 12) break;
      }
      DROPS = merged.map((d) => ({ day: fmtDay(d.date), year: String(d.date.getFullYear()), lab: d.lab, title: d.title, tag: d.tag, note: d.note }));
      renderTimeline();

      // Reflect live latest in the hero radar rows.
      LABS.slice(0, 6).forEach((l, i) => { if (RADAR[i]) RADAR[i].model = l.latest; });
      renderRadar();
    } catch (_e) {
      // Network/offline → curated content already rendered; stay silent.
    }
  }

  async function loadStats() {
    if (!watchCount) return;
    try {
      const stats = await rpc("dexlyywatch_public_stats");
      updateFreeSeatUi(stats);
    } catch (_e) {
      updateFreeSeatUi({ watching_count: 0, free_tier_full: false });
    }
  }

  /* ---------------- Auth-aware nav ----------------
     The marketing page has no Supabase client, but supabase-js persists the
     session in localStorage under sb-<project-ref>-auth-token. Read it directly
     (no network) so the nav reflects whether the visitor is already signed in. */
  function isSignedIn() {
    try {
      const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed;
      if (!session?.access_token) return false;
      if (session.expires_at && Number(session.expires_at) * 1000 <= Date.now()) return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function updateAuthNav() {
    const signIn = $("#navSignIn");
    const signUp = $("#navSignUp");
    const stickyCta = $("#stickyCta");
    if (!signIn || !signUp) return;
    if (isSignedIn()) {
      const navDash = $("#navDashboardLink");
      if (navDash) navDash.hidden = true;
      signIn.textContent = "Dashboard";
      signIn.href = "watch-dashboard.html";
      signUp.textContent = "Sign out";
      signUp.href = "watch-dashboard.html?signout=1";
      signUp.classList.remove("js-free-cta");
      if (stickyCta) stickyCta.hidden = true;
    }
  }

  /* ---------------- Init ---------------- */
  renderLabs();
  renderTimeline();
  observeReveals();
  updateAuthNav();
  loadStats();
  loadLive();

  /* Sticky mobile CTA — show after scrolling past hero */
  const stickyCta = $("#stickyCta");
  if (stickyCta) {
    const onSticky = () => {
      const show = window.scrollY > window.innerHeight * 0.55;
      stickyCta.classList.toggle("is-visible", show);
    };
    window.addEventListener("scroll", onSticky, { passive: true });
    onSticky();
  }
})();
