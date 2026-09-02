import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, mocks = {}, globals = {}, transform = (source) => source) {
  const source = transform(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (name) => {
    if (!(name in mocks)) throw new Error(`Missing mock: ${name}`);
    return mocks[name];
  }, URL, URLSearchParams, Date, Error, setTimeout, clearTimeout, ...globals });
  return exports;
}
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
const code = 'A1B2C3D4E5F6'; // Synthetic only; never redeem a real invitation in tests.
const helpers = load('lib/staff-invite.ts');

test('shareable link uses a fragment, not a server-visible query', () => {
  const url = new URL(helpers.staffJoinUrl('https://dexlyy.com/anything', code));
  assert.equal(url.pathname, '/staff/join');
  assert.equal(url.search, '');
  assert.equal(url.hash, `#invite=${code}`);
  assert.equal(helpers.staffJoinUrl('https://dexlyy.com'), 'https://dexlyy.com/staff/join');
});
test('invalid codes and non-web addresses are rejected', () => {
  for (const invalid of ['abcdef', 'GGGGGGGGGGGG', '<script>', 'A1B2C3D4E5F6?next=evil']) {
    assert.equal(helpers.normalizeStaffInviteCode(invalid), '');
    assert.throws(() => helpers.staffJoinUrl('https://dexlyy.com', invalid));
  }
  assert.equal(helpers.normalizeStaffInviteCode(' a1b2 c3d4 e5f6 '), code);
  assert.throws(() => helpers.staffJoinUrl('file:///tmp/site', code));
});
test('copied message includes joining instructions and the required Discord role', () => {
  const url = helpers.staffJoinUrl('https://dexlyy.com', code);
  const message = helpers.staffInviteMessage({ serverName: 'Demo RP', role: 'admin', discordRole: 'Moderators', url });
  assert.ok(message.includes(url));
  for (const text of ['administrator', 'Discord account', 'Join portal team', 'Moderators', 'one person only']) assert.ok(message.includes(text));
});
test('code survives OAuth in the same tab and is cleared after acceptance', () => {
  const sessionStorage = storage();
  const before = load('lib/staff-invite.ts', {}, { sessionStorage });
  assert.equal(before.rememberStaffInvite(code), true);
  const after = load('lib/staff-invite.ts', {}, { sessionStorage });
  assert.equal(after.recallStaffInvite(), code);
  after.rememberStaffInvite('');
  assert.equal(after.recallStaffInvite(), '');
});
test('stale or malformed tab storage is ignored and unavailable storage has a safe fallback', () => {
  const sessionStorage = storage();
  sessionStorage.setItem('dexlyy:pending-staff-invite', JSON.stringify({ code, savedAt: Date.now() - 3600001 }));
  const stored = load('lib/staff-invite.ts', {}, { sessionStorage });
  assert.equal(stored.recallStaffInvite(), '');
  sessionStorage.setItem('dexlyy:pending-staff-invite', 'not-json');
  assert.equal(stored.recallStaffInvite(), '');
  assert.equal(helpers.rememberStaffInvite(code), false);
  assert.equal(helpers.recallStaffInvite(), '');
});

function joinHarness({ hash = `#invite=${code}`, sessionStorage = storage(), user = null, fail = false } = {}) {
  const slots = [], effects = [], oauth = [], api = [];
  let index = 0;
  const react = {
    useState(initial) { const key = index++; if (!(key in slots)) slots[key] = initial;
      return [slots[key], (value) => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }]; },
    useEffect(fn) { index++; effects.push(fn); },
  };
  const location = { hash, origin: 'https://dexlyy.com', pathname: '/staff/join', search: '' };
  let replacedUrl;
  const invite = load('lib/staff-invite.ts', {}, { sessionStorage });
  const client = { auth: { getUser: async () => ({ data: { user } }), signInWithOAuth: async (args) => { oauth.push(args); return {}; } } };
  const component = load('components/staff-join.tsx', {
    react, 'react/jsx-runtime': {}, 'next/link': {}, 'lucide-react': {},
    '@/lib/auth': { discordAuthEnabled: true, friendlyAuthError: (value) => value },
    '@/lib/supabase/client': { createClient: () => client }, '@/lib/staff-invite': invite,
    '@/lib/client-request': { fetchJsonWithTimeout: async (_url, init) => {
      api.push(JSON.parse(init.body));
      if (fail) throw new Error('Connection failed');
      return { ok: true, data: { ok: true, server_id: 'demo', role: 'reviewer' } };
    } },
  }, { window: { location, history: { state: null, replaceState: (_state, _title, url) => { replacedUrl = url; location.hash = ''; } } } },
    (source) => source.replace('  return <main', '  return { discordLogin, join, code, busy, error, result, signedIn, hasDiscord, checkingAuth };\n  return <main'));
  const render = () => { index = 0; return component.default(); };
  return { render, oauth, api, invite, url: () => replacedUrl, async init() { render(); effects[0](); await new Promise(resolve => setTimeout(resolve, 0)); return render(); } };
}
test('opening an invitation prefills the code but never consumes it', async () => {
  const harness = joinHarness();
  const view = await harness.init();
  assert.equal(view.code, code);
  assert.equal(harness.url(), '/staff/join');
  assert.equal(harness.api.length, 0);
  await view.discordLogin();
  assert.equal(harness.invite.recallStaffInvite(), code);
  assert.equal(harness.oauth[0].options.redirectTo, 'https://dexlyy.com/auth/callback?next=/staff/join');
  assert.ok(!JSON.stringify(harness.oauth).includes(code));
});
test('returning from OAuth restores code; accepting explicitly clears it', async () => {
  const sessionStorage = storage();
  load('lib/staff-invite.ts', {}, { sessionStorage }).rememberStaffInvite(code);
  const harness = joinHarness({ hash: '', sessionStorage, user: { identities: [{ provider: 'discord' }] } });
  const view = await harness.init();
  assert.equal(view.code, code);
  assert.equal(view.hasDiscord, true);
  await view.join();
  assert.equal(harness.api[0].code, code);
  assert.equal(harness.render().result.server_id, 'demo');
  assert.equal(harness.invite.recallStaffInvite(), '');
});
test('invalid link never reuses a previously saved invitation', async () => {
  const sessionStorage = storage();
  load('lib/staff-invite.ts', {}, { sessionStorage }).rememberStaffInvite(code);
  const harness = joinHarness({ hash: '#invite=broken', sessionStorage });
  const view = await harness.init();
  assert.equal(view.code, '');
  assert.match(view.error, /incomplete/);
  assert.equal(harness.invite.recallStaffInvite(), '');
});
test('join failure unlocks the form and retains the invite for retry', async () => {
  const harness = joinHarness({ fail: true });
  const view = await harness.init();
  await view.join();
  const next = harness.render();
  assert.equal(next.busy, false);
  assert.equal(next.code, code);
  assert.match(next.error, /Connection failed/);
});
test('a non-Discord session is not labelled Discord-connected', async () => {
  const view = await joinHarness({ user: { identities: [{ provider: 'email' }] } }).init();
  assert.equal(view.signedIn, true);
  assert.equal(view.hasDiscord, false);
});
