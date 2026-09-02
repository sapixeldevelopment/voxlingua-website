import "server-only";

type PayPalResponse = Record<string, unknown>;

function paypalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalIsConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getPayPalAccessToken() {
  if (!paypalIsConfigured()) throw new Error("PayPal is not configured on the server.");
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status}).`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("PayPal did not return an access token.");
  return body.access_token;
}

export async function paypalRequest<T extends PayPalResponse = PayPalResponse>(path: string, init: RequestInit = {}) {
  const token = await getPayPalAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${paypalBaseUrl()}${path}`, { ...init, headers, cache: "no-store", signal: init.signal || AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body: T | null = null;
  try { body = text ? JSON.parse(text) as T : null; } catch { body = null; }
  if (!response.ok) {
    const detail = body && typeof body.message === "string" ? body.message : `PayPal request failed (${response.status}).`;
    throw new Error(detail);
  }
  return { response, body };
}

export async function verifyPayPalWebhook(headers: Headers, event: PayPalResponse) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  if (!webhookId || !transmissionId || !transmissionSig || !transmissionTime || !certUrl || !authAlgo) return false;
  const result = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  return result.body?.verification_status === "SUCCESS";
}
