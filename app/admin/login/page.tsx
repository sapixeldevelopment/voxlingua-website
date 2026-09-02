"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Headphones, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { discordAuthEnabled, friendlyAuthError } from "@/lib/auth";
import { REMEMBER_ME_COOKIE } from "@/lib/supabase/session";

export default function AdminLoginPage() {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true);
    setError("");
    // Session cookies avoid persistent login; Lax permits Discord's callback.
    // This is not a substitute for server-enforced session expiry or MFA.
    document.cookie = `${REMEMBER_ME_COOKIE}=0; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` },
    });
    if (authError) {
      setBusy(false);
      setError(friendlyAuthError(authError.message));
    }
  }

  return <main className="admin-login-page">
    <section className="admin-login-card">
      <Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link>
      <div className="admin-login-icon"><Headphones size={25} /></div>
      <span className="eyebrow">Private operations</span>
      <h1>Support workspace.</h1>
      <p>Review customer feedback, update ticket progress, and keep internal support notes in one protected queue.</p>
      <button className="btn btn-primary admin-login-button" onClick={() => void signIn()} disabled={busy || !discordAuthEnabled}>
        <MessageCircle size={17} /> {busy ? "Connecting…" : "Continue with Discord"} <ArrowRight size={16} />
      </button>
      {error && <div className="form-error">{error}</div>}
      <div className="admin-login-security"><ShieldCheck size={17} /><span>Only explicitly provisioned Dexlyy staff accounts are admitted.</span></div>
      <div className="admin-login-footer"><LockKeyhole size={13} /> Authentication does not grant support access automatically.</div>
      <Link href="/login" className="admin-login-back"><ArrowLeft size={14} /> Owner login</Link>
    </section>
  </main>;
}
