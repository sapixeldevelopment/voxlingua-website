import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { discordIdentity, getDiscordGuild, getDiscordGuildMember, discordMemberCanManageGuild, isDiscordSnowflake } from "@/lib/discord";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { consumeRateLimit, isUuid, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

type ConnectionBody = { guildId?: string | null };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: server } = await admin.from("servers").select("owner_id").eq("id", id).maybeSingle();
  if (!server) return noStoreJson({ error: "Portal not found." }, { status: 404 });
  if (server.owner_id !== auth.user.id) return noStoreJson({ error: "Only the portal owner can manage its Discord connection." }, { status: 403 });

  const connection = await getVerifiedDiscordConnection(id);
  return noStoreJson({ connected: Boolean(connection), guildName: connection?.guild_name || null });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`discord-connection:${auth.user.id}`, 20, 900))) {
    return noStoreJson({ error: "Too many Discord connection checks. Please wait a moment." }, { status: 429 });
  }

  const body = await readJsonBody<ConnectionBody>(request, 2_048);
  if (!body || (body.guildId !== undefined && body.guildId !== null && typeof body.guildId !== "string")) {
    return noStoreJson({ error: "Invalid Discord server ID." }, { status: 400 });
  }
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";

  const admin = createAdminClient();
  const { data: server } = await admin.from("servers").select("owner_id").eq("id", id).maybeSingle();
  if (!server) return noStoreJson({ error: "Portal not found." }, { status: 404 });
  if (server.owner_id !== auth.user.id) return noStoreJson({ error: "Only the portal owner can manage its Discord connection." }, { status: 403 });

  if (!guildId) {
    const { error: deleteError } = await admin.from("server_discord_connections").delete().eq("server_id", id);
    if (deleteError) return noStoreJson({ error: "The Discord connection could not be removed." }, { status: 500 });
    const { error: clearError } = await admin.from("servers").update({ discord_guild_id: null, discord_guild_name: null }).eq("id", id).eq("owner_id", auth.user.id);
    if (clearError) return noStoreJson({ error: "The Discord connection could not be removed." }, { status: 500 });
    return noStoreJson({ connected: false });
  }

  if (!isDiscordSnowflake(guildId)) return noStoreJson({ error: "Enter a valid Discord server ID." }, { status: 400 });
  const identity = discordIdentity(auth.user);
  if (!identity) return noStoreJson({ error: "Your Dexlyy account must be authenticated with Discord." }, { status: 422 });
  if (!process.env.DISCORD_BOT_TOKEN) return noStoreJson({ error: "The Dexlyy Discord bot is not configured on the server yet." }, { status: 503 });

  const guildResponse = await getDiscordGuild(guildId);
  if (!guildResponse.configured || !guildResponse.response) return noStoreJson({ error: "The Dexlyy Discord bot is not configured on the server yet." }, { status: 503 });
  if (!guildResponse.response.ok) {
    return noStoreJson({ error: guildResponse.response.status === 404 ? "Dexlyy is not installed in that Discord server yet. Use the Install Dexlyy bot button first." : "Dexlyy could not access that Discord server. Check that the bot is installed and try again." }, { status: guildResponse.response.status === 404 ? 422 : 502 });
  }
  const guild = await guildResponse.response.json().catch(() => null) as { id?: string; name?: string; owner_id?: string } | null;
  if (!guild?.id || guild.id !== guildId) return noStoreJson({ error: "Discord returned an invalid server." }, { status: 502 });

  const member = await getDiscordGuildMember(guildId, identity.id);
  if (!member.response?.ok || !(await discordMemberCanManageGuild(guildId, identity.id, guild.owner_id || null, member.response))) {
    return noStoreJson({ error: "Your Discord account must own or have Manage Server permission in that server." }, { status: 403 });
  }

  const { data: existing } = await admin.from("server_discord_connections").select("server_id").eq("guild_id", guildId).maybeSingle();
  if (existing && existing.server_id !== id) return noStoreJson({ error: "That Discord server is already connected to another Dexlyy portal." }, { status: 409 });

  const { error: connectionError } = await admin.from("server_discord_connections").upsert({
    server_id: id,
    guild_id: guildId,
    guild_name: typeof guild.name === "string" ? guild.name.slice(0, 100) : null,
    verified_at: new Date().toISOString(),
    verified_by: auth.user.id,
  }, { onConflict: "server_id" });
  if (connectionError) return noStoreJson({ error: "The Discord connection could not be saved." }, { status: 500 });

  const { error: serverError } = await admin.from("servers").update({ discord_guild_id: guildId, discord_guild_name: typeof guild.name === "string" ? guild.name.slice(0, 100) : null }).eq("id", id).eq("owner_id", auth.user.id);
  if (serverError) return noStoreJson({ error: "The Discord connection could not be saved." }, { status: 500 });

  return noStoreJson({ connected: true, guildName: guild.name || null });
}
