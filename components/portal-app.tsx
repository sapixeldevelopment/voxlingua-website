"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock3, FileText, LockKeyhole, LogIn, Mic2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ApplicationField } from "@/lib/types";
import { discordAuthEnabled, friendlyAuthError } from "@/lib/auth";

type PublicPortalServer = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  welcome_message: string;
  is_active: true;
  discord_configured: boolean;
};

export default function PortalApp({ slug }: { slug: string }) {
  const supabase = createClient();
  const [server, setServer] = useState<PublicPortalServer | null>(null);
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [returningApplicant, setReturningApplicant] = useState(false);
  const [applicationBlock, setApplicationBlock] = useState<{
    kind: "application_in_progress" | "already_approved";
    message: string;
    resumeSessionId?: string | null;
  } | null>(null);
  const [discordStatus, setDiscordStatus] = useState<
    | "checking"
    | "verified"
    | "not_verified"
    | "unconfigured"
    | "discord_required"
  >("checking");

  useEffect(() => {
    (async () => {
      const [portalResponse, { data: auth }] = await Promise.all([
        fetch(`/api/portal/${encodeURIComponent(slug)}`, { cache: "no-store" }),
        supabase.auth.getUser(),
      ]);
      const portal = await portalResponse.json().catch(() => null) as { server?: PublicPortalServer; fields?: ApplicationField[]; error?: string } | null;
      if (!portalResponse.ok || !portal?.server) {
        setError(
          portal?.error || "This portal is closed because the server is disabled or its subscription is not active.",
        );
        setLoading(false);
        return;
      }
      const serverData = portal.server;
      setServer(serverData);
      const activeFields = portal.fields || [];
      setFields(activeFields);
      setForm(
        Object.fromEntries(activeFields.map((field) => [field.field_key, ""])),
      );
      if (auth.user) {
        setUser({ id: auth.user.id, email: auth.user.email });
        const signedInWithDiscord =
          auth.user.app_metadata?.provider === "discord" ||
          auth.user.identities?.some(
            (identity) => identity.provider === "discord",
          );
        if (!signedInWithDiscord) {
          setDiscordStatus("discord_required");
          setError(
            "Please authenticate with Discord so we can verify that you are a member of this server.",
          );
        } else if (serverData.discord_configured) {
          try {
            const [response, eligibilityResponse] = await Promise.all([
              fetch("/api/discord/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug }),
              }),
              fetch(`/api/applications?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }),
            ]);
            const result = (await response.json()) as {
              configured?: boolean;
              verified?: boolean;
              approved?: boolean;
              error?: string;
            };
            const eligibility = (await eligibilityResponse.json().catch(() => null)) as {
              error?: string;
              reason?: "application_in_progress" | "already_approved";
              resumeSessionId?: string | null;
              returningApplicant?: boolean;
            } | null;
            if (!eligibilityResponse.ok) {
              setApplicationBlock({
                kind: eligibility?.reason === "already_approved" ? "already_approved" : "application_in_progress",
                message: eligibility?.error || "You cannot create another application for this server right now.",
                resumeSessionId: eligibility?.resumeSessionId,
              });
            } else {
              setReturningApplicant(Boolean(eligibility?.returningApplicant));
            }
            if (result.approved) {
              setApplicationBlock({
                kind: "already_approved",
                message: `Your Discord account already has access to ${serverData.name}. No new application or interview is needed.`,
              });
            }
            setDiscordStatus(
              result.configured
                ? result.verified
                  ? "verified"
                  : "not_verified"
                : "unconfigured",
            );
            if (result.error) setError(result.error);
          } catch {
            setDiscordStatus("unconfigured");
            setError(
              "Discord membership could not be checked. Please try again or contact the server owner.",
            );
          }
        } else setDiscordStatus("unconfigured");
      }
      setLoading(false);
    })();
  }, [slug]);

  async function discordLogin() {
    if (!discordAuthEnabled) {
      setError(
        "Discord sign-in is not enabled for this Dexlyy project yet. Enable Discord under Supabase → Authentication → Providers, then reload this page.",
      );
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/portal/${slug}`,
      },
    });
    if (oauthError) setError(friendlyAuthError(oauthError.message));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      window.location.href = `/login?next=/portal/${slug}`;
      return;
    }
    if (!server) return;
    if (discordStatus !== "verified") {
      setError(
        discordStatus === "discord_required"
          ? "Authenticate with Discord before applying."
          : discordStatus === "unconfigured"
            ? "Discord membership verification is not configured yet. Please contact the server owner."
            : "You must be a member of this Discord server before applying.",
      );
      return;
    }
    const missing = fields.find(
      (field) => field.is_required && !form[field.field_key]?.trim(),
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, form }),
    });
    const result = await response.json().catch(() => null) as { sessionId?: string; error?: string } | null;
    if (!response.ok || !result?.sessionId) {
      setError(result?.error || "Could not create the interview session.");
      setBusy(false);
      return;
    }
    window.location.href = `/interview/${result.sessionId}`;
  }

  function updateField(fieldKey: string, value: string) {
    setForm((current) => ({ ...current, [fieldKey]: value }));
  }
  function renderField(field: ApplicationField) {
    const common = {
      className: "input",
      value: form[field.field_key] || "",
      placeholder: field.placeholder || "",
      required: field.is_required,
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => updateField(field.field_key, event.target.value),
      disabled: Boolean(applicationBlock),
    };
    return (
      <label className="label portal-field" key={field.id}>
        <span className="portal-field-heading">
          <span>{field.label}</span>
          <small>{field.is_required ? "Required" : "Optional"}</small>
        </span>
        {field.description && (
          <span className="portal-field-description">
            {field.description}
          </span>
        )}
        {field.field_type === "textarea" ? (
          <textarea {...common} className="textarea" />
        ) : field.field_type === "select" ? (
          <select {...common} className="select">
            <option value="">Select an option</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input {...common} />
        )}
      </label>
    );
  }

  if (loading)
    return (
      <main className="portal-wrap">
        <div className="portal-card">
          <span className="eyebrow">dexlyy portal</span>
          <h1>Loading portal…</h1>
        </div>
      </main>
    );
  if (!server)
    return (
      <main className="portal-wrap">
        <div className="portal-card">
          <span className="eyebrow">dexlyy portal</span>
          <h1>Portal unavailable.</h1>
          <p className="subtle">{error}</p>
          <Link
            href="/"
            className="btn btn-primary"
            style={{ display: "inline-flex", marginTop: 20 }}
          >
            Back to Dexlyy
          </Link>
        </div>
      </main>
    );
  const alreadyApproved = applicationBlock?.kind === "already_approved";
  return (
    <main className="portal-wrap">
      <section className="portal-shell">
        <header className="portal-header">
          <div className="portal-server-identity">
            {server.logo_url ? (
              <img className="portal-server-logo" src={server.logo_url} alt={`${server.name} logo`} />
            ) : (
              <div className="portal-server-logo portal-server-logo-fallback">{server.name.slice(0, 1).toUpperCase()}</div>
            )}
            <div>
              <strong className="portal-server-name">{server.name}</strong>
              <span className="portal-badge">Applicant portal</span>
            </div>
          </div>
          <span className="portal-powered"><LockKeyhole size={13} /> Secured by <strong>Dexlyy</strong></span>
        </header>

        <div className="portal-layout">
          <aside className="portal-intro-panel">
            <div>
              <span className="eyebrow">{alreadyApproved ? "Access confirmed" : returningApplicant ? "Welcome back" : "Your application"}</span>
              <h1>{alreadyApproved
                ? `Welcome back to ${server.name}.`
                : returningApplicant
                  ? `Let’s get you back into ${server.name}.`
                  : `Take the first step into ${server.name}.`}</h1>
              <p className="portal-welcome-copy">
                {alreadyApproved
                  ? "You’re already whitelisted. Your application has been approved and your Discord access is ready."
                  : returningApplicant
                    ? "Your previous approval remains in the server’s history, but your current Discord membership no longer has the approved role. You can apply again for fresh access."
                    : server.welcome_message || `Tell the ${server.name} team who you are, then join a short guided voice interview at your own pace.`}
              </p>
            </div>

            <div className="portal-process" aria-label="Application process">
              <div className={`portal-process-step ${discordStatus === "verified" || alreadyApproved ? "complete" : "active"}`}>
                <span>{discordStatus === "verified" || alreadyApproved ? <Check size={15} /> : "01"}</span>
                <div><strong>Verify Discord</strong><small>Confirm you belong to this community.</small></div>
              </div>
              <div className={`portal-process-step ${alreadyApproved ? "complete" : discordStatus === "verified" ? "active" : ""}`}>
                <span>{alreadyApproved ? <Check size={15} /> : "02"}</span>
                <div><strong>Share your story</strong><small>Complete the server’s application.</small></div>
              </div>
              <div className={`portal-process-step ${alreadyApproved ? "complete" : ""}`}>
                <span>{alreadyApproved ? <Check size={15} /> : "03"}</span>
                <div><strong>Join the interview</strong><small>Talk naturally with the Dexlyy interviewer.</small></div>
              </div>
            </div>

            <div className="portal-assurance">
              <ShieldCheck size={19} />
              <div>
                <strong>A person always makes the final call.</strong>
                <p>Your application, transcript, and interview are reviewed by the {server.name} team.</p>
              </div>
            </div>
            <div className="portal-expectations">
              <span><Clock3 size={14} /> Complete it in your own time</span>
              <span><Mic2 size={14} /> Microphone required for interview</span>
            </div>
          </aside>

          <section className="portal-application-panel">
            <div className="portal-application-heading">
              <div>
                <span className="portal-section-label"><FileText size={13} /> Application details</span>
                <h2>{alreadyApproved ? "You’re already whitelisted" : returningApplicant ? "Reapply for access" : user ? "Tell us about yourself" : "Connect Discord to begin"}</h2>
                <p>{alreadyApproved
                  ? "Your approved access remains connected to this Discord account."
                  : returningApplicant
                    ? "The review team can see your earlier decision while considering this new application."
                  : user
                    ? "A few thoughtful details help the review team get to know you before you speak."
                    : "We’ll verify your membership and bring you straight back to this application."}</p>
              </div>
              {user && <span className={`portal-discord-status status-${discordStatus}`}>
                <CheckCircle2 size={14} />
                {alreadyApproved
                  ? "Access active"
                  : discordStatus === "verified"
                  ? "Discord verified"
                  : discordStatus === "checking"
                    ? "Checking Discord"
                    : "Action required"}
              </span>}
            </div>

            {alreadyApproved ? (
              <div className="portal-auth-card portal-approved-card">
                <span className="portal-auth-icon"><ShieldCheck size={23} /></span>
                <span className="portal-approved-kicker"><CheckCircle2 size={14} /> Approval complete</span>
                <h3>No new application needed</h3>
                <p>{applicationBlock.message}</p>
                <div className="portal-approved-note">
                  Open Discord and continue into the community. If your role is not visible yet, contact the {server.name} team rather than submitting again.
                </div>
                <Link className="btn btn-primary portal-primary-action" href="/">
                  Return to Dexlyy <ArrowRight size={16} />
                </Link>
              </div>
            ) : !user ? (
              <div className="portal-auth-card">
                <span className="portal-auth-icon"><LogIn size={21} /></span>
                <h3>Continue with your Discord account</h3>
                <p>No email or password is needed. Discord is only used to verify your identity and server membership.</p>
                <button
                  className="btn btn-primary portal-primary-action"
                  onClick={discordLogin}
                  disabled={!discordAuthEnabled}
                  title={!discordAuthEnabled ? "Enable Discord in Supabase Auth Providers first" : undefined}
                >
                  Connect Discord <ArrowRight size={16} />
                </button>
                {!discordAuthEnabled && <div className="form-error">Discord authentication is awaiting project setup. The server owner needs to enable Discord in Supabase Auth Providers first.</div>}
                {error && <div className="form-error">{error}</div>}
              </div>
            ) : (
              <form className="form-stack portal-application-form" onSubmit={submit}>
                {returningApplicant && <div className="portal-verification-callout portal-returning-callout">
                  <ShieldCheck size={17} />
                  <div>
                    <strong>Previous approval found</strong>
                    <p>Because the approved Discord role is no longer present, a new application is allowed. Your earlier application stays safely in the server’s history.</p>
                  </div>
                </div>}
                {discordStatus !== "verified" && <div className={`portal-verification-callout status-${discordStatus}`}>
                  <CheckCircle2 size={17} />
                  <div>
                    <strong>{discordStatus === "checking" ? "Checking your membership…" : "Discord verification needs attention"}</strong>
                    <p>{discordStatus === "not_verified"
                      ? "Join this Discord server before continuing with your application."
                      : discordStatus === "discord_required"
                        ? "Authenticate with Discord before applying."
                        : discordStatus === "unconfigured"
                          ? "Membership verification has not been configured. Contact the server owner."
                          : "Please wait while we confirm your Discord membership."}</p>
                  </div>
                </div>}
                {discordStatus === "discord_required" && <button type="button" className="btn btn-ghost portal-discord-reconnect" onClick={discordLogin} disabled={!discordAuthEnabled}><LogIn size={16} /> Authenticate with Discord</button>}
                {applicationBlock && <div className="portal-verification-callout status-not_verified">
                  <Clock3 size={17} />
                  <div>
                    <strong>Another application cannot be started</strong>
                    <p>{applicationBlock.message}</p>
                    {applicationBlock.resumeSessionId && <Link className="btn btn-ghost btn-small" href={`/interview/${applicationBlock.resumeSessionId}`}>Continue your interview <ArrowRight size={14} /></Link>}
                  </div>
                </div>}
                <div className="portal-fields">
                  {fields.length ? fields.map(renderField) : <div className="empty-state">This server has not configured any application fields yet.</div>}
                </div>
                {error && <div className="form-error">{error}</div>}
                <button className="btn btn-primary portal-primary-action" disabled={busy || discordStatus !== "verified" || !fields.length || Boolean(applicationBlock)}>
                  <Mic2 size={16} />
                  {busy ? "Preparing your interview…" : "Continue to voice interview"}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </form>
            )}
            {!alreadyApproved && <p className="portal-consent"><LockKeyhole size={13} /> By continuing, you agree that the interview may be recorded and privately reviewed by the community owner team.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}
