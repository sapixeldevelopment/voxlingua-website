import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const RECORDINGS_BUCKET = "interview-recordings";
const FINAL_STATUSES = ["approved", "declined", "role_assigned"];
const CLEANUP_BATCH_SIZE = 100;
const MAX_BATCHES_PER_RUN = 20;

export type RetentionCleanupResult = {
  applicationsDeleted: number;
  recordingsDeleted: number;
};

export async function cleanupServerApplicationHistory(
  serverId: string,
  configuredRetentionDays?: number,
): Promise<RetentionCleanupResult> {
  const admin = createAdminClient();
  let retentionDays = configuredRetentionDays;

  if (retentionDays === undefined) {
    const { data: server, error } = await admin
      .from("servers")
      .select("application_retention_days")
      .eq("id", serverId)
      .maybeSingle();
    if (error) throw error;
    retentionDays = server?.application_retention_days;
  }

  if (!retentionDays || retentionDays < 1) {
    await admin
      .from("application_reapply_blocks")
      .delete()
      .eq("server_id", serverId)
      .lte("blocked_until", new Date().toISOString());
    return { applicationsDeleted: 0, recordingsDeleted: 0 };
  }

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const total: RetentionCleanupResult = { applicationsDeleted: 0, recordingsDeleted: 0 };
  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const { data: sessions, error: sessionsError } = await admin
      .from("interview_sessions")
      .select("id,recording_path,applications!inner(status,reviewed_at)")
      .eq("server_id", serverId)
      .not("recording_path", "is", null)
      .in("applications.status", FINAL_STATUSES)
      .lt("applications.reviewed_at", cutoff)
      .order("completed_at", { ascending: true })
      .limit(CLEANUP_BATCH_SIZE);
    if (sessionsError) throw sessionsError;
    if (!sessions?.length) break;

    const recordingPaths = Array.from(
      new Set(
        (sessions || [])
          .map((session) => session.recording_path)
          .filter((path): path is string => Boolean(path)),
      ),
    );
    if (recordingPaths.length) {
      const { error: recordingError } = await admin.storage
        .from(RECORDINGS_BUCKET)
        .remove(recordingPaths);
      if (recordingError) throw recordingError;
    }

    const { error: updateError } = await admin
      .from("interview_sessions")
      .update({ recording_path: null, recording_deleted_at: new Date().toISOString() })
      .in("id", sessions.map((session) => session.id));
    if (updateError) throw updateError;

    total.recordingsDeleted += recordingPaths.length;
    if (sessions.length < CLEANUP_BATCH_SIZE) break;
  }

  await admin
    .from("application_reapply_blocks")
    .delete()
    .eq("server_id", serverId)
    .lte("blocked_until", new Date().toISOString());

  return total;
}

export async function cleanupAllApplicationHistory(): Promise<RetentionCleanupResult> {
  const admin = createAdminClient();
  const { data: servers, error } = await admin
    .from("servers")
    .select("id,application_retention_days");
  if (error) throw error;

  const total: RetentionCleanupResult = { applicationsDeleted: 0, recordingsDeleted: 0 };
  for (const server of servers || []) {
    const result = await cleanupServerApplicationHistory(
      server.id,
      server.application_retention_days,
    );
    total.applicationsDeleted += result.applicationsDeleted;
    total.recordingsDeleted += result.recordingsDeleted;
  }
  return total;
}
