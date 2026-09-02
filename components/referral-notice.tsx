"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  return <aside className="affiliate-notice" aria-label="Partner referral"><div><strong>You arrived through a Dexlyy partner.</strong><p>May we remember their referral for 30 days? If you sign up and buy, they can earn commission at no extra cost to you. <Link href="/partners/terms">How it works</Link></p>{error && <p role="alert">{error}</p>}</div><div className="affiliate-actions"><button className="btn btn-ghost btn-small" onClick={dismiss} disabled={busy}>No thanks</button><button className="btn btn-primary btn-small" onClick={() => void accept()} disabled={busy}>{busy ? 'Saving…' : 'Remember referral'}</button></div></aside>;
}
