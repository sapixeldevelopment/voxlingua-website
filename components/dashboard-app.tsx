"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Inbox, LogOut, Plus, Radio, Search, Settings2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Application, ApplicationField, Question, Server } from "@/lib/types";
import type { OwnerBilling } from "@/lib/billing";
import BillingPanel from "@/components/billing-panel";
import ServerSettingsForm from "@/components/server-settings-form";
import ConfirmModal from "@/components/confirm-modal";
import FeedbackPanel from "@/components/feedback-panel";

const defaultQuestions = [
  "Introduce yourself and tell us why you want to join this community.",
  "How would you handle a disagreement with another player during a session?",
  "Tell us about a time you helped keep a roleplay or community interaction enjoyable.",
];

type ApplicationFilter = "all" | "needs_review" | "approved" | "declined";
const APPLICATIONS_PER_PAGE = 12;
const NEEDS_REVIEW_STATUSES = ["pending", "under_review", "role_pending"];

function applicationStatusClass(status: string) {
  if (["approved", "role_assigned"].includes(status)) return "pill-green";
  if (status === "declined") return "pill-red";
  return "pill-orange";
}

function applicationStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function ApplicationQueue({server, applications}: {server?: Server; applications: Application[]}) {
  const [filter, setFilter] = useState<ApplicationFilter>("needs_review");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const scopedApplications = useMemo(() => {
    if (!server) return [];
    return applications.filter(application => application.server_id === server.id);
  }, [applications, server]);
  const counts = useMemo(() => ({
    all: scopedApplications.length,
    needs_review: scopedApplications.filter(application => NEEDS_REVIEW_STATUSES.includes(application.status)).length,
    approved: scopedApplications.filter(application => ["approved", "role_assigned"].includes(application.status)).length,
    declined: scopedApplications.filter(application => application.status === "declined").length,
  }), [scopedApplications]);
  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedApplications.filter(application => {
      const matchesFilter = filter === "all"
        || (filter === "needs_review" && NEEDS_REVIEW_STATUSES.includes(application.status))
        || (filter === "approved" && ["approved", "role_assigned"].includes(application.status))
        || (filter === "declined" && application.status === "declined");
      if (!matchesFilter) return false;
      if (!query) return true;
      return [application.player_name, application.discord_username, application.discord_user_id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });
  }, [filter, scopedApplications, search]);
  const pageCount = Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PER_PAGE));
  const visibleApplications = filteredApplications.slice((page - 1) * APPLICATIONS_PER_PAGE, page * APPLICATIONS_PER_PAGE);

  useEffect(() => { setPage(1); }, [filter, search, server?.id]);
  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);

  if (!server) return <section className="panel"><div className="panel-title"><h2>Review queue</h2><span>0 applications</span></div><div className="empty-state">Select or create a community to see applications.</div></section>;

  const filters: Array<{key: ApplicationFilter; label: string}> = [
    {key: "needs_review", label: "Needs review"},
    {key: "all", label: "All applications"},
    {key: "approved", label: "Approved"},
    {key: "declined", label: "Declined"},
  ];
  const emptyTitle = search
    ? "No matching applicants"
    : filter === "needs_review"
      ? "You’re all caught up"
      : `No ${filter === "all" ? "applications" : filter} applications yet`;
  const emptyDescription = search
    ? "Try another player name, Discord username, or ID."
    : filter === "needs_review"
      ? "New applications that need a decision will appear here automatically."
      : "Applications will appear here as players move through your portal.";
  return <section className="panel review-queue-panel">
    <div className="panel-title review-queue-title"><div className="review-queue-heading"><span className="review-heading-icon"><Inbox size={18}/></span><div><span className="eyebrow">Application inbox</span><h2>Review queue</h2><span className="review-queue-subtitle">{counts.needs_review ? `${counts.needs_review} application${counts.needs_review === 1 ? "" : "s"} waiting for a decision` : "Nothing needs your attention right now"}</span></div></div><span className="review-record-count">{counts.all} total</span></div>
    <div className="review-toolbar"><div className="review-filters">{filters.map(item => <button key={item.key} type="button" className={`review-filter ${filter === item.key ? "active" : ""}`} onClick={() => setFilter(item.key)}>{item.label}<span>{counts[item.key]}</span></button>)}</div><label className="review-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search applicants" aria-label="Search applicants" /></label></div>
    {filteredApplications.length ? <>
      <div className="application-list">{visibleApplications.map(application => { const displayName = application.player_name || application.discord_username || "Applicant"; const initials = displayName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(); const reviewHref = server ? `/dashboard/applications/${application.id}?returnTo=${encodeURIComponent(`/dashboard/servers/${server.id}`)}` : `/dashboard/applications/${application.id}`; return <div className="application-item" key={application.id}><div className="application-person"><span className="application-avatar">{initials}</span><div><div className="row-title">{displayName}</div><div className="row-meta">{application.discord_username ? `@${application.discord_username}` : "Discord not connected yet"} · {new Date(application.created_at).toLocaleDateString()}</div><span className={`pill ${applicationStatusClass(application.status)}`}>{applicationStatusLabel(application.status)}</span></div></div><div className="application-actions"><Link className="btn btn-ghost btn-small" href={reviewHref} title="Open application review"><Radio size={14}/><span>Review</span></Link></div></div>; })}</div>
      <div className="review-pagination"><span>Showing {(page - 1) * APPLICATIONS_PER_PAGE + 1}–{Math.min(page * APPLICATIONS_PER_PAGE, filteredApplications.length)} of {filteredApplications.length}</span><div><button className="icon-button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={16}/></button><span>Page {page} of {pageCount}</span><button className="icon-button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Next page"><ChevronRight size={16}/></button></div></div>
    </> : <div className="review-empty-state"><span className="review-empty-icon"><Inbox size={22}/></span><h3>{emptyTitle}</h3><p>{emptyDescription}</p>{!search && filter === "needs_review" && <a className="btn btn-ghost btn-small" href={`/portal/${server.slug}`} target="_blank" rel="noreferrer">View player portal <ArrowUpRight size={14}/></a>}</div>}
  </section>;
}

