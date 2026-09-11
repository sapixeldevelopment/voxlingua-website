import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const Link = ({ children, ...props }) => React.createElement('a', props, children);
const stub = () => null;
function load(path, state = {}, extras = {}) {
  let slot = 0;
  const mocks = {
    react: { ...React, useState(initial) { const key = slot++; return [key in state ? state[key] : initial, stub]; }, useEffect: stub },
    'next/link': { default: Link },
    'next/navigation': { usePathname: () => '/dashboard', useRouter: () => ({}) },
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/components/billing-panel': { default: () => React.createElement('div', null, 'Existing billing controls') },
    '@/components/feedback-panel': { default: () => React.createElement('div', null, 'Existing feedback controls') },
    '@/components/server-settings-form': { default: stub },
    '@/components/confirm-modal': { default: stub },
    '@/lib/billing': { BILLING_PLANS: { starter: { name: 'Starter' } } },
    '@/lib/auth': { discordAuthEnabled: true, friendlyAuthError: String },
    ...extras,
  };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => name in mocks ? mocks[name] : require(name), URL, Date, process });
  return exports;
}
const server = { id: 'demo-server', name: 'Harbor RP', slug: 'harbor', created_at: '2026-09-01', is_active: true, interview_mode: 'guided' };
const billing = { plan_key: 'starter', status: 'active', server_limit: 1 };

test('workspace navigation has real destinations, accessible current state and skip link', () => {
  const Frame = load('components/workspace-frame.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Frame, null, 'Workspace content'));
  for (const path of ['/dashboard', '/dashboard#billing', '/dashboard#support', '#workspace-content']) assert.ok(html.includes(`href="${path}"`));
  assert.match(html, /aria-current="location"/);
  assert.match(html, /id="workspace-content"/);
  assert.doesNotMatch(html, /\/admin/);
});

test('communities precede billing and feedback while existing actions stay available', () => {
  const Dashboard = load('components/dashboard-app.tsx', { 0: { id: 'demo-user' }, 1: [server], 3: false, 6: billing, 7: false }).default;
  const html = renderToStaticMarkup(React.createElement(Dashboard));
  assert.ok(html.indexOf('id="communities"') < html.indexOf('id="billing"'));
  assert.ok(html.indexOf('id="billing"') < html.indexOf('id="support"'));
  assert.match(html, /href="\/dashboard\/servers\/demo-server"/);
  assert.match(html, /href="\/dashboard\/servers\/demo-server\/settings"/);
  assert.match(html, /aria-label="Copy portal link"/);
  assert.match(html, /aria-label="Delete Harbor RP"/);
  assert.match(html, /disabled="" title="Your starter plan allows 1 server"/);
  assert.match(html, /Existing billing controls/);
});

test('paused billing still locks configuration and adding communities', () => {
  const Dashboard = load('components/dashboard-app.tsx', { 0: { id: 'demo-user' }, 1: [server], 3: false, 6: { ...billing, status: 'suspended' }, 7: false }).default;
  const html = renderToStaticMarkup(React.createElement(Dashboard));
  assert.match(html, /aria-label="Portal configuration locked"/);
  assert.doesNotMatch(html, /href="\/dashboard\/servers\/demo-server\/settings"/);
  assert.match(html, /disabled="" title="Choose an active plan below first"/);
});

test('application queue retains review filtering and original return destination', () => {
  const Queue = load('components/dashboard-app.tsx').ApplicationQueue;
  const html = renderToStaticMarkup(React.createElement(Queue, { server, applications: [
    { id: 'review-one', server_id: server.id, player_name: 'Review applicant', status: 'under_review', created_at: '2026-09-01' },
    { id: 'approved-one', server_id: server.id, player_name: 'Already approved', status: 'approved', created_at: '2026-09-01' },
  ] }));
  assert.match(html, /Review applicant/);
  assert.doesNotMatch(html, /Already approved/);
  assert.match(html, /returnTo=%2Fdashboard%2Fservers%2Fdemo-server/);
});

test('Guided portal retains audio-only consent and Discord entry point', () => {
  const Portal = load('components/portal-app.tsx', { 0: server, 3: false }).default;
  const html = renderToStaticMarkup(React.createElement(Portal, { slug: 'harbor' }));
  assert.match(html, /Listen to each question, then record your answer/);
  assert.match(html, /Your recorded answers are not sent to OpenAI/);
  assert.match(html, /Connect Discord to begin/);
  assert.doesNotMatch(html, /sending interview audio, your application, and transcript to OpenAI/);
});

test('Realtime portal keeps its separate consent and unverified submission gate', () => {
  const Portal = load('components/portal-app.tsx', { 0: { ...server, interview_mode: 'realtime' }, 2: { id: 'demo-user' }, 3: false, 9: 'not_verified' }).default;
  const html = renderToStaticMarkup(React.createElement(Portal, { slug: 'harbor' }));
  assert.match(html, /sending interview audio, your application, and transcript to OpenAI/);
  assert.match(html, /class="btn btn-primary portal-primary-action" disabled=""/);
});
