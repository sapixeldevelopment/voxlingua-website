"use client";

import { useEffect, useState } from "react";
import { Bug, Check, CheckCircle2, HelpCircle, Lightbulb, MessageSquarePlus, RotateCcw, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FeedbackCategory = "bug" | "suggestion" | "question" | "other";
type FeedbackRow = {
  id: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
};

const categories: Array<{ value: FeedbackCategory; label: string; description: string }> = [
  { value: "bug", label: "Report a bug", description: "Something is not working" },
  { value: "suggestion", label: "Suggest an idea", description: "Help shape what comes next" },
  { value: "question", label: "Ask a question", description: "Get help with Dexlyy" },
  { value: "other", label: "Something else", description: "Share anything useful" },
];

function categoryIcon(category: FeedbackCategory) {
  if (category === "bug") return <Bug size={14} />;
  if (category === "suggestion") return <Lightbulb size={14} />;
  if (category === "question") return <HelpCircle size={14} />;
  return <MessageSquarePlus size={14} />;
}

function formatFeedbackDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function FeedbackPanel({ userId, supabase }: { userId: string; supabase: ReturnType<typeof createClient> }) {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("owner_feedback")
        .select("id,category,subject,message,status,created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) {
        setFeedback((data || []) as FeedbackRow[]);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [supabase, userId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (cleanSubject.length < 3) { setError("Add a short subject so we know what this is about."); return; }
    if (cleanMessage.length < 10) { setError("Add a little more detail so we can understand your feedback."); return; }
    setBusy(true); setError(""); setSubmitted(false);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject: cleanSubject, message: cleanMessage, pagePath: window.location.pathname }),
    });
    const result = await response.json().catch(() => ({})) as { feedback?: FeedbackRow; error?: string; warning?: string };
    if (!response.ok && response.status !== 202) {
      setError(result.error || "Could not send your feedback.");
      setBusy(false);
      return;
    }
    if (result.feedback) setFeedback(current => [result.feedback as FeedbackRow, ...current].slice(0, 20));
    setSubject(""); setMessage(""); setSubmitted(true); setError(result.warning || ""); setBusy(false);
  }

  async function updateStatus(item: FeedbackRow) {
    const nextStatus = item.status === "closed" ? "open" : "closed";
    setStatusBusy(item.id);
    setError("");
    const { data, error: updateError } = await supabase
      .from("owner_feedback")
      .update({ status: nextStatus })
      .eq("id", item.id)
      .eq("owner_id", userId)
      .select("id,category,subject,message,status,created_at")
      .single();
    if (updateError || !data) {
      setError(updateError?.message || "Could not update this ticket.");
      setStatusBusy("");
      return;
    }
    setFeedback(current => current.map(row => row.id === item.id ? data as FeedbackRow : row));
    setStatusBusy("");
  }

  return <section className="panel feedback-panel">
    <div className="feedback-panel-heading">
      <div className="feedback-title-wrap"><span className="feedback-icon"><MessageSquarePlus size={18} /></span><div><span className="eyebrow">help shape Dexlyy</span><h2>Send feedback</h2><p className="subtle">Found a bug, have an idea, or need a hand? Send it directly to the Dexlyy team.</p></div></div>
      <span className="feedback-private"><CheckCircle2 size={14} /> Owner-only</span>
    </div>
    <div className="feedback-layout">
      <form className="feedback-form" onSubmit={submit}>
        <div className="feedback-category-grid" role="group" aria-label="Feedback type">
          {categories.map(item => <button type="button" key={item.value} className={`feedback-category ${category === item.value ? "selected" : ""}`} onClick={() => setCategory(item.value)}><span className="feedback-category-icon">{categoryIcon(item.value)}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}
        </div>
        <label className="label">Subject<input className="input" value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} placeholder="What would you like us to know?" /></label>
        <label className="label">Details<textarea className="textarea feedback-textarea" value={message} onChange={event => setMessage(event.target.value)} maxLength={5000} placeholder="Tell us what happened, what you expected, or how your idea would help." /></label>
        <div className="feedback-form-footer"><span>{message.length}/5000</span><button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? "Sending…" : <><Send size={14} /> Send feedback</>}</button></div>
        {error && <div className="form-error feedback-error">{error}</div>}
        {submitted && <div className="form-success feedback-success"><CheckCircle2 size={15} /> Thanks—we’ve received your feedback.</div>}
      </form>
      <aside className="feedback-history"><div className="feedback-history-head"><div><span className="eyebrow">your notes</span><h3>Recent feedback</h3></div><span>{feedback.length ? `${feedback.length} shown` : "No notes yet"}</span></div>{loading ? <p className="feedback-history-empty">Loading your feedback…</p> : feedback.length ? <div className="feedback-history-list">{feedback.map(item => { const closed = item.status === "closed"; const changing = statusBusy === item.id; return <div className={`feedback-history-item ${closed ? "is-closed" : ""}`} key={item.id}><div className="feedback-history-item-head"><span>{categoryIcon(item.category)} {item.category}</span><time>{formatFeedbackDate(item.created_at)}</time></div><strong>{item.subject}</strong><p>{item.message}</p><div className="feedback-history-item-footer"><span className={`feedback-status feedback-status-${item.status}`}>{item.status.replace("_", " ")}</span><button type="button" className="feedback-status-action" onClick={() => void updateStatus(item)} disabled={Boolean(statusBusy)} aria-label={`${closed ? "Reopen" : "Close"} ${item.subject}`}>{changing ? <span className="button-spinner button-spinner-dark" /> : closed ? <RotateCcw size={12} /> : <Check size={13} />}{changing ? "Saving" : closed ? "Reopen" : "Close ticket"}</button></div></div>; })}</div> : <div className="feedback-history-empty"><MessageSquarePlus size={18} /><p>Your feedback history will appear here.</p></div>}</aside>
    </div>
  </section>;
}

