import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getServerRole(serverId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("server_members")
    .select("role")
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "reviewer"])
    .maybeSingle();
  return data?.role || null;
}
