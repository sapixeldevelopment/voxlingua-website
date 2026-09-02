"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { referralCode } from "@/lib/affiliate-policy";
export default function ReferralNotice() {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setCode(referralCode(new URL(window.location.href).searchParams.get('ref'))); }, []);
  function dismiss() {
    const url = new URL(window.location.href); url.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); setCode('');
  }
  async function accept() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/partners/referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, consent: true }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Referral could not be saved.');
      dismiss();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  if (!code) return null;
  return <aside className="affiliate-notice" aria-label="Partner referral"><div className="affiliate-notice-inner"><span className="affiliate-notice-icon" aria-hidden="true"><Handshake size={20} /></span><div className="affiliate-notice-copy"><span className="affiliate-notice-kicker">PARTNER REFERRAL</span><strong>A Dexlyy partner sent you here.</strong><p>Accepting saves their referral for 30 days. If you create an account and purchase, they may earn a 15% commission. <b>Your price stays exactly the same.</b> <Link href="/partners/terms">Learn how referrals work</Link></p>{error && <p className="affiliate-notice-error" role="alert">{error}</p>}</div><div className="affiliate-actions"><button className="btn btn-ghost btn-small" onClick={dismiss} disabled={busy}>Continue without referral</button><button className="btn btn-primary btn-small" onClick={() => void accept()} disabled={busy}>{busy ? 'Saving…' : 'Accept referral'}</button></div></div></aside>;
}
