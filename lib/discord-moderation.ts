import "server-only";

import { isDiscordSnowflake } from "@/lib/discord";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { createAdminClient } from "@/lib/supabase/admin";

const DISCORD_EPOCH = BigInt("1420070400000");
const AUDIT_ACTIONS = [
  { actionType: 20, eventType: "kick" },
  { actionType: 22, eventType: "ban" },
  { actionType: 23, eventType: "unban" },
] as const;
const MAX_PAGES_PER_ACTION = 5;
const SYNC_FRESH_MS = 5 * 60 * 1_000;

type AuditLogEntry = {
  id?: unknown;
  target_id?: unknown;
  user_id?: unknown;
  action_type?: unknown;
  reason?: unknown;
};

type AuditLogUser = {
  id?: unknown;
  username?: unknown;
  global_name?: unknown;
};

type AuditLogPayload = {
  audit_log_entries?: unknown;
  users?: unknown;
};

export type DiscordModerationEvent = {
  id: string;
  eventType: "kick" | "ban" | "unban";
  moderatorDiscordUserId: string | null;
  moderatorName: string | null;
  reason: string | null;
  occurredAt: string;
};

export type DiscordModerationSummary = {
  score: number;
  level: "clear" | "watch" | "elevated" | "high";
  kickCount: number;
  banCount: number;
  unbanCount: number;
  currentlyBanned: boolean;
  recentIncidentCount: number;
  lastIncidentAt: string | null;
  events: DiscordModerationEvent[];
};

export type DiscordModerationSyncResult = {
  status: "synced" | "fresh" | "not_configured" | "missing_permission" | "rate_limited" | "failed";
  imported: number;
};

function auditLogTimestamp(id: string) {
  try {
    return new Date(Number((BigInt(id) >> BigInt(22)) + DISCORD_EPOCH)).toISOString();
  } catch {
    return null;
  }
}

async function updateSyncState(serverId: string, status: DiscordModerationSyncResult["status"], detail: string | null = null) {
  const admin = createAdminClient();
  await admin.from("discord_moderation_sync_state").upsert({
    server_id: serverId,
    last_synced_at: new Date().toISOString(),
    last_status: status,
    last_error: detail?.slice(0, 500) || null,
  }, { onConflict: "server_id" });
}

