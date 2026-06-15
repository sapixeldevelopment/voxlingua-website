const SUPABASE_URL = 'https://mmgzuubrtyodhjtmjlvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LYP_tofuZNutUaE-KfjT7Q_Uf5XcaIO';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;

const params = new URLSearchParams(location.search);
const boardSlug = (params.get('b') || '').trim().toLowerCase();

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const lockScreenEl = document.getElementById('lockScreen');
const lockTitleEl = document.getElementById('lockTitle');
const lockPasswordEl = document.getElementById('lockPassword');
const lockSubmitEl = document.getElementById('lockSubmit');
const lockErrorEl = document.getElementById('lockError');
const layoutEl = document.getElementById('layout');
const boardTitleEl = document.getElementById('boardTitle');
const boardMetaEl = document.getElementById('boardMeta');
const snipTabsEl = document.getElementById('snipTabs');
const viewportEl = document.getElementById('viewport');
const stageWrapEl = document.getElementById('stageWrap');
const stageEl = document.getElementById('stage');
const shotEl = document.getElementById('shot');
const overlay = document.getElementById('overlay');
const noteListEl = document.getElementById('noteList');
const zoomLabelEl = document.getElementById('zoomLabel');
const zoomInEl = document.getElementById('zoomIn');
const zoomOutEl = document.getElementById('zoomOut');
const zoomFitEl = document.getElementById('zoomFit');
const zoom100El = document.getElementById('zoom100');
const ctx = overlay?.getContext('2d');

let supabaseRealtime = null;
let board = null;
let snips = [];
let activeSnipIndex = 0;
let selectedGroupId = null;
let hoveredCalloutId = null;
let imgW = 0;
let imgH = 0;
let accessCode = '';

let fitScale = 1;
let zoom = 1;
let panX = 0;
let panY = 0;
let userAdjustedView = false;

let isPanning = false;
let panDrag = null;
let pointerDown = null;

function unlockStorageKey() {
  return `dexlyy-review-unlock:${boardSlug}`;
}

function loadStoredAccessCode() {
  try {
    return sessionStorage.getItem(unlockStorageKey()) || '';
  } catch {
    return '';
  }
}

function storeAccessCode(code) {
  try {
    if (code) sessionStorage.setItem(unlockStorageKey(), code);
    else sessionStorage.removeItem(unlockStorageKey());
  } catch { /* ignore */ }
}

function showLockScreen(data) {
  loadingEl.hidden = true;
  layoutEl.hidden = true;
  errorEl.hidden = true;
  lockScreenEl.hidden = false;
  lockTitleEl.textContent = data?.title || 'Protected review';
  lockErrorEl.textContent = '';
  lockPasswordEl.value = '';
  lockPasswordEl.focus();
}

function groupIdOf(c) {
  return c.groupId ?? c.id;
}

function sortCallouts(list) {
  return [...list].sort((a, b) => {
    const dy = a.rect.y - b.rect.y;
    if (Math.abs(dy) > 12) return dy;
    return a.rect.x - b.rect.x;
  });
}

function sortedGroups(callouts) {
  const gids = [...new Set(callouts.map(groupIdOf))];
  return gids
    .map(gid => ({ gid, members: sortCallouts(callouts.filter(c => groupIdOf(c) === gid)) }))
    .sort((a, b) => {
      const ar = a.members[0].rect;
      const br = b.members[0].rect;
      const dy = ar.y - br.y;
      if (Math.abs(dy) > 12) return dy;
      return ar.x - br.x;
    });
}

function markNumberForCallout(c, callouts) {
  const gid = groupIdOf(c);
  const idx = sortedGroups(callouts).findIndex(g => g.gid === gid);
  return idx + 1;
}

function getGroupInstruction(gid, callouts) {
  const members = callouts.filter(c => groupIdOf(c) === gid);
  const withText = members.find(m => (m.instruction || '').trim());
  return (withText || members[0])?.instruction || '';
}

function parseSession(raw) {
  if (!raw) return { callouts: [], overall: '' };
  if (typeof raw === 'string') {
    try { return parseSession(JSON.parse(raw)); } catch { return { callouts: [], overall: '' }; }
  }
  return {
    callouts: Array.isArray(raw.callouts) ? raw.callouts : [],
    overall: raw.overall || '',
  };
}

