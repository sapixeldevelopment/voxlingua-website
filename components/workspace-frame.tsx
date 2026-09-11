"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, CreditCard, LayoutGrid, LifeBuoy, ShieldCheck } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Your communities", icon: LayoutGrid, section: "" },
  { href: "/dashboard#billing", label: "Plan & billing", icon: CreditCard, section: "#billing" },
  { href: "/dashboard#support", label: "Help & feedback", icon: LifeBuoy, section: "#support" },
];

/** Presentation only: existing pages continue to own data, permissions and actions. */
export default function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [section, setSection] = useState("");
  useEffect(() => {
    const update = () => setSection(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [pathname]);

  return <div className="workspace-ui">
    <a className="workspace-skip" href="#workspace-content">Skip to workspace</a>
    <aside className="workspace-rail">
      <Link className="brand workspace-brand" href="/"><span className="brand-mark" />Dexlyy<span className="workspace-brand-dot" /></Link>
      <span className="workspace-rail-label">WORKSPACE</span>
      <nav aria-label="Workspace navigation" className="workspace-navigation">
        {links.map(({ href, label, icon: Icon, section: target }) => {
          const active = pathname === "/dashboard" && section === target;
          // Native anchors keep section navigation working without custom scroll handlers.
          return <a key={href} href={href} className={active ? "active" : ""} aria-current={active ? "location" : undefined} onClick={() => setSection(target)}><Icon size={18} /><span>{label}</span>{active && <i />}</a>;
        })}
      </nav>
      <div className="workspace-rail-note"><ShieldCheck size={21} /><strong>Your community.<br/>Your decisions.</strong><p>Applications, interviews and human review, together.</p><Link href="/" target="_blank" rel="noreferrer">Visit Dexlyy <ArrowUpRight size={14} /></Link></div>
      <div className="workspace-rail-footer"><span className="brand-mark" /><span>Made for your community<small>Powered by Dexlyy</small></span></div>
    </aside>
    <div className="workspace-content" id="workspace-content" tabIndex={-1}>{children}</div>
  </div>;
}
