import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 400 });
  }

  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  return null;
}

export async function readJsonBody<T>(request: Request, maxBytes = 32_768): Promise<T | null> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;

  const raw = await request.text();
  if (!raw || Buffer.byteLength(raw, "utf8") > maxBytes) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSafeSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function requestClientIp(request: Request) {
  // Cloudflare replaces this header at the edge. Do not trust a caller-supplied
  // X-Forwarded-For value in production because its left-most entry is
  // spoofable when a proxy appends rather than replaces the header.
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp && cloudflareIp.length <= 64 && /^[0-9a-f:.]+$/i.test(cloudflareIp)) {
    return cloudflareIp;
  }

  // Keep local Next.js development usable where Cloudflare headers are absent.
  if (process.env.NODE_ENV !== "production") {
    const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwardedIp && forwardedIp.length <= 64 && /^[0-9a-f:.]+$/i.test(forwardedIp)) return forwardedIp;
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp && realIp.length <= 64 && /^[0-9a-f:.]+$/i.test(realIp)) return realIp;
  }

  // An unknown production address intentionally shares one conservative bucket.
  return "unknown";
}

export function applicationOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured in production.");
  }
  return new URL(request.url).origin;
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const digest = createHash("sha256").update(key).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_key: digest,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  // Keep local development usable before the accompanying migration is applied.
  // Production deployments must apply all Supabase migrations before release.
  if (error) {
    if (process.env.NODE_ENV !== "production") return true;
    throw new Error("Rate-limit service is unavailable.");
  }
  return data === true;
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
