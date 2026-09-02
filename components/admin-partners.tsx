"use client";
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { PartnerHeader, PartnerHistory, PartnerStats, partnerRequest } from '@/components/partner-dashboard';
import type { Partner, PartnerData } from '@/lib/affiliate-policy';
import { usd } from '@/lib/affiliate-policy';

type Detail = PartnerData & { audit: Array<{ id: string; action: string; details: { note?: string }; created_at: string }>; reviews: Array<{ transaction_id: string; gross_cents: number; refunded_cents: number; commission_cents: number; reversed_commission_cents: number }> };
export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]), [selected, setSelected] = useState(''), [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState('pending'), [page, setPage] = useState(0), [ledgerPage, setLedgerPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [pendingEvents, setPendingEvents] = useState(0);
  const [action, setAction] = useState('approve'), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false), [reference, setReference] = useState('');
  const [transaction, setTransaction] = useState(''), [kind, setKind] = useState('sale');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const result = await partnerRequest(`/api/admin/partners?page=${page}&status=${filter}`);
      setPartners(result.partners); setHasMore(result.hasMore); setPendingEvents(result.pendingEvents);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load partners.'); }
    finally { setBusy(false); }
  }, [page, filter]);
  const loadDetail = useCallback(async () => {
    if (!selected) { setDetail(null); return; }
    try { setDetail(await partnerRequest(`/api/admin/partners?id=${selected}&page=${ledgerPage}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load partner.'); }
  }, [selected, ledgerPage]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { let cancelled = false; setDetail(null); if (selected) partnerRequest(`/api/admin/partners?id=${selected}&page=${ledgerPage}`).then(result => { if (!cancelled) setDetail(result); }).catch(reason => { if (!cancelled) setError(reason.message); }); return () => { cancelled = true; }; }, [selected, ledgerPage]);
  async function update() {
    if (!detail?.partner || !confirmed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const openPayout = detail.payouts?.find(item => item.status === 'reserved');
      await partnerRequest('/api/admin/partners', { partnerId: detail.partner.id, action, note, confirm: true, payoutId: openPayout?.id, reference });
      setNotice(action === 'reserve' ? 'Payout reserved. No money has been sent. Verify the recipient and send through your approved payout provider, then record its receipt.' : action === 'paid' ? 'External payment receipt recorded. This action did not send money.' : 'Partner record updated.');
      setConfirmed(false); setNote(''); setReference(''); await load(); await loadDetail();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete action.'); }
    finally { setBusy(false); }
  }
  async function reconcile(retry: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await partnerRequest('/api/admin/partners/reconcile', retry ? { action: 'retry' } : kind === 'subscription' ? { action: 'subscription', subscription: transaction } : { action: 'transaction', kind, transaction });
      setNotice(retry ? `Checked ${result.checked} queued events; processed ${result.processed}.` : 'PayPal reconciliation completed. Existing transactions were not credited twice.'); await load(); await loadDetail();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not reconcile.'); }
    finally { setBusy(false); }
  }
  function exportPayout() {
    const payout = detail?.payouts?.find(item => item.status === 'reserved');
    if (!payout) return;
    const cell = (value: string) => `"${(/^[=+@\-\t\r\n]/.test(value) ? "'" : '') + value.replaceAll('"','""')}"`;
    const csv = ['payout_id,recipient_email,currency,amount,status', [payout.id, payout.payout_email, 'USD', (payout.amount_cents / 100).toFixed(2), 'RESERVED_NOT_SENT'].map(cell).join(',')].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `dexlyy-payout-${payout.id}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  const partner = detail?.partner;
  const payout = detail?.payouts?.find(item => item.status === 'reserved');
  return <main className="affiliate-page"><PartnerHeader admin /><div className="affiliate-container"><section className="affiliate-admin-intro"><div><span className="eyebrow">CONTROLLED GROWTH</span><h1>Partner operations.</h1><p>Approve thoughtfully. Keep the ledger accurate. Pay with confidence.</p></div><span className="affiliate-pill"><ShieldCheck size={15} />Platform admins only</span></section>
    <div role="status" aria-live="polite">{notice && <p className="form-success">{notice}</p>}</div>{error && <p className="form-error" role="alert">{error}</p>}
    <section className="affiliate-card affiliate-admin-health"><div><strong>{pendingEvents} payment events awaiting processing</strong><p className="affiliate-muted">Resolve outstanding financial events before approving a payout. Retry works on up to 10 due events at a time.</p></div><button className="btn btn-ghost btn-small" onClick={() => void reconcile(true)} disabled={busy}><RefreshCw size={14} />Retry due events</button></section>
    <div className="affiliate-admin-grid"><aside className="affiliate-card affiliate-partner-list"><div className="affiliate-card-head"><h2>Partners</h2><button className="affiliate-inline" onClick={() => void load()} disabled={busy} aria-label="Refresh partners"><RefreshCw size={16} /></button></div><label className="affiliate-filter">Status<select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); setSelected(''); }}><option value="">All partners</option>{['pending','approved','suspended','rejected'].map(status => <option key={status}>{status}</option>)}</select></label><div className="affiliate-scroll" tabIndex={0} aria-label="Partner applications">{!partners.length ? <p className="affiliate-empty">{busy ? 'Loading…' : 'No partners in this view.'}</p> : partners.map(item => <button key={item.id} className={`affiliate-partner-item ${selected === item.id ? 'selected' : ''}`} onClick={() => { setSelected(item.id); setLedgerPage(0); setConfirmed(false); setNote(''); setReference(''); }}><strong>{item.display_name}</strong><span>{item.country} · {item.status}</span><small>{new Date(item.created_at).toLocaleDateString()}</small></button>)}</div><div className="affiliate-pagination"><button disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Previous</button><span>{page + 1}</span><button disabled={!hasMore || busy} onClick={() => setPage(page + 1)}>Next</button></div></aside>
    <section className="affiliate-card">{!partner ? <div className="affiliate-empty"><ShieldCheck size={28} /><h2>Select a partner to review.</h2><p>Applications, eligibility checks, payout controls, and audit notes stay together.</p></div> : <><div className="affiliate-card-head"><div><span className="eyebrow">{partner.country} · {partner.code}</span><h2>{partner.display_name}</h2></div><span className={`affiliate-pill affiliate-status-${partner.status}`}>{partner.status}</span></div><p className="affiliate-application-copy">{partner.promotion}</p><div className="affiliate-review-details"><span>PayPal recipient<strong>{partner.payout_email}</strong></span><span>Recipient verification<strong>{partner.payout_verified ? 'Verified by admin' : 'Needs verification'}</strong></span></div><p className="affiliate-muted">Before approving: verify country/provider eligibility, identity, promotional channels, terms acceptance, and that 15% is sustainable for your margins. Never approve a partner just because they supplied an email address.</p>
      {payout && <div className="affiliate-reserved"><strong>{usd(payout.amount_cents)} reserved · not sent</strong><span>Recipient snapshot: {payout.payout_email}</span><code>{payout.id}</code><button className="btn btn-ghost btn-small" onClick={exportPayout}><Download size={14} />Export payout worksheet</button></div>}
      <form className="affiliate-form" onSubmit={event => { event.preventDefault(); void update(); }}><label>Action<select value={action} onChange={event => { setAction(event.target.value); setConfirmed(false); }}><option value="approve">Approve partner</option><option value="verify_payout">Verify payout recipient</option><option value="review_refunds">Confirm partial refunds reconciled</option><option value="suspend">Suspend partner and payouts</option><option value="reject">Decline application</option><option value="reserve">Reserve eligible balance for payout</option><option value="paid">Record an externally completed payout</option><option value="cancel_payout">Cancel reservation and release balance</option></select></label>{action === 'paid' && <label>Actual provider payment reference<input required minLength={8} maxLength={100} pattern="[A-Za-z0-9-]+" value={reference} onChange={event => setReference(event.target.value)} /><small>Record only after the transfer succeeds. This dashboard does not send money.</small></label>}<label>Audit note<textarea required minLength={10} maxLength={1000} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="What did you verify, and why is this action appropriate?" /></label><label className="affiliate-checkbox"><input required type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{action === 'paid' ? 'I have verified the recipient, amount and successful external transfer receipt.' : 'I have reviewed eligibility, outstanding payment events, and the impact of this action.'}</span></label><button className="btn btn-primary" disabled={busy || !confirmed}><CheckCircle2 size={16} />{busy ? 'Saving…' : 'Confirm action'}</button></form></>}</section></div>
    {detail?.partner && <><PartnerStats data={detail} />{!!detail.reviews?.length && <section className="affiliate-card"><h2>Refund review holds</h2><p>Compare every transaction below with its complete PayPal refund history. Replay missing refund webhooks from PayPal first. Clear holds only when all amounts match.</p><div className="affiliate-scroll">{detail.reviews.map(review => <p key={review.transaction_id}><code>{review.transaction_id}</code> · Charged {usd(review.gross_cents)} · Refunded {usd(review.refunded_cents)} · Commission reversed {usd(review.reversed_commission_cents)}</p>)}</div><button className="btn btn-ghost" onClick={() => { setAction('review_refunds'); setConfirmed(false); }}>Select refund-review action above</button></section>}<PartnerHistory data={detail} page={ledgerPage} onPage={setLedgerPage} /><section className="affiliate-card"><h2>Audit trail</h2><div className="affiliate-scroll" tabIndex={0}>{detail.audit.length ? detail.audit.map(item => <article className="affiliate-audit-row" key={item.id}><strong>{item.action.replaceAll('_',' ')}</strong><small>{new Date(item.created_at).toLocaleString()}</small><p>{item.details.note || 'Recorded system action'}</p></article>) : <p className="affiliate-muted">No administrative changes recorded yet.</p>}</div></section></>}
    <section className="affiliate-card"><span className="eyebrow">RECOVERY & RECONCILIATION</span><h2>Check a PayPal payment</h2><p className="affiliate-muted">Re-read a transaction from PayPal, or scan a subscription’s last 30 days. Amounts and customer ownership are verified server-side. For partial refunds, replay the original verified refund notification as well.</p><form className="affiliate-form affiliate-reconcile" onSubmit={event => { event.preventDefault(); void reconcile(false); }}><label>Record type<select value={kind} onChange={event => setKind(event.target.value)}><option value="sale">Subscription payment / sale</option><option value="capture">Interview pack / capture</option><option value="subscription">Subscription history (30 days)</option></select></label><label>PayPal ID<input required maxLength={100} pattern="[A-Za-z0-9-]+" value={transaction} onChange={event => setTransaction(event.target.value)} /></label><button className="btn btn-ghost" disabled={busy}>Verify with PayPal</button></form></section>
  </div></main>;
}
