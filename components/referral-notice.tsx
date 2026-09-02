"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { referralCode } from "@/lib/affiliate-policy";
export default function ReferralNotice() {
  const [code, setCode] = useState(''), [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving'), [error, setError] = useState('');
  const started = useRef('');
  useEffect(() => {
    const parsed = referralCode(new URL(window.location.href).searchParams.get('ref'));
    setCode(parsed);
    if (!parsed || started.current === parsed) return;
    started.current = parsed;
    void (async () => {
      try {
        const response = await fetch('/api/partners/referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: parsed }), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Referral could not be saved.');
        setStatus('saved');
      } catch (reason) {
        setStatus('error');
        setError(reason instanceof Error ? reason.message : 'This referral could not be applied.');
      }
    })();
  }, []);
  function dismiss() {
    const url = new URL(window.location.href); url.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); setCode('');
  }
  if (!code) return null;
  return <aside className="affiliate-notice" aria-label="Partner referral" aria-live="polite"><div className="affiliate-notice-inner"><span className="affiliate-notice-icon" aria-hidden="true"><Handshake size={20} /></span><div className="affiliate-notice-copy"><span className="affiliate-notice-kicker">PARTNER REFERRAL</span><strong>{status === 'saving' ? 'Applying your partner referral…' : status === 'saved' ? 'Partner referral applied.' : 'Partner referral unavailable.'}</strong><p>A Dexlyy partner sent you here, so this visit is attributed to them for 30 days. If you create an account and purchase, they may earn a 15% commission. <b>Your price stays exactly the same.</b> <Link href="/partners/terms">Learn how referrals work</Link></p>{error && <p className="affiliate-notice-error" role="alert">{error}</p>}</div><div className="affiliate-actions"><button className="btn btn-primary btn-small" onClick={dismiss}>Got it</button></div></div></aside>;
}
