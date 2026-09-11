import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// Exercise the actual TS modules with isolated, in-memory dependencies. No
// credentials, live recordings, provider calls, or production writes are used.
function load(path, mocks = {}, globals = {}, transform = (source) => source) {
  const source = transform(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (name) => {
    if (!(name in mocks)) throw new Error(`Missing mock: ${name}`);
    return mocks[name];
  }, console: { error() {}, warn() {} }, setTimeout, clearTimeout, AbortController,
  Response, Request, Blob, FormData, URL, Error, process: { env: {} }, ...globals }, { filename: path });
  return exports;
}

const policy = load('lib/interview-policy.ts');
const transcript = Array.from({ length: 8 }, () => ({ role: 'user', text:
  'I would calmly discuss the situation with the other player and ask a moderator for help when necessary.' }));
const savedSession = { id: 'test-session', application_id: 'test-application', server_id: 'test-server',
  status: 'in_progress', started_at: '2020-01-01T00:00:00Z', restart_count: 0,
  recording_path: 'test-server/test-session/recording.webm', transcript };
function query(result) {
  const builder = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
  for (const name of ['select', 'eq', 'order', 'maybeSingle', 'upsert', 'update']) builder[name] = () => builder;
  return builder;
}

test('JSON timeout includes a stalled response body and aborts the request', async () => {
  let signal;
  const requests = load('lib/client-request.ts', {}, { fetch: async (_url, init) => {
    signal = init.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) };
  }});
  await assert.rejects(requests.fetchJsonWithTimeout('/submit', {}, 10, 'timed out'), /timed out/);
  assert.equal(signal.aborted, true);
});

test('HTTP errors keep their status and readable message', async () => {
  const requests = load('lib/client-request.ts', {}, { fetch: async () =>
    Response.json({ error: 'Try again' }, { status: 422 }) });
  const result = await requests.fetchJsonWithTimeout('/submit', {}, 100, 'timeout');
  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
  assert.equal(result.data.error, 'Try again');
});

function apiHarness({ rpcError = null, data = { ok: true }, status = 'in_progress', signedIn = true } = {}) {
  const deferred = [];
  let rpcCalls = 0;
  let adminQueries = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'applicant' } : null } }) },
    from: () => query({ data: { ...savedSession, status } }),
    rpc: async () => { rpcCalls++; return { data, error: rpcError }; },
  };
  const api = load('app/api/interviews/submit/route.ts', {
    'next/server': { after: (callback) => deferred.push(callback) },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => { adminQueries++; return query({ count: 3 }); } }) },
    '@/lib/interview-policy': policy,
    '@/lib/discord-webhook': { sendDiscordWebhook: () => new Promise(() => {}) },
    '@/lib/interview-analysis': { analyzeInterviewSession: () => new Promise(() => {}) },
    '@/lib/security': { rejectCrossOrigin: () => null, consumeRateLimit: async () => true,
      isUuid: () => true, readJsonBody: (request) => request.json(), noStoreJson: Response.json },
  });
  return { call: (lines = transcript) => api.POST(new Request('https://example.test/api/interviews/submit', {
    method: 'POST', body: JSON.stringify({ sessionId: savedSession.id, transcript: lines }),
  })), deferred, calls: () => ({ rpcCalls, adminQueries }) };
}

test('saved recording can be submitted after review delay, before any notification work', async () => {
  const harness = apiHarness();
  const response = await harness.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(harness.deferred.length, 1);
  assert.equal(harness.calls().rpcCalls, 1);
});

test('completed retry skips changed requirements and does not repeat follow-up work', async () => {
  const harness = apiHarness({ status: 'completed', data: { ok: true, already_submitted: true } });
  const response = await harness.call([]);
  assert.equal(response.status, 200);
  assert.equal(harness.calls().adminQueries, 0);
  assert.equal(harness.deferred.length, 0);
});

test('unknown database errors stay private; known business errors are actionable', async () => {
  const unknown = apiHarness({ rpcError: { code: '42883', message: 'sensitive database detail' } });
  const response = await unknown.call();
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /sensitive database detail/);
  const expected = apiHarness({ rpcError: { code: 'P0001', message: 'No interview credits remaining.' } });
  assert.equal((await expected.call()).status, 402);
  assert.equal(expected.deferred.length, 0);
});

test('unauthenticated, empty transcript, and missing RPC confirmation cannot succeed', async () => {
  const unauthenticated = apiHarness({ signedIn: false });
  assert.equal((await unauthenticated.call()).status, 401);
  assert.equal(unauthenticated.calls().rpcCalls, 0);
  assert.equal((await apiHarness().call([])).status, 422);
  assert.equal((await apiHarness({ data: null }).call()).status, 500);
});

