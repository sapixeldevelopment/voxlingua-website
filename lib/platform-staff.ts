import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformStaffRole = "support" | "admin";
export type PlatformStaff = {
  user_id: string;
  role: PlatformStaffRole;
  display_name: string | null;
};

export async function getPlatformStaff(userId: string): Promise<PlatformStaff | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_staff")
    .select("user_id,role,display_name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data || !["support", "admin"].includes(data.role)) return null;
  return data as PlatformStaff;
}

