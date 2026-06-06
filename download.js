/* =========================================================
   Dexlyy Voice — download page
   Windows ships now; macOS & Linux are coming soon.
   ========================================================= */
(function () {
  'use strict';

  var RELEASES_REPO = 'sapixeldevelopment/voxlingua-releases';
  var LATEST_API = 'https://api.github.com/repos/' + RELEASES_REPO + '/releases/latest';
  var RELEASES_PAGE = 'https://github.com/' + RELEASES_REPO + '/releases/latest';

  // Fallback Windows installer URL. GitHub's /releases/latest/download/<name>
  // redirect only resolves if an asset with this EXACT name exists in the
  // latest release. Because our filenames embed the version, this can go stale
  // between releases — so it is ONLY a fallback. The primary path resolves the
  // real asset name live from the GitHub API (resolveLatest), which never goes
  // stale regardless of version. Keep this pointing at a known-good release.
  // As of v2.6.0 the installer is named DexlyyVoice_* (Tauri productName).
  // Older releases were VoxLingua_* — the matcher below accepts either so the
  // live resolver always finds the newest build regardless of the rename.
  var WINDOWS_URL =
    'https://github.com/' + RELEASES_REPO + '/releases/download/v2.6.1/DexlyyVoice_2.6.1_x64-setup.exe';
  var WINDOWS_FILE = 'DexlyyVoice-setup.exe';

  var LABELS = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

  // Match the Windows setup installer asset regardless of version OR brand name.
  // e.g. DexlyyVoice_2.6.0_x64-setup.exe, VoxLingua_2.5.0_x64-setup.exe …
  function isWindowsAsset(name) {
    return /\.exe$/i.test(name) && /setup/i.test(name) && !/\.sig$/i.test(name);
  }

  // Ask GitHub for the latest release and return the live Windows .exe URL +
  // its real version, so downloads always track the newest published build.
  // Falls back to the static WINDOWS_URL if the API is unreachable/rate-limited.
  function resolveLatest() {
    return fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error('gh ' + r.status); return r.json(); })
      .then(function (data) {
        var assets = (data && data.assets) || [];
        var hit = assets.filter(function (a) { return isWindowsAsset(a.name); })[0];
        if (!hit) throw new Error('no windows asset');
        return { url: hit.browser_download_url, file: hit.name, version: data.tag_name || '' };
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

  function render() {
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
  }

  // Paint immediately with the fallback URL so the button is never dead, then
  // upgrade it to the live latest-release URL once the GitHub API responds.
  render();
  resolveLatest().then(function (latest) {
    WINDOWS_URL = latest.url;
    WINDOWS_FILE = latest.file;
    if (els.version && latest.version) {
      els.version.textContent = 'Latest: ' + latest.version;
    }
    render();
  });
})();
