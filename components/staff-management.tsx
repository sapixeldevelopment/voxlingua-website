"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Link2, MessageSquare, RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { BILLING_PLANS, type OwnerBilling } from "@/lib/billing";
import { createClient } from "@/lib/supabase/client";
import type { Server } from "@/lib/types";
import { staffInviteMessage, staffJoinUrl } from "@/lib/staff-invite";
import { fetchJsonWithTimeout } from "@/lib/client-request";

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
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");
  const [copyError, setCopyError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setOrigin(window.location.origin); void load(); }, [serverId]);

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
    setBusy(true); setError(""); setCopied(""); setCopyError("");
    try {
      const response = await fetchJsonWithTimeout<{ code?: string; role?: string; expiresAt?: string | null; error?: string }>("/api/staff/invites", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverId: server.id, role }),
      }, 20_000, "Creating the invite timed out. Please try again.");
      const result = response.data;
      if (!response.ok || !result?.code) setError(result?.error === "Your plan has reached its staff limit."
        ? "Your staff seats are assigned or reserved by unused invitations. Use an existing invite, or wait for it to expire before creating another."
        : result?.error || "Could not create a staff invite.");
      else setInvite({ code: result.code, role: result.role || role, expiresAt: result.expiresAt || null });
    } catch {
      setError("The invite could not be created. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function copyText(value: string, label: string) {
    setCopyError(""); setCopied("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopyError("Copying is blocked by your browser. Select the link or message below and copy it manually.");
    }
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
  const joinUrl = origin ? staffJoinUrl(origin) : "";
  const inviteUrl = origin && invite ? staffJoinUrl(origin, invite.code) : "";
  const message = invite ? staffInviteMessage({ serverName: server.name, role: invite.role, discordRole: server.staff_role_name || "configured staff", url: inviteUrl }) : "";

  return <main className="dashboard-page staff-page">
    <header className="topbar">
      <Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link>
      <nav className="topnav"><Link href={`/dashboard/servers/${server.id}`} className="btn btn-ghost btn-small"><ArrowLeft size={14} /> Portal workspace</Link></nav>
    </header>
    <div className="staff-shell">
      <div className="workspace-breadcrumb"><Link href={`/dashboard/servers/${server.id}`}><ArrowLeft size={14} /> {server.name}</Link><span>/</span><span>Staff access</span></div>
      <div className="staff-heading">
        <div><span className="eyebrow">Your portal team</span><h1>Good people. One simple invite.</h1><p className="subtle">Give your team their own access. Create a private invite, send the link, and let Discord handle the identity check.</p></div>
        <div className="staff-plan-badge"><ShieldCheck size={16} /><span>{plan?.name || "Current plan"} · {staff.length}/{limitLabel} staff</span></div>
      </div>
      {error && <div className="form-error staff-alert" role="alert">{error}</div>}
      <div className="staff-grid">
        <section className="panel staff-card staff-invite-card">
          <div className="staff-card-kicker">01 / Create & share</div>
          <h2>Invite a teammate</h2>
          <p className="subtle">One private link for one person. No account sharing and no separate registration required.</p>
          <label className="label">Their access in Dexlyy
            <select className="select" value={role} onChange={event => setRole(event.target.value as "admin" | "reviewer")} disabled={busy}>
              <option value="reviewer">Reviewer · review applications</option>
              <option value="admin">Administrator · configure and review</option>
            </select>
          </label>
          <p className="staff-access-hint">{role === "admin" ? "For trusted teammates who also manage portal settings." : "For teammates who help review applicants."} This does not assign a Discord role.</p>
          <button className="btn btn-primary staff-invite-button" onClick={() => void createInvite()} disabled={busy || !canInvite}><UserPlus size={16} />{busy ? "Creating invite…" : invite ? "Create another invite" : "Create invite link"}</button>
          <p className="staff-access-hint">Unused invitations reserve staff seats until they are accepted or expire.</p>
          {(!server.discord_guild_id || !server.staff_role_id) && <p className="staff-inline-warning">Connect your Discord server and choose a staff role in portal settings first.</p>}
          {billing?.status !== "active" && <p className="staff-inline-warning">An active subscription is required to add staff.</p>}
          {limitReached && <p className="staff-inline-warning">All {limitLabel} staff seats are in use. Remove someone or upgrade before inviting another teammate.</p>}

          {invite ? <div className="staff-share-box">
            <div className="staff-share-heading"><span className="staff-card-kicker"><Check size={13} /> Ready to send</span><span className="staff-role">{invite.role === "admin" ? "Administrator" : "Reviewer"}</span></div>
            <label className="label">Private invite link
              <input className="input staff-link-input" value={inviteUrl} readOnly onFocus={event => event.currentTarget.select()} />
            </label>
            <div className="staff-share-actions">
              <button className="btn btn-primary" disabled={!inviteUrl} onClick={() => void copyText(inviteUrl, "Invite link")}><Link2 size={15} />{copied === "Invite link" ? "Link copied" : "Copy invite link"}</button>
              <button className="btn btn-ghost" disabled={!inviteUrl} onClick={() => void copyText(message, "Message")}><MessageSquare size={15} />{copied === "Message" ? "Message copied" : "Copy message"}</button>
            </div>
            <p className="staff-share-note">The link fills in their code automatically. Send it in a private message, not a public Discord channel.</p>
            <div className="staff-invite-meta"><span>Single use</span>{invite.expiresAt && <span>Expires {new Date(invite.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>}</div>
            <details className="staff-share-details">
              <summary>Prefer to send a code? View code & message</summary>
              <div className="staff-manual-code"><code>{invite.code}</code><button className="btn btn-ghost btn-small" onClick={() => void copyText(invite.code, "Code")}><Copy size={13} />Copy code</button></div>
              <p>Send the code together with <a href={joinUrl} target="_blank" rel="noopener noreferrer">{joinUrl}</a>.</p>
              <label className="label">Ready-to-send message<textarea className="textarea staff-message-preview" value={message} readOnly rows={9} onFocus={event => event.currentTarget.select()} /></label>
            </details>
            <p className="staff-share-note">Creating another invite does not cancel earlier ones. Each teammate needs a different link.</p>
          </div> : <div className="staff-share-empty"><Link2 size={18} /><span>Your private link and ready-to-send message will appear here.</span></div>}
          <div className="staff-copy-feedback" role="status" aria-live="polite">{copyError || (copied ? `${copied} copied — ready to paste into a private message.` : "")}</div>
        </section>

        <section className="panel staff-card staff-guide-card">
          <div className="staff-card-kicker">02 / Their next steps</div>
          <h2>From invite to workspace</h2>
          <div className="staff-steps">
            <div><span>01</span><p><strong>Open your invite link</strong>Their one-time code is filled in automatically. If you sent only a code, they can use the joining page below.</p></div>
            <div><span>02</span><p><strong>Sign in with Discord</strong>Use the account that is already in your Discord server. The invite is kept while they sign in.</p></div>
            <div><span>03</span><p><strong>Join, then open the workspace</strong>Select <b>Join portal team</b>. After verification, select <b>Open portal workspace</b> to get started.</p></div>
          </div>
          <div className="staff-requirement-box">
            <div className="staff-card-kicker"><ShieldCheck size={13} /> Required Discord role</div>
            <strong>{server.staff_role_name || (server.staff_role_id ? "Configured staff role" : "Not configured")}</strong>
            <p>Both reviewers and administrators need this role in your Discord server. A Dexlyy invite does not give them that Discord role.</p>
            {/owner/i.test(server.staff_role_name || "") && <p className="staff-role-caution">You selected an Owner role. If your teammates do not have it, choose the appropriate staff role in settings instead.</p>}
            <Link className="text-link" href={`/dashboard/servers/${server.id}/settings`}>Review Discord staff role <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }} /></Link>
          </div>
          <div className="staff-general-link">
            <label className="label">Joining page <span>Use this with a separate invite code.</span>
              <input className="input staff-link-input" value={joinUrl} readOnly onFocus={event => event.currentTarget.select()} />
            </label>
            <button className="btn btn-ghost btn-small" disabled={!joinUrl} onClick={() => void copyText(joinUrl, "Joining page")}><Copy size={14} />Copy joining page</button>
          </div>
          <details className="staff-share-details"><summary>Having trouble joining?</summary><p>Check that they used the right Discord account, joined your Discord server, and received the role shown above. If the invite has expired or was already used, create a new one. Staff seats must still be available when they accept.</p></details>
        </section>
      </div>
      <section className="panel staff-card staff-members-card">
        <div className="staff-card-header"><div><div className="staff-card-kicker">03 / Your team</div><h2>People with access</h2><p className="subtle">New teammates appear here after accepting an invite. You can remove their portal access at any time.</p></div><button className="btn btn-ghost btn-small" onClick={() => void load()}><RefreshCw size={14} />Refresh team</button></div>
        {staff.length ? <div className="staff-member-list">{staff.map(member => <div className="staff-member" key={member.user_id}>
          <div className="staff-member-avatar"><ShieldCheck size={16} /></div>
          <div className="staff-member-copy"><strong>Discord account</strong><span>•••• {member.user_id.slice(-6)} · added {new Date(member.created_at).toLocaleDateString()}</span></div>
          <span className={`staff-role staff-role-${member.role}`}>{member.role}</span>
          <button className="icon-button icon-button-danger" onClick={() => void removeStaff(member.user_id)} disabled={removeBusy === member.user_id} title="Remove staff access" aria-label="Remove staff access">{removeBusy === member.user_id ? <span className="button-spinner button-spinner-dark" /> : <Trash2 size={15} />}</button>
        </div>)}</div> : <div className="staff-empty"><UserPlus size={23} /><strong>Your first teammate starts here</strong><span>Create an invite above, send it privately, and refresh this list after they join.</span></div>}
      </section>
    </div>
  </main>;
}
