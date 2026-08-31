import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { discordGuildMemberRoles, discordIdentity, getDiscordGuildMember, isDiscordSnowflake } from "@/lib/discord";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, isSafeSlug, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`discord-verify:${auth.user.id}`, 30, 600))) {
    return noStoreJson({ error: "Too many Discord verification attempts. Please wait a moment." }, { status: 429 });
  }
  const body = await readJsonBody<{ slug?: string }>(request, 2_048);
  if (!body || !isSafeSlug(body.slug)) return noStoreJson({ error: "Missing portal." }, { status: 400 });
  const admin = createAdminClient();
  const { data: server } = await admin.from("servers").select("id,approved_role_id,is_active").eq("slug", body.slug).maybeSingle();
  const connection = server ? await getVerifiedDiscordConnection(server.id) : null;
  if (!server?.is_active || !connection || !isDiscordSnowflake(connection.guild_id) || !process.env.DISCORD_BOT_TOKEN) return noStoreJson({ configured: false, verified: false });
  const identity = discordIdentity(auth.user);
  if (!identity) return noStoreJson({ configured: true, verified: false, error: "No verified Discord identity found on this account." });
  const membership = await getDiscordGuildMember(connection.guild_id, identity.id);
  const verified = membership.response?.ok === true;
  const memberRoles = verified ? await discordGuildMemberRoles(membership.response) : [];
  return noStoreJson({
    configured: true,
    verified,
    approved: isDiscordSnowflake(server.approved_role_id) && memberRoles.includes(server.approved_role_id),
  });
}