function componentHarness(fetcher, session = savedSession) {
  const slots = [];
  const effects = [];
  let index = 0;
  const react = {
    useState(initial) { const key = index++; if (!(key in slots)) slots[key] = initial;
      return [slots[key], (value) => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }]; },
    useRef(initial) { const key = index++; return slots[key] ||= { current: initial }; },
    useMemo(factory) { const key = index++; return slots[key] ||= factory(); },
    useEffect(callback) { const key = index++; if (!(key in slots)) { slots[key] = true; effects.push(callback); } },
  };
  let uploads = 0;
  const client = { from: () => query({ data: session }), storage: { from: () => ({ upload: async () => {
    uploads++; return { error: null };
  } }) } };
  const requests = load('lib/client-request.ts', {}, { fetch: fetcher });
  const component = load('components/interview-app.tsx', {
    react, 'react/jsx-runtime': {}, 'next/link': {}, 'lucide-react': {},
    '@/lib/supabase/client': { createClient: () => client },
    '@/lib/client-audio': { createApplicantVoiceSample: async () => null },
    '@/lib/client-request': requests, '@/lib/interview-policy': policy,
    '@/components/confirm-modal': {},
    '@/components/interview-recovery': {useInterviewRecovery: () => ({save:async()=>{},clear:async()=>{},prime(){}})},
    '@/lib/recording-upload': {uploadInterviewRecording:async()=>{uploads++;return {error:null};}},
  }, { window: { setTimeout, clearTimeout, clearInterval() {} }, fetch: fetcher }, (source) => source
    .replace('const API_REQUEST_TIMEOUT_MS = 20_000;', 'const API_REQUEST_TIMEOUT_MS = 10;')
    .replace('  return <main className="interview-page">', `  return {
      finish, handleRealtimeEvent, snapshot: { busy, error, session, submitted, roomStatus, recordingState, modelSpeaking, speechState },
      refs: { channel, pendingRecordingBlob, completionRequested, completionFinalized, lastAssistantTranscript, outputAudioActive, responseActive }
    };
    return <main className="interview-page">`));
  const render = () => { index = 0; return component.default({ sessionId: session.id }); };
  const event = (payload) => render().handleRealtimeEvent({ data: JSON.stringify(payload) });
  return { render, event, uploads: () => uploads, async init() {
    render(); effects[0](); await new Promise((resolve) => setTimeout(resolve, 0)); return render();
  }};
}

test('submission timeout unlocks the button, keeps answers, and a retry can succeed', async () => {
  let attempt = 0;
  const harness = componentHarness(async () => ++attempt === 1
    ? { ok: true, json: () => new Promise(() => {}) }
    : Response.json({ ok: true }));
  const first = await harness.init();
  await first.finish();
  let view = harness.render();
  assert.equal(view.snapshot.busy, false);
  assert.match(view.snapshot.error, /timed out/);
  assert.equal(view.snapshot.session.transcript.length, 8);
  await view.finish();
  view = harness.render();
  assert.equal(view.snapshot.submitted, true);
  assert.equal(view.snapshot.busy, false);
  assert.match(view.snapshot.roomStatus, /submitted successfully/);
  assert.equal(harness.uploads(), 0);
});

test('link failure retains local audio and retry does not upload it again', async () => {
  let links = 0;
  const harness = componentHarness(async (url) => url.includes('/recording') && ++links === 1
    ? Response.json({ error: 'Temporary link failure' }, { status: 500 })
    : Response.json({ ok: true }), { ...savedSession, recording_path: null });
  const view = await harness.init();
  view.refs.pendingRecordingBlob.current = new Blob(['test audio']);
  await view.finish();
  assert.equal(harness.render().snapshot.recordingState, 'ready');
  assert.equal(harness.render().refs.pendingRecordingBlob.current.size, 10);
  await harness.render().finish();
  assert.equal(harness.render().snapshot.submitted, true);
  assert.equal(harness.uploads(), 1);
});

test('double-click only starts one submission', async () => {
  let requests = 0;
  const harness = componentHarness(async () => { requests++; return Response.json({ ok: true }); });
  const view = await harness.init();
  await Promise.all([view.finish(), view.finish()]);
  assert.equal(requests, 1);
});

