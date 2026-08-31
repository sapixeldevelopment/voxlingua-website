import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { discordGuildMemberRoles, discordIdentity, getDiscordGuildMember, isDiscordSnowflake } from "@/lib/discord";
import { consumeRateLimit, isSafeSlug, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

type SubmissionBody = { slug?: string; form?: unknown };
type PublicField = {
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "select";
  options: unknown;
  is_required: boolean;
};

const OPEN_APPLICATION_STATUSES = [
  "pending",
  "interviewing",
  "under_review",
  "role_pending",
  "role_failed",
] as const;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must sign in with Discord first." }, { status: 401 });

  const slug = new URL(request.url).searchParams.get("slug");
  if (!isSafeSlug(slug)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const admin = createAdminClient();
  const { data: server } = await admin
    .from("servers")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!server) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const { data: existing } = await admin
    .from("applications")
    .select("id,status")
    .eq("server_id", server.id)
    .eq("applicant_user_id", auth.user.id)
    .in("status", [...OPEN_APPLICATION_STATUSES])
    .limit(1)
    .maybeSingle();
  if (existing) {
    let resumeSessionId: string | null = null;
    if (existing.status === "interviewing") {
      const { data: session } = await admin
        .from("interview_sessions")
        .select("id")
        .eq("application_id", existing.id)
        .maybeSingle();
      resumeSessionId = session?.id || null;
    }
    return noStoreJson({
      eligible: false,
      reason: "application_in_progress",
      resumeSessionId,
      error: existing.status === "interviewing"
        ? "You already started an application for this server. Continue that interview instead of creating another one."
        : "You already have an application awaiting this server's review.",
    }, { status: 409 });
  }

  const now = new Date();
  const { data: reapplyBlock } = await admin
    .from("application_reapply_blocks")
    .select("blocked_until")
    .eq("server_id", server.id)
    .eq("applicant_user_id", auth.user.id)
    .gt("blocked_until", now.toISOString())
    .maybeSingle();
  if (reapplyBlock?.blocked_until) {
    const availableAt = new Date(reapplyBlock.blocked_until);
    return noStoreJson({
      eligible: false,
      error: `Your previous application was declined. You can apply again on ${availableAt.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.`,
    }, { status: 429 });
  }

  const { data: previousApproval } = await admin
    .from("applications")
    .select("id")
    .eq("server_id", server.id)
    .eq("applicant_user_id", auth.user.id)
    .in("status", ["approved", "role_assigned"])
    .limit(1)
    .maybeSingle();

  return noStoreJson({ eligible: true, returningApplicant: Boolean(previousApproval) });
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must sign in with Discord first." }, { status: 401 });
  if (!(await consumeRateLimit(`application:${auth.user.id}`, 6, 3600))) {
    return noStoreJson({ error: "Too many application attempts. Please wait before trying again." }, { status: 429 });
  }
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(`application-ip:${forwardedFor}`, 20, 3600))) {
    return noStoreJson({ error: "Too many applications are being submitted from this connection. Please try again later." }, { status: 429 });
  }

  const body = await readJsonBody<SubmissionBody>(request, 32_768);
  if (!body || !isSafeSlug(body.slug) || !body.form || typeof body.form !== "object" || Array.isArray(body.form)) {
    return noStoreJson({ error: "Invalid application submission." }, { status: 400 });
  }
  const identity = discordIdentity(auth.user);
  if (!identity) return noStoreJson({ error: "This account is not authenticated through Discord." }, { status: 422 });

  const admin = createAdminClient();
  const { data: server } = await admin
    .from("servers")
    .select("id,owner_id,name,approved_role_id,is_active")
    .eq("slug", body.slug)
    .maybeSingle();
  const connection = server ? await getVerifiedDiscordConnection(server.id) : null;
  if (!server?.is_active || !connection || !isDiscordSnowflake(connection.guild_id)) {
    return noStoreJson({ error: "This portal is unavailable or Discord verification is not configured." }, { status: 404 });
  }

  const { data: billing } = await admin
    .from("owner_billing")
    .select("status,subscription_period_end")
    .eq("user_id", server.owner_id)
    .maybeSingle();
  const paidThrough = billing?.subscription_period_end ? new Date(`${billing.subscription_period_end}T00:00:00Z`) : null;
  const accessible = billing?.status === "active" || (billing?.status === "suspended" && paidThrough !== null && paidThrough > new Date());
  if (!accessible) return noStoreJson({ error: "This portal is closed." }, { status: 403 });

  const membership = await getDiscordGuildMember(connection.guild_id, identity.id);
  if (!membership.configured) return noStoreJson({ error: "Discord verification is not configured." }, { status: 503 });
  if (!membership.response?.ok) {
    return noStoreJson({ error: membership.response?.status === 404 ? "You must join this Discord server before applying." : "Discord membership could not be verified." }, { status: membership.response?.status === 404 ? 403 : 502 });
  }
  const memberRoles = await discordGuildMemberRoles(membership.response);
  if (isDiscordSnowflake(server.approved_role_id) && memberRoles.includes(server.approved_role_id)) {
    return noStoreJson({
      error: "You’re already approved for this server. Your Discord role is active, so you cannot submit another application.",
      reason: "already_approved",
    }, { status: 409 });
  }

  const { data: fieldRows, error: fieldsError } = await admin
    .from("application_fields")
    .select("field_key,label,field_type,options,is_required")
    .eq("server_id", server.id)
    .eq("is_active", true)
    .order("order_index");
  if (fieldsError || !fieldRows?.length || fieldRows.length > 50) {
    return noStoreJson({ error: "This portal does not have a valid application form." }, { status: 422 });
  }

  const submitted = body.form as Record<string, unknown>;
  const fields = fieldRows as PublicField[];
  const allowedKeys = new Set(fields.map((field) => field.field_key));
  if (Object.keys(submitted).some((key) => !allowedKeys.has(key))) {
    return noStoreJson({ error: "The application contains an unknown field." }, { status: 400 });
  }

  const form: Record<string, string> = {};
  let totalLength = 0;
  for (const field of fields) {
    const rawValue = submitted[field.field_key];
    if (rawValue !== undefined && typeof rawValue !== "string") {
      return noStoreJson({ error: `${field.label} has an invalid value.` }, { status: 400 });
    }
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const maxLength = field.field_type === "textarea" ? 4_000 : 300;
    if (field.is_required && !value) return noStoreJson({ error: `${field.label} is required.` }, { status: 400 });
    if (value.length > maxLength) return noStoreJson({ error: `${field.label} is too long.` }, { status: 400 });
    if (field.field_type === "select" && value) {
      const options = Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
      if (!options.includes(value)) return noStoreJson({ error: `${field.label} has an invalid option.` }, { status: 400 });
    }
    totalLength += value.length;
    form[field.field_key] = value;
  }
  if (totalLength > 12_000) return noStoreJson({ error: "The application is too large." }, { status: 413 });

  const { data: existing } = await admin
    .from("applications")
    .select("id,status")
    .eq("server_id", server.id)
    .eq("applicant_user_id", auth.user.id)
    .in("status", [...OPEN_APPLICATION_STATUSES])
    .limit(1)
    .maybeSingle();
  if (existing) {
    const message = existing.status === "interviewing"
      ? "You already started an application for this Discord server. Finish or restart that interview instead of creating another one."
      : "You already have an application awaiting this server's review. You cannot submit another one yet.";
    return noStoreJson({ error: message, reason: "application_in_progress" }, { status: 409 });
  }

  const now = new Date();
  const { data: reapplyBlock } = await admin
    .from("application_reapply_blocks")
    .select("blocked_until")
    .eq("server_id", server.id)
    .eq("applicant_user_id", auth.user.id)
    .gt("blocked_until", now.toISOString())
    .maybeSingle();
  if (reapplyBlock?.blocked_until) {
    const availableAt = new Date(reapplyBlock.blocked_until);
    const retryAfter = Math.max(1, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));
    return noStoreJson(
      { error: `Your previous application was declined. You can apply to this server again on ${availableAt.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const playerName = form.player_name || identity.username || "Discord applicant";
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .insert({
      server_id: server.id,
      applicant_user_id: auth.user.id,
      discord_user_id: identity.id,
      discord_username: identity.username,
      player_name: playerName.slice(0, 300),
      game_name: form.game_name?.slice(0, 300) || null,
      experience: form.experience?.slice(0, 4_000) || null,
      form_data: form,
      status: "interviewing",
    })
    .select("id")
    .single();
  if (applicationError || !application) {
    if (applicationError?.code === "23505") {
      return noStoreJson({ error: "You already have an application in progress for this Discord server." }, { status: 409 });
    }
    return noStoreJson({ error: "The application could not be created." }, { status: 500 });
  }

  const { data: session, error: sessionError } = await admin
    .from("interview_sessions")
    .insert({ application_id: application.id, server_id: server.id, status: "created" })
    .select("id")
    .single();
  if (sessionError || !session) {
    await admin.from("applications").delete().eq("id", application.id);
    return noStoreJson({ error: "The interview room could not be created." }, { status: 500 });
  }

  return noStoreJson({ ok: true, sessionId: session.id }, { status: 201 });
}