export async function syncDiscordModerationForServer(
  server: { id: string; discord_guild_id: string | null },
  options: { force?: boolean } = {},
): Promise<DiscordModerationSyncResult> {
  if (!process.env.DISCORD_BOT_TOKEN || !isDiscordSnowflake(server.discord_guild_id)) {
    return { status: "not_configured", imported: 0 };
  }

  const admin = createAdminClient();
  if (!options.force) {
    const { data: syncState } = await admin
      .from("discord_moderation_sync_state")
      .select("last_synced_at,last_status")
      .eq("server_id", server.id)
      .maybeSingle();
    const lastSyncedAt = syncState?.last_synced_at ? new Date(syncState.last_synced_at).getTime() : 0;
    if (lastSyncedAt && Date.now() - lastSyncedAt < SYNC_FRESH_MS) {
      const previousStatus = syncState?.last_status as DiscordModerationSyncResult["status"] | undefined;
      return { status: previousStatus === "synced" ? "fresh" : previousStatus || "fresh", imported: 0 };
    }
  }

  const latestByEvent = new Map<string, string>();
  const latestResults = await Promise.all(AUDIT_ACTIONS.map((action) => admin
    .from("discord_moderation_events")
    .select("discord_audit_log_id")
    .eq("server_id", server.id)
    .eq("event_type", action.eventType)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle()));
  latestResults.forEach((result, index) => {
    const id = result.data?.discord_audit_log_id;
    if (isDiscordSnowflake(id)) latestByEvent.set(AUDIT_ACTIONS[index].eventType, id);
  });

  let imported = 0;
  for (const action of AUDIT_ACTIONS) {
    let before: string | null = null;
    const latestKnownId = latestByEvent.get(action.eventType) || null;

    for (let page = 0; page < MAX_PAGES_PER_ACTION; page += 1) {
      const url = new URL(`https://discord.com/api/v10/guilds/${server.discord_guild_id}/audit-logs`);
      url.searchParams.set("action_type", String(action.actionType));
      url.searchParams.set("limit", "100");
      if (before) url.searchParams.set("before", before);

      const response = await fetch(url, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const status = response.status === 403
          ? "missing_permission"
          : response.status === 429
            ? "rate_limited"
            : "failed";
        await updateSyncState(server.id, status, `Discord audit log returned ${response.status}.`);
        return { status, imported };
      }

      const payload = await response.json().catch(() => null) as AuditLogPayload | null;
      const entries = Array.isArray(payload?.audit_log_entries)
        ? payload.audit_log_entries.filter((entry): entry is AuditLogEntry => Boolean(entry) && typeof entry === "object")
        : [];
      const users = Array.isArray(payload?.users)
        ? payload.users.filter((user): user is AuditLogUser => Boolean(user) && typeof user === "object")
        : [];
      const userNames = new Map<string, string>();
      users.forEach((user) => {
        if (!isDiscordSnowflake(user.id)) return;
        const name = typeof user.global_name === "string" && user.global_name.trim()
          ? user.global_name.trim()
          : typeof user.username === "string"
            ? user.username.trim()
            : "";
        if (name) userNames.set(user.id, name.slice(0, 100));
      });

      const reachedKnownHistory = latestKnownId !== null && entries.some((entry) => {
        if (!isDiscordSnowflake(entry.id)) return false;
        try {
          return BigInt(entry.id) <= BigInt(latestKnownId);
        } catch {
          return false;
        }
      });
      const rows = entries.flatMap((entry) => {
        if (!isDiscordSnowflake(entry.id) || !isDiscordSnowflake(entry.target_id) || entry.action_type !== action.actionType) return [];
        if (latestKnownId) {
          try {
            if (BigInt(entry.id) <= BigInt(latestKnownId)) return [];
          } catch {
            return [];
          }
        }
        const occurredAt = auditLogTimestamp(entry.id);
        if (!occurredAt) return [];
        const moderatorId = isDiscordSnowflake(entry.user_id) ? entry.user_id : null;
        return [{
          server_id: server.id,
          discord_user_id: entry.target_id,
          event_type: action.eventType,
          discord_audit_log_id: entry.id,
          moderator_discord_user_id: moderatorId,
          moderator_name: moderatorId ? userNames.get(moderatorId) || null : null,
          reason: typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim().slice(0, 512) : null,
          occurred_at: occurredAt,
        }];
      });

      if (rows.length) {
        const { error } = await admin
          .from("discord_moderation_events")
          .upsert(rows, { onConflict: "server_id,discord_audit_log_id", ignoreDuplicates: true });
        if (error) {
          await updateSyncState(server.id, "failed", error.message);
          return { status: "failed", imported };
        }
        imported += rows.length;
      }

      if (reachedKnownHistory || entries.length < 100) break;
      const oldestId = entries.at(-1)?.id;
      if (!isDiscordSnowflake(oldestId)) break;
      before = oldestId;
    }
  }

  await updateSyncState(server.id, "synced");
  return { status: "synced", imported };
}

export async function syncAllDiscordModeration() {
  const admin = createAdminClient();
  const { data: servers, error } = await admin
    .from("servers")
    .select("id")
    .eq("is_active", true);
  if (error) throw error;

  const results = [];
  for (const server of servers || []) {
    const connection = await getVerifiedDiscordConnection(server.id);
    results.push({ serverId: server.id, ...(await syncDiscordModerationForServer({ id: server.id, discord_guild_id: connection?.guild_id || null }, { force: true })) });
  }
  return results;
}

export function buildDiscordModerationSummary(rows: Array<{
  id: string;
  event_type: "kick" | "ban" | "unban";
  moderator_discord_user_id: string | null;
  moderator_name: string | null;
  reason: string | null;
  occurred_at: string;
}>): DiscordModerationSummary {
  const events = rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    moderatorDiscordUserId: row.moderator_discord_user_id,
    moderatorName: row.moderator_name,
    reason: row.reason,
    occurredAt: row.occurred_at,
  }));
  const kickCount = events.filter((event) => event.eventType === "kick").length;
  const banCount = events.filter((event) => event.eventType === "ban").length;
  const unbanCount = events.filter((event) => event.eventType === "unban").length;
  const latestBanEvent = events.find((event) => event.eventType === "ban" || event.eventType === "unban");
  const currentlyBanned = latestBanEvent?.eventType === "ban";
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1_000;
  const recentIncidentCount = events.filter((event) => event.eventType !== "unban" && new Date(event.occurredAt).getTime() >= recentCutoff).length;
  const score = Math.min(100, kickCount * 12 + banCount * 32 + (currentlyBanned ? 24 : 0) + Math.min(16, recentIncidentCount * 4));
  const level = score === 0 ? "clear" : score < 25 ? "watch" : score < 60 ? "elevated" : "high";

  return {
    score,
    level,
    kickCount,
    banCount,
    unbanCount,
    currentlyBanned,
    recentIncidentCount,
    lastIncidentAt: events.find((event) => event.eventType !== "unban")?.occurredAt || null,
    events: events.slice(0, 20),
  };
}
