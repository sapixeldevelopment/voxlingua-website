import Link from "next/link";
import { BILLING_PLANS } from "@/lib/billing";
import {
  ArrowRight,
  AudioWaveform,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Headphones,
  ListChecks,
  MessageSquareText,
  Mic2,
  Play,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users2,
} from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: Number(BILLING_PLANS.starter.price),
    description: "For new communities with a lighter application flow.",
    interviews: "15 interviews / month",
    servers: "1 server portal",
    staff: "2 staff seats",
    cta: "Start with Starter",
  },
  {
    name: "Small",
    price: Number(BILLING_PLANS.small.price),
    description: "For a growing community building a reliable intake flow.",
    interviews: "50 interviews / month",
    servers: "1 server portal",
    staff: "5 staff seats",
    cta: "Start with Small",
  },
  {
    name: "Medium",
    price: Number(BILLING_PLANS.medium.price),
    description: "For busy servers with a steady stream of new players.",
    interviews: "150 interviews / month",
    servers: "1 server portal",
    staff: "15 staff seats",
    cta: "Choose Medium",
    featured: true,
  },
  {
    name: "Pro",
    price: Number(BILLING_PLANS.pro.price),
    description: "For established communities managing multiple teams.",
    interviews: "300 interviews / month",
    servers: "Up to 3 server portals",
    staff: "30 staff seats",
    cta: "Choose Pro",
  },
  {
    name: "Ultra",
    price: Number(BILLING_PLANS.ultra.price),
    description: "For networks that operate communities at serious scale.",
    interviews: "750 interviews / month",
    servers: "Up to 15 server portals",
    staff: "Unlimited staff seats",
    cta: "Choose Ultra",
  },
];

