import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isDiscordWebhookUrl,
  maskDiscordWebhookUrl,
  sendDiscordWebhook,
} from "@/lib/discord-webhook";
import { consumeRateLimit, isUuid, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

type WebhookBody = { url?: unknown; remove?: unknown };

async function getOwnedServer(serverId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("servers")
    .select("id,owner_id,name")
    .eq("id", serverId)
    .maybeSingle();
  return data && data.owner_id === userId ? data : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await getOwnedServer(id, auth.user.id))) {
    return noStoreJson({ error: "Portal not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("server_discord_webhooks")
    .select("webhook_url")
    .eq("server_id", id)
    .maybeSingle();
  if (error) return noStoreJson({ error: "Webhook configuration could not be loaded." }, { status: 500 });
  return noStoreJson({
    configured: Boolean(data?.webhook_url),
    maskedUrl: data?.webhook_url ? maskDiscordWebhookUrl(data.webhook_url) : null,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await getOwnedServer(id, auth.user.id))) {
    return noStoreJson({ error: "Only the portal owner can configure notifications." }, { status: 403 });
  }
  if (!(await consumeRateLimit(`webhook-config:${auth.user.id}:${id}`, 20, 600))) {
    return noStoreJson({ error: "Too many webhook changes. Please wait a few minutes." }, { status: 429 });
  }

  const body = await readJsonBody<WebhookBody>(request, 4096);
  if (!body || (body.url !== undefined && body.url !== null && typeof body.url !== "string") || (body.remove !== undefined && typeof body.remove !== "boolean")) {
    return noStoreJson({ error: "Invalid webhook configuration." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (body.remove === true) {
    const { error } = await admin.from("server_discord_webhooks").delete().eq("server_id", id);
    if (error) return noStoreJson({ error: "The Discord webhook could not be removed." }, { status: 500 });
    return noStoreJson({ ok: true, configured: false });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    const { data, error } = await admin.from("server_discord_webhooks").select("webhook_url").eq("server_id", id).maybeSingle();
    if (error) return noStoreJson({ error: "The Discord webhook could not be checked." }, { status: 500 });
    return noStoreJson({ ok: true, configured: Boolean(data?.webhook_url) });
  }
  if (!isDiscordWebhookUrl(url)) {
    return noStoreJson({ error: "Enter a valid HTTPS Discord webhook URL from a Discord channel." }, { status: 400 });
  }

  const { error } = await admin.from("server_discord_webhooks").upsert({
    server_id: id,
    webhook_url: url,
    configured_by: auth.user.id,
  }, { onConflict: "server_id" });
  if (error) return noStoreJson({ error: "The Discord webhook could not be saved." }, { status: 500 });
  return noStoreJson({ ok: true, configured: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  const server = await getOwnedServer(id, auth.user.id);
  if (!server) return noStoreJson({ error: "Only the portal owner can test notifications." }, { status: 403 });
  if (!(await consumeRateLimit(`webhook-test:${auth.user.id}:${id}`, 5, 600))) {
    return noStoreJson({ error: "Too many test notifications. Please wait a few minutes." }, { status: 429 });
  }

  const result = await sendDiscordWebhook(id, {
    embeds: [{
      title: "Dexlyy webhook connected",
      description: `Application updates for **${server.name}** will be posted in this channel.`,
      color: 0x27845f,
      timestamp: new Date().toISOString(),
      footer: { text: "Dexlyy notifications" },
    }],
  });
  if (!result.configured) return noStoreJson({ error: "Configure and save a Discord webhook before testing it." }, { status: 422 });
  if (!result.ok) return noStoreJson({ error: "Discord did not accept the test notification. Check that the webhook is still active." }, { status: 502 });
  return noStoreJson({ ok: true });
}
