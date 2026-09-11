"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AudioWaveform, Ban, BrainCircuit, CalendarClock, Check, FileText, Gavel, Headphones, History, MessageCircle, ShieldAlert, ShieldCheck, Sparkles, Trash2, UserCheck, UserMinus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Application, ApplicationField, InterviewAssessment, InterviewSession, Server, ServerAdditionalRole } from "@/lib/types";
import ConfirmModal from "@/components/confirm-modal";
import ReviewCollaboration from "@/components/review-collaboration";

type ModerationEvent = {
  id: string;
  eventType: "kick" | "ban" | "unban";
  moderatorDiscordUserId: string | null;
  moderatorName: string | null;
  reason: string | null;
  occurredAt: string;
};

type ModerationSummary = {
  score: number;
  level: "clear" | "watch" | "elevated" | "high";
  kickCount: number;
  banCount: number;
  unbanCount: number;
  currentlyBanned: boolean;
  recentIncidentCount: number;
  lastIncidentAt: string | null;
  events: ModerationEvent[];
};

function AssessmentScore({ icon, label, score, detail }: { icon: React.ReactNode; label: string; score: number | null; detail: string }) {
  const normalized = score ?? 0;
  return <div className="assessment-score-card">
    <div className="assessment-score-heading"><span>{icon}</span><small>{label}</small></div>
    <div className="assessment-score-value"><strong>{score ?? "—"}</strong>{score !== null && <span>/100</span>}</div>
    <span className="assessment-score-track"><span style={{ width: `${normalized}%` }} /></span>
    <p>{detail}</p>
  </div>;
}

