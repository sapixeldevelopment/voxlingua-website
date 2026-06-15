const SUPABASE_URL = 'https://mmgzuubrtyodhjtmjlvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LYP_tofuZNutUaE-KfjT7Q_Uf5XcaIO';

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
const shotEl = document.getElementById('shot');
const overlay = document.getElementById('overlay');
const noteListEl = document.getElementById('noteList');
const ctx = overlay?.getContext('2d');

let supabaseRealtime = null;
let board = null;
let snips = [];
let activeSnipIndex = 0;
let selectedGroupId = null;
let hoveredCalloutId = null;
let displayScale = 1;
let imgW = 0;
let imgH = 0;
let accessCode = '';

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

function layoutCanvas() {
  const wrap = document.getElementById('canvasArea');
  const maxW = Math.max(200, wrap.clientWidth - 48);
  displayScale = Math.min(1, maxW / imgW);
  const w = Math.max(1, Math.round(imgW * displayScale));
  const h = Math.max(1, Math.round(imgH * displayScale));
  shotEl.style.width = w + 'px';
  shotEl.style.height = h + 'px';
  overlay.width = imgW;
  overlay.height = imgH;
  overlay.style.width = w + 'px';
  overlay.style.height = h + 'px';
  drawMarks();
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
      ctx.strokeStyle = '#0088ff';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(0, 136, 255, 0.22)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else if (hovered) {
      ctx.strokeStyle = '#56d4ff';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(86, 212, 255, 0.16)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else {
      ctx.strokeStyle = 'rgba(232, 146, 58, .8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    const bx = layout?.badgeX ?? (x + 8 + badgeR);
    const by = layout?.badgeY ?? (y + 8 + badgeR);
    if (layout?.leader) {
      ctx.strokeStyle = selected ? '#0088ff' : 'rgba(232, 146, 58, .75)';
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
    ctx.fillStyle = selected ? '#0088ff' : hovered ? '#3ec5ff' : '#e8923a';
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
  const r = overlay.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / displayScale,
    y: (e.clientY - r.top) / displayScale,
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

overlay?.addEventListener('mousemove', e => {
  const hit = hitTestCallout(canvasPos(e));
  if (hit === hoveredCalloutId) return;
  hoveredCalloutId = hit;
  if (hit) {
    const c = activeCallouts().find(x => x.id === hit);
    selectedGroupId = c ? groupIdOf(c) : null;
    renderNotes();
  }
  drawMarks();
});

overlay?.addEventListener('click', () => {
  if (hoveredCalloutId) renderNotes();
});

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

window.addEventListener('resize', () => {
  if (imgW && imgH) layoutCanvas();
});

if (lockSubmitEl) lockSubmitEl.addEventListener('click', tryUnlock);
if (lockPasswordEl) {
  lockPasswordEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
  });
}

loadBoard();
