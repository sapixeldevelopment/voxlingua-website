"use client";
import { useState } from "react";
export default function ReferralCodeField() {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function apply() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/partners/referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, consent: true, attach: true }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      setMessage(response.ok ? 'Your referral is linked. Future qualifying purchases will credit that partner.' : result.error || 'Referral could not be applied.');
    } catch { setMessage('Could not check the referral. Please try again.'); }
    finally { setBusy(false); }
  }
  return <details className="affiliate-referral-field"><summary>Referred by a Dexlyy partner?</summary><p>Enter their code before your first purchase. Applying it links your account to that partner; they may earn commission at no extra cost to you.</p><div><label>Partner code<input value={code} onChange={event => setCode(event.target.value)} maxLength={12} autoComplete="off" placeholder="12-character code" /></label><button type="button" className="btn btn-ghost btn-small" onClick={() => void apply()} disabled={busy || code.trim().length !== 12}>{busy ? 'Checking…' : 'Apply referral'}</button></div><p role="status">{message}</p></details>;
}
