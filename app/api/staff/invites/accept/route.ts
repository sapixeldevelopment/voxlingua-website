import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { discordIdentity, getDiscordGuildMember } from "@/lib/discord";
import { consumeRateLimit, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

function discordError(status: number) {
  if (status === 404) return "Your Discord account is not a member of this server.";
  if (status === 401 || status === 403) return "Dexlyy could not verify this Discord server. Check the bot token and permissions.";
  if (status === 429) return "Discord is temporarily rate-limiting verification. Please try again shortly.";
  return `Discord membership verification failed (${status}).`;
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must sign in with Discord first." }, { status: 401 });
  if (!(await consumeRateLimit(`staff-accept:${auth.user.id}`, 10, 900))) {
    return noStoreJson({ error: "Too many invite attempts. Please wait before trying again." }, { status: 429 });
  }

  const body = await readJsonBody<{ code?: string }>(request, 2_048);
  const code = body?.code?.replace(/\s+/g, "").toUpperCase() || "";
  if (!/^[A-F0-9]{12}$/.test(code)) return noStoreJson({ error: "Enter the 12-character staff invite code." }, { status: 400 });

  const identity = discordIdentity(auth.user);
  if (!identity) return noStoreJson({ error: "This account is not connected to Discord. Sign out and use Discord sign-in." }, { status: 422 });
  if (!process.env.DISCORD_BOT_TOKEN) return noStoreJson({ error: "Staff verification is not configured yet. Ask the owner to finish the Discord bot setup." }, { status: 503 });

  const codeHash = createHash("sha256").update(code).digest("hex");
  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("server_staff_invites")
    .select("server_id,role,accepted_at,expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (inviteError || !invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return noStoreJson({ error: "This invite is invalid, expired, or has already been used." }, { status: 400 });
  }

  const { data: server, error: serverError } = await admin
    .from("servers")
    .select("staff_role_id,is_active")
    .eq("id", invite.server_id)
    .maybeSingle();
  const connection = server ? await getVerifiedDiscordConnection(invite.server_id) : null;
  if (serverError || !server?.is_active || !connection || !server.staff_role_id) {
    return noStoreJson({ error: "This server has not finished configuring staff verification." }, { status: 422 });
  }

  const membership = await getDiscordGuildMember(connection.guild_id, identity.id);
  const response = membership.response;
  if (!response?.ok) return noStoreJson({ error: discordError(response?.status || 503) }, { status: response?.status === 404 ? 403 : 502 });
  const member = await response.json().catch(() => null) as { roles?: unknown } | null;
  if (!Array.isArray(member?.roles) || !member.roles.includes(server.staff_role_id)) {
    return noStoreJson({ error: "Your Discord account does not have the configured staff role." }, { status: 403 });
  }

  const { data, error } = await admin.rpc("accept_staff_invite", {
    p_code_hash: codeHash,
    p_user_id: auth.user.id,
  });
  if (error) return noStoreJson({ error: error.message }, { status: 400 });
  return noStoreJson(data || { ok: true });
}
