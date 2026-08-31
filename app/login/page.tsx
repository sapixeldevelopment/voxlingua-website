"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { discordAuthEnabled, friendlyAuthError } from "@/lib/auth";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from "@/lib/supabase/session";

export default function LoginPage() {
  const supabase = createClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const preference = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${REMEMBER_ME_COOKIE}=`))?.split("=")[1];
    if (preference === "0") setRememberMe(false);
  }, []);

  async function discordLogin() {
    setBusy(true);
    setError("");
    document.cookie = `${REMEMBER_ME_COOKIE}=${rememberMe ? "1" : "0"}; Path=/; ${rememberMe ? `Max-Age=${REMEMBER_ME_MAX_AGE}; ` : ""}SameSite=Lax`;
    if (!discordAuthEnabled) {
      setBusy(false);
      setError("Discord sign-in is not enabled for this Dexlyy project yet. Enable Discord under Supabase → Authentication → Providers, then reload this page.");
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } });
    if (oauthError) { setBusy(false); setError(friendlyAuthError(oauthError.message)); }
  }

  return <main className="auth-page auth-page-modern"><div className="auth-layout">
    <section className="auth-story"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><div className="auth-story-copy"><span className="eyebrow">A calmer way to build your community</span><h1>Make every new player feel expected.</h1><p>Dexlyy gives your FiveM community a thoughtful front door: a clear application, a natural interview, and the final say in your hands.</p><div className="auth-benefits"><div><span><Check size={14}/></span><div><strong>One clear workspace</strong><small>Applications, transcripts, and decisions in one place.</small></div></div><div><span><Check size={14}/></span><div><strong>Built around Discord</strong><small>Keep your community identity and access rules connected.</small></div></div><div><span><Check size={14}/></span><div><strong>Human approval stays yours</strong><small>AI helps with the conversation. You make the call.</small></div></div></div></div><div className="auth-story-foot"><span className="auth-story-orb"/><span>Designed for communities that care who joins.</span></div></section>
    <section className="auth-card auth-card-modern"><div className="auth-card-label"><span className="auth-card-icon"><MessageCircle size={17}/></span><span className="eyebrow">Owner workspace</span></div><h2>Welcome back.</h2><p className="auth-card-lead">Sign in with Discord to create and manage your interview portals.</p><button className="btn btn-primary auth-discord-button" onClick={discordLogin} disabled={busy || !discordAuthEnabled} aria-busy={busy} title={!discordAuthEnabled ? "Enable Discord in Supabase Auth Providers first" : undefined}><MessageCircle size={17}/>{busy ? "Connecting to Discord…" : "Continue with Discord"}<ArrowRight size={16} className="auth-button-arrow" /></button><label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={busy}/><span><strong>Keep me signed in</strong><small>Stay signed in on this device</small></span></label>{!discordAuthEnabled && <div className="form-error auth-message">Discord sign-in is awaiting project setup. Enable the Discord provider in Supabase before continuing.</div>}{error && <div className="form-error auth-message">{error}</div>}<div className="auth-security-note"><ShieldCheck size={17}/><p><strong>Your Discord identity is your Dexlyy identity.</strong> We use it to verify ownership and community membership. No email or password is needed.</p></div><div className="auth-card-footer"><LockKeyhole size={13}/> Private, Discord-only access</div></section>
  </div><p className="auth-page-caption">Dexlyy <span>·</span> thoughtful interviews for better communities</p></main>;
}
