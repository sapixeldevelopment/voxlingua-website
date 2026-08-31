import { getServerRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid, noStoreJson } from "@/lib/security";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Application not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("applications")
    .select("server_id,reviewed_by,reviewed_at,reviewer_role")
    .eq("id", id)
    .maybeSingle();
  if (!application) return noStoreJson({ error: "Application not found." }, { status: 404 });
  if (!(await getServerRole(application.server_id, auth.user.id))) {
    return noStoreJson({ error: "You are not allowed to review this application." }, { status: 403 });
  }
  if (!application.reviewed_by || !application.reviewed_at) {
    return noStoreJson({ reviewer: null });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", application.reviewed_by)
    .maybeSingle();

  return noStoreJson({
    reviewer: {
      displayName: profile?.display_name?.trim() || "Former staff member",
      reviewedAt: application.reviewed_at,
      role: application.reviewer_role || "reviewer",
    },
  });
}
