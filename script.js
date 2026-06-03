/* =========================================================
   VoxLingua — interactions
   ========================================================= */
(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Nav: scrolled state + mobile toggle + hero watermark parallax ---- */
  var nav = document.getElementById('nav');
  var burger = document.querySelector('.nav__burger');
  var watermark = document.querySelector('.hero__watermark');
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

  /* ---- Direct installer download from any [data-download] button ----
     Detects the visitor's OS and points the button straight at the latest
     native installer on the public releases repo, so a click downloads the
     setup file immediately (no extra page hop). Falls back to download.html
     if no matching installer is published yet. ---- */
  var DL_REPO = 'sapixeldevelopment/voxlingua-releases';
  var DL_API = 'https://api.github.com/repos/' + DL_REPO + '/releases/latest';
  var dlButtons = document.querySelectorAll('[data-download]');

  if (dlButtons.length) {
    var DL_PATTERNS = {
      windows: [/x64.*setup\.exe$/i, /setup\.exe$/i, /\.msi$/i],
      macos:   [/aarch64.*\.dmg$/i, /universal.*\.dmg$/i, /x64.*\.dmg$/i, /\.dmg$/i],
      linux:   [/\.appimage$/i, /amd64\.deb$/i, /\.deb$/i, /\.rpm$/i]
    };
    var DL_BLOCK = /(\.(py|pyc|ps1|sh|bat|cmd|zip|tar|gz|json|txt|md|yml|yaml|sig|sha256|asc|map)$|source|src)/i;

    var dlOS = (function () {
      var ua = (navigator.userAgent || '').toLowerCase();
      var p = (navigator.platform || '').toLowerCase();
      if (/win/.test(ua) || /win/.test(p)) return 'windows';
      if (/mac/.test(ua) || /mac/.test(p) || /iphone|ipad|ipod/.test(ua)) return 'macos';
      if (/linux|x11|android/.test(ua) || /linux/.test(p)) return 'linux';
      return 'unknown';
    })();

    function dlPick(assets, os) {
      var pats = DL_PATTERNS[os] || [];
      for (var i = 0; i < pats.length; i++) {
        for (var j = 0; j < assets.length; j++) {
          if (pats[i].test(assets[j].name) && !DL_BLOCK.test(assets[j].name)) return assets[j];
        }
      }
      return null;
    }

    if (dlOS !== 'unknown') {
      fetch(DL_API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rel) {
          if (!rel || !rel.assets) return;
          var asset = dlPick(rel.assets, dlOS);
          if (!asset) return;
          dlButtons.forEach(function (btn) {
            btn.setAttribute('href', asset.browser_download_url);
            btn.setAttribute('download', asset.name);
            btn.removeAttribute('target');
          });
        })
        .catch(function () { /* keep download.html fallback */ });
    }
  }
})();