export default function DashboardApp() {
  const supabase = createClient();
  const [user, setUser] = useState<{id:string;email?:string}|null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedServerId, setCopiedServerId] = useState("");
  const [billing, setBilling] = useState<OwnerBilling | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [deletingServerId, setDeletingServerId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null);

  async function load() {
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = "/login"; return; }
    setUser({id: auth.user.id, email: auth.user.email});
    const billingResponse = await fetch("/api/billing/status", { cache: "no-store" });
    if (billingResponse.ok) {
      const billingResult = await billingResponse.json() as { billing?: OwnerBilling | null };
      setBilling(billingResult.billing || null);
    }
    setBillingLoading(false);
    const { data: serverData, error: serverError } = await supabase.from("servers").select("*").order("created_at", { ascending: false });
    if (serverError) { setError(serverError.message); setLoading(false); return; }
    const list = (serverData || []) as Server[]; setServers(list);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function signOut() { await supabase.auth.signOut(); window.location.href = "/"; }
  async function copyPortalLink(server: Server) {
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
    setCopiedServerId(server.id);
    window.setTimeout(() => setCopiedServerId(current => current === server.id ? "" : current), 1800);
  }
  async function deleteServer(server: Server) {
    setDeletingServerId(server.id); setError("");
    const response = await fetch(`/api/servers/${server.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setError(result.error || "Could not delete the portal."); setDeletingServerId(""); return; }
    const remainingServers = servers.filter(item => item.id !== server.id);
    setServers(remainingServers);
    setDeletingServerId("");
    setDeleteTarget(null);
  }

  const serverLimitReached = Boolean(billing && billing.server_limit !== -1 && servers.length >= billing.server_limit);
  const canCreateServer = !billingLoading && !loading && billing?.status === "active" && !serverLimitReached;
  const portalConfigurationLocked = billing?.status === "suspended";
  const createServerTitle = billingLoading || loading
    ? "Checking your plan"
    : billing?.status !== "active"
      ? "Choose an active plan below first"
      : serverLimitReached
        ? `Your ${billing.plan_key} plan allows ${billing.server_limit} server${billing.server_limit === 1 ? "" : "s"}`
        : "Add a Discord server";
  return <main className="dashboard-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><nav className="topnav"><span>{user?.email}</span><button className="btn btn-ghost btn-small" onClick={signOut}><LogOut size={14}/> Sign out</button></nav></header>
    <div className="dashboard-main">
      <div className="page-heading"><div><span className="eyebrow">owner workspace</span><h1>Your portals.</h1><p className="subtle">Choose a community to manage its applications, interviews, and whitelist decisions.</p></div><button className="btn btn-primary" onClick={()=>setShowCreate(true)} disabled={!canCreateServer} title={createServerTitle}><Plus size={16}/> Add a Discord server</button></div>
      <BillingPanel suppressCheckout={showCreate} onActivated={() => { void load(); }} />
      {error && <div className="form-error" style={{marginBottom:18}}>{error}</div>}
      <section className="panel portal-directory-panel"><div className="panel-title"><div><h2>Your communities</h2><p className="subtle panel-subtitle">Each portal has its own private review workspace.</p></div><span>{servers.length} total</span></div>{loading ? <div className="empty-state">Loading portals…</div> : servers.length ? <div className="portal-list">{servers.map(server=>{const portalUrl=typeof window!=="undefined"?`${window.location.origin}/portal/${server.slug}`:`/portal/${server.slug}`;const copied=copiedServerId===server.id;const deleting=deletingServerId===server.id;return <div key={server.id} className="server-item"><div className="server-item-head"><Link className="server-item-main" href={`/dashboard/servers/${server.id}`}><span className="server-name">{server.name}</span><span className="server-slug">/{server.slug}</span><span className="portal-open-hint">Open workspace →</span></Link><div className="server-item-actions">{portalConfigurationLocked ? <span className="icon-button icon-button-disabled" title="Portal configuration is locked while the subscription is paused" aria-label="Portal configuration locked"><Settings2 size={15}/></span> : <Link className="icon-button" href={`/dashboard/servers/${server.id}/settings`} title={`Configure ${server.name}`} aria-label={`Configure ${server.name}`}><Settings2 size={15}/></Link>}<button className="icon-button icon-button-danger" onClick={()=>setDeleteTarget(server)} disabled={deleting} title={`Delete ${server.name}`} aria-label={`Delete ${server.name}`}>{deleting?<span className="button-spinner button-spinner-dark" />:<Trash2 size={15}/>}</button></div></div><div className="server-link-row"><span className="server-link" title={portalUrl}>{portalUrl}</span><button className="btn btn-ghost btn-small server-copy" onClick={()=>copyPortalLink(server)} title={copied?"Portal link copied":"Copy portal link"} aria-label={copied?"Portal link copied":"Copy portal link"}>{copied?<Check size={14}/>:<Copy size={14}/>}<span>{copied?"Copied":"Copy"}</span></button></div></div>})}</div> : <div className="empty-state">Your first server portal starts here. Add a Discord community to get a shareable player link.</div>}<button className="btn btn-ghost" style={{width:"100%",marginTop:14}} onClick={()=>setShowCreate(true)} disabled={!canCreateServer} title={createServerTitle}><Plus size={15}/> Create another portal</button></section>
      {user && <FeedbackPanel userId={user.id} supabase={supabase} />}
    </div>
    {showCreate && <CreateServerModal userId={user?.id || ""} supabase={supabase} onClose={()=>setShowCreate(false)} onCreated={()=>{setShowCreate(false);load();}} />}
    {deleteTarget && <ConfirmModal title={`Delete ${deleteTarget.name}?`} description="This permanently removes its applications, interviews, recordings, questions, and portal configuration." confirmLabel="Delete portal" busy={deletingServerId === deleteTarget.id} onCancel={()=>setDeleteTarget(null)} onConfirm={()=>void deleteServer(deleteTarget)} />}
  </main>;
}

function CreateServerModal({userId, supabase, onClose, onCreated}: {userId:string; supabase:ReturnType<typeof createClient>; onClose:()=>void; onCreated:()=>void}) {
  const [name,setName]=useState(""); const [roleId,setRoleId]=useState(""); const [roleName,setRoleName]=useState("Approved"); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  function slugify(value:string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48) || `server-${Date.now()}`; }
  async function create(event:React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); const slug=slugify(name); const {data:server,error:serverError}=await supabase.from("servers").insert({owner_id:userId,name,slug,discord_guild_id:null,approved_role_id:roleId||null,approved_role_name:roleName||null}).select().single(); if(serverError||!server){setError(serverError?.message||"Could not create server");setBusy(false);return;} const {error:memberError}=await supabase.from("server_members").insert({server_id:server.id,user_id:userId,role:"owner"}); if(memberError){setError(memberError.message);setBusy(false);return;} await supabase.from("question_bank").insert(defaultQuestions.map((prompt,order_index)=>({server_id:server.id,prompt,order_index,created_by:userId}))); await supabase.from("application_fields").insert([{server_id:server.id,field_key:"player_name",label:"Player name",description:"Your FiveM or in-game name.",field_type:"text",placeholder:"Your in-game name",is_required:true,order_index:0},{server_id:server.id,field_key:"game_name",label:"Character name",description:"The character you plan to play.",field_type:"text",placeholder:"Optional",is_required:false,order_index:1},{server_id:server.id,field_key:"experience",label:"Tell us about your experience",description:"Share your FiveM, roleplay, or community experience.",field_type:"textarea",placeholder:"A few sentences is plenty.",is_required:false,order_index:2}]); setBusy(false); onCreated(); }
  return <div className="modal-backdrop"><section className="modal"><div className="panel-title"><div><span className="eyebrow">new community</span><h2 style={{marginTop:8}}>Create your player portal</h2></div><button className="btn btn-ghost btn-small" onClick={onClose}>×</button></div><p className="subtle" style={{fontSize:13}}>After creation, install the Dexlyy bot from portal settings, then verify your Discord server connection.</p><form className="form-stack" onSubmit={create}><label className="label">Community name<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Dexlyy RP" required /></label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><label className="label">Approved role ID<input className="input" value={roleId} onChange={e=>setRoleId(e.target.value)} placeholder="Optional" /></label><label className="label">Approved role name<input className="input" value={roleName} onChange={e=>setRoleName(e.target.value)} placeholder="Approved" /></label></div>{error&&<div className="form-error">{error}</div>}<button className="btn btn-primary" disabled={busy}>{busy?"Creating…":"Create portal"}</button></form></section></div>;
}

export function ConfigureServerModal({server, supabase, onClose, onSaved, variant="modal"}: {server:Server; supabase:ReturnType<typeof createClient>; onClose:()=>void; onSaved:()=>void; variant?:"modal"|"page"}) {
  const [guildId, setGuildId] = useState(server.discord_guild_id || "");
  const [roleId, setRoleId] = useState(server.approved_role_id || "");
  const [roleName, setRoleName] = useState(server.approved_role_name || "Approved");
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [{data: fieldData, error: fieldError}, {data: questionData, error: questionError}] = await Promise.all([
        supabase.from("application_fields").select("*").eq("server_id", server.id).order("order_index"),
        supabase.from("question_bank").select("*").eq("server_id", server.id).order("order_index"),
      ]);
      if (fieldError || questionError) setError(fieldError?.message || questionError?.message || "Could not load configuration.");
      setFields((fieldData || []) as ApplicationField[]);
      setQuestions((questionData || []) as Question[]);
      setLoading(false);
    })();
  }, [server.id]);

  function addField() {
    setFields(current => [...current, {id:"", server_id:server.id, field_key:`custom_field_${current.length + 1}`, label:"New application field", description:null, field_type:"textarea", placeholder:"", options:[], is_required:false, is_active:true, order_index:current.length}]);
  }
  function addQuestion() {
    setQuestions(current => [...current, {id:"", server_id:server.id, prompt:"New interview question", scenario:null, order_index:current.length, is_active:true}]);
  }
  function updateField(index:number, patch:Partial<ApplicationField>) { setFields(current => current.map((field, itemIndex) => itemIndex === index ? {...field, ...patch} : field)); }
  function updateQuestion(index:number, patch:Partial<Question>) { setQuestions(current => current.map((question, itemIndex) => itemIndex === index ? {...question, ...patch} : question)); }
  function keyFor(value:string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,48) || "custom_field"; }

  async function save() {
    setBusy(true); setError("");
    const connectionResponse = await fetch(`/api/servers/${encodeURIComponent(server.id)}/discord/connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: guildId.trim() || null }),
    });
    const connectionResult = await connectionResponse.json().catch(() => null) as { error?: string } | null;
    if (!connectionResponse.ok) { setError(connectionResult?.error || "Could not verify the Discord connection."); setBusy(false); return; }
    const {error: serverSaveError} = await supabase.from("servers").update({discord_guild_id:guildId.trim() || null,approved_role_id:roleId.trim() || null,approved_role_name:roleName.trim() || null}).eq("id", server.id);
    if (serverSaveError) { setError(serverSaveError.message); setBusy(false); return; }
    const normalizedFields = fields.map((field, index) => ({...field, field_key:keyFor(field.field_key || field.label), order_index:index}));
    const keys = normalizedFields.map(field => field.field_key);
    if (new Set(keys).size !== keys.length) { setError("Each application field needs a unique field key."); setBusy(false); return; }
    const fieldRows = normalizedFields.map(({id, ...field}) => id ? {id, ...field} : field);
    const {error: fieldSaveError} = fieldRows.length ? await supabase.from("application_fields").upsert(fieldRows, {onConflict:"id"}) : {error:null};
    if (fieldSaveError) { setError(fieldSaveError.message); setBusy(false); return; }
    const keepFieldIds = normalizedFields.filter(field => field.id).map(field => field.id);
    const fieldDelete = supabase.from("application_fields").delete().eq("server_id", server.id);
    const {error: fieldDeleteError} = keepFieldIds.length ? await fieldDelete.not("id", "in", `(${keepFieldIds.join(",")})`) : await fieldDelete;
    if (fieldDeleteError) { setError(fieldDeleteError.message); setBusy(false); return; }

    const normalizedQuestions = questions.map((question, index) => ({...question, order_index:index}));
    const questionRows = normalizedQuestions.map(({id, ...question}) => id ? {id, ...question} : question);
    const {error: questionSaveError} = questionRows.length ? await supabase.from("question_bank").upsert(questionRows, {onConflict:"id"}) : {error:null};
    if (questionSaveError) { setError(questionSaveError.message); setBusy(false); return; }
    const keepQuestionIds = normalizedQuestions.filter(question => question.id).map(question => question.id);
    const questionDelete = supabase.from("question_bank").delete().eq("server_id", server.id);
    const {error: questionDeleteError} = keepQuestionIds.length ? await questionDelete.not("id", "in", `(${keepQuestionIds.join(",")})`) : await questionDelete;
    if (questionDeleteError) { setError(questionDeleteError.message); setBusy(false); return; }
    setBusy(false); onSaved();
  }

  return <div className={variant === "page" ? "settings-page-inner" : "modal-backdrop"}><section className={`modal modal-wide ${variant === "page" ? "settings-card" : ""}`}><div className="panel-title"><div><span className="eyebrow">{server.name} · configuration</span><h2 style={{marginTop:8}}>Shape the application</h2></div><button className="btn btn-ghost btn-small" onClick={onClose}>×</button></div><p className="subtle" style={{fontSize:13}}>Choose exactly what applicants fill in and what the AI interviewer asks. Inactive items stay saved but are hidden from the player portal.</p>{loading?<div className="empty-state">Loading configuration…</div>:<><section className="config-section config-section-first"><div className="config-section-head"><div><h3>Discord connection</h3><p className="subtle">These settings enable membership verification and automatic whitelist-role assignment.</p></div></div><div className="config-grid"><label className="label">Discord server ID<input className="input" value={guildId} onChange={e=>setGuildId(e.target.value)} placeholder="123456789012345678" /></label><label className="label">Approved role ID<input className="input" value={roleId} onChange={e=>setRoleId(e.target.value)} placeholder="123456789012345678" /></label></div><label className="label">Approved role name<input className="input" value={roleName} onChange={e=>setRoleName(e.target.value)} placeholder="Approved" /></label></section><section className="config-section"><div className="config-section-head"><div><h3>Application fields</h3><p className="subtle">These appear before the voice interview.</p></div><button type="button" className="btn btn-ghost btn-small" onClick={addField}><Plus size={14}/> Add field</button></div><div className="config-list">{fields.map((field,index)=><div className={`config-card ${field.is_active?"":"config-card-muted"}`} key={field.id || `new-field-${index}`}><div className="config-card-head"><strong>Field {index+1}</strong><label className="check-label"><input type="checkbox" checked={field.is_active} onChange={e=>updateField(index,{is_active:e.target.checked})}/> Visible</label><label className="check-label"><input type="checkbox" checked={field.is_required} onChange={e=>updateField(index,{is_required:e.target.checked})}/> Required</label><button type="button" className="text-link config-remove" onClick={()=>setFields(current=>current.filter((_,itemIndex)=>itemIndex!==index))}>Remove</button></div><div className="config-grid"><label className="label">Label<input className="input" value={field.label} onChange={e=>updateField(index,{label:e.target.value})} /></label><label className="label">Field key<input className="input" value={field.field_key} onChange={e=>updateField(index,{field_key:e.target.value})} /></label><label className="label">Type<select className="select" value={field.field_type} onChange={e=>updateField(index,{field_type:e.target.value as ApplicationField["field_type"]})}><option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Dropdown</option></select></label><label className="label">Placeholder<input className="input" value={field.placeholder || ""} onChange={e=>updateField(index,{placeholder:e.target.value})} placeholder="What should the player enter?" /></label></div><label className="label">Helper text<input className="input" value={field.description || ""} onChange={e=>updateField(index,{description:e.target.value})} placeholder="Shown below the field" /></label>{field.field_type === "select" && <label className="label">Dropdown options <span style={{fontWeight:400,color:"#9aa6b8"}}>comma separated</span><input className="input" value={(field.options || []).join(", ")} onChange={e=>updateField(index,{options:e.target.value.split(",").map(option=>option.trim()).filter(Boolean)})} placeholder="Civilian, Police, EMS" /></label>}</div>)}</div></section><section className="config-section"><div className="config-section-head"><div><h3>AI interview questions</h3><p className="subtle">The active questions and scenarios guide the GPT Realtime interviewer.</p></div><button type="button" className="btn btn-ghost btn-small" onClick={addQuestion}><Plus size={14}/> Add question</button></div><div className="config-list">{questions.map((question,index)=><div className={`config-card ${question.is_active?"":"config-card-muted"}`} key={question.id || `new-question-${index}`}><div className="config-card-head"><strong>Question {index+1}</strong><label className="check-label"><input type="checkbox" checked={question.is_active} onChange={e=>updateQuestion(index,{is_active:e.target.checked})}/> Active</label><button type="button" className="text-link config-remove" onClick={()=>setQuestions(current=>current.filter((_,itemIndex)=>itemIndex!==index))}>Remove</button></div><label className="label">Question<textarea className="textarea config-textarea" value={question.prompt} onChange={e=>updateQuestion(index,{prompt:e.target.value})} /></label><label className="label">Scenario guidance <span style={{fontWeight:400,color:"#9aa6b8"}}>optional</span><textarea className="textarea config-textarea" value={question.scenario || ""} onChange={e=>updateQuestion(index,{scenario:e.target.value})} placeholder="What should the interviewer explore or test?" /></label></div>)}</div></section></>}{error&&<div className="form-error" style={{marginTop:16}}>{error}</div>}<div className="config-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={busy||loading}>{busy?"Saving…":"Save configuration"}</button></div></section></div>;
}

