"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, CircleDot, Clock3, Copy, Headphones, Inbox, LogOut, MessageSquareText, RefreshCw, Save, Search, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlatformStaffRole } from "@/lib/platform-staff";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketCategory = "bug" | "suggestion" | "question" | "other";
type SupportTicket = {
  id: string;
  owner_id: string;
  submitter_email: string | null;
  category: TicketCategory;
  subject: string;
  message: string;
  page_path: string | null;
  status: TicketStatus;
  support_notes: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};
type QueueFilter = "active" | TicketStatus | "all";

const statusLabels: Record<TicketStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };

function statusIcon(status: TicketStatus) {
  if (status === "open") return <AlertCircle size={14} />;
  if (status === "in_progress") return <Clock3 size={14} />;
  if (status === "resolved") return <CheckCircle2 size={14} />;
  return <XCircle size={14} />;
}

function readableDate(value: string) {
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminAccessDenied({ userId, email }: { userId: string; email: string }) {
  const supabase = createClient();
  const [copied, setCopied] = useState(false);
  async function switchAccount() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }
  async function copyId() {
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <main className="admin-denied-page"><section className="admin-denied-card"><span className="admin-denied-icon"><ShieldAlert size={27} /></span><span className="eyebrow">Access restricted</span><h1>This account is not on the support team.</h1><p><strong>{email}</strong> authenticated successfully, but has not been provisioned as Dexlyy platform staff.</p><div className="admin-account-id"><span>Account ID</span><code>{userId}</code><button onClick={() => void copyId()}>{copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button></div><button className="btn btn-primary" onClick={() => void switchAccount()}>Use another Discord account</button><Link href="/" className="text-link"><ArrowLeft size={14} /> Return to Dexlyy</Link></section></main>;
}

export default function AdminSupportDashboard({ email, role, displayName }: { email: string; role: PlatformStaffRole; displayName: string | null }) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("active");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [draftStatus, setDraftStatus] = useState<TicketStatus>("open");
  const [draftNotes, setDraftNotes] = useState("");

  const selected = tickets.find(ticket => ticket.id === selectedId) || null;
  const counts = useMemo(() => ({
    open: tickets.filter(ticket => ticket.status === "open").length,
    in_progress: tickets.filter(ticket => ticket.status === "in_progress").length,
    resolved: tickets.filter(ticket => ticket.status === "resolved").length,
    closed: tickets.filter(ticket => ticket.status === "closed").length,
  }), [tickets]);
  const visibleTickets = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return tickets.filter(ticket => {
      const matchesFilter = filter === "all"
        || (filter === "active" && ["open", "in_progress"].includes(ticket.status))
        || ticket.status === filter;
      const matchesSearch = !cleanQuery || [ticket.subject, ticket.message, ticket.submitter_email, ticket.category, ticket.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(cleanQuery));
      return matchesFilter && matchesSearch;
    });
  }, [filter, query, tickets]);

  async function loadTickets() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/feedback", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as { tickets?: SupportTicket[]; error?: string };
    if (!response.ok) setError(result.error || "Could not load the support queue.");
    else {
      const nextTickets = result.tickets || [];
      setTickets(nextTickets);
      setSelectedId(current => current && nextTickets.some(ticket => ticket.id === current) ? current : nextTickets[0]?.id || "");
    }
    setLoading(false);
  }

  useEffect(() => { void loadTickets(); }, []);
  useEffect(() => {
    if (!selected) return;
    setDraftStatus(selected.status);
    setDraftNotes(selected.support_notes || "");
    setSaved(false);
  }, [selectedId, selected?.status, selected?.support_notes]);

  async function saveTicket() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, status: draftStatus, supportNotes: draftNotes }),
    });
    const result = await response.json().catch(() => ({})) as { ticket?: SupportTicket; error?: string };
    if (!response.ok || !result.ticket) setError(result.error || "Could not save this ticket.");
    else {
      setTickets(current => current.map(ticket => ticket.id === result.ticket?.id ? result.ticket : ticket));
      setSaved(true);
    }
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  const filters: Array<{ value: QueueFilter; label: string }> = [
    { value: "active", label: "Active" }, { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" },
  ];

  return <main className="admin-support-page">
    <header className="admin-support-header"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><div className="admin-support-identity"><span><ShieldCheck size={14} /> {role}</span><strong>{displayName || email}</strong><button onClick={() => void signOut()}><LogOut size={14} /> Sign out</button></div></header>
    <div className="admin-support-shell">
      <section className="admin-support-hero"><div><span className="eyebrow">Platform operations</span><h1>Support inbox.</h1><p>Review every customer ticket, record internal context, and keep its progress accurate.</p></div><button className="btn btn-ghost btn-small" onClick={() => void loadTickets()} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh</button></section>
      <section className="admin-support-stats">
        <div><span className="admin-stat-icon open"><AlertCircle size={17} /></span><strong>{counts.open}</strong><small>Open</small></div>
        <div><span className="admin-stat-icon progress"><Clock3 size={17} /></span><strong>{counts.in_progress}</strong><small>In progress</small></div>
        <div><span className="admin-stat-icon resolved"><CheckCircle2 size={17} /></span><strong>{counts.resolved}</strong><small>Resolved</small></div>
        <div><span className="admin-stat-icon closed"><XCircle size={17} /></span><strong>{counts.closed}</strong><small>Closed</small></div>
      </section>
      {error && <div className="form-error admin-support-error">{error}</div>}
      <section className="admin-support-workspace">
        <aside className="admin-ticket-queue"><div className="admin-queue-heading"><div><span className="eyebrow">Ticket queue</span><h2>{visibleTickets.length} results</h2></div><Inbox size={19} /></div><label className="admin-ticket-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tickets" /></label><div className="admin-ticket-filters">{filters.map(item => <button key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><div className="admin-ticket-list">{loading ? <div className="admin-ticket-empty"><RefreshCw size={18} className="spin" /> Loading tickets…</div> : visibleTickets.length ? visibleTickets.map(ticket => <button key={ticket.id} className={`admin-ticket-item ${selectedId === ticket.id ? "selected" : ""}`} onClick={() => setSelectedId(ticket.id)}><div><span className={`admin-ticket-status admin-ticket-status-${ticket.status}`}>{statusIcon(ticket.status)} {statusLabels[ticket.status]}</span><time>{new Date(ticket.created_at).toLocaleDateString()}</time></div><strong>{ticket.subject}</strong><p>{ticket.message}</p><small>{ticket.submitter_email || `Account ${ticket.owner_id.slice(0, 8)}`}</small></button>) : <div className="admin-ticket-empty"><MessageSquareText size={21} /><strong>No matching tickets</strong><span>Try another status or search term.</span></div>}</div></aside>
        <div className="admin-ticket-detail">{selected ? <><div className="admin-ticket-detail-head"><div><span className={`admin-ticket-status admin-ticket-status-${selected.status}`}>{statusIcon(selected.status)} {statusLabels[selected.status]}</span><h2>{selected.subject}</h2><p>{selected.submitter_email || "Email unavailable"} · {readableDate(selected.created_at)}</p></div><span className="admin-ticket-category"><CircleDot size={12} /> {selected.category}</span></div><div className="admin-ticket-metadata"><div><span>Submitted from</span><strong>{selected.page_path || "Unknown page"}</strong></div><div><span>Ticket ID</span><strong>{selected.id}</strong></div></div><article className="admin-ticket-message"><span>Customer message</span><p>{selected.message}</p></article><div className="admin-ticket-editor"><label>Status<select value={draftStatus} onChange={event => setDraftStatus(event.target.value as TicketStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Internal support notes<textarea value={draftNotes} onChange={event => setDraftNotes(event.target.value)} maxLength={5000} placeholder="Add context for the support team. Customers cannot see these notes." /><small>{draftNotes.length}/5000 · private to Dexlyy staff</small></label><div className="admin-ticket-save"><span>{saved ? <><CheckCircle2 size={14} /> Changes saved</> : selected.updated_by ? `Last updated ${readableDate(selected.updated_at)}` : "No support updates yet"}</span><button className="btn btn-primary btn-small" onClick={() => void saveTicket()} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save ticket"}</button></div></div></> : <div className="admin-ticket-detail-empty"><Headphones size={28} /><h2>Select a ticket</h2><p>Choose a customer message from the queue to review and update it.</p></div>}</div>
      </section>
    </div>
  </main>;
}

