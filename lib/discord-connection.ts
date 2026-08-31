import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type VerifiedDiscordConnection = {
  server_id: string;
  guild_id: string;
  guild_name: string | null;
  verified_at: string;
  verified_by: string | null;
};

export async function getVerifiedDiscordConnection(serverId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("server_discord_connections")
    .select("server_id,guild_id,guild_name,verified_at,verified_by")
    .eq("server_id", serverId)
    .maybeSingle();
  return (data as VerifiedDiscordConnection | null) || null;
}
