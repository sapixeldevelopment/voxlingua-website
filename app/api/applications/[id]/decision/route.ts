import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { getServerRole } from "@/lib/access";
import { isDiscordSnowflake } from "@/lib/discord";
import { sendDiscordWebhook } from "@/lib/discord-webhook";
import { consumeRateLimit, isUuid, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

type DecisionBody = { decision?: "approved" | "declined"; additionalRoleIds?: unknown };

function roleAssignmentError(status: number) {
  if (status === 401) return "The Discord bot token is invalid or has expired.";
  if (status === 403) return "Discord rejected the role assignment. Give the bot Manage Roles permission and move its highest role above the approved role.";
  if (status === 404) return "Discord could not find the server, approved role, or applicant.";
  if (status === 429) return "Discord temporarily rate-limited the role assignment. Please retry in a moment.";
  return `Discord role assignment failed (${status}).`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Application not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`decision:${auth.user.id}`, 60, 600))) {
    return noStoreJson({ error: "Too many decision requests. Please wait a moment." }, { status: 429 });
  }
  const body = await readJsonBody<DecisionBody>(request, 2_048);
  if (!body || !["approved", "declined"].includes(body.decision || "")) {
    return noStoreJson({ error: "Invalid application decision." }, { status: 400 });
  }
  const additionalRoleIds = body.additionalRoleIds === undefined
    ? []
    : Array.isArray(body.additionalRoleIds) && body.additionalRoleIds.length <= 25 && body.additionalRoleIds.every((roleId) => typeof roleId === "string" && isUuid(roleId))
      ? body.additionalRoleIds as string[]
      : null;
  if (!additionalRoleIds) {
    return noStoreJson({ error: "Invalid additional Discord roles." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("applications")
    .select("id,server_id,discord_user_id,discord_username,player_name,status")
    .eq("id", id)
    .maybeSingle();
  if (!application) return noStoreJson({ error: "Application not found." }, { status: 404 });
  const reviewerRole = await getServerRole(application.server_id, auth.user.id);
  if (!reviewerRole) {
    return noStoreJson({ error: "You are not allowed to review this application." }, { status: 403 });
  }
  if (application.status === "interviewing") {
    return noStoreJson({ error: "This application has not been submitted yet." }, { status: 409 });
  }
  if (["approved", "declined", "role_assigned"].includes(application.status)) {
    return noStoreJson({ ok: true, status: application.status, alreadyDecided: true });
  }

  const reviewedAt = new Date().toISOString();
  if (body.decision === "declined") {
    const { error } = await admin.from("applications").update({ status: "declined", reviewed_by: auth.user.id, reviewed_at: reviewedAt, reviewer_role: reviewerRole, role_error: null }).eq("id", id);
    if (error) return noStoreJson({ error: "The decision could not be saved." }, { status: 500 });
    await admin.from("audit_logs").insert({ server_id: application.server_id, actor_user_id: auth.user.id, action: "application_declined", entity_type: "application", entity_id: id });
    const notification = await sendDiscordWebhook(application.server_id, {
      embeds: [{
        title: "Application declined",
        description: "An application has been declined by the review team.",
        color: 0xc94b61,
        fields: [
          { name: "Applicant", value: (application.player_name || "Discord applicant").slice(0, 256), inline: true },
          { name: "Discord", value: application.discord_username ? `@${application.discord_username}`.slice(0, 256) : "Not provided", inline: true },
          { name: "Status", value: "Declined", inline: true },
        ],
        timestamp: reviewedAt,
        footer: { text: "Dexlyy applications" },
      }],
    });
    if (notification.configured && !notification.ok) console.warn("Discord decline notification failed", { serverId: application.server_id, status: notification.status });
    return noStoreJson({ ok: true, status: "declined", reviewedAt, reviewerRole });
  }

  const { data: server } = await admin.from("servers").select("name,approved_role_id,approved_role_name").eq("id", application.server_id).maybeSingle();
  const connection = server ? await getVerifiedDiscordConnection(application.server_id) : null;
  if (!server || !connection || !isDiscordSnowflake(connection.guild_id) || !isDiscordSnowflake(server.approved_role_id) || !isDiscordSnowflake(application.discord_user_id) || !process.env.DISCORD_BOT_TOKEN) {
    return noStoreJson({ error: "Discord role assignment is not configured correctly." }, { status: 422 });
  }

  const { data: configuredRoles, error: configuredRolesError } = additionalRoleIds.length
    ? await admin.from("server_additional_roles").select("id,role_id,name").eq("server_id", application.server_id).in("id", additionalRoleIds)
    : { data: [], error: null };
  if (configuredRolesError || configuredRoles.length !== new Set(additionalRoleIds).size) {
    return noStoreJson({ error: "One or more selected Discord roles are no longer configured for this portal." }, { status: 400 });
  }
  const rolesToAssign = [
    { roleId: server.approved_role_id, name: server.approved_role_name || "Approved" },
    ...configuredRoles.filter((role) => role.role_id !== server.approved_role_id).map((role) => ({ roleId: role.role_id, name: role.name })),
  ];

  await admin.from("applications").update({ status: "role_pending", reviewed_by: auth.user.id, reviewed_at: reviewedAt, reviewer_role: reviewerRole, role_error: null }).eq("id", id);
  for (const role of rolesToAssign) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${connection.guild_id}/members/${application.discord_user_id}/roles/${role.roleId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "X-Audit-Log-Reason": `Dexlyy application approved · ${role.name}`.slice(0, 90) },
    });
    if (!response.ok) {
      const message = `${roleAssignmentError(response.status)} Could not add the “${role.name}” role.`;
      await admin.from("applications").update({ status: "role_failed", role_error: message }).eq("id", id);
      return noStoreJson({ error: message, status: "role_failed" }, { status: 502 });
    }
    await admin.from("audit_logs").insert({ server_id: application.server_id, actor_user_id: auth.user.id, action: "discord_role_assigned", entity_type: "application", entity_id: id });
  }

  const { error: statusError } = await admin.from("applications").update({ status: "role_assigned", role_error: null }).eq("id", id);
  if (statusError) return noStoreJson({ error: "The role was assigned, but the application status could not be updated." }, { status: 500 });
  const notification = await sendDiscordWebhook(application.server_id, {
    embeds: [{
      title: "Application approved",
      description: `An application has been approved for **${server.name || "this server"}**.`,
      color: 0x27845f,
      fields: [
        { name: "Applicant", value: (application.player_name || "Discord applicant").slice(0, 256), inline: true },
        { name: "Discord", value: application.discord_username ? `@${application.discord_username}`.slice(0, 256) : "Not provided", inline: true },
        { name: "Roles", value: rolesToAssign.map((role) => role.name).join(", ").slice(0, 1_024), inline: true },
      ],
      timestamp: reviewedAt,
      footer: { text: "Dexlyy applications" },
    }],
  });
  if (notification.configured && !notification.ok) console.warn("Discord approval notification failed", { serverId: application.server_id, status: notification.status });
  return noStoreJson({ ok: true, status: "role_assigned", reviewedAt, reviewerRole });
}
