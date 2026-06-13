/* =========================================================
   Dexlyy Voice — interactions
   ========================================================= */
(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Nav: scrolled state + mobile toggle + hero watermark parallax ---- */
  var nav = document.getElementById('nav');
  var burger = document.querySelector('.nav__burger');
  var watermark = document.querySelector('.hero__waves');
  var ticking = false;

  function applyScroll() {
    var y = window.scrollY;
    if (y > 12) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
    // gentle parallax: watermark drifts up at ~28% of scroll while hero is in view
    if (watermark && !prefersReduced && y < 900) {
      watermark.style.setProperty('--py', (-y * 0.28) + 'px');
    }
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  applyScroll();

  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('.nav__links a, .nav__cta a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Nav products dropdown ---- */
  var dd = document.getElementById('navProducts');
  if (dd) {
    var ddTrigger = dd.querySelector('.nav__dd-trigger');
    var hoverCapable = window.matchMedia('(hover: hover)').matches;
    var closeTimer;

    function ddOpen() { clearTimeout(closeTimer); dd.classList.add('is-open'); ddTrigger.setAttribute('aria-expanded', 'true'); }
    function ddClose() { dd.classList.remove('is-open'); ddTrigger.setAttribute('aria-expanded', 'false'); }
    function ddToggle() { dd.classList.contains('is-open') ? ddClose() : ddOpen(); }

    // Click/tap always toggles (works on touch + as a11y fallback)
    ddTrigger.addEventListener('click', function (e) { e.stopPropagation(); ddToggle(); });

    // Desktop: open on hover, close shortly after leaving
    if (hoverCapable) {
      dd.addEventListener('mouseenter', ddOpen);
      dd.addEventListener('mouseleave', function () { closeTimer = setTimeout(ddClose, 140); });
    }

    // Close on outside click, Escape, or selecting an item
    document.addEventListener('click', function (e) { if (!dd.contains(e.target)) ddClose(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ddClose(); });
    dd.querySelectorAll('.nav__menu-item').forEach(function (a) {
      a.addEventListener('click', ddClose);
    });
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll('.reveal');

  // Above-the-fold (hero) elements reveal immediately with a stagger on load.
  var hero = document.querySelector('.hero');
  if (hero && !prefersReduced) {
    var heroReveals = hero.querySelectorAll('.reveal');
    heroReveals.forEach(function (el, i) {
      el.style.transitionDelay = (i * 0.09) + 's';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add('is-visible'); });
      });
    });
  }

  if (prefersReduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- Pricing toggle ---- */
  var toggleBtns = document.querySelectorAll('.toggle__btn');
  var amts = document.querySelectorAll('.plan__amt[data-annual]');
  var pers = document.querySelectorAll('.plan__per[data-annual]');

  function setPeriod(period) {
    toggleBtns.forEach(function (b) {
      var active = b.dataset.period === period;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    amts.forEach(function (el) { el.textContent = el.dataset[period]; });
    pers.forEach(function (el) { el.textContent = el.dataset[period]; });
  }
  toggleBtns.forEach(function (b) {
    b.addEventListener('click', function () { setPeriod(b.dataset.period); });
  });

  /* ---- Pro checkout links respect billing toggle ---- */
  var checkoutBtn = document.querySelector('[data-checkout]');
  function syncCheckoutHref() {
    if (!checkoutBtn) return;
    var active = document.querySelector('.toggle__btn.is-active');
    var period = active && active.dataset.period === 'monthly' ? 'monthly' : 'annual';
    checkoutBtn.href = 'checkout.html?interval=' + period;
  }
  toggleBtns.forEach(function (b) {
    b.addEventListener('click', syncCheckoutHref);
  });
  syncCheckoutHref();

  /* ---- Hero typewriter demo (multilingual) ---- */
  var typed = document.getElementById('typed');
  var langTag = document.getElementById('demoLang');
  if (typed && !prefersReduced) {
    var lines = [
      { lang: 'EN', text: 'Let’s ship the new release on Friday — I’ll handle the changelog.' },
      { lang: 'ES', text: 'Perfecto, te envío el contrato esta tarde. ¡Gracias por la paciencia!' },
      { lang: 'FR', text: 'Je confirme la réunion de mardi à 14h, salle de conférence.' },
      { lang: 'DE', text: 'Klingt gut — ich bereite die Präsentation bis morgen vor.' }
    ];
    var li = 0, ci = 0, deleting = false;

    function tick() {
      var line = lines[li];
      langTag.textContent = line.lang;
      if (!deleting) {
        ci++;
        typed.textContent = line.text.slice(0, ci);
        if (ci >= line.text.length) {
          deleting = true;
          return setTimeout(tick, 2200);
        }
        setTimeout(tick, 38 + Math.random() * 45);
      } else {
        ci -= 3;
        if (ci < 0) ci = 0;
        typed.textContent = line.text.slice(0, ci);
        if (ci <= 0) {
          deleting = false;
          li = (li + 1) % lines.length;
          return setTimeout(tick, 320);
        }
        setTimeout(tick, 18);
      }
    }
    setTimeout(tick, 700);
  } else if (typed) {
    typed.textContent = 'Let’s ship the new release on Friday.';
  }

  /* ---- Dexlyy Shot early-access waitlist ----
     Posts straight to Supabase via the public publishable key. RLS on
     shot_waitlist allows insert-only for anon — the key can never read
     the list back, so emails can't be scraped. ---- */
  var shotForm = document.getElementById('shotForm');
  if (shotForm) {
    var SB_URL = 'https://mmgzuubrtyodhjtmjlvb.supabase.co';
    var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZ3p1dWJydHlvZGhqdG1qbHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzY2NjQsImV4cCI6MjA5NTgxMjY2NH0.KvCAKHnqQoNl7_THOk2QtCDeKFWmd8Wmn_YUsvRtMsc';
    var note = document.getElementById('shotNote');
    var input = shotForm.querySelector('input[name="email"]');
    var btn = shotForm.querySelector('button');

    shotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        note.textContent = 'Please enter a valid email address.';
        note.className = 'shot__form-note is-error';
        input.focus();
        return;
      }
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = 'Adding…';

      fetch(SB_URL + '/rest/v1/shot_waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ email: email, source: 'website' })
      }).then(function (res) {
        if (res.ok) {
          shotForm.style.display = 'none';
          note.textContent = "You're on the list — we'll email you when Dexlyy Shot launches. 🎉";
          note.className = 'shot__form-note is-success';
        } else if (res.status === 409) {
          shotForm.style.display = 'none';
          note.textContent = "You're already on the list — thanks for your patience!";
          note.className = 'shot__form-note is-success';
        } else {
          throw new Error('http ' + res.status);
        }
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = label;
        note.textContent = 'Something went wrong — please try again, or email support@dexlyy.com.';
        note.className = 'shot__form-note is-error';
      });
    });
  }

  /* ---- Download buttons ----
     Every [data-download] button links to download.html (set in the markup).
     We intentionally do NOT rewrite them to a direct installer URL: visitors
     always land on the download page first, which detects their OS and serves
     the correct, latest installer (see download.js). This gives a consistent
     funnel and a clear macOS/Linux "coming soon" message. ---- */
})();
