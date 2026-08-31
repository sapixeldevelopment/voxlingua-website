import { getServerRole } from "@/lib/access";
import { buildDiscordModerationSummary, syncDiscordModerationForServer } from "@/lib/discord-moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { isUuid, noStoreJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Application not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("applications")
    .select("server_id,discord_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!application) return noStoreJson({ error: "Application not found." }, { status: 404 });
  if (!(await getServerRole(application.server_id, auth.user.id))) {
    return noStoreJson({ error: "You are not allowed to review this application." }, { status: 403 });
  }
  if (!application.discord_user_id) {
    return noStoreJson({ monitoringStatus: "unavailable", summary: null });
  }

  const { data: server } = await admin
    .from("servers")
    .select("id")
    .eq("id", application.server_id)
    .maybeSingle();
  if (!server) return noStoreJson({ error: "Server not found." }, { status: 404 });
  const connection = await getVerifiedDiscordConnection(server.id);
  if (!connection) return noStoreJson({ monitoringStatus: "not_configured", summary: null });

  const sync = await syncDiscordModerationForServer({ id: server.id, discord_guild_id: connection.guild_id });
  const { data: rows, error } = await admin
    .from("discord_moderation_events")
    .select("id,event_type,moderator_discord_user_id,moderator_name,reason,occurred_at")
    .eq("server_id", application.server_id)
    .eq("discord_user_id", application.discord_user_id)
    .order("occurred_at", { ascending: false });
  if (error) return noStoreJson({ error: "Moderation history could not be loaded." }, { status: 500 });

  return noStoreJson({
    monitoringStatus: sync.status,
    summary: buildDiscordModerationSummary((rows || []) as Parameters<typeof buildDiscordModerationSummary>[0]),
  });
}
