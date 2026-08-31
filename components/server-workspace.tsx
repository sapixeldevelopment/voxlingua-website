"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  LogOut,
  Settings2,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Application, Server } from "@/lib/types";
import { ApplicationQueue } from "@/components/dashboard-app";

export default function ServerWorkspaceApp({serverId}: {serverId: string}) {
  const supabase = createClient();
  const [server, setServer] = useState<Server | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [billingStatus, setBillingStatus] = useState<"active" | "suspended" | "cancelled" | "expired" | "pending" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void load();
  }, [serverId]);

  async function load() {
    setLoading(true);
    setError("");
    const {data: auth} = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.href = `/login?next=/dashboard/servers/${serverId}`;
      return;
    }
    setUserEmail(auth.user.email || "");
    const [{data: serverData, error: serverError}, {data: applicationData, error: applicationError}, {data: billingData, error: billingError}] = await Promise.all([
      supabase.from("servers").select("*").eq("id", serverId).maybeSingle(),
      supabase.from("applications").select("*").eq("server_id", serverId).neq("status", "interviewing").order("created_at", {ascending: false}),
      supabase.from("owner_billing").select("status").eq("user_id", auth.user.id).maybeSingle(),
    ]);
    if (serverError || !serverData) setError(serverError?.message || "Portal not found or unavailable.");
    if (applicationError) setError(applicationError.message);
    if (billingError) setError(billingError.message);
    setServer(serverData as Server | null);
    setIsOwner(serverData?.owner_id === auth.user.id);
    setApplications((applicationData || []) as Application[]);
    setBillingStatus((billingData?.status as "active" | "suspended" | "cancelled" | "expired" | "pending" | undefined) || null);
    setLoading(false);
  }

  async function copyPortalLink() {
    if (!server) return;
    const portalUrl = `${window.location.origin}/portal/${server.slug}`;
    try {
      await navigator.clipboard.writeText(portalUrl);
    } catch {
      const input = document.createElement("textarea");
      input.value = portalUrl;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <main className="dashboard-page"><div className="settings-loading">Loading portal workspace…</div></main>;
  if (!server) return <main className="dashboard-page"><div className="settings-loading"><span className="eyebrow">owner workspace</span><h1>Portal unavailable.</h1><p className="subtle">{error || "This portal could not be loaded."}</p><Link className="btn btn-primary" href="/dashboard">Back to dashboard</Link></div></main>;

  const portalUrl = `/portal/${server.slug}`;
  const pending = applications.filter(application => ["pending", "under_review", "role_pending"].includes(application.status)).length;
  const completed = applications.filter(application => ["approved", "role_assigned", "declined"].includes(application.status)).length;
  const configurationPaused = billingStatus === "suspended";
  const serverInitials = server.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return <main className="dashboard-page workspace-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><nav className="topnav"><Link href="/dashboard" className="btn btn-ghost btn-small"><ArrowLeft size={14}/> All portals</Link><span>{userEmail}</span><button className="btn btn-ghost btn-small" onClick={signOut}><LogOut size={14}/> Sign out</button></nav></header>
    <div className="dashboard-main server-workspace-main">
      <div className="workspace-breadcrumb"><Link href="/dashboard"><ArrowLeft size={14}/> Your portals</Link><span>/</span><span>{server.name}</span></div>
      <section className="workspace-command">
        <div className="workspace-command-main">
          <div className="workspace-identity">
            <div className="workspace-server-logo">
              {server.logo_url ? <img src={server.logo_url} alt={`${server.name} logo`} /> : <span>{serverInitials}</span>}
            </div>
            <div className="workspace-intro">
              <div className="workspace-kicker-row">
                <span className="eyebrow">Portal workspace</span>
                <span className={`workspace-status ${configurationPaused ? "paused" : "live"}`}><i />{configurationPaused ? "Portal paused" : "Portal live"}</span>
              </div>
              <h1>{server.name}</h1>
              <p>Review applications, listen to every interview, and make confident membership decisions from one place.</p>
            </div>
          </div>
          <div className="workspace-actions">
            {configurationPaused ? <span className="btn workspace-action-primary workspace-disabled-action" title="Portal configuration is locked while the subscription is paused"><Settings2 size={16}/> Configuration paused</span> : <Link className="btn workspace-action-primary" href={`/dashboard/servers/${server.id}/settings`}><Settings2 size={16}/> Configure portal</Link>}
            {isOwner && <Link className="btn workspace-action-secondary" href={`/dashboard/servers/${server.id}/staff`}><UserPlus size={16}/> Manage staff</Link>}
            <button className="btn workspace-action-secondary" onClick={copyPortalLink}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Link copied" : "Copy player link"}</button>
          </div>
        </div>
        <div className="workspace-share-row">
          <span className="workspace-share-icon"><Link2 size={17}/></span>
          <div>
            <span>Player-facing application portal</span>
            <a href={portalUrl} target="_blank" rel="noreferrer">{portalUrl}<ExternalLink size={13}/></a>
          </div>
          <a className="workspace-open-portal" href={portalUrl} target="_blank" rel="noreferrer">Open portal <ArrowUpRight size={15}/></a>
        </div>
      </section>
      {error && <div className="form-error" style={{marginBottom:18}}>{error}</div>}
      <div className="stat-grid workspace-stat-grid">
        <article className="stat-card workspace-stat-card"><span className="workspace-stat-icon"><FileText size={18}/></span><div><div className="stat-label">Total applications</div><div className="stat-number">{applications.length}</div><p>Received through this portal</p></div></article>
        <article className={`stat-card workspace-stat-card ${pending ? "attention" : ""}`}><span className="workspace-stat-icon"><Clock3 size={18}/></span><div><div className="stat-label">Needs review</div><div className="stat-number">{pending}</div><p>{pending ? "Waiting for your team" : "Your inbox is clear"}</p></div></article>
        <article className="stat-card workspace-stat-card"><span className="workspace-stat-icon"><CircleCheck size={18}/></span><div><div className="stat-label">Decisions made</div><div className="stat-number">{completed}</div><p>Approved or declined</p></div></article>
        <article className="stat-card workspace-stat-card status"><span className="workspace-stat-icon"><Activity size={18}/></span><div><div className="stat-label">Portal status</div><div className="stat-number">{configurationPaused ? "Paused" : "Active"}</div><p>{configurationPaused ? "Configuration is locked" : "Accepting applications"}</p></div></article>
      </div>
      <ApplicationQueue server={server} applications={applications} />
    </div>
  </main>;
}
