import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isGuidedPlan } from "@/lib/billing";
import { isUuid } from "@/lib/security";

export async function guidedAccess(id: string) {
  if (!isUuid(id)) throw new Error("Interview not found.");
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Please sign in.");
  const admin = createAdminClient();
  const { data: session, error } = await admin.from("interview_sessions").select("*").eq("id", id).maybeSingle();
  if (error || !session || session.interview_mode !== "guided") throw new Error("Guided interview not found.");
  const { data: application } = await admin.from("applications").select("applicant_user_id").eq("id", session.application_id).maybeSingle();
  if (application?.applicant_user_id !== auth.user.id) throw new Error("Interview not found.");
  const { data: server } = await admin.from("servers").select("owner_id,is_active").eq("id", session.server_id).maybeSingle();
  if (!server?.is_active) throw new Error("This portal is closed.");
  const { data: billing } = await admin.from("owner_billing").select("*").eq("user_id", server.owner_id).maybeSingle();
  const accessible = billing?.status === "active" || (billing?.status === "suspended" && billing.subscription_period_end > new Date().toISOString().slice(0,10));
  if (!billing || !accessible || !isGuidedPlan(billing.plan_key)) throw new Error("This portal needs an active Guided Voice plan.");
  const used = billing.monthly_period_end <= new Date().toISOString().slice(0,10) ? 0 : billing.monthly_interviews_used;
  if (session.status !== "completed" && used >= billing.monthly_interview_limit) throw new Error("No interview credits remaining.");
  return { admin, session, user: auth.user, ownerId: server.owner_id, planKey:billing.plan_key };
}