export default function ApplicationReview({ applicationId }: { applicationId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [application, setApplication] = useState<Application | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [server, setServer] = useState<Server | null>(null);
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [canDeleteHistory, setCanDeleteHistory] = useState(false);
  const [reviewer, setReviewer] = useState<{ displayName: string; reviewedAt: string; role: string } | null>(null);
  const [assessment, setAssessment] = useState<InterviewAssessment | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(true);
  const [moderation, setModeration] = useState<ModerationSummary | null>(null);
  const [moderationStatus, setModerationStatus] = useState("");
  const [moderationLoading, setModerationLoading] = useState(true);
  const [additionalRoles, setAdditionalRoles] = useState<ServerAdditionalRole[]>([]);
  const [selectedAdditionalRoleIds, setSelectedAdditionalRoleIds] = useState<string[]>([]);

  useEffect(() => {
    void load();
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;
    const loadModeration = async () => {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/moderation`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as { monitoringStatus?: string; summary?: ModerationSummary | null } | null;
      if (cancelled) return;
      setModeration(response.ok ? result?.summary || null : null);
      setModerationStatus(response.ok ? result?.monitoringStatus || "failed" : "failed");
      setModerationLoading(false);
    };
    void loadModeration();
    return () => { cancelled = true; };
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loadAssessment = async () => {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/analysis`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as { assessment?: InterviewAssessment | null } | null;
      if (cancelled) return;
      setAssessment(response.ok ? result?.assessment || null : null);
      setAssessmentLoading(false);
      if (response.ok && result?.assessment && ["pending", "processing"].includes(result.assessment.status)) {
        timer = setTimeout(loadAssessment, 4_000);
      }
    };
    void loadAssessment();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId]);

  async function load() {
    setLoading(true);
    setError("");
    const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo") || "";
    if (/^\/dashboard\/servers\/[^/?#]+$/.test(requestedReturnTo)) setReturnTo(requestedReturnTo);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.href = `/login?next=/dashboard/applications/${applicationId}`;
      return;
    }
    const { data: applicationData, error: applicationError } = await supabase.from("applications").select("*").eq("id", applicationId).maybeSingle();
    if (applicationError || !applicationData) {
      setError(applicationError?.message || "Application not found.");
      setLoading(false);
      return;
    }
    const loadedApplication = applicationData as Application;
    setApplication(loadedApplication);
    const [{ data: sessionData, error: sessionError }, { data: serverData, error: serverError }, { data: fieldData, error: fieldError }, { data: memberData }, { data: additionalRoleData, error: additionalRoleError }] = await Promise.all([
      supabase.from("interview_sessions").select("*").eq("application_id", applicationId).maybeSingle(),
      supabase.from("servers").select("*").eq("id", loadedApplication.server_id).maybeSingle(),
      supabase.from("application_fields").select("*").eq("server_id", loadedApplication.server_id).order("order_index"),
      supabase.from("server_members").select("role").eq("server_id", loadedApplication.server_id).eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("server_additional_roles").select("*").eq("server_id", loadedApplication.server_id).order("name"),
    ]);
    if (sessionError || serverError || fieldError || additionalRoleError) {
      setError(sessionError?.message || serverError?.message || fieldError?.message || additionalRoleError?.message || "Could not load the review.");
    }
    const loadedSession = sessionData as InterviewSession | null;
    setSession(loadedSession);
    setServer(serverData as Server | null);
    setFields((fieldData || []) as ApplicationField[]);
    setAdditionalRoles((additionalRoleData || []) as ServerAdditionalRole[]);
    setCanDeleteHistory(memberData?.role === "owner" || memberData?.role === "admin");
    setRecordingUrl(loadedSession?.recording_path ? `/api/applications/${applicationId}/recording` : "");
    if (loadedApplication.reviewed_by) {
      const reviewerResponse = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/reviewer`);
      const reviewerResult = await reviewerResponse.json().catch(() => null) as { reviewer?: { displayName: string; reviewedAt: string; role: string } | null } | null;
      setReviewer(reviewerResponse.ok ? reviewerResult?.reviewer || null : null);
    } else {
      setReviewer(null);
    }
    setLoading(false);
  }

  async function removeFinalizedApplication() {
    if (!application) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/applications/${encodeURIComponent(application.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setError(result?.error || "The application history could not be deleted.");
      setBusy(false);
      return;
    }
    setConfirmDelete(false);
    window.location.href = returnTo || (server ? `/dashboard/servers/${server.id}` : "/dashboard");
  }

  async function decide(decision: "approved" | "declined") {
    if (!application) return;
    setBusy(true);
    setError("");
    const decisionResponse = await fetch(`/api/applications/${encodeURIComponent(application.id)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, additionalRoleIds: decision === "approved" ? selectedAdditionalRoleIds : [] }),
    });
    const result = await decisionResponse.json().catch(() => null) as { status?: Application["status"]; error?: string } | null;
    if (!decisionResponse.ok) {
      setError(result?.error || "The decision could not be saved.");
      if (result?.status) setApplication((current) => current ? { ...current, status: result.status!, role_error: result.error || null } : current);
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (loading) return <main className="review-page"><div className="review-loading">Loading application review…</div></main>;
  if (!application) return <main className="review-page"><div className="review-loading"><div className="form-error">{error || "Application unavailable."}</div><Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link></div></main>;

  const submitted = application.form_data || {};
  const knownKeys = new Set(fields.map((field) => field.field_key));
  const values = fields.filter((field) => submitted[field.field_key] !== undefined).map((field) => ({ label: field.label, value: submitted[field.field_key] || "—" }));
  Object.entries(submitted).filter(([key]) => !knownKeys.has(key)).forEach(([key, value]) => values.push({ label: key.replaceAll("_", " "), value: value || "—" }));
  if (!values.length) {
    values.push({ label: "Player name", value: application.player_name || "—" }, { label: "Character name", value: application.game_name || "—" }, { label: "Experience", value: application.experience || "—" });
  }
  const transcript = session?.transcript || [];
  const decided = ["approved", "declined", "role_assigned"].includes(application.status);
  const backHref = returnTo || (server ? `/dashboard/servers/${server.id}` : "/dashboard");
  const selectableAdditionalRoles = additionalRoles.filter((role) => role.role_id !== server?.approved_role_id);
  const applicantName = application.player_name || application.discord_username || "Applicant";
  const applicantInitials = applicantName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
  const submittedAt = new Date(application.created_at);
  const statusLabel = application.status.replaceAll("_", " ");
  const interviewState = session?.status === "completed" ? "Interview complete" : session?.status === "in_progress" ? "Interview in progress" : "Awaiting interview";
  const moderationMonitoringLimited = ["missing_permission", "not_configured", "failed", "rate_limited"].includes(moderationStatus);
  const moderationEvidenceAvailable = Boolean(moderation && (moderation.events.length > 0 || !moderationMonitoringLimited));

  return <main className="review-page">
    <header className="review-header"><Link href="/dashboard" className="brand"><span className="brand-mark" />Dexlyy</Link><Link href={backHref} className="btn btn-ghost btn-small"><ArrowLeft size={14} /> Back to portal</Link></header>
    <section className="review-shell">
      <section className="review-hero">
        <div className="review-applicant-avatar" aria-hidden="true">{applicantInitials}</div>
        <div className="review-hero-copy">
          <span className="eyebrow">Application review</span>
          <h1>{applicantName}</h1>
          <div className="review-hero-meta">
            <span><ShieldCheck size={14} /> {server?.name || "Community"}</span>
            <span><CalendarClock size={14} /> Submitted {submittedAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} at {submittedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
            <span><MessageCircle size={14} /> {application.discord_username ? `@${application.discord_username}` : "Discord not connected"}</span>
          </div>
        </div>
        <div className="review-hero-status">
          <small>Application status</small>
          <span className={`pill ${application.status === "declined" ? "pill-red" : decided ? "pill-green" : "pill-orange"}`}>{statusLabel}</span>
          <span>{interviewState}</span>
        </div>
      </section>
      {error && <div className="form-error" style={{ marginBottom: 18 }}>{error}</div>}
      <section className={`moderation-panel moderation-level-${moderationEvidenceAvailable ? moderation?.level || "clear" : "clear"}`}>
        <div className="moderation-panel-heading">
          <div>
            <span className="eyebrow"><ShieldAlert size={12} /> Community safety history</span>
            <h2>Verified Discord moderation signals</h2>
            <p>Confirmed kicks, bans, and unbans from this Discord server’s audit log. Voluntary leaves are never counted.</p>
          </div>
          {!moderationLoading && moderation && <span className={`moderation-level-badge level-${moderationMonitoringLimited ? "watch" : moderation.level}`}>{moderationMonitoringLimited ? "Monitoring limited" : moderation.level === "clear" ? "No incidents" : `${moderation.level} caution`}</span>}
        </div>

        {moderationLoading ? <div className="moderation-loading"><span className="assessment-spinner" /><div><strong>Checking server history</strong><p>Dexlyy is matching this Discord account against retained moderation records.</p></div></div> : <>
          {["missing_permission", "not_configured", "failed", "rate_limited"].includes(moderationStatus) && <div className="moderation-sync-warning">
            <ShieldAlert size={17} />
            <div><strong>{moderationStatus === "missing_permission" ? "Discord audit access is missing" : moderationStatus === "not_configured" ? "Moderation monitoring is not configured" : "Live Discord history could not be refreshed"}</strong><p>{moderationStatus === "missing_permission" ? "Give the Dexlyy bot the View Audit Log permission. Previously synchronized records are still shown below." : moderationStatus === "not_configured" ? "Connect the Discord bot to begin retaining moderation history." : "Previously synchronized records are still available. Dexlyy will try again during the next scheduled sync."}</p></div>
          </div>}

          {moderationEvidenceAvailable && moderation ? <div className="moderation-content">
            <div className="moderation-score-card">
              <div className="moderation-score-top"><span><ShieldAlert size={19} /></span><small>Moderation caution</small></div>
              <div className="moderation-score-value"><strong>{moderation.score}</strong><span>/100</span></div>
              <span className="moderation-score-track"><span style={{ width: `${moderation.score}%` }} /></span>
              <p>12 per kick · 32 per ban · +24 while actively banned · up to +16 for incidents in the last 90 days. It never makes the final decision.</p>
            </div>
            <div className="moderation-stat-grid">
              <div><span className="moderation-stat-icon kick"><UserMinus size={17} /></span><small>Confirmed kicks</small><strong>{moderation.kickCount}</strong><p>Administrative removals only</p></div>
              <div><span className="moderation-stat-icon ban"><Ban size={17} /></span><small>Total bans</small><strong>{moderation.banCount}</strong><p>{moderation.unbanCount} recorded unban{moderation.unbanCount === 1 ? "" : "s"}</p></div>
              <div><span className={`moderation-stat-icon ${moderation.currentlyBanned ? "ban" : "clear"}`}><Gavel size={17} /></span><small>Latest ban status</small><strong>{moderation.currentlyBanned ? "Banned (recorded)" : "No active ban recorded"}</strong><p>{moderation.recentIncidentCount} incident{moderation.recentIncidentCount === 1 ? "" : "s"} in 90 days</p></div>
            </div>
          </div> : <div className="moderation-unavailable"><History size={19} /><div><strong>{moderationMonitoringLimited ? "No reliable moderation history available yet" : "No Discord identity available"}</strong><p>{moderationMonitoringLimited ? "Fix the Discord bot permission or connection before treating an empty history as a clean record." : "Moderation history can only be matched when the applicant authenticated with Discord."}</p></div></div>}

          {moderationEvidenceAvailable && moderation && <div className="moderation-event-section">
            <div className="moderation-event-heading"><div><History size={15} /><strong>Incident record</strong></div><span>{moderation.events.length} captured event{moderation.events.length === 1 ? "" : "s"}</span></div>
            {moderation.events.length ? <div className="moderation-event-list">{moderation.events.map((event) => <article className={`moderation-event event-${event.eventType}`} key={event.id}>
              <span className="moderation-event-icon">{event.eventType === "kick" ? <UserMinus size={16} /> : event.eventType === "ban" ? <Ban size={16} /> : <Check size={16} />}</span>
              <div className="moderation-event-copy"><div><strong>{event.eventType === "kick" ? "Kicked from server" : event.eventType === "ban" ? "Banned from server" : "Ban removed"}</strong><time>{new Date(event.occurredAt).toLocaleString()}</time></div><p>{event.reason || "No moderation reason was recorded in Discord."}</p><small>{event.moderatorName ? `Action by ${event.moderatorName}` : "Moderator identity unavailable"}</small></div>
            </article>)}</div> : <div className="moderation-clear-state"><ShieldCheck size={20} /><div><strong>No captured moderation incidents</strong><p>Dexlyy has not found a confirmed kick or ban for this player in this server’s synchronized history.</p></div></div>}
          </div>}

          <div className="moderation-disclaimer"><ShieldCheck size={15} /><span><strong>Use context, not the score alone.</strong> Reasons may be incomplete and an unban can indicate a reversed decision. Review the event history and interview before deciding.</span></div>
        </>}
      </section>
      <ReviewCollaboration applicationId={applicationId} />
      {session?.interview_mode !== "guided" && (assessmentLoading || assessment) && <section className="assessment-panel">
        <div className="assessment-panel-heading">
          <div><span className="eyebrow"><Sparkles size={12} /> AI interview signals</span><h2>Evidence to support your review</h2><p>These indicators summarize what was said and heard. They are not facts, identity checks, or an automatic decision.</p></div>
          {assessment?.status === "completed" && <span className="assessment-confidence">{assessment.confidence || "low"} confidence</span>}
        </div>
        {assessmentLoading || assessment?.status === "pending" || assessment?.status === "processing"
          ? <div className="assessment-processing"><span className="assessment-spinner" /><div><strong>Review signals are being prepared</strong><p>Transcript and audio checks usually finish shortly after submission.</p></div></div>
          : assessment?.status === "failed"
            ? <div className="assessment-unavailable"><BrainCircuit size={18} /><div><strong>Signals are unavailable for this interview</strong><p>Review the application, transcript, and recording directly. Your final decision controls the outcome.</p></div></div>
            : assessment?.status === "completed" && <>
              <div className="assessment-score-grid">
                <AssessmentScore icon={<Sparkles size={16} />} label="Interview quality" score={assessment.overallScore} detail="Completeness, relevance, and overall strength of the interview." />
                <AssessmentScore icon={<ShieldCheck size={16} />} label="Rules understanding" score={assessment.rulesScore} detail="Evidence that answers align with configured rules and scenarios." />
                <AssessmentScore icon={<MessageCircle size={16} />} label="Communication" score={assessment.communicationScore} detail="Clarity, responsiveness, and ability to explain decisions." />
                <AssessmentScore icon={<BrainCircuit size={16} />} label="Communication maturity" score={assessment.maturityScore} detail="Respect, accountability, patience, and judgment—not an age estimate." />
              </div>
              <div className="assessment-detail-grid">
                <div className="assessment-summary"><span>Assessment summary</span><p>{assessment.summary || "No summary was produced."}</p><div className="assessment-evidence-columns"><div><strong>Positive signals</strong>{assessment.strengths.length ? <ul>{assessment.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No strong positive signal identified.</p>}</div><div><strong>Points to verify</strong>{assessment.concerns.length ? <ul>{assessment.concerns.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No material concern identified.</p>}</div></div>{assessment.rulesEvidence.length > 0 && <div className="assessment-rules-evidence"><strong>Rules evidence</strong><ul>{assessment.rulesEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div>
                <div className={`assessment-voice ${assessment.voiceAnalysisResult === "possible_alteration" ? "flagged" : ""}`}><span className="assessment-voice-icon"><AudioWaveform size={19} /></span><small>Audio alteration signal</small>{assessment.voiceAlterationScore !== null ? <><strong>{assessment.voiceAlterationScore}%</strong><span>possible alteration · {assessment.voiceAlterationConfidence || "low"} confidence</span></> : <><strong>Not assessed</strong><span>Not enough suitable applicant-only audio.</span></>}<p>{assessment.voiceNotes || "This check looks only for obvious digital alteration artifacts. Microphone quality, accent, and natural vocal differences are not treated as a voice changer."}</p></div>
              </div>
              <div className="assessment-disclaimer"><ShieldCheck size={15} /><span><strong>Human review stays in control.</strong> Listen to the recording and read the transcript before deciding. Never use these indicators alone to approve or decline an applicant.</span></div>
            </>}
      </section>}
      <div className="review-grid">
        <section className="panel review-application-card">
          <div className="panel-title review-panel-title"><div className="review-panel-heading"><span className="review-panel-icon"><FileText size={17} /></span><div><small>Application</small><h2>Player details</h2></div></div><span className="review-count-badge">{values.length} fields</span></div>
          <div className="review-fields">{values.map((item) => <div className="review-field" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
          {decided && <div className="review-history-card"><UserCheck size={18} /><div><span>Decision recorded by</span><strong>{reviewer?.displayName || "Review team member"}</strong><small>{reviewer?.role || application.reviewer_role || "reviewer"} · {new Date(reviewer?.reviewedAt || application.reviewed_at || application.updated_at).toLocaleString()}</small></div></div>}
        </section>
        <section className="panel review-interview-card">
          <div className="panel-title review-panel-title"><div className="review-panel-heading"><span className="review-panel-icon"><Headphones size={17} /></span><div><small>Voice interview</small><h2>{session?.interview_mode==="guided"?"Guided Voice recording":"Recording & transcript"}</h2></div></div><span className="review-count-badge">{transcript.length} turns</span></div>
          {recordingUrl ? <div className="recording-player"><div className="recording-player-label"><AudioWaveform size={16} /><span><strong>Interview recording</strong><small>Private evidence for your review team</small></span></div><audio controls src={recordingUrl} /><small>Audio follows the portal’s configured recording-retention period.</small></div> : <div className="recording-empty"><span><Headphones size={21} /></span><strong>{session?.recording_deleted_at ? "Recording retention period ended" : session?.status === "completed" ? "No recording saved" : "Interview not completed"}</strong><p>{session?.recording_deleted_at ? "The audio recording was deleted to control storage costs. The transcript, application, decision, and reviewer history remain available." : session?.status === "completed" ? "This interview does not have a playable recording. It may have been completed before recording was enabled or the upload may have failed. The transcript is still available below." : "The applicant has not completed the interview yet."}</p></div>}
          {session?.interview_mode==="guided" ? <p className="plan-feature-disclosure">Guided Voice · Audio-only answers. No written transcript, AI review, scores, or voice analysis. Listen to the recording to make your decision.</p> : <div className="review-transcript">{transcript.length ? transcript.map((line, index) => <div className={`review-transcript-line ${line.role}`} key={`${index}-${line.text}`}><span>{line.role === "assistant" ? "Interviewer" : "Applicant"}</span>{line.text}</div>) : <div className="review-transcript-empty"><MessageCircle size={18} /><strong>No transcript available yet</strong><p>Transcript turns will appear here after the player submits the interview.</p></div>}</div>}
        </section>
      </div>
      <section className={`review-actions ${decided ? "is-decided" : ""}`}>
        <div className="review-decision-copy"><span className="eyebrow">Final decision</span><h2>{decided ? "Review complete" : "Ready to make the call?"}</h2><p>{decided ? "The application details, transcript, decision time, and reviewer remain available. Audio follows the configured retention period." : "Approve the applicant and choose any additional Discord roles, or decline the application. Your team’s decision is final."}</p></div>
        {!decided && <div className="review-role-picker"><div className="review-role-picker-heading"><span><ShieldCheck size={15} /> Discord roles</span><small>Applied on approval</small></div><div className="review-role-picker-required"><span><Check size={13} /><strong>{server?.approved_role_name || "Approval role"}</strong></span><em>Required</em></div>{selectableAdditionalRoles.length ? <div className="review-role-picker-options">{selectableAdditionalRoles.map((role) => <label className={`review-role-option ${selectedAdditionalRoleIds.includes(role.id) ? "selected" : ""}`} key={role.id}><input type="checkbox" checked={selectedAdditionalRoleIds.includes(role.id)} onChange={(event) => setSelectedAdditionalRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} /><span><strong>{role.name}</strong><small>Optional role</small></span><span className="review-role-check"><Check size={12} /></span></label>)}</div> : <p className="review-role-picker-empty">No additional roles configured. Only the required approval role will be applied.</p>}</div>}
        <div className="review-action-buttons">{!decided && <><button className="btn review-approve-button" onClick={() => void decide("approved")} disabled={busy}><Check size={16} /> <span>{busy ? "Processing…" : "Approve application"}<small>{selectedAdditionalRoleIds.length ? `${selectedAdditionalRoleIds.length + 1} roles will be assigned` : "Assign required role"}</small></span></button><button className="btn review-decline-button" onClick={() => void decide("declined")} disabled={busy}><X size={15} /> Decline application</button></>}{decided && <><span className="review-decision"><Check size={15} /> Decision recorded</span>{canDeleteHistory && <button className="btn btn-ghost btn-small" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={14} /> Delete history</button>}</>}</div>
      </section>
    </section>
    {confirmDelete && <ConfirmModal title="Delete this application history?" description="This permanently removes the application, transcript, and recording. The applicant's configured reapply cooldown will remain in effect." confirmLabel="Delete history" busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={() => void removeFinalizedApplication()} />}
  </main>;
}
