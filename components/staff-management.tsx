"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { BILLING_PLANS, type OwnerBilling } from "@/lib/billing";
import { createClient } from "@/lib/supabase/client";
import type { Server } from "@/lib/types";

type Member = { user_id: string; role: "owner" | "admin" | "reviewer"; created_at: string };

export default function StaffManagementApp({ serverId }: { serverId: string }) {
  const supabase = createClient();
  const [server, setServer] = useState<Server | null>(null);
  const [billing, setBilling] = useState<OwnerBilling | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<"admin" | "reviewer">("admin");
  const [invite, setInvite] = useState<{ code: string; role: string; expiresAt: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, [serverId]);

  async function load() {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = `/login?next=/dashboard/servers/${serverId}/staff`; return; }
    const [{ data: serverData, error: serverError }, { data: billingData }, { data: memberData, error: memberError }] = await Promise.all([
      supabase.from("servers").select("*").eq("id", serverId).eq("owner_id", auth.user.id).maybeSingle(),
      supabase.from("owner_billing").select("*").eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("server_members").select("user_id,role,created_at").eq("server_id", serverId).order("created_at"),
    ]);
    if (serverError || memberError || !serverData) setError(serverError?.message || memberError?.message || "Only the portal owner can manage staff.");
    setServer(serverData as Server | null);
    setBilling((billingData || null) as OwnerBilling | null);
    setMembers((memberData || []) as Member[]);
    setLoading(false);
  }

  async function createInvite() {
    if (!server) return;
    setBusy(true); setError(""); setInvite(null);
    const response = await fetch("/api/staff/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: server.id, role }) });
    const result = await response.json().catch(() => ({})) as { code?: string; role?: string; expiresAt?: string | null; error?: string };
    if (!response.ok || !result.code) setError(result.error || "Could not create a staff invite.");
    else setInvite({ code: result.code, role: result.role || role, expiresAt: result.expiresAt || null });
    setBusy(false);
  }

  async function copyInvite() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function removeStaff(userId: string) {
    if (!server) return;
    setRemoveBusy(userId); setError("");
    const { error: removeError } = await supabase.from("server_members").delete().eq("server_id", server.id).eq("user_id", userId);
    if (removeError) setError(removeError.message);
    else setMembers(current => current.filter(member => member.user_id !== userId));
    setRemoveBusy("");
  }

  if (loading) return <main className="dashboard-page"><div className="settings-loading">Loading staff access…</div></main>;
  if (!server) return <main className="dashboard-page"><div className="settings-loading"><span className="eyebrow">staff access</span><h1>Staff area unavailable.</h1><p className="subtle">{error || "This portal could not be loaded."}</p><Link className="btn btn-primary" href={`/dashboard/servers/${serverId}`}>Back to workspace</Link></div></main>;

  const plan = billing?.plan_key ? BILLING_PLANS[billing.plan_key] : null;
  const staff = members.filter(member => member.role !== "owner");
  const staffLimit = billing?.staff_limit ?? plan?.staff ?? 0;
  const limitReached = staffLimit !== -1 && staff.length >= staffLimit;
  const canInvite = billing?.status === "active" && Boolean(server.discord_guild_id && server.staff_role_id) && !limitReached;
  const limitLabel = staffLimit === -1 ? "Unlimited" : String(staffLimit);

  return <main className="dashboard-page staff-page"><header className="topbar"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><nav className="topnav"><Link href={`/dashboard/servers/${server.id}`} className="btn btn-ghost btn-small"><ArrowLeft size={14}/> Portal workspace</Link></nav></header><div className="staff-shell">
    <div className="workspace-breadcrumb"><Link href={`/dashboard/servers/${server.id}`}><ArrowLeft size={14}/> {server.name}</Link><span>/</span><span>Staff access</span></div>
    <div className="staff-heading"><div><span className="eyebrow">owner workspace · staff</span><h1>Trusted access for your team.</h1><p className="subtle">Invite reviewers and administrators from your Discord server without sharing your owner account.</p></div><div className="staff-plan-badge"><ShieldCheck size={16}/><span>{plan?.name || "Current plan"} · {staff.length}/{limitLabel} staff</span></div></div>
    {error && <div className="form-error staff-alert">{error}</div>}
    <div className="staff-grid">
      <section className="panel staff-card staff-invite-card"><div className="staff-card-kicker">01 / INVITE</div><h2>Add someone you trust</h2><p className="subtle">They will sign in with Discord and must hold your configured <strong>{server.staff_role_name || "staff"}</strong> role before access is granted.</p><label className="label">Access level<select className="select" value={role} onChange={event => setRole(event.target.value as "admin" | "reviewer")}><option value="admin">Administrator · can configure and review</option><option value="reviewer">Reviewer · can review applications</option></select></label><button className="btn btn-primary staff-invite-button" onClick={() => void createInvite()} disabled={busy || !canInvite}><UserPlus size={15}/>{busy ? "Creating invite…" : "Create one-time invite"}</button>{!server.staff_role_id && <p className="staff-inline-warning">Configure the Discord staff role in portal settings before creating an invite.</p>}{billing?.status !== "active" && <p className="staff-inline-warning">An active subscription is required to add staff.</p>}{limitReached && <p className="staff-inline-warning">Your {plan?.name || "current"} plan has reached its staff limit. Upgrade to add more seats.</p>}
      {invite && <div className="staff-invite-result"><div><span className="staff-card-kicker">INVITE READY · {invite.role}</span><strong className="staff-code">{invite.code}</strong><p>Give this code to the staff member. It can only be used once{invite.expiresAt ? ` and expires ${new Date(invite.expiresAt).toLocaleDateString()}.` : "."}</p></div><button className="btn btn-ghost btn-small" onClick={() => void copyInvite()}><>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy code"}</></button></div>}
      </section>
      <section className="panel staff-card staff-guide-card"><div className="staff-card-kicker">02 / HOW IT WORKS</div><h2>Two checks, one secure handoff.</h2><div className="staff-steps"><div><span>01</span><p><strong>Send the code</strong> Share the one-time code privately with the person you want to add.</p></div><div><span>02</span><p><strong>They authenticate</strong> They visit <code>/staff/join</code>, sign in with Discord, and enter the code.</p></div><div><span>03</span><p><strong>Discord confirms</strong> Dexlyy checks their server membership and staff role before granting access.</p></div></div><Link className="text-link" href={`/dashboard/servers/${server.id}/settings`}>Configure Discord staff role <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }}/></Link></section>
    </div>
    <section className="panel staff-card staff-members-card"><div className="staff-card-header"><div><div className="staff-card-kicker">03 / CURRENT TEAM</div><h2>People with access</h2><p className="subtle">Remove access here at any time. Their Discord account will no longer be able to open this portal workspace.</p></div><span className="staff-count">{staff.length} {staff.length === 1 ? "member" : "members"}</span></div>{staff.length ? <div className="staff-member-list">{staff.map(member => <div className="staff-member" key={member.user_id}><div className="staff-member-avatar"><ShieldCheck size={16}/></div><div className="staff-member-copy"><strong>Discord account</strong><span>•••• {member.user_id.slice(-6)} · added {new Date(member.created_at).toLocaleDateString()}</span></div><span className={`staff-role staff-role-${member.role}`}>{member.role}</span><button className="icon-button icon-button-danger" onClick={() => void removeStaff(member.user_id)} disabled={removeBusy === member.user_id} title="Remove staff access" aria-label="Remove staff access">{removeBusy === member.user_id ? <span className="button-spinner button-spinner-dark"/> : <Trash2 size={15}/>}</button></div>)}</div> : <div className="staff-empty"><ShieldCheck size={23}/><strong>No staff added yet</strong><span>Create an invite when you are ready to add your first reviewer or administrator.</span></div>}</section>
  </div></main>;
}
