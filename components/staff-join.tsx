"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { discordAuthEnabled, friendlyAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { normalizeStaffInviteCode, recallStaffInvite, rememberStaffInvite } from "@/lib/staff-invite";
import { fetchJsonWithTimeout } from "@/lib/client-request";

export default function StaffJoinApp() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState(false);
  const [hasDiscord, setHasDiscord] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [result, setResult] = useState<{ server_id: string; server_name?: string; role?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const fromLink = params.get("invite");
    if (fromLink !== null) {
      const normalized = normalizeStaffInviteCode(fromLink);
      setCode(normalized);
      setStorageWarning(!rememberStaffInvite(normalized));
      if (!normalized) setError("This invite link looks incomplete. Ask the owner to copy it again, or enter the 12-character code.");
      // Keep the code out of subsequent navigation and the OAuth callback.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    } else {
      setCode(recallStaffInvite());
    }
    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setHasDiscord(Boolean(data.user?.identities?.some(identity => identity.provider === "discord")));
    }).catch(() => setError("We couldn't check your sign-in. Refresh the page and try again."))
      .finally(() => setCheckingAuth(false));
  }, []);

  async function discordLogin() {
    setError("");
    if (!discordAuthEnabled) { setError("Discord sign-in is not enabled yet. Please contact the portal owner."); return; }
    // Keep the existing callback URL; no new Supabase redirect allowlist is needed.
    if (!rememberStaffInvite(code) && code) {
      setStorageWarning(true);
      if (!storageWarning) return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/auth/callback?next=/staff/join` } });
      if (authError) setError(friendlyAuthError(authError.message));
    } catch { setError("Discord sign-in could not start. Please try again."); }
    finally { setBusy(false); }
  }

  async function join() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetchJsonWithTimeout<{ error?: string; ok?: boolean; server_id?: string; server_name?: string; role?: string }>("/api/staff/invites/accept", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: normalizeStaffInviteCode(code) }),
      }, 20_000, "Verification took too long. Check your dashboard in case access was granted, or try again.");
      const data = response.data;
      if (!response.ok || !data?.server_id) setError(data?.error || "This staff invite could not be accepted.");
      else {
        rememberStaffInvite("");
        setResult({ server_id: data.server_id, server_name: data.server_name, role: data.role });
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Joining failed. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page staff-join-page"><section className="auth-card staff-join-card">
    <Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link>
    <div className="staff-join-icon"><ShieldCheck size={24} /></div>
    <span className="eyebrow">Your team invitation</span>
    <h1>A seat on the team.</h1>
    <p>Sign in with the Discord account you use in the owner's server, then confirm your invite. You'll need their configured Discord staff role.</p>
    {result ? <div className="staff-join-success" role="status"><CheckCircle2 size={21} /><div><strong>You're on the team</strong><span>You now have {result.role === "admin" ? "administrator" : result.role || "staff"} access to {result.server_name || "the portal"}.</span></div><Link className="btn btn-primary" href={`/dashboard/servers/${result.server_id}`}>Open portal workspace</Link></div>
      : <>
        <ol className="staff-join-progress" aria-label="Joining steps"><li className={signedIn && hasDiscord ? "complete" : "current"}>1. Sign in</li><li className={signedIn && hasDiscord ? "current" : ""}>2. Confirm invite</li><li>3. Open workspace</li></ol>
        <form className="form-stack staff-join-form" onSubmit={event => { event.preventDefault(); if (signedIn && hasDiscord) void join(); }}>
          <label className="label">One-time invite code<input className="input staff-code-input" value={code} onChange={event => { setCode(event.target.value.replace(/\s/g, "").toUpperCase()); setError(""); }} maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="A1B2C3D4E5F6" aria-describedby="staff-code-help" /></label>
          <p id="staff-code-help" className="staff-access-hint">{normalizeStaffInviteCode(code) ? "Code ready. We'll check that it is valid when you join." : "Opened a link without a code? Paste the code your portal owner sent you."}</p>
          {storageWarning && <p className="staff-inline-warning">Your browser cannot keep this code during sign-in. Copy it now so you can paste it when you return, then select Sign in with Discord.</p>}
          {checkingAuth ? <p className="subtle" role="status">Checking your sign-in…</p> : signedIn && hasDiscord ? <>
            <div className="staff-signed-in"><CheckCircle2 size={15} />Discord account connected</div>
            <button className="btn btn-primary" disabled={busy || !normalizeStaffInviteCode(code)}>{busy ? "Checking Discord access…" : "Join portal team"}</button>
          </> : <>
            {signedIn && <p className="staff-inline-warning">This account is not connected to Discord. Continue with the Discord account you use in the owner's server.</p>}
            <button type="button" className="btn btn-primary" onClick={() => void discordLogin()} disabled={busy || !discordAuthEnabled}><LogIn size={16} />{busy ? "Opening Discord…" : "Sign in with Discord"}</button>
            {!discordAuthEnabled && <p className="form-error">Discord sign-in is not available yet. Please contact the portal owner.</p>}
          </>}
          {error && <div className="form-error" role="alert">{error}</div>}
        </form>
        <details className="staff-share-details staff-join-help"><summary>Can't join the team?</summary><p>Make sure you are in the owner's Discord server and have their required staff role. If the code is expired or already used, ask for a new invite. Your Dexlyy access level and Discord role are separate.</p><p>Already accepted this invite? <Link className="text-link" href="/dashboard">Open your dashboard</Link>.</p></details>
      </>}
    <Link href="/" className="staff-back-link"><ArrowLeft size={14} />Back to Dexlyy</Link>
  </section></main>;
}