function showError(msg) {
  loadingEl.hidden = true;
  layoutEl.hidden = true;
  lockScreenEl.hidden = true;
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

function formatUpdated(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function activeSnip() {
  return snips[activeSnipIndex] || null;
}

function activeCallouts() {
  const snip = activeSnip();
  return parseSession(snip?.session).callouts;
}

function badgeLayouts(callouts) {
  if (globalThis.ReviewBadges?.computeBadgeLayouts) {
    return ReviewBadges.computeBadgeLayouts(
      callouts,
      c => markNumberForCallout(c, callouts),
      imgW,
      imgH
    );
  }
  return new Map();
}

function clampZoom(z) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

function computeFitScale() {
  if (!viewportEl || !imgW || !imgH) return 1;
  const pad = 32;
  const w = Math.max(1, viewportEl.clientWidth - pad);
  const h = Math.max(1, viewportEl.clientHeight - pad);
  return Math.min(w / imgW, h / imgH);
}

function viewScale() {
  return fitScale * zoom;
}

function centerView() {
  if (!viewportEl) return;
  const s = viewScale();
  panX = (viewportEl.clientWidth - imgW * s) / 2;
  panY = (viewportEl.clientHeight - imgH * s) / 2;
}

function applyViewTransform() {
  const s = viewScale();
  stageWrapEl.style.transform = `translate(${panX}px, ${panY}px) scale(${s})`;

  if (zoomLabelEl) {
    const pct = Math.round(s * 100);
    if (Math.abs(s - fitScale) < 0.01) zoomLabelEl.textContent = 'Fit';
    else if (Math.abs(s - 1) < 0.01) zoomLabelEl.textContent = '100%';
    else zoomLabelEl.textContent = `${pct}%`;
  }
}

function resetView({ keepUserZoom = false } = {}) {
  fitScale = computeFitScale();
  if (!keepUserZoom || !userAdjustedView) {
    zoom = 1;
    userAdjustedView = false;
  }
  centerView();
  applyViewTransform();
}

function setZoomAt(clientX, clientY, nextZoom) {
  const oldS = viewScale();
  const newZoom = clampZoom(nextZoom);
  const newS = fitScale * newZoom;
  const vp = viewportEl.getBoundingClientRect();
  const zx = clientX - vp.left;
  const zy = clientY - vp.top;
  const ix = (zx - panX) / oldS;
  const iy = (zy - panY) / oldS;
  zoom = newZoom;
  panX = zx - ix * newS;
  panY = zy - iy * newS;
  userAdjustedView = true;
  applyViewTransform();
}

function zoomBy(factor, clientX, clientY) {
  const cx = clientX ?? viewportEl.clientWidth / 2 + viewportEl.getBoundingClientRect().left;
  const cy = clientY ?? viewportEl.clientHeight / 2 + viewportEl.getBoundingClientRect().top;
  setZoomAt(cx, cy, zoom * factor);
}

function zoomToFit() {
  fitScale = computeFitScale();
  zoom = 1;
  userAdjustedView = false;
  centerView();
  applyViewTransform();
}

function zoomTo100() {
  fitScale = computeFitScale();
  zoom = clampZoom(1 / fitScale);
  userAdjustedView = true;
  centerView();
  applyViewTransform();
}

function groupBounds(gid, callouts) {
  const members = callouts.filter(c => groupIdOf(c) === gid);
  if (!members.length) return null;
  const minX = Math.min(...members.map(c => c.rect.x));
  const minY = Math.min(...members.map(c => c.rect.y));
  const maxX = Math.max(...members.map(c => c.rect.x + c.rect.width));
  const maxY = Math.max(...members.map(c => c.rect.y + c.rect.height));
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function focusGroup(gid) {
  const callouts = activeCallouts();
  const bounds = groupBounds(gid, callouts);
  if (!bounds || !viewportEl) return;

  const pad = 48;
  const bw = bounds.maxX - bounds.minX + pad * 2;
  const bh = bounds.maxY - bounds.minY + pad * 2;
  fitScale = computeFitScale();
  const targetS = Math.min(
    viewportEl.clientWidth / bw,
    viewportEl.clientHeight / bh,
    2.5
  );
  zoom = clampZoom(targetS / fitScale);
  userAdjustedView = true;
  panX = viewportEl.clientWidth / 2 - bounds.cx * targetS;
  panY = viewportEl.clientHeight / 2 - bounds.cy * targetS;
  applyViewTransform();
}

function layoutCanvas() {
  if (!imgW || !imgH) return;

  shotEl.style.width = `${imgW}px`;
  shotEl.style.height = `${imgH}px`;
  overlay.width = imgW;
  overlay.height = imgH;
  overlay.style.width = `${imgW}px`;
  overlay.style.height = `${imgH}px`;
  stageEl.style.width = `${imgW}px`;
  stageEl.style.height = `${imgH}px`;

  drawMarks();
  resetView({ keepUserZoom: userAdjustedView });
}

function drawMarks() {
  if (!ctx) return;
  const callouts = activeCallouts();
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const layouts = badgeLayouts(callouts);

  callouts.forEach(c => {
    const gid = groupIdOf(c);
    const n = markNumberForCallout(c, callouts);
    const selected = selectedGroupId === gid;
    const hovered = hoveredCalloutId === c.id && !selected;
    const { x, y, width: w, height: h } = c.rect;
    const layout = layouts.get(c.id);
    const badgeR = selected ? 15 : hovered ? 13 : 12;

    ctx.save();
    if (selected) {
      ctx.strokeStyle = '#2b9fff';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(43, 159, 255, 0.2)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else if (hovered) {
      ctx.strokeStyle = '#56d4ff';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(86, 212, 255, 0.14)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else {
      ctx.strokeStyle = 'rgba(232, 146, 58, .85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    const bx = layout?.badgeX ?? (x + 8 + badgeR);
    const by = layout?.badgeY ?? (y + 8 + badgeR);
    if (layout?.leader) {
      ctx.strokeStyle = selected ? '#2b9fff' : 'rgba(232, 146, 58, .75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(layout.leaderX, layout.leaderY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#2b9fff' : hovered ? '#3ec5ff' : '#e8923a';
    ctx.fill();
    ctx.strokeStyle = '#fff8ef';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff8ef';
    ctx.font = `bold ${selected ? 13 : 12}px "Hanken Grotesk", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), bx, by + 1);
    ctx.restore();
  });
}

function renderNotes() {
  const snip = activeSnip();
  if (!snip) return;
  const session = parseSession(snip.session);
  const groups = sortedGroups(session.callouts);
  noteListEl.innerHTML = '';

  if (session.overall?.trim()) {
    const overall = document.createElement('div');
    overall.className = 'overall';
    overall.innerHTML = `<h3>General</h3><p>${escapeHtml(session.overall.trim())}</p>`;
    noteListEl.appendChild(overall);
  }

  groups.forEach((g, i) => {
    const n = i + 1;
    const text = getGroupInstruction(g.gid, session.callouts).trim() || 'See marked area on screenshot';
    const card = document.createElement('div');
    card.className = 'note-card' + (selectedGroupId === g.gid ? ' active' : '');
    card.dataset.gid = String(g.gid);
    card.innerHTML = `
      <span class="note-card__num">${n}</span>
      <p>${escapeHtml(text)}</p>
      ${g.members.length > 1 ? `<small>${g.members.length} linked areas</small>` : ''}
    `;
    card.addEventListener('click', () => {
      selectedGroupId = g.gid;
      renderNotes();
      drawMarks();
      focusGroup(g.gid);
    });
    noteListEl.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderSnipTabs() {
  snipTabsEl.innerHTML = '<h2>Screens</h2>';
  snips.forEach((snip, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'snip-tab' + (i === activeSnipIndex ? ' active' : '');
    btn.innerHTML = `<img src="${snip.image_url}" alt="" loading="lazy" /><span>${escapeHtml(snip.title || `Screen ${i + 1}`)}</span>`;
    btn.addEventListener('click', () => selectSnip(i));
    snipTabsEl.appendChild(btn);
  });
}

function selectSnip(index) {
  activeSnipIndex = index;
  selectedGroupId = null;
  hoveredCalloutId = null;
  userAdjustedView = false;
  const snip = activeSnip();
  if (!snip?.image_url) {
    showError('This review screen has no image.');
    return;
  }
  renderSnipTabs();

  const url = snip.image_url;
  const applyLoaded = () => {
    imgW = snip.img_w || shotEl.naturalWidth;
    imgH = snip.img_h || shotEl.naturalHeight;
    if (!imgW || !imgH) {
      showError('Could not read the review screenshot dimensions.');
      return;
    }
    layoutCanvas();
    renderNotes();
  };

  shotEl.onload = applyLoaded;
  shotEl.onerror = () => {
    showError('Could not load the review screenshot. Ask your teammate to copy the live link again.');
  };

  if (shotEl.src === url && shotEl.complete && shotEl.naturalWidth) {
    applyLoaded();
    return;
  }
  shotEl.src = url;
  if (shotEl.complete && shotEl.naturalWidth) applyLoaded();
}

function canvasPos(e) {
  const vp = viewportEl.getBoundingClientRect();
  const s = viewScale();
  return {
    x: (e.clientX - vp.left - panX) / s,
    y: (e.clientY - vp.top - panY) / s,
  };
}

function hitTestCallout(p) {
  const callouts = activeCallouts();
  const hits = callouts.filter(c => {
    const { x, y, width: w, height: h } = c.rect;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  });
  if (!hits.length) return null;
  hits.sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  return hits[0].id;
}

function setupViewport() {
  if (!viewportEl) return;

  viewportEl.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomBy(factor, e.clientX, e.clientY);
  }, { passive: false });

  viewportEl.addEventListener('pointerdown', e => {
    if (e.button > 2) return;
    isPanning = e.button === 1 || e.button === 2 || e.altKey;
    pointerDown = { x: e.clientX, y: e.clientY, panX, panY, button: e.button, altKey: e.altKey };
    panDrag = null;
    viewportEl.setPointerCapture(e.pointerId);
    if (isPanning) viewportEl.classList.add('is-panning');
  });

  viewportEl.addEventListener('pointermove', e => {
    if (!pointerDown) {
      const hit = hitTestCallout(canvasPos(e));
      if (hit !== hoveredCalloutId) {
        hoveredCalloutId = hit;
        viewportEl.classList.toggle('can-mark', !!hit);
        if (hit) {
          const c = activeCallouts().find(x => x.id === hit);
          selectedGroupId = c ? groupIdOf(c) : null;
          renderNotes();
        }
        drawMarks();
      }
      return;
    }

    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;

    if (!panDrag && Math.hypot(dx, dy) > 5) {
      panDrag = true;
      if (pointerDown.button === 0 && !pointerDown.altKey) {
        isPanning = true;
        viewportEl.classList.add('is-panning');
      }
    }

    if (isPanning && panDrag) {
      panX = pointerDown.panX + dx;
      panY = pointerDown.panY + dy;
      userAdjustedView = true;
      applyViewTransform();
    }
  });

  viewportEl.addEventListener('pointerup', e => {
    if (!pointerDown) return;

    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    const moved = Math.hypot(dx, dy) > 4;

    if (!moved && pointerDown.button === 0 && !pointerDown.altKey) {
      const hit = hitTestCallout(canvasPos(e));
      if (hit) {
        const c = activeCallouts().find(x => x.id === hit);
        if (c) {
          selectedGroupId = groupIdOf(c);
          renderNotes();
          drawMarks();
          focusGroup(selectedGroupId);
        }
      } else {
        selectedGroupId = null;
        hoveredCalloutId = null;
        renderNotes();
        drawMarks();
      }
    }

    pointerDown = null;
    panDrag = null;
    isPanning = false;
    viewportEl.classList.remove('is-panning');
    try { viewportEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  viewportEl.addEventListener('dblclick', e => {
    e.preventDefault();
    zoomToFit();
  });

  viewportEl.addEventListener('contextmenu', e => e.preventDefault());
}

zoomInEl?.addEventListener('click', () => zoomBy(ZOOM_STEP));
zoomOutEl?.addEventListener('click', () => zoomBy(1 / ZOOM_STEP));
zoomFitEl?.addEventListener('click', () => zoomToFit());
zoom100El?.addEventListener('click', () => zoomTo100());

async function fetchBoard(code = accessCode) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shot_review_board`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_slug: boardSlug,
      p_access_code: code || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Could not load review (${res.status})`;
    return { data: null, error: { message: msg } };
  }
  return { data, error: null };
}

function showBoardChrome(data) {
  lockScreenEl.hidden = true;
  loadingEl.hidden = true;
  errorEl.hidden = true;
  layoutEl.hidden = false;
  boardTitleEl.textContent = data.title || 'Screenshot review';
  boardMetaEl.innerHTML = `${(data.snips || []).length} screen${(data.snips || []).length === 1 ? '' : 's'} · Updated ${formatUpdated(data.updated_at)} <span class="live-pill">Live</span>`;
}

function renderBoardData(data) {
  board = data;
  snips = Array.isArray(data.snips) ? data.snips : [];
  if (!snips.length) {
    showError('This review board has no screens yet.');
    return;
  }
  showBoardChrome(data);
  renderSnipTabs();
  selectSnip(0);
  setupRealtime();
}

async function loadBoard() {
  if (!boardSlug || boardSlug.length < 6) {
    showError('Missing or invalid review link. Ask your teammate to resend the URL.');
    return;
  }

  try {
    accessCode = loadStoredAccessCode();
    const { data, error } = await fetchBoard(accessCode);
    if (error) {
      showError(error.message || 'Could not load this review.');
      return;
    }
    if (!data?.ok) {
      showError('This review was not found or has expired.');
      return;
    }
    if (data.locked) {
      showLockScreen(data);
      return;
    }
    if (accessCode) storeAccessCode(accessCode);
    renderBoardData(data);
  } catch (err) {
    showError(err?.message || 'Could not load this review.');
  }
}

async function tryUnlock() {
  const code = (lockPasswordEl?.value || '').trim();
  if (!code) {
    lockErrorEl.textContent = 'Enter the review password.';
    return;
  }
  lockSubmitEl.disabled = true;
  lockErrorEl.textContent = '';
  const { data, error } = await fetchBoard(code);
  lockSubmitEl.disabled = false;
  if (error) {
    lockErrorEl.textContent = error.message || 'Could not unlock review.';
    return;
  }
  if (!data?.ok) {
    lockErrorEl.textContent = 'This review was not found or has expired.';
    return;
  }
  if (data.locked) {
    lockErrorEl.textContent = 'Incorrect password — try again.';
    return;
  }
  accessCode = code;
  storeAccessCode(code);
  renderBoardData(data);
}

function setupRealtime() {
  if (!board?.id || !window.supabase?.createClient) return;
  if (!supabaseRealtime) {
    supabaseRealtime = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  supabaseRealtime
    .channel(`review-${boardSlug}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shot_review_snips',
      filter: `board_id=eq.${board.id}`,
    }, () => {
      refreshBoard({ quiet: true });
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'shot_review_boards',
      filter: `id=eq.${board.id}`,
    }, () => {
      refreshBoard({ quiet: true });
    })
    .subscribe();
}

async function refreshBoard({ quiet = false } = {}) {
  const { data, error } = await fetchBoard(accessCode);
  if (error || !data?.ok) return;
  if (data.locked) {
    storeAccessCode('');
    accessCode = '';
    showLockScreen(data);
    return;
  }

  const prevId = activeSnip()?.id;
  board = data;
  snips = Array.isArray(data.snips) ? data.snips : snips;
  showBoardChrome(data);
  renderSnipTabs();

  const idx = prevId ? snips.findIndex(s => s.id === prevId) : activeSnipIndex;
  if (idx >= 0) {
    activeSnipIndex = idx;
    if (!quiet) selectSnip(idx);
    else {
      const snip = snips[idx];
      imgW = snip.img_w;
      imgH = snip.img_h;
      if (snip.image_url !== shotEl.src) shotEl.src = snip.image_url;
      else {
        layoutCanvas();
        renderNotes();
      }
    }
  }
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (imgW && imgH) resetView({ keepUserZoom: userAdjustedView });
  }, 120);
});

if (lockSubmitEl) lockSubmitEl.addEventListener('click', tryUnlock);
if (lockPasswordEl) {
  lockPasswordEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
  });
}

setupViewport();
loadBoard();
