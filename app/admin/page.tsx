import { redirect } from "next/navigation";
import AdminSupportDashboard, { AdminAccessDenied } from "@/components/admin-support-dashboard";
import { getPlatformStaff } from "@/lib/platform-staff";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");

  const staff = await getPlatformStaff(auth.user.id);
  if (!staff) return <AdminAccessDenied userId={auth.user.id} email={auth.user.email || "Discord account"} />;

  return <AdminSupportDashboard
    email={auth.user.email || "Dexlyy staff"}
    role={staff.role}
    displayName={staff.display_name}
  />;
}

