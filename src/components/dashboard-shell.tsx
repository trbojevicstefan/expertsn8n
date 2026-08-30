import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, CircleDollarSign, FileCheck2, LayoutDashboard, LogOut, MessageSquareText, Settings, ShieldCheck, UserRoundSearch, Workflow } from "lucide-react";
import { Brand } from "./brand";
import type { SessionUser } from "@/lib/types";

export function DashboardShell({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  const client = session.role === "client";
  const nav = client ? [
    ["Overview", "/dashboard", LayoutDashboard], ["My jobs", "/dashboard/client/jobs", BriefcaseBusiness], ["Find experts", "/experts", UserRoundSearch], ["Contracts", "/contracts/c-2041", FileCheck2], ["Messages", "/contracts/c-2041", MessageSquareText]
  ] : [
    ["Overview", "/dashboard", LayoutDashboard], ["My profile", "/dashboard/expert/profile", UserRoundSearch], ["Showcases", "/dashboard/expert/showcases", Workflow], ["Invites", "/dashboard/expert/invites", BriefcaseBusiness], ["Proposals", "/dashboard/expert/proposals", FileCheck2]
  ];
  return <div className="portal"><aside className="sidebar"><div className="sidebar-brand"><Brand/></div><nav className="side-nav">
    {nav.map(([label, href, Icon]) => <Link key={String(label)} href={String(href)}><Icon size={18}/><span>{String(label)}</span><ChevronRight className="side-chevron" size={15}/></Link>)}
    {session.admin && <><div className="nav-label">Administration</div><Link href="/admin"><ShieldCheck size={18}/><span>Admin panel</span><ChevronRight className="side-chevron" size={15}/></Link><Link href="/admin/payments"><CircleDollarSign size={18}/><span>Payments</span></Link></>}
  </nav><div className="sidebar-bottom"><Link href="/settings"><Settings size={17}/>Settings</Link><form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={17}/>Log out</button></form></div></aside>
    <main className="portal-main"><header className="portal-top"><div><span className="mobile-brand">n8nexperts</span></div><div className="portal-user"><div className="user-avatar">{(session.name || session.email).slice(0,1).toUpperCase()}</div><div><strong>{session.name || session.email.split('@')[0]}</strong><span>{session.role}</span></div></div></header><div className="portal-content">{children}</div></main>
  </div>;
}
