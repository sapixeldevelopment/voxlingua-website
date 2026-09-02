"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Handshake, Link2, ShieldCheck, Wallet, Clock3, Users, RefreshCw } from "lucide-react";
import { AFFILIATE_TERMS_VERSION, type PartnerData, usd } from "@/lib/affiliate-policy";

export async function partnerRequest(path: string, body?: object, method = 'POST') {
  const response = await fetch(path, { ...(body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
export function PartnerHeader({ admin = false }: { admin?: boolean }) {
  return <header className="affiliate-header"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy<span className="affiliate-brand-label">{admin ? 'PARTNER OPERATIONS' : 'PARTNERS'}</span></Link><Link href={admin ? '/admin' : '/dashboard'} className="affiliate-back"><ArrowLeft size={15} />{admin ? 'Support dashboard' : 'Your workspace'}</Link></header>;
}
export function PartnerStats({ data }: { data: PartnerData }) {
  const stats = data.summary;
  return <div className="affiliate-stats">{[
    { icon: <Clock3 size={18} />, label: 'Pending earnings', value: usd(stats?.pending_cents || 0), detail: '30-day clearance period' },
    { icon: <Wallet size={18} />, label: 'Available balance', value: usd(stats?.available_cents || 0), detail: `${usd(stats?.reserved_cents || 0)} reserved for payout` },
    { icon: <Check size={18} />, label: 'Paid to date', value: usd(stats?.paid_cents || 0), detail: 'Confirmed payout records' },
    { icon: <Users size={18} />, label: 'Paying customers', value: String(stats?.customers || 0), detail: `${stats?.referrals || 0} referred signups` },
  ].map(stat => <article className="affiliate-stat" key={stat.label}><span>{stat.icon}{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></article>)}</div>;
}
export function PartnerHistory({ data, page, onPage }: { data: PartnerData; page: number; onPage: (page: number) => void }) {
  return <div className="affiliate-columns"><section className="affiliate-card"><div className="affiliate-card-head"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Commission history</h2></div><span className="affiliate-pill">USD</span></div><p className="affiliate-muted">Each confirmed payment earns once. Negative entries are refund adjustments.</p><div className="affiliate-scroll" tabIndex={0} aria-label="Commission history">
    {!data.entries?.length ? <div className="affiliate-empty"><Link2 size={24} /><h3>Your first referral starts here.</h3><p>Share your link. Qualifying payments will appear in this private ledger.</p></div> : <table><thead><tr><th>Activity</th><th>Amount</th><th>Availability</th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.id}><td>{entry.amount_cents < 0 ? 'Refund adjustment' : 'Payment commission'}<small>{new Date(entry.created_at).toLocaleDateString()}</small></td><td className={entry.amount_cents < 0 ? 'affiliate-negative' : 'affiliate-positive'}>{usd(entry.amount_cents)}</td><td>{entry.payout_id ? 'Allocated to payout' : new Date(entry.available_at).getTime() > Date.now() ? new Date(entry.available_at).toLocaleDateString() : 'Available'}</td></tr>)}</tbody></table>}
    </div><div className="affiliate-pagination"><button disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={!data.hasMore} onClick={() => onPage(page + 1)}>Next</button></div></section>
    <section className="affiliate-card"><div className="affiliate-card-head"><div><span className="eyebrow">MONEY MOVEMENT</span><h2>Payout history</h2></div><Wallet size={21} /></div><p className="affiliate-muted">Monthly review · $25 minimum · smaller balances roll forward. Latest 50 payouts.</p><div className="affiliate-scroll" tabIndex={0} aria-label="Payout history">{!data.payouts?.length ? <div className="affiliate-empty"><Wallet size={24} /><h3>No payouts yet.</h3><p>Eligible earnings are reviewed monthly. There is no guaranteed income.</p></div> : data.payouts.map(payout => <article className="affiliate-payout-row" key={payout.id}><div><strong>{usd(payout.amount_cents)}</strong><small>{new Date(payout.created_at).toLocaleDateString()}</small></div><span className={`affiliate-pill affiliate-status-${payout.status}`}>{payout.status === 'reserved' ? 'In review' : payout.status}</span>{payout.payment_reference && <small className="affiliate-receipt">Receipt: {payout.payment_reference}</small>}</article>)}</div></section></div>;
}

export default function PartnerDashboard({ signedIn }: { signedIn: boolean }) {
  const [data, setData] = useState<PartnerData | null>(null), [loading, setLoading] = useState(signedIn), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [page, setPage] = useState(0), [link, setLink] = useState('');
  const [name, setName] = useState(''), [promotion, setPromotion] = useState(''), [country, setCountry] = useState(''), [recipient, setRecipient] = useState(''), [agreed, setAgreed] = useState(false);
  const load = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true); setError('');
    try { const result: PartnerData = await partnerRequest(`/api/partners?page=${page}`); setData(result); if (result.partner) { setRecipient(result.partner.payout_email); setLink(`${window.location.origin}/?ref=${result.partner.code}`); } }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load partner records.'); }
    finally { setLoading(false); }
  }, [page, signedIn]);
  useEffect(() => { void load(); }, [load]);
  async function submit(application: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      await partnerRequest('/api/partners', application ? { name, promotion, country, email: recipient, terms: agreed ? AFFILIATE_TERMS_VERSION : '' } : { email: recipient }, application ? 'POST' : 'PATCH');
      setNotice(application ? 'Application received. We will review your audience, promotional approach, and payout eligibility.' : 'Payout details saved. Admin verification and a 48-hour security hold apply.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your details.'); }
    finally { setBusy(false); }
  }
  async function copy(message: boolean) {
    try { await navigator.clipboard.writeText(message ? `Build a more welcoming FiveM community with Dexlyy: structured AI voice interviews, with your staff making the final decision. Explore it here: ${link}\n\nDisclosure: I earn commission if you purchase through my link, at no extra cost to you.` : link); setNotice(message ? 'Promotional message copied, including the commission disclosure.' : 'Referral link copied.'); }
    catch { setNotice('Copy is unavailable in this browser. Select and copy the link below.'); }
  }
  const partner = data?.partner;
  return <main className="affiliate-page"><PartnerHeader /><div className="affiliate-container"><section className="affiliate-hero"><div><span className="eyebrow"><Handshake size={15} /> THE DEXLYY PARTNER PROGRAMME</span><h1>Good communities.<br /><em>Shared success.</em></h1><p>Introduce people to Dexlyy. Earn 15% on their qualifying payments for as long as they keep paying.</p></div><div className="affiliate-rate"><strong>15<span>%</span></strong><span>recurring commission</span><small>Real payments. Clear records.</small></div></section>
    <div role="status" aria-live="polite">{notice && <p className="form-success">{notice}</p>}</div>{error && <div className="form-error" role="alert">{error}<button className="affiliate-inline" onClick={() => void load()}>Try again</button></div>}
    {!signedIn ? <section className="affiliate-card affiliate-welcome"><div><h2>Your recommendations can go further.</h2><p>Free to apply. No subscription required. Partners are reviewed before their links become active.</p></div><Link href="/login?next=/partners" className="btn btn-primary">Sign in to apply <ArrowRight size={17} /></Link></section> : loading && !data ? <p className="affiliate-empty">Loading your partner workspace…</p> : !partner && !error ? <section className="affiliate-card"><span className="eyebrow">LET’S GET TO KNOW YOU</span><h2>Apply to become a partner</h2><form className="affiliate-form" onSubmit={event => { event.preventDefault(); void submit(true); }}><div className="affiliate-form-grid"><label>Your name or brand<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="How should we introduce you?" /></label><label>Country code<input required pattern="[A-Za-z]{2}" maxLength={2} value={country} onChange={event => setCountry(event.target.value.toUpperCase())} placeholder="ZA, US, GB…" /></label></div><label>PayPal email<input type="email" placeholder="you@example.com" required maxLength={254} value={recipient} onChange={event => setRecipient(event.target.value)} /><small>We verify payout eligibility before approval. This address is never public.</small></label><label>How will you promote Dexlyy?<textarea required minLength={20} maxLength={1500} rows={4} value={promotion} onChange={event => setPromotion(event.target.value)} placeholder="Tell us about your community, audience, and channels. Include your public profile links." /></label><label className="affiliate-checkbox"><input type="checkbox" required checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>I accept the <Link href="/partners/terms">partner terms</Link>, will disclose commissions, and will not self-refer, spam, or make misleading claims.</span></label><button className="btn btn-primary" disabled={busy || !agreed}>{busy ? 'Sending application…' : 'Submit application'}<ArrowRight size={16} /></button></form></section> : partner && data ? <>
      <div className="affiliate-workspace-bar"><span className={`affiliate-pill affiliate-status-${partner.status}`}>{partner.status}</span><strong>{partner.display_name}</strong><button onClick={() => void load()} disabled={loading} className="affiliate-inline"><RefreshCw size={14} />Refresh</button></div>
      {partner.status !== 'approved' && <section className="affiliate-card"><h2>{partner.status === 'pending' ? 'Your application is in review.' : 'Your referral link is inactive.'}</h2><p>{partner.status === 'pending' ? 'We check your promotional approach, country, and payout eligibility. Your link activates only after approval.' : 'Contact support@dexlyy.com for help with your partner account. Existing financial records remain available.'}</p></section>}
      <PartnerStats data={data} />
      {partner.status === 'approved' && <section className="affiliate-share"><div><span className="eyebrow">YOUR PERSONAL LINK</span><h2>One link. Every qualifying renewal.</h2><p>Share it with new customers. They can also enter your code before their first purchase.</p><label className="affiliate-link-label">Referral link<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label><small>Manual code: <code>{partner.code}</code> · No customer discount is added.</small></div><div className="affiliate-share-buttons"><button className="btn btn-primary" onClick={() => void copy(false)}><Copy size={16} />Copy referral link</button><button className="btn btn-ghost" onClick={() => void copy(true)}>Copy promotional message</button><a href="/partner-promo.svg" download className="affiliate-inline">Download promotional card</a></div></section>}
      <PartnerHistory data={data} page={page} onPage={setPage} />
      <section className="affiliate-card"><div className="affiliate-card-head"><div><span className="eyebrow">PRIVATE PAYOUT DETAILS</span><h2>Where your earnings go</h2></div><span className="affiliate-pill"><ShieldCheck size={14} />{partner.payout_verified ? 'Admin verified' : 'Verification pending'}</span></div><form className="affiliate-form" onSubmit={event => { event.preventDefault(); void submit(false); }}><label>PayPal email<input type="email" placeholder="you@example.com" value={recipient} maxLength={254} required onChange={event => setRecipient(event.target.value)} /></label><p className="affiliate-muted">Changing your address requires a fresh review and starts a 48-hour payout hold. Payouts already in review must be resolved first.</p><button className="btn btn-ghost" disabled={busy || recipient === partner.payout_email}>{busy ? 'Saving…' : 'Update payout address'}</button></form></section>
    </> : null}
    <section className="affiliate-how"><article><span>01</span><h3>Share with care.</h3><p>Use your link and tell people you may earn commission. New customers have 30 days to sign up.</p></article><article><span>02</span><h3>Earn on real payments.</h3><p>Monthly renewals, annual payments, and interview packs qualify. Refunds adjust earnings.</p></article><article><span>03</span><h3>Get paid monthly.</h3><p>Earnings clear after 30 days. Eligible balances of $25 or more are reviewed for payout.</p></article></section><footer className="affiliate-footer"><Link href="/partners/terms">Programme terms & privacy</Link><a href="mailto:support@dexlyy.com">Partner support</a><span>All figures in USD. Earnings are not guaranteed.</span></footer></div></main>;
}