const faq = [
  {
    question: "What counts as an interview?",
    answer:
      "Only a completed interview that the player submits counts toward your monthly allowance. If they leave early or lose connection, it does not use a credit.",
  },
  {
    question: "Does AI decide who joins our server?",
    answer:
      "No. Dexlyy conducts your configured interview and organises the result. Your owner or staff team always makes the final approval decision.",
  },
  {
    question: "Does it work with our Discord roles?",
    answer:
      "Yes. Dexlyy verifies Discord membership and can automatically assign your chosen approval role after a staff member approves an application.",
  },
  {
    question: "Can we buy more interviews?",
    answer:
      "Yes. Prepaid interview credits can be added when you need them, and those credits remain available until they are used.",
  },
];

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Dexlyy",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI-powered voice interviews, application review, Discord verification, and automatic role assignment for FiveM communities.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "15",
      highPrice: "199",
      priceCurrency: "USD",
      offerCount: "5",
    },
    featureList: [
      "AI voice interviews",
      "Discord membership verification",
      "Interview recordings and transcripts",
      "Human approval workflow",
      "Automatic Discord role assignment",
    ],
  };

  return (
    <main className="marketing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <div className="marketing-announcement">
        <span className="marketing-pulse" /> Interview around the clock. Pay
        only for completed submissions.
      </div>

      <header className="marketing-header">
        <Link href="/" className="marketing-brand" aria-label="Dexlyy home">
          <span className="brand-mark" />
          <span>Dexlyy</span>
        </Link>
        <nav className="marketing-nav" aria-label="Main navigation">
          <div className="marketing-nav-links">
            <Link href="#product">Product</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="#faq">FAQ</Link>
            <Link href="/partners">Partners</Link>
          </div>
          <Link
            href="/login"
            className="btn btn-primary btn-small marketing-nav-cta"
          >
            Create your portal <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <div className="marketing-kicker">
            <Sparkles size={14} /> Built for serious FiveM communities
          </div>
          <h1>
            Meet the right players.<span> Without living in interviews.</span>
          </h1>
          <p>
            Dexlyy runs structured, natural voice interviews for your FiveM
            server 24/7—then gives your team the recording, transcript, and
            application needed to make the final call.
          </p>
          <div className="marketing-hero-actions">
            <Link href="/login" className="btn marketing-primary-cta">
              Launch your interview portal <ArrowRight size={17} />
            </Link>
            <Link href="#how-it-works" className="marketing-text-link">
              See the full workflow <span>↓</span>
            </Link>
          </div>
          <div className="marketing-hero-assurance">
            <span>
              <CheckCircle2 size={15} /> From $10/month
            </span>
            <span>
              <CheckCircle2 size={15} /> Human approval stays final
            </span>
            <span>
              <CheckCircle2 size={15} /> Abandoned interviews cost nothing
            </span>
          </div>
        </div>

        <div
          className="marketing-product-stage"
          aria-label="Dexlyy product preview"
        >
          <div className="marketing-stage-glow" />
          <div className="marketing-app-window">
            <div className="marketing-app-topbar">
              <div className="marketing-window-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="marketing-app-title">
                Vellaryn RP · review queue
              </span>
              <span className="marketing-live">
                <i /> Live
              </span>
            </div>
            <div className="marketing-app-body">
              <aside className="marketing-app-sidebar">
                <span className="marketing-mini-logo">D</span>
                <span className="active" />
                <span />
                <span />
                <span />
              </aside>
              <div className="marketing-queue">
                <div className="marketing-queue-head">
                  <div>
                    <small>APPLICATIONS</small>
                    <strong>Ready for review</strong>
                  </div>
                  <span>3 waiting</span>
                </div>
                <div className="marketing-candidate selected">
                  <span className="marketing-avatar">JM</span>
                  <div>
                    <strong>Jayden Morris</strong>
                    <small>Interview complete · 8 min</small>
                  </div>
                  <span className="marketing-status">Review</span>
                </div>
                <div className="marketing-candidate">
                  <span className="marketing-avatar purple">SK</span>
                  <div>
                    <strong>Sage K.</strong>
                    <small>Transcript ready · 11 min</small>
                  </div>
                  <span className="marketing-status muted">New</span>
                </div>
                <div className="marketing-candidate">
                  <span className="marketing-avatar sand">TN</span>
                  <div>
                    <strong>Tyler N.</strong>
                    <small>Approved · role assigned</small>
                  </div>
                  <Check size={14} />
                </div>
              </div>
              <div className="marketing-review-pane">
                <div className="marketing-review-head">
                  <div>
                    <small>VOICE INTERVIEW</small>
                    <strong>Jayden Morris</strong>
                  </div>
                  <span className="pill pill-green">Complete</span>
                </div>
                <div className="marketing-waveform">
                  {[
                    18, 30, 13, 42, 27, 49, 21, 36, 16, 45, 29, 38, 19, 31, 14,
                    25,
                  ].map((height, index) => (
                    <i key={index} style={{ height }} />
                  ))}
                </div>
                <div className="marketing-transcript">
                  <span>
                    <Bot size={13} /> DEXLYY INTERVIEWER
                  </span>
                  <p>
                    Tell me about a time you protected the quality of a roleplay
                    scene.
                  </p>
                  <span className="player">
                    <Mic2 size={13} /> PLAYER
                  </span>
                  <p>
                    We paused the scene, clarified the rules, and made sure
                    everyone could continue fairly.
                  </p>
                </div>
                <div className="marketing-review-actions">
                  <button type="button">
                    <Headphones size={14} /> Listen
                  </button>
                  <button type="button" className="approve">
                    <Check size={14} /> Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="marketing-floating-card voice">
            <AudioWaveform size={17} />
            <div>
              <strong>Natural voice interview</strong>
              <span>Live and conversational</span>
            </div>
          </div>
          <div className="marketing-floating-card role">
            <ShieldCheck size={17} />
            <div>
              <strong>Discord role assigned</strong>
              <span>Approval completed</span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="marketing-trust-row"
        aria-label="Core platform capabilities"
      >
        <span>
          <MessageSquareText size={17} /> Discord verification
        </span>
        <span>
          <Mic2 size={17} /> AI voice interview
        </span>
        <span>
          <Headphones size={17} /> Recording + transcript
        </span>
        <span>
          <UserCheck size={17} /> Human approval
        </span>
        <span>
          <ShieldCheck size={17} /> Automatic role assignment
        </span>
      </section>

      <section className="marketing-film" aria-labelledby="product-film-title">
        <div className="marketing-film-heading">
          <div>
            <span className="marketing-overline">See Dexlyy in motion</span>
            <h2 id="product-film-title">From first hello to the right Discord role.</h2>
          </div>
          <div className="marketing-film-intro">
            <p>
              Watch the complete player journey in twenty seconds: a branded
              application, a natural AI voice interview, human review, and
              automatic Discord access.
            </p>
            <Link href="/login" className="marketing-text-link">
              Build your workflow <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="marketing-film-stage">
          <div className="marketing-film-topbar">
            <span><i /> Dexlyy product tour</span>
            <span><Play size={12} fill="currentColor" /> 20 second overview</span>
          </div>
          <video
            className="marketing-film-video"
            poster="/dexlyy-product-tour-poster.png"
            preload="metadata"
            autoPlay
            muted
            loop
            playsInline
            controls
            aria-describedby="product-film-description"
          >
            <source src="/dexlyy-product-tour.mp4" type="video/mp4" />
            Your browser does not support embedded video.
          </video>
          <div className="marketing-film-footer" id="product-film-description">
            <span>01 Apply</span>
            <i />
            <span>02 Talk</span>
            <i />
            <span>03 Review</span>
            <i />
            <span>04 Welcome</span>
          </div>
        </div>
      </section>

      <section className="marketing-problem" id="product">
        <div className="marketing-section-intro">
          <span className="marketing-overline">A better front door</span>
          <h2>
            Your staff should shape the community—not chase interview slots.
          </h2>
          <p>
            Replace scheduling, scattered DMs, and inconsistent questions with
            one polished intake system that is ready whenever a player is.
          </p>
        </div>
        <div className="marketing-outcome-grid">
          <article>
            <span className="marketing-card-number">01</span>
            <Clock3 size={20} />
            <h3>Always available</h3>
            <p>
              Players apply and interview across every time zone without waiting
              for staff.
            </p>
          </article>
          <article>
            <span className="marketing-card-number">02</span>
            <ListChecks size={20} />
            <h3>Consistent by design</h3>
            <p>
              Every candidate gets the questions and scenarios your leadership
              team approved.
            </p>
          </article>
          <article>
            <span className="marketing-card-number">03</span>
            <Users2 size={20} />
            <h3>Human where it matters</h3>
            <p>
              Your staff listen, review the evidence, and make every final
              membership decision.
            </p>
          </article>
        </div>
      </section>

      <section className="marketing-workflow" id="how-it-works">
        <div className="marketing-workflow-heading">
          <span className="marketing-overline light">
            From player to approved
          </span>
          <h2>A complete whitelist flow, without the busywork.</h2>
          <p>Configure it once. Dexlyy keeps the experience moving.</p>
        </div>
        <div className="marketing-workflow-list">
          <article>
            <span>01</span>
            <div className="marketing-workflow-icon">
              <Server size={19} />
            </div>
            <div>
              <h3>Brand your portal</h3>
              <p>
                Add your server identity, application fields, interview
                questions, and Discord roles.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div className="marketing-workflow-icon">
              <Mic2 size={19} />
            </div>
            <div>
              <h3>Players apply and talk</h3>
              <p>
                Discord is verified before a natural voice interview begins on
                your schedule-free portal.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div className="marketing-workflow-icon">
              <Headphones size={19} />
            </div>
            <div>
              <h3>Your team reviews</h3>
              <p>
                The application, transcript, and recording stay together in a
                clean private workspace.
              </p>
            </div>
          </article>
          <article>
            <span>04</span>
            <div className="marketing-workflow-icon">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h3>Approve with confidence</h3>
              <p>
                Make the final call and let Dexlyy apply the correct Discord
                role automatically.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="marketing-control">
        <div className="marketing-control-copy">
          <span className="marketing-overline">AI that follows your lead</span>
          <h2>You set the standard. Dexlyy runs the conversation.</h2>
          <p>
            This is not an AI gatekeeper making opaque decisions. It is your
            configured interview process, delivered consistently and presented
            clearly for your team to review.
          </p>
          <ul>
            <li>
              <Check size={16} /> Your application fields and questions
            </li>
            <li>
              <Check size={16} /> Your scenario guidance and follow-ups
            </li>
            <li>
              <Check size={16} /> Your staff and approval permissions
            </li>
            <li>
              <Check size={16} /> Your final decision, every time
            </li>
          </ul>
        </div>
        <div className="marketing-control-panel">
          <div className="marketing-control-top">
            <span>
              <i /> Interview configuration
            </span>
            <small>Saved</small>
          </div>
          <div className="marketing-config-row">
            <span>01</span>
            <div>
              <strong>Introduce yourself and your RP background.</strong>
              <small>Active · required</small>
            </div>
            <i />
          </div>
          <div className="marketing-config-row">
            <span>02</span>
            <div>
              <strong>How would you handle a rule disagreement?</strong>
              <small>Active · scenario guidance</small>
            </div>
            <i />
          </div>
          <div className="marketing-config-row">
            <span>03</span>
            <div>
              <strong>Tell us about a strong roleplay moment.</strong>
              <small>Active · adaptive follow-up</small>
            </div>
            <i />
          </div>
          <div className="marketing-config-foot">
            <Bot size={17} /> The interviewer stays focused on your questions.
          </div>
        </div>
      </section>

      <section className="marketing-pricing" id="pricing">
        <div className="marketing-section-intro centered">
          <span className="marketing-overline">Simple monthly pricing</span>
          <h2>Choose the capacity your community needs.</h2>
          <p>
            Every plan includes the full interview and review workflow. Upgrade
            as your server grows.
          </p>
        </div>
        <div className="marketing-plan-grid">
          {plans.map((plan) => (
            <article
              className={`marketing-plan ${plan.featured ? "featured" : ""}`}
              key={plan.name}
            >
              {plan.featured && (
                <span className="marketing-plan-label">Most popular</span>
              )}
              <div className="marketing-plan-head">
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>
              <div className="marketing-price">
                <strong>${plan.price}</strong>
                <span>
                  USD
                  <br />/ month
                </span>
              </div>
              <ul>
                <li>
                  <Check size={15} /> {plan.interviews}
                </li>
                <li>
                  <Check size={15} /> {plan.servers}
                </li>
                <li>
                  <Check size={15} /> {plan.staff}
                </li>
                <li>
                  <Check size={15} /> Recordings and transcripts
                </li>
                <li>
                  <Check size={15} /> Discord role automation
                </li>
              </ul>
              <Link
                href="/login"
                className={`btn ${plan.featured ? "btn-primary" : "btn-ghost"}`}
              >
                {plan.cta} <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
        <p className="marketing-pricing-note">
          Need more capacity? Add prepaid interview credits whenever you need
          them—they never expire.
        </p>
      </section>

      <section className="marketing-faq" id="faq">
        <div className="marketing-faq-intro">
          <span className="marketing-overline">Questions, answered</span>
          <h2>Everything your team needs to know before switching.</h2>
          <p>
            Still unsure? Start with one portal and bring your existing process
            with you.
          </p>
          <Link href="/login" className="marketing-text-link">
            Create your portal <ArrowRight size={15} />
          </Link>
        </div>
        <div className="marketing-faq-list">
          {faq.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                {item.question}
                <span>+</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="marketing-final-cta">
        <div>
          <span className="marketing-overline light">
            Open your interview room
          </span>
          <h2>
            Your next great player should not have to wait for staff to come
            online.
          </h2>
        </div>
        <div>
          <Link href="/login" className="btn marketing-light-cta">
            Build your Dexlyy portal <ArrowRight size={17} />
          </Link>
          <p>Plans from $10/month. Only submitted interviews count.</p>
        </div>
      </section>

      <footer className="marketing-footer">
        <div>
          <Link href="/" className="marketing-brand">
            <span className="brand-mark" />
            <span>Dexlyy</span>
          </Link>
          <p>Voice-first whitelist interviews for modern FiveM communities.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="#product">Product</Link>
          <Link href="#how-it-works">How it works</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="#faq">FAQ</Link>
          <Link href="/login">Owner sign in</Link>
          <Link href="/partners">Partner programme</Link>
        </nav>
        <span>© {new Date().getFullYear()} Dexlyy</span>
      </footer>
    </main>
  );
}
