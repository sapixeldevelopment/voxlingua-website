/* =========================================================
   VoxLingua — download page
   Auto-detects OS and links to the LATEST GitHub release asset.
   Always serves the newest installer; no manual updates needed.
   ========================================================= */
(function () {
  'use strict';

  // Installers are published to a PUBLIC releases repo so anyone can download
  // them, while the source code stays in a private repo.
  var REPO = 'sapixeldevelopment/voxlingua-releases';
  var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var RELEASES_PAGE = 'https://github.com/' + REPO + '/releases/latest';
  // Stable "latest" URLs (work the moment a release exists, even before the API call).
  function latestAsset(name) {
    return 'https://github.com/' + REPO + '/releases/latest/download/' + name;
  }

  // Native SETUP installers only, in preference order. The website must never
  // serve a script or source file — only a double-click installer per OS.
  var PATTERNS = {
    windows: [/x64.*setup\.exe$/i, /setup\.exe$/i, /\.msi$/i],
    macos:   [/aarch64.*\.dmg$/i, /universal.*\.dmg$/i, /x64.*\.dmg$/i, /\.dmg$/i],
    linux:   [/\.appimage$/i, /amd64\.deb$/i, /\.deb$/i, /\.rpm$/i]
  };

  // Anything matching these is NOT an end-user installer and is never linked.
  var BLOCKLIST = /(\.(py|pyc|ps1|sh|bat|cmd|zip|tar|tar\.gz|tgz|gz|json|txt|md|yml|yaml|sig|sha256|asc|map)$|source|sources|src)/i;

  var LABELS = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux'
  };

  // Human-friendly installer type for the sublabel.
  function installerKind(name) {
    if (/setup\.exe$/i.test(name)) return 'Windows setup (.exe)';
    if (/\.msi$/i.test(name)) return 'Windows installer (.msi)';
    if (/\.dmg$/i.test(name)) return 'macOS disk image (.dmg)';
    if (/\.appimage$/i.test(name)) return 'Linux AppImage';
    if (/\.deb$/i.test(name)) return 'Linux package (.deb)';
    if (/\.rpm$/i.test(name)) return 'Linux package (.rpm)';
    return name;
  }

  function detectOS() {
    var ua = (navigator.userAgent || '').toLowerCase();
    var plat = (navigator.platform || '').toLowerCase();
    if (/win/.test(ua) || /win/.test(plat)) return 'windows';
    if (/mac/.test(ua) || /mac/.test(plat) || /iphone|ipad|ipod/.test(ua)) return 'macos';
    if (/linux|x11|android/.test(ua) || /linux/.test(plat)) return 'linux';
    return 'unknown';
  }

  function pickAsset(assets, os) {
    var pats = PATTERNS[os] || [];
    for (var i = 0; i < pats.length; i++) {
      for (var j = 0; j < assets.length; j++) {
        var name = assets[j].name;
        // Must match a native-installer pattern AND not be a script/source/sidecar file.
        if (pats[i].test(name) && !BLOCKLIST.test(name)) {
          return assets[j];
        }
      }
    }
    // No installer for this OS — return null. We never fall back to an
    // arbitrary asset, so a .py/.zip/etc. can never be offered as "the download".
    return null;
  }

  var els = {
    version: document.getElementById('dl-version'),
    primary: document.getElementById('dl-primary'),
    primaryLabel: document.getElementById('dl-primary-label'),
    primarySub: document.getElementById('dl-primary-sub'),
    others: document.getElementById('dl-others'),
    status: document.getElementById('dl-status')
  };

  // Make the primary button DOWNLOAD the installer file directly (not navigate).
  // `download` attr + the asset's Content-Disposition: attachment => file download.
  function setPrimary(href, osLabel, fileName, isInstaller) {
    els.primary.href = href;
    els.primary.removeAttribute('aria-disabled');
    if (isInstaller) {
      els.primary.setAttribute('download', fileName || '');
      els.primary.removeAttribute('target');
    } else {
      els.primary.removeAttribute('download');
    }
    els.primaryLabel.textContent = 'Download for ' + osLabel;
    els.primarySub.textContent = fileName ? fileName : 'Latest version';
  }

  function renderOtherPlatforms(byOs, currentOs) {
    var order = ['windows', 'macos', 'linux'];
    var html = '';
    order.forEach(function (os) {
      if (os === currentOs) return;
      var a = byOs[os];
      if (a) {
        // download attribute => clicking saves the installer instead of opening GitHub
        html += '<a class="dl-alt" href="' + a.browser_download_url + '" download="' + a.name + '">' +
                '<span class="dl-alt__os">Download for ' + LABELS[os] + '</span>' +
                '<span class="dl-alt__file">' + installerKind(a.name) + '</span></a>';
      } else {
        html += '<span class="dl-alt dl-alt--soon">' +
                '<span class="dl-alt__os">' + LABELS[os] + '</span>' +
                '<span class="dl-alt__file">Coming soon</span></span>';
      }
    });
    els.others.innerHTML = html;
  }

  function fallbackToReleasesPage(msg) {
    // No installer to download yet — disable the button rather than send to GitHub.
    els.primary.href = '#';
    els.primary.setAttribute('aria-disabled', 'true');
    els.primary.removeAttribute('download');
    els.primaryLabel.textContent = 'Download coming soon';
    els.primarySub.textContent = 'Installers are on the way';
    if (els.version) els.version.textContent = '';
    if (els.status) els.status.textContent = msg || 'Installers are being published — check back shortly.';
    renderOtherPlatforms({}, detectOS());
  }

  var os = detectOS();
  if (os !== 'unknown') {
    els.primaryLabel.textContent = 'Detecting your system…';
  }

  fetch(API, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' }
  })
    .then(function (r) {
      if (r.status === 404) throw new Error('NO_RELEASE');
      if (!r.ok) throw new Error('HTTP_' + r.status);
      return r.json();
    })
    .then(function (rel) {
      var assets = rel.assets || [];
      var version = (rel.tag_name || '').replace(/^v/i, '');
      if (els.version && version) els.version.textContent = 'v' + version;

      // Best asset per platform for the "other platforms" row.
      var byOs = {
        windows: pickAsset(assets, 'windows'),
        macos: pickAsset(assets, 'macos'),
        linux: pickAsset(assets, 'linux')
      };

      var mine = byOs[os];
      if (mine) {
        // Direct installer download for the detected OS.
        setPrimary(mine.browser_download_url, LABELS[os], mine.name, true);
        els.primarySub.textContent = installerKind(mine.name);
        if (els.status) els.status.textContent = 'Free • 3,000 words/week • no credit card';
      } else if (os === 'unknown') {
        // Can't detect OS — let them pick a direct download from the list below.
        els.primary.href = '#';
        els.primary.setAttribute('aria-disabled', 'true');
        els.primary.removeAttribute('download');
        els.primaryLabel.textContent = 'Choose your platform below';
        els.primarySub.textContent = 'Pick your installer';
        if (els.status) els.status.textContent = 'We couldn’t detect your system — choose your installer below.';
      } else {
        // OS detected but no build for it yet.
        els.primary.href = '#';
        els.primary.setAttribute('aria-disabled', 'true');
        els.primary.removeAttribute('download');
        els.primaryLabel.textContent = LABELS[os] + ' build coming soon';
        els.primarySub.textContent = 'Try another platform below';
        if (els.status) els.status.textContent = 'No ' + LABELS[os] + ' installer on the latest release yet.';
      }
      renderOtherPlatforms(byOs, os);
    })
    .catch(function (err) {
      if (err && err.message === 'NO_RELEASE') {
        fallbackToReleasesPage('Installers are being published — check back shortly.');
      } else {
        fallbackToReleasesPage('Couldn’t load the latest version just now — please refresh in a moment.');
      }
    });
})();
