import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPlatformStaff } from "@/lib/platform-staff";
import { consumeRateLimit, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
type TicketStatus = (typeof STATUSES)[number];

type UpdateTicketBody = {
  id?: unknown;
  status?: unknown;
  supportNotes?: unknown;
};

async function authorizeSupport() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const staff = await getPlatformStaff(auth.user.id);
  return staff ? { user: auth.user, staff } : null;
}

export async function GET() {
  const access = await authorizeSupport();
  if (!access) return noStoreJson({ error: "Dexlyy support access is required." }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("owner_feedback")
    .select("id,owner_id,submitter_email,category,subject,message,page_path,status,support_notes,created_at,updated_at,updated_by")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return noStoreJson({ error: "The support queue could not be loaded." }, { status: 500 });
  return noStoreJson({ tickets: data || [], staff: access.staff });
}

export async function PATCH(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  const access = await authorizeSupport();
  if (!access) return noStoreJson({ error: "Dexlyy support access is required." }, { status: 403 });
  if (!(await consumeRateLimit(`platform-feedback:${access.user.id}`, 180, 3600))) {
    return noStoreJson({ error: "Too many ticket updates. Please wait a moment." }, { status: 429 });
  }

  const body = await readJsonBody<UpdateTicketBody>(request, 8_000);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status;
  const supportNotes = typeof body?.supportNotes === "string" ? body.supportNotes.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    || typeof status !== "string"
    || !STATUSES.includes(status as TicketStatus)
    || supportNotes.length > 5000) {
    return noStoreJson({ error: "Choose a valid status and keep internal notes under 5,000 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("owner_feedback")
    .update({
      status,
      support_notes: supportNotes,
      updated_at: new Date().toISOString(),
      updated_by: access.user.id,
    })
    .eq("id", id)
    .select("id,owner_id,submitter_email,category,subject,message,page_path,status,support_notes,created_at,updated_at,updated_by")
    .single();

  if (error || !data) return noStoreJson({ error: "The ticket could not be updated." }, { status: 500 });
  return noStoreJson({ ticket: data });
}

