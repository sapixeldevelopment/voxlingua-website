"use client";

import Link from "next/link";
import YouTubeLink from "@/components/youtube-link";
import { useState } from "react";
import { ArrowRight, AudioWaveform, Check, ChevronRight, CircleCheck, FileText, Headphones, LayoutDashboard, Menu, MessageCircle, Mic, Settings2, ShieldCheck, Users, X } from "lucide-react";
import { BILLING_PLANS, REALTIME_PLAN_KEYS, GUIDED_PLAN_KEYS, planFeatures } from "@/lib/billing";

export function MarketingNavigation() {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <div className="site-container site-header-inner">
      <Link className="site-brand" href="/" aria-label="Dexlyy home"><span className="brand-mark" />Dexlyy<span className="site-brand-dot">.</span></Link>
      <nav className="site-desktop-nav" aria-label="Main navigation">
        <a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><Link href="/partners">Partners</Link>
      </nav>
      <div className="site-header-actions">
        <Link href="/login" className="site-sign-in">Sign in</Link>
        <Link href="#pricing" className="site-button site-button-green site-button-small">Get started <ArrowRight size={14} /></Link>
      </div>
      <div className="site-header-utilities">
        <nav className="site-social-links" aria-label="Dexlyy community">
          <YouTubeLink iconOnly />
          <a className="site-social-icon site-social-discord" href="https://discord.gg/kgzKr4bskN" target="_blank" rel="noopener noreferrer" aria-label="Join our Discord community (opens in a new tab)" title="Join our Discord">
            <img src="/discord-mark.svg" width="24" height="24" alt="" />
          </a>
        </nav>
        <button className="site-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="site-mobile-nav" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </div>
    <nav className="site-mobile-nav" id="site-mobile-nav" aria-label="Mobile navigation" hidden={!open} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      {[["Product", "/#product"], ["How it works", "/#how-it-works"], ["Pricing", "/#pricing"], ["Partners", "/partners"], ["Sign in", "/login"]].map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}<ArrowRight size={15} /></Link>)}
      <a href="https://discord.gg/kgzKr4bskN" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Join our Discord<ArrowRight size={15} /></a>
      <YouTubeLink />
    </nav>
  </header>;
}

const previewTabs = ["Interview", "Review", "Welcome"];
const waveform = [12, 23, 35, 19, 43, 29, 52, 33, 21, 46, 61, 35, 49, 26, 56, 39, 20, 47, 32, 58, 42, 23, 37, 16, 29, 43, 21, 35, 17, 26];
export function ProductPreview() {
  const [tab, setTab] = useState(1);
  return <div className="site-product-window"><div className="site-product-chrome"><span className="site-product-logo"><span className="brand-mark" />Dexlyy</span><span className="site-product-server">Harbor Roleplay <ChevronRight size={12} /></span><span className="site-preview-user">HR</span></div><div className="site-product-body"><aside className="site-product-rail" aria-hidden="true"><LayoutDashboard size={18} /><span className="active"><FileText size={18} /></span><Users size={18} /><Settings2 size={18} /><span className="site-rail-bottom"><ShieldCheck size={18} /></span></aside><div className="site-product-content"><div className="site-product-heading"><div><span className="site-micro">YOUR COMMUNITY, IN GOOD HANDS</span><h3>Meet your next player.</h3></div><span className="site-demo-label">DEMO</span></div><div className="site-preview-tabs" role="group" aria-label="Explore the product preview">{previewTabs.map((label, index) => <button type="button" key={label} aria-pressed={tab === index} onClick={() => setTab(index)}><span>0{index + 1}</span>{label}</button>)}</div><div className="site-preview-panel" aria-live="polite">
    {tab === 0 ? <><div className="site-demo-person"><span className="site-avatar">JR</span><div><strong>Jordan Riley</strong><small>Guided voice interview</small></div><span className="site-live-pill"><i /> In conversation</span></div><div className="site-demo-waveform"><span className="site-demo-wave-icon"><Mic size={22} /></span><div>{waveform.map((height, index) => <i key={index} style={{ height: height * .7 }} />)}</div><span>Calm. Natural. On your terms.</span></div><div className="site-demo-transcript"><span><AudioWaveform size={12} /> DEXLYY INTERVIEWER</span><p>“What makes a great roleplay community, and how would you contribute to it?”</p><small>Your questions. A real conversation.</small></div></> : tab === 1 ? <><div className="site-demo-person"><span className="site-avatar">JR</span><div><strong>Jordan Riley</strong><small>Whitelist application · Example player</small></div><span className="site-live-pill"><i /> Ready to review</span></div><div className="site-demo-recording"><span className="site-recording-icon"><Headphones size={19} /></span><div><strong>Every answer. In their own words.</strong><small>Interview recording</small></div><AudioWaveform size={28} /><span>04:32</span></div><div className="site-demo-transcript"><span><FileText size={12} /> TRANSCRIPT EXCERPT</span><p>“A good scene gives everyone a chance to contribute. I’d rather build a story together than try to win every interaction.”</p><small>Application, recording & transcript in one place</small></div><div className="site-demo-decision"><span><ShieldCheck size={14} /> The final decision is yours.</span><button type="button" aria-label="Preview the welcome step" onClick={() => setTab(2)}>Preview approval <Check size={14} /></button></div></> : <div className="site-demo-welcome"><span className="site-welcome-icon"><ShieldCheck size={32} /></span><span className="site-micro">A GREAT FIRST IMPRESSION</span><h4>Welcome to the community.</h4><p>After your team approves, Dexlyy can assign the right Discord role automatically.</p><div><MessageCircle size={19} /><span>Harbor Roleplay<strong><Check size={12} /> Whitelisted</strong></span><CircleCheck size={20} /></div><small>Example approval · No real application is changed</small></div>}
    </div></div></div><div className="site-product-status"><span><span className="site-status-dot" /> Your interview room is always open</span><span><ShieldCheck size={12} /> Human-led approval</span></div></div>;
}

