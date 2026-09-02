import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("production abuse controls use Cloudflare's authenticated client IP", async () => {
  const security = await read("lib/security.ts");
  const applications = await read("app/api/applications/route.ts");
  const portal = await read("app/api/portal/[slug]/route.ts");
  assert.match(security, /cf-connecting-ip/);
  assert.match(security, /NODE_ENV !== "production"/);
  assert.match(applications, /requestClientIp\(request\)/);
  assert.match(portal, /requestClientIp\(request\)/);
  assert.doesNotMatch(applications, /headers\.get\("x-forwarded-for"\)/);
  assert.doesNotMatch(portal, /headers\.get\("x-forwarded-for"\)/);
});

test("PayPal webhook is throttled before provider verification and hides provider errors", async () => {
  const webhook = await read("app/api/paypal/webhook/route.ts");
  assert.ok(webhook.indexOf("paypal-webhook-ip") < webhook.indexOf("await verifyPayPalWebhook"));
  assert.match(webhook, /paypal-webhook-global/);
  assert.doesNotMatch(webhook, /error instanceof Error \? error\.message/);
});

test("public portal reads cannot trigger destructive retention cleanup", async () => {
  const portal = await read("app/api/portal/[slug]/route.ts");
  const worker = await read("worker.ts");
  assert.doesNotMatch(portal, /cleanupServerApplicationHistory/);
  assert.match(worker, /application-retention/);
});

test("admin login creates a browser-session-only preference", async () => {
  const login = await read("app/admin/login/page.tsx");
  assert.match(login, /REMEMBER_ME_COOKIE}=0/);
  assert.doesNotMatch(login, /REMEMBER_ME_MAX_AGE/);
});

test("recording update policy revalidates the exact destination path", async () => {
  const migration = await read("supabase/migrations/20260902133343_security_hardening_storage_and_privileges.sql");
  assert.match(migration, /with check[\s\S]*recording\.webm/);
  assert.match(migration, /voice-sample\.wav/);
  assert.match(migration, /revoke all privileges on all tables in schema public from anon/);
});
