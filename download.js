/* =========================================================
   VoxLingua — download page
   Windows ships now; macOS & Linux are coming soon.
   ========================================================= */
(function () {
  'use strict';

  // Direct link to the current Windows setup installer. Always serves the
  // latest published build. (Kept in code only; not surfaced to users.)
  var WINDOWS_URL =
    'https://github.com/sapixeldevelopment/voxlingua-releases/releases/latest/download/VoxLingua_1.1.0_x64-setup.exe';
  var WINDOWS_FILE = 'VoxLingua_1.1.0_x64-setup.exe';

  var LABELS = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

  function detectOS() {
    var ua = (navigator.userAgent || '').toLowerCase();
    var p = (navigator.platform || '').toLowerCase();
    if (/win/.test(ua) || /win/.test(p)) return 'windows';
    if (/mac/.test(ua) || /mac/.test(p) || /iphone|ipad|ipod/.test(ua)) return 'macos';
    if (/linux|x11|android/.test(ua) || /linux/.test(p)) return 'linux';
    return 'unknown';
  }

  var els = {
    version: document.getElementById('dl-version'),
    primary: document.getElementById('dl-primary'),
    primaryLabel: document.getElementById('dl-primary-label'),
    primarySub: document.getElementById('dl-primary-sub'),
    others: document.getElementById('dl-others'),
    status: document.getElementById('dl-status')
  };

  function makeWindowsDownload() {
    els.primary.href = WINDOWS_URL;
    els.primary.setAttribute('download', WINDOWS_FILE);
    els.primary.removeAttribute('aria-disabled');
    els.primary.removeAttribute('target');
    els.primaryLabel.textContent = 'Download for Windows';
    els.primarySub.textContent = 'Windows 10 & 11 · 64-bit';
    if (els.status) els.status.textContent = 'Free • 3,000 words/week • no credit card';
  }

  function makeComingSoon(osLabel) {
    els.primary.href = '#';
    els.primary.setAttribute('aria-disabled', 'true');
    els.primary.removeAttribute('download');
    els.primaryLabel.textContent = osLabel + ' — coming soon';
    els.primarySub.textContent = 'Windows is available now';
    if (els.status) els.status.textContent = 'The ' + osLabel + ' app is on the way. Get it on Windows today, or use any platform via the web soon.';
  }

  function renderOthers(currentOs) {
    // Show the two platforms the visitor is NOT on.
    var order = ['windows', 'macos', 'linux'];
    var html = '';
    order.forEach(function (os) {
      if (os === currentOs) return;
      if (os === 'windows') {
        html += '<a class="dl-alt" href="' + WINDOWS_URL + '" download="' + WINDOWS_FILE + '">' +
                '<span class="dl-alt__os">Download for Windows</span>' +
                '<span class="dl-alt__file">Windows 10 &amp; 11 · 64-bit</span></a>';
      } else {
        html += '<span class="dl-alt dl-alt--soon">' +
                '<span class="dl-alt__os">' + LABELS[os] + '</span>' +
                '<span class="dl-alt__file">Coming soon</span></span>';
      }
    });
    els.others.innerHTML = html;
  }

  if (els.version) els.version.textContent = '';

  var os = detectOS();
  if (os === 'windows') {
    makeWindowsDownload();
  } else if (os === 'macos' || os === 'linux') {
    makeComingSoon(LABELS[os]);
  } else {
    // Unknown OS — offer the Windows build as the available option.
    makeWindowsDownload();
    els.primaryLabel.textContent = 'Download for Windows';
  }
  renderOthers(os === 'macos' || os === 'linux' ? os : 'windows');
})();
