"use client";

import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="confirm-close" onClick={onCancel} disabled={busy} aria-label="Close confirmation"><X size={17} /></button>
      <div className="confirm-icon"><AlertTriangle size={21} /></div>
      <div className="confirm-copy"><span className="eyebrow">please confirm</span><h2 id="confirm-modal-title">{title}</h2><p>{description}</p></div>
      <div className="confirm-actions"><button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Keep it</button><button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button></div>
    </section>
  </div>;
}