test('silent wait acknowledges the tool without generating another spoken response', async () => {
  const harness = componentHarness(async () => Response.json({ ok: true }));
  const view = await harness.init();
  const sent = [];
  view.refs.channel.current = { readyState: 'open', send: (event) => sent.push(JSON.parse(event)) };
  harness.event({ type: 'response.created' });
  harness.event({ type: 'response.function_call_arguments.done', name: 'wait_for_applicant', call_id: 'wait-1' });
  harness.event({ type: 'response.done', response: { status: 'completed' } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'conversation.item.create');
  assert.equal(harness.render().snapshot.modelSpeaking, false);
  assert.equal(harness.render().snapshot.speechState, 'listening');
  assert.equal(harness.render().refs.completionFinalized.current, false);
});

test('cancelled response and incidental overlap do not fail or finish the interview', async () => {
  const harness = componentHarness(async () => Response.json({ ok: true }));
  await harness.init();
  harness.event({ type: 'response.created' });
  harness.event({ type: 'output_audio_buffer.started' });
  harness.event({ type: 'input_audio_buffer.speech_started' });
  assert.equal(harness.render().snapshot.modelSpeaking, true);
  harness.render().refs.completionRequested.current = true;
  harness.event({ type: 'response.done', response: { status: 'cancelled' } });
  harness.event({ type: 'output_audio_buffer.stopped' });
  assert.equal(harness.render().snapshot.error, '');
  assert.equal(harness.render().refs.completionRequested.current, false);
  assert.equal(harness.render().refs.completionFinalized.current, false);
});

test('completion waits for both the response and audio playback to finish', async () => {
  const harness = componentHarness(async () => Response.json({ ok: true }));
  await harness.init();
  harness.event({ type: 'response.created' });
  harness.event({ type: 'output_audio_buffer.started' });
  harness.event({ type: 'response.function_call_arguments.done', name: 'complete_interview' });
  harness.event({ type: 'output_audio_buffer.stopped' });
  assert.equal(harness.render().refs.completionFinalized.current, false);
  harness.event({ type: 'response.done', response: { status: 'completed' } });
  assert.equal(harness.render().refs.completionFinalized.current, true);
});

test('voice-sample preparation yields to the browser and produces a bounded WAV', async () => {
  const samples = new Float32Array(16_000 * 10);
  samples.fill(0.2, 16_000 * 4);
  let closed = false;
  let browserTick = false;
  const audio = load('lib/client-audio.ts', {}, {
    window: { setTimeout }, AudioContext: class {
      async decodeAudioData() { return { length: samples.length, numberOfChannels: 1,
        sampleRate: 16_000, getChannelData: () => samples }; }
      async close() { closed = true; }
    },
  });
  setTimeout(() => { browserTick = true; }, 0);
  const result = await audio.createApplicantVoiceSample(new Blob(['synthetic']));
  assert.equal(browserTick, true);
  assert.equal(closed, true);
  assert.equal(result.type, 'audio/wav');
  assert.ok(result.size <= 44 + 16_000 * 45 * 2);
  assert.equal(new TextDecoder().decode((await result.arrayBuffer()).slice(0, 4)), 'RIFF');
});

test('voice-sample preparation respects cancellation before expensive work', async () => {
  const controller = new AbortController();
  controller.abort();
  const audio = load('lib/client-audio.ts', {}, { window: {} });
  await assert.rejects(audio.createApplicantVoiceSample(new Blob(['synthetic']), controller.signal), /timed out/);
});

test('Realtime request preserves patient turn detection and provides the silent wait tool', async () => {
  let sessionConfig;
  const admin = { from(table) {
    const values = {
      interview_sessions: { ...savedSession, started_at: new Date().toISOString() },
      applications: { applicant_user_id: 'applicant' },
      servers: { owner_id: 'owner', is_active: true },
      owner_billing: { status: 'active', daily_interview_limit: -1, monthly_interview_limit: 15, monthly_interviews_used: 0 },
      question_bank: [{ prompt: 'Describe your experience.', scenario: null }],
    };
    return query({ data: values[table] });
  } };
  const route = load('app/api/realtime/session/route.ts', {
    '@/lib/billing': load('lib/billing.ts'),
    'next/server': {}, 'node:crypto': { createHash },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      getUser: async () => ({ data: { user: { id: 'applicant' } } }),
    } }) },
    '@/lib/interview-policy': policy,
    '@/lib/security': { rejectCrossOrigin: () => null, consumeRateLimit: async () => true,
      isUuid: () => true, readJsonBody: (request) => request.json(), noStoreJson: Response.json },
  }, { process: { env: { OPENAI_API_KEY: 'test-only-placeholder' } }, fetch: async (_url, init) => {
    sessionConfig = JSON.parse(init.body.get('session'));
    return new Response('test sdp', { status: 201 });
  } });
  const result = await route.POST(new Request('https://example.test/api/realtime/session', {
    method: 'POST', body: JSON.stringify({ sessionId: savedSession.id, sdp: 'test sdp with enough characters' }),
  }));
  assert.equal(result.status, 201);
  assert.equal(sessionConfig.audio.input.turn_detection.type, 'semantic_vad');
  assert.equal(sessionConfig.audio.input.turn_detection.eagerness, 'low');
  assert.equal(sessionConfig.audio.input.turn_detection.interrupt_response, false);
  assert.ok(sessionConfig.tools.some((tool) => tool.name === 'wait_for_applicant'));
  assert.match(sessionConfig.instructions, /Accidental overlap/);
  assert.match(sessionConfig.instructions, /keep the same question active/);
  assert.doesNotMatch(sessionConfig.instructions, /Please answer the question I asked/);
});
