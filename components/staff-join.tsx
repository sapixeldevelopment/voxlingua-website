"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { discordAuthEnabled, friendlyAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function StaffJoinApp() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ server_id: string; server_name?: string; role?: string } | null>(null);

  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user))); }, []);

  async function discordLogin() {
    setError("");
    if (!discordAuthEnabled) { setError("Discord sign-in is not enabled yet. Enable the Discord provider in Supabase Authentication first."); return; }
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/auth/callback?next=/staff/join` } });
    if (authError) setError(friendlyAuthError(authError.message));
  }

  async function join() {
    setBusy(true); setError(""); setResult(null);
    const response = await fetch("/api/staff/invites/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json().catch(() => ({})) as { error?: string; ok?: boolean; server_id?: string; server_name?: string; role?: string };
    if (!response.ok || !data.server_id) setError(data.error || "This staff invite could not be accepted.");
    else setResult({ server_id: data.server_id, server_name: data.server_name, role: data.role });
    setBusy(false);
  }

  return <main className="auth-page staff-join-page"><section className="auth-card staff-join-card"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><div className="staff-join-icon"><ShieldCheck size={24}/></div><span className="eyebrow">staff access</span><h1>Join a portal team.</h1><p>Use the one-time invite code from the portal owner. Your Discord account must be a member of their server and hold the configured staff role.</p>{result ? <div className="staff-join-success"><CheckCircle2 size={21}/><div><strong>Access granted</strong><span>You can now open {result.server_name || "the portal workspace"} as a {result.role || "staff member"}.</span></div><Link className="btn btn-primary" href={`/dashboard/servers/${result.server_id}`}>Open portal workspace</Link></div> : !signedIn ? <div className="staff-join-auth"><button className="btn btn-primary" onClick={() => void discordLogin()} disabled={!discordAuthEnabled}><LogIn size={16}/> Sign in with Discord</button>{!discordAuthEnabled && <div className="form-error">Discord authentication is not enabled for this project yet.</div>}</div> : <form className="form-stack staff-join-form" onSubmit={event => { event.preventDefault(); void join(); }}><div className="staff-signed-in"><CheckCircle2 size={15}/> Discord account connected</div><label className="label">One-time invite code<input className="input staff-code-input" value={code} onChange={event => setCode(event.target.value.replace(/\s/g, "").toUpperCase())} maxLength={12} autoComplete="off" placeholder="A1B2C3D4E5F6" /></label>{error && <div className="form-error">{error}</div>}<button className="btn btn-primary" disabled={busy || code.length !== 12}>{busy ? "Checking Discord access…" : "Join portal team"}</button></form>}{error && !signedIn && <div className="form-error staff-join-error">{error}</div>}<Link href="/" className="staff-back-link"><ArrowLeft size={14}/> Back to Dexlyy</Link></section></main>;
}
