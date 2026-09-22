import Link from "next/link";
import YouTubeLink from "@/components/youtube-link";
import { ArrowRight, AudioWaveform, Check, CheckCircle2, ChevronDown, Clock3, Headphones, LayoutDashboard, ListChecks, MessageCircle, Play, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { BILLING_PLANS, PLAN_KEYS } from "@/lib/billing";
import { MarketingNavigation, ProductPreview, MarketingPricing } from "@/components/marketing-experience";
import "./marketing.css";

const questions = [
  ["How does Dexlyy work?", "Create a branded portal, connect your Discord server, and configure your application and interview questions. Players apply and complete an AI voice interview. Your team reviews the recording and transcript, makes the decision, and can assign the approval role automatically."],
  ["Does AI decide who gets into our server?", "No. The AI conducts the conversation and helps organise the information. Your team makes the final approval decision, with the application, recording, and transcript available for review."],
  ["What counts towards my interview allowance?", "Only completed interviews that a player submits count towards your allowance. Abandoned interviews do not use a credit. Your plan includes a monthly interview allowance, including when you pay yearly."],
  ["What if we need more interviews?", "Add prepaid interview credits from your dashboard. Extra credits remain available until used. You can also change your subscription as your community grows; changes require PayPal confirmation."],
  ["How does yearly billing work?", "Pay for ten months and receive twelve months of service. For example, Starter costs $10 monthly or $100 billed yearly. Your interview allowance still renews monthly."],
  ["Can my staff help review applications?", "Yes. Invite administrators and reviewers from your Discord community with their own accounts. Each plan includes staff seats, and you control their access. Your team does not need to share the owner account."],
];

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Dexlyy",
    applicationCategory: "BusinessApplication", operatingSystem: "Web",
    description: "AI voice interviews and a human-led application review workspace for FiveM communities.",
    offers: { "@type": "AggregateOffer", lowPrice: BILLING_PLANS.free.price, highPrice: BILLING_PLANS.ultra.price, priceCurrency: "USD", offerCount: PLAN_KEYS.length },
  };
  return <main className="site-page" id="top">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <a className="site-skip" href="#main-content">Skip to content</a>
    <div className="site-announcement"><span className="site-status-dot" /> Your interview room. Open around the clock.<a href="#pricing">Paid plans from $5 <ArrowRight size={12} /></a></div>
    <MarketingNavigation />
    <section className="site-hero site-container" id="main-content">
      <div className="site-hero-copy">
        <span className="site-eyebrow"><span className="site-eyebrow-line" /> THE NEXT CHAPTER OF YOUR COMMUNITY</span>
        <h1>Better players.<br />Less busywork.<br /><em>More roleplay.</em></h1>
        <p>Your FiveM server deserves a better front door. Let Dexlyy handle the voice interviews, so your team can focus on the people behind them.</p>
        <div className="site-hero-actions"><Link className="site-button site-button-green" href="#pricing">Find your plan <ArrowRight size={17} /></Link><Link className="site-button site-button-outline" href="#demo"><Play size={14} /> See it in action</Link></div>
        <div className="site-hero-proof"><span><CheckCircle2 size={15} /> Free plan available · Paid plans from $5/month</span><span><CheckCircle2 size={15} /> Your team makes the final call</span></div>
      </div>
      <div className="site-hero-product"><div className="site-preview-caption"><span><span className="site-status-dot" /> YOUR NEW REVIEW WORKSPACE</span><span>Product preview</span></div><ProductPreview /><div className="site-preview-foot"><span><ShieldCheck size={15} /> Built around your Discord community</span><span>Apply. Talk. Review. Welcome.</span></div></div>
    </section>
    <div className="site-capabilities site-container" aria-label="Included capabilities"><span className="site-capabilities-label">ONE CONNECTED WORKFLOW</span><span><MessageCircle size={18} /> Discord verification</span><span><AudioWaveform size={18} /> AI voice interviews</span><span><Headphones size={18} /> Recordings & transcripts</span><span><ShieldCheck size={18} /> Human approval</span></div>

    <section className="site-section site-container" id="product">
      <div className="site-section-heading"><div><span className="site-eyebrow">LESS ADMIN. MORE COMMUNITY.</span><h2>A better welcome.<br /><em>Less work for your team.</em></h2></div><p>Interviews on their schedule. Your standards. Your final decision.</p></div>
      <div className="site-benefits">
        <article className="site-benefit site-benefit-featured"><div className="site-card-top"><span className="site-icon"><Clock3 size={22} /></span><span className="site-card-index">01 / AVAILABILITY</span></div><h3>Always open.<br />No scheduling.</h3><p>Players interview whenever they’re ready. Your staff don’t need to be online.</p><div className="site-benefit-summary"><Clock3 size={22} /><div><strong>24/7 interviews</strong><span>Every time zone. No appointments.</span></div></div></article>
        <article className="site-benefit"><div className="site-card-top"><span className="site-icon"><ListChecks size={22} /></span><span className="site-card-index">02 / CONSISTENCY</span></div><h3>Your questions.<br />Your standards.</h3><p>Choose the questions and roleplay scenarios that matter to your community.</p><div className="site-benefit-summary"><ListChecks size={22} /><div><strong>Built around your server</strong><span>Experience, expectations and scenarios.</span></div></div></article>
        <article className="site-benefit"><div className="site-card-top"><span className="site-icon"><Users size={22} /></span><span className="site-card-index">03 / CONTROL</span></div><h3>Hear their answers.<br />Make the call.</h3><p>Review the recording with your team. You decide who joins—not the AI.</p><div className="site-benefit-summary"><ShieldCheck size={22} /><div><strong>Human-led approval</strong><span>Transcripts included with GPT Realtime.</span></div></div></article>
      </div>
    </section>

    <section className="site-workflow-wrap" id="how-it-works"><div className="site-container site-section">
      <div className="site-section-heading"><div><span className="site-eyebrow">A BETTER WAY TO WELCOME PLAYERS</span><h2>From “can I join?”<br /><em>to “welcome aboard.”</em></h2></div><Link href="/login" className="site-text-link">Build your interview portal <ArrowRight size={17} /></Link></div>
      <div className="site-steps">{[
        { icon: SlidersHorizontal, title: "Make it yours", text: "Add your branding, questions, and Discord roles. Your portal reflects your community." },
        { icon: AudioWaveform, title: "Let the conversation flow", text: "Players verify with Discord and complete a guided voice interview whenever they’re ready." },
        { icon: LayoutDashboard, title: "Get the full picture", text: "Your team reviews the application, transcript, and recording in one organised workspace." },
        { icon: ShieldCheck, title: "Welcome the right people", text: "Approve the application and let Dexlyy assign the Discord role you’ve chosen." },
      ].map(({ icon: Icon, title, text }, index) => <article key={title}><div className="site-step-top"><span>0{index + 1}</span><Icon size={22} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>

    <section className="site-section site-container site-demo-section" id="demo"><div className="site-demo-copy"><span className="site-eyebrow">MEET YOUR NEW WORKFLOW</span><h2>A little less chaos.<br /><em>A lot more clarity.</em></h2><p>See how a player moves from your branded portal to a completed interview, a staff decision, and their Discord role.</p><ul><li><CheckCircle2 size={17} /> A professional welcome for every applicant</li><li><CheckCircle2 size={17} /> All the context your reviewers need</li><li><CheckCircle2 size={17} /> One clear decision from your team</li></ul><Link href="#pricing" className="site-text-link">Explore the plans <ArrowRight size={17} /></Link></div><div className="site-film"><div className="site-film-top"><span><Play size={13} /> THE DEXLYY TOUR</span><span>20 seconds</span></div><video controls playsInline preload="none" poster="/dexlyy-product-tour-poster.png" aria-label="Dexlyy product tour"><source src="/dexlyy-product-tour.mp4" type="video/mp4" />Watch the <a href="/dexlyy-product-tour.mp4">Dexlyy product tour</a>.</video><div className="site-film-bottom"><span>01 Apply</span><ArrowRight size={12} /><span>02 Interview</span><ArrowRight size={12} /><span>03 Review</span><ArrowRight size={12} /><span>04 Welcome</span></div></div></section>

    <section className="site-pricing-wrap" id="pricing"><div className="site-container site-section"><div className="site-section-heading site-centered"><span className="site-eyebrow">A SMALL INVESTMENT. A BETTER FIRST IMPRESSION.</span><h2>A plan for your community.<br /><em>Room for what comes next.</em></h2><p>Choose Guided Voice for recorded answers, or GPT Realtime for live conversations, transcripts, and AI reviews.</p></div><MarketingPricing /><div className="site-pricing-included"><span><CheckCircle2 size={16} /> Only submitted interviews count</span><span><CheckCircle2 size={16} /> Extra credits available</span><span><CheckCircle2 size={16} /> Payments through PayPal</span></div></div></section>

    <section className="site-section site-container site-faq" id="faq"><div><span className="site-eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</span><h2>Good questions.<br /><em>Clear answers.</em></h2><p>Want to talk through your setup?</p><a className="site-text-link" href="mailto:support@dexlyy.com">Talk to Dexlyy <ArrowRight size={16} /></a></div><div className="site-faq-list">{questions.map(([question, answer], index) => <details key={question} name="site-faq"><summary><span className="site-faq-number">0{index + 1}</span><span>{question}</span><ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></section>

    <section className="site-closing site-container"><div className="site-closing-orbit" aria-hidden="true" /><span className="site-eyebrow">MAKE ROOM FOR YOUR NEXT GREAT PLAYER</span><h2>Build the community<br /><em>you want to be part of.</em></h2><p>Give your players a better welcome.<br />Give your team their time back.</p><Link href="#pricing" className="site-button site-button-light">Find your plan <ArrowRight size={18} /></Link><span className="site-closing-note">From $10/month · Your community. Your final call.</span></section>
    <footer className="site-footer site-container"><div className="site-footer-main"><div><Link href="/" className="site-brand"><span className="brand-mark" />Dexlyy<span className="site-brand-dot">.</span></Link><p>A better front door for<br />your FiveM community.</p></div><nav aria-label="Footer product links"><strong>Explore</strong><a href="#product">The product</a><a href="#how-it-works">How it works</a><a href="#pricing">Plans & pricing</a></nav><nav aria-label="Footer community links"><strong>Connect</strong><a href="https://discord.gg/kgzKr4bskN" target="_blank" rel="noopener noreferrer">Join our Discord</a><YouTubeLink /><Link href="/partners">Become a partner <ArrowRight size={12} /></Link><a href="mailto:support@dexlyy.com">Contact support</a><Link href="/login">Sign in to Dexlyy</Link></nav><div className="site-footer-note"><span className="site-status-dot" /> Ready when your players are.<p>AI-powered conversations.<br />Human-led communities.</p></div></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} Dexlyy. All rights reserved.</span><span>Independent software for FiveM communities.</span><a href="#top">Back to top ↑</a></div></footer>
  </main>;
}