export function MarketingPricing() {
  const [yearly,setYearly]=useState(false);
  const [guided,setGuided]=useState(true);
  return <>
    <div className="site-billing-switch" role="group" aria-label="Interview type">
      <button type="button" aria-pressed={guided} onClick={()=>setGuided(true)}>Guided Voice · Text-to-speech</button>
      <button type="button" aria-pressed={!guided} onClick={()=>setGuided(false)}>Conversational AI · GPT Realtime</button>
    </div>
    <p className="site-billing-explanation">{guided ? "Prepared questions read aloud. Recorded answers for your team to review. No transcripts, AI reviews, scores, voice analysis, or live AI conversation." : "Live AI conversations with recordings, transcripts, AI reviews, scores, and voice analysis. Your team makes the final decision."}</p>
    <div className="site-billing-switch" role="group" aria-label="Billing period"><button type="button" aria-pressed={!yearly} onClick={()=>setYearly(false)}>Monthly</button><button type="button" aria-pressed={yearly} onClick={()=>setYearly(true)}>Yearly · 2 months free</button></div>
    <div className={guided?"site-plans guided-plans":"site-plans"}>{(guided?GUIDED_PLAN_KEYS:REALTIME_PLAN_KEYS).map(key=>{
      const plan=BILLING_PLANS[key],featured=key===(guided?"boost":"medium");
      return <article key={key} className={`site-plan${featured?" site-plan-featured":""}`}>
        <div className="site-plan-ribbon">{featured?"ROOM TO GROW":""}</div><div className="site-plan-content">
        <span className="site-plan-size">{guided?"GUIDED VOICE":"GPT REALTIME"}</span><h3>{plan.name}</h3>
        <p className="site-plan-description">{plan.description}</p><div className="site-plan-price"><strong>${Number(yearly?plan.yearlyPrice:plan.price)}</strong><span>/{yearly&&key!=="free"?"year":"month"}</span></div>
        <p className="site-plan-billing">{key==="free"?"No payment required":yearly?"USD billed yearly · 2 months free":"USD billed monthly"}</p>
        <Link href="/login" className={`site-button ${featured?"site-button-green":"site-button-outline"}`}>Get started <ArrowRight size={14}/></Link>
        <div className="site-plan-divider"/><ul><li><AudioWaveform size={15}/>{plan.interviews} interviews / month</li><li><LayoutDashboard size={15}/>{plan.servers} server portals</li><li><Users size={15}/>{plan.staff===-1?"Unlimited":plan.staff} staff seats</li></ul>
        <p className="plan-feature-disclosure">{planFeatures(key)}</p>
      </div></article>;
    })}</div></>;
}