export function ServerSettingsApp({serverId}:{serverId:string}) {
  const router = useRouter();
  const supabase = createClient();
  const [server, setServer] = useState<Server | null>(null);
  const [billingStatus, setBillingStatus] = useState<OwnerBilling["status"] | null>(null);
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const {data:auth} = await supabase.auth.getUser();
      if (!auth.user) { router.push(`/login?next=/dashboard/servers/${serverId}/settings`); return; }
      const [{data,error:serverError}, {data:billingData,error:billingError}] = await Promise.all([
        supabase.from("servers").select("*").eq("id",serverId).single(),
        supabase.from("owner_billing").select("status,subscription_period_end").eq("user_id",auth.user.id).maybeSingle(),
      ]);
      if (serverError || !data) setError(serverError?.message || "Server not found.");
      else setServer(data as Server);
      if (billingError) setError(billingError.message);
      setBillingStatus((billingData?.status as OwnerBilling["status"] | undefined) || null);
      setBillingPeriodEnd(billingData?.subscription_period_end || null);
      setLoading(false);
    })();
  }, [serverId, router]);

  if (loading) return <main className="settings-page"><div className="settings-loading">Loading server settings…</div></main>;
  if (!server) return <main className="settings-page"><div className="settings-loading"><h1>Settings unavailable.</h1><p className="subtle">{error}</p><Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link></div></main>;
  if (billingStatus === "suspended") return <main className="settings-page"><header className="settings-topbar"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><Link href={`/dashboard/servers/${server.id}`} className="btn btn-ghost btn-small">Back to portal</Link></header><div className="settings-page-heading"><span className="eyebrow">owner workspace · server settings</span><h1>{server.name}</h1><p className="subtle">Your portal is still available through the paid period, but configuration is paused.</p></div><section className="panel settings-locked"><div className="settings-lock-icon"><Settings2 size={20}/></div><h2>Configuration is paused</h2><p className="subtle">Resume your subscription to edit Discord settings, application fields, or interview questions. Your existing portal and reviews remain available until {billingPeriodEnd || "the paid period ends"}.</p><Link href={`/dashboard/servers/${server.id}`} className="btn btn-primary">Back to portal workspace</Link></section></main>;
  return <main className="settings-page settings-page-premium"><header className="settings-topbar"><Link href="/" className="brand"><span className="brand-mark" />Dexlyy</Link><Link href={`/dashboard/servers/${server.id}`} className="btn btn-ghost btn-small">Back to portal</Link></header><div className="settings-page-heading settings-page-hero"><div><span className="eyebrow">owner workspace · server settings</span><h1>{server.name}</h1><p>Configure the complete player experience—from the first application field to the final Discord role.</p></div><div className="settings-hero-mark"><Settings2 size={22}/><span>Portal controls<small>Private owner workspace</small></span></div></div><ServerSettingsForm server={server} supabase={supabase} onBack={()=>router.push(`/dashboard/servers/${server.id}`)} onSaved={()=>router.push(`/dashboard/servers/${server.id}`)} /></main>;
}
