import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DiscordWebhookPayload = {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp?: string;
    footer?: { text: string };
  }>;
  allowed_mentions?: { parse: string[] };
};

type WebhookDelivery = {
  configured: boolean;
  ok: boolean;
  status?: number;
  error?: string;
};

const DISCORD_WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com"]);

export function isDiscordWebhookUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 40 || value.length > 512) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      DISCORD_WEBHOOK_HOSTS.has(url.hostname.toLowerCase()) &&
      /^\/api\/webhooks\/\d+\/[^/]+$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function maskDiscordWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/");
    const token = parts.at(-1) || "";
    parts[parts.length - 1] = token.length > 8 ? `${token.slice(0, 4)}••••${token.slice(-4)}` : "••••••••";
    parts[parts.length - 2] = "••••••";
    return `${url.origin}${parts.join("/")}`;
  } catch {
    return "Discord webhook configured";
  }
}

async function getWebhookUrl(serverId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("server_discord_webhooks")
    .select("webhook_url")
    .eq("server_id", serverId)
    .maybeSingle();
  if (error) return { url: null, error: error.message };
  return { url: data?.webhook_url || null, error: null };
}

export async function sendDiscordWebhook(
  serverId: string,
  payload: DiscordWebhookPayload,
): Promise<WebhookDelivery> {
  const { url, error } = await getWebhookUrl(serverId);
  if (error) return { configured: false, ok: false, error: "Webhook lookup failed." };
  if (!url) return { configured: false, ok: true };
  if (!isDiscordWebhookUrl(url)) {
    return { configured: true, ok: false, error: "Stored webhook URL is invalid." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } }),
      signal: controller.signal,
    });
    return { configured: true, ok: response.ok, status: response.status };
  } catch {
    return { configured: true, ok: false, error: "Discord webhook request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

