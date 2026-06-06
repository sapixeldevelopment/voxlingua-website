/* =========================================================
   VoxLingua — interactions
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

  /* ---- Direct download for Windows visitors ----
     Windows ships now: rewrite [data-download] buttons to grab the setup
     installer directly. macOS/Linux visitors keep the link to download.html,
     which shows the "coming soon" message.

     The installer URL is resolved LIVE from the GitHub API so it always tracks
     the latest published release — the asset filename embeds the version, so a
     hardcoded link goes stale. A static fallback keeps the button working if
     the API is unreachable. ---- */
  var RELEASES_REPO = 'sapixeldevelopment/voxlingua-releases';
  var WIN_URL = 'https://github.com/' + RELEASES_REPO + '/releases/download/v2.1.4/VoxLingua_2.1.4_x64-setup.exe';
  var WIN_FILE = 'VoxLingua-setup.exe';

  var dlButtons = document.querySelectorAll('[data-download]');
  if (dlButtons.length) {
    var ua = (navigator.userAgent || '').toLowerCase();
    var p = (navigator.platform || '').toLowerCase();
    var isWindows = /win/.test(ua) || /win/.test(p);
    if (isWindows) {
      var applyHref = function () {
        dlButtons.forEach(function (btn) {
          btn.setAttribute('href', WIN_URL);
          btn.setAttribute('download', WIN_FILE);
          btn.removeAttribute('target');
        });
      };
      // Wire up the fallback immediately, then upgrade to the live latest URL.
      applyHref();
      fetch('https://api.github.com/repos/' + RELEASES_REPO + '/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' }
      })
        .then(function (r) { if (!r.ok) throw new Error('gh ' + r.status); return r.json(); })
        .then(function (data) {
          var hit = ((data && data.assets) || []).filter(function (a) {
            return /\.exe$/i.test(a.name) && /setup/i.test(a.name) && !/\.sig$/i.test(a.name);
          })[0];
          if (hit) {
            WIN_URL = hit.browser_download_url;
            WIN_FILE = hit.name;
            applyHref();
          }
        })
        .catch(function () { /* keep fallback */ });
    }
  }
})();
