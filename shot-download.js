/* =========================================================
   DexlyyShot — download page
   Windows ships now; macOS & Linux are coming soon.
   Installers are hosted as assets on the shared
   sapixeldevelopment/voxlingua-releases repo. Because that
   repo also holds Dexlyy Voice builds, we resolve the Shot
   installer by FILENAME across recent releases, not by
   "latest release" (which could be a Voice build).
   ========================================================= */
(function () {
  'use strict';

  var RELEASES_REPO = 'sapixeldevelopment/voxlingua-releases';
  var LIST_API = 'https://api.github.com/repos/' + RELEASES_REPO + '/releases?per_page=30';

  // Fallback URL — used only if the GitHub API is unreachable. Point this at a
  // known-good Shot release tag once you publish one (e.g. shot-v1.0.0). The
  // live resolver below tracks the newest Shot build regardless of version.
  var WINDOWS_URL =
    'https://github.com/' + RELEASES_REPO + '/releases/download/shot-v1.2.0/DexlyyShot.Setup.1.2.0.exe';
  var WINDOWS_FILE = 'DexlyyShot-Setup.exe';

  function formatVersion(tag) {
    if (!tag) return '';
    var m = String(tag).match(/v?(\d+\.\d+\.\d+)/);
    return m ? m[1] : tag.replace(/^shot-/i, '');
  }

  var LABELS = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

  // Match a DexlyyShot Windows installer asset across versions.
  // electron-builder names it "DexlyyShot Setup 1.0.0.exe"; GitHub replaces
  // spaces with dots in asset names → "DexlyyShot.Setup.1.0.0.exe".
  function isShotWindowsAsset(name) {
    return /\.exe$/i.test(name) &&
           /dexlyyshot/i.test(name) &&
           /setup/i.test(name) &&
           !/\.blockmap$/i.test(name);
  }

  // Scan recent releases for the newest Shot Windows installer.
  function resolveLatest() {
    return fetch(LIST_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error('gh ' + r.status); return r.json(); })
      .then(function (releases) {
        for (var i = 0; i < releases.length; i++) {
          var rel = releases[i];
          var assets = (rel && rel.assets) || [];
          for (var j = 0; j < assets.length; j++) {
            if (isShotWindowsAsset(assets[j].name)) {
              return { url: assets[j].browser_download_url, file: assets[j].name, version: rel.tag_name || '' };
            }
          }
        }
        throw new Error('no shot windows asset');
      })
      .catch(function () {
        return { url: WINDOWS_URL, file: WINDOWS_FILE, version: '' };
      });
  }

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
    if (els.status) els.status.textContent = 'Free to try · Unlock Pro for $39 (one-time)';
  }

  function makeComingSoon(osLabel) {
    els.primary.href = '#';
    els.primary.setAttribute('aria-disabled', 'true');
    els.primary.removeAttribute('download');
    els.primaryLabel.textContent = osLabel + ' — coming soon';
    els.primarySub.textContent = 'Windows is available now';
    if (els.status) els.status.textContent = 'The ' + osLabel + ' app is on the way. Get it on Windows today.';
  }

  function renderOthers(currentOs) {
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

  function render() {
    var os = detectOS();
    if (os === 'windows') {
      makeWindowsDownload();
    } else if (os === 'macos' || os === 'linux') {
      makeComingSoon(LABELS[os]);
    } else {
      makeWindowsDownload();
      els.primaryLabel.textContent = 'Download for Windows';
    }
    renderOthers(os === 'macos' || os === 'linux' ? os : 'windows');
  }

  render();
  resolveLatest().then(function (latest) {
    WINDOWS_URL = latest.url;
    WINDOWS_FILE = latest.file;
    if (els.version && latest.version) {
      els.version.textContent = 'v' + formatVersion(latest.version);
    }
    render();
  });
})();
