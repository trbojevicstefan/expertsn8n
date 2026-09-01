import Link from "next/link";
import {
  Bell, BriefcaseBusiness, Building2, ChevronRight, CircleDollarSign, FileCheck2, LayoutDashboard,
  LifeBuoy, LogOut, Plus, ScrollText, Settings, ShieldCheck, UserRoundSearch, Workflow,
} from "lucide-react";
import { Brand } from "./brand";
import type { SessionUser } from "@/lib/types";

type NavItem = [label: string, href: string, Icon: typeof LayoutDashboard];

export function DashboardShell({
  session,
  unread = 0,
  children,
}: {
  session: SessionUser;
  unread?: number;
  children: React.ReactNode;
}) {
  const client = session.role === "client";

  const nav: NavItem[] = client
    ? [
      ["Overview", "/dashboard", LayoutDashboard],
      ["Company profile", "/dashboard/client/profile", Building2],
      ["My jobs", "/dashboard/client/jobs", BriefcaseBusiness],
      ["Proposals", "/dashboard/client/proposals", FileCheck2],
      ["Contracts", "/dashboard/contracts", ScrollText],
      ["Find experts", "/experts", UserRoundSearch],
      ["Notifications", "/notifications", Bell],
      ["Support", "/support", LifeBuoy],
    ]
    : [
      ["Overview", "/dashboard", LayoutDashboard],
      ["My profile", "/dashboard/expert/profile", UserRoundSearch],
      ["Showcases", "/dashboard/expert/showcases", Workflow],
      ["Invites", "/dashboard/expert/invites", BriefcaseBusiness],
      ["Proposals", "/dashboard/expert/proposals", FileCheck2],
      ["Contracts", "/dashboard/contracts", ScrollText],
      ["Notifications", "/notifications", Bell],
      ["Support", "/support", LifeBuoy],
    ];

  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand /></div>
        <nav className="side-nav">
          {nav.map(([label, href, Icon]) => (
            <Link key={label} href={href}>
              <Icon size={18} />
              <span>{label}</span>
              {label === "Notifications" && unread > 0 && <span className="nav-badge">{unread}</span>}
              <ChevronRight className="side-chevron" size={15} />
            </Link>
          ))}
          {session.admin && (
            <>
              <div className="nav-label">Administration</div>
              <Link href="/admin"><ShieldCheck size={18} /><span>Admin panel</span><ChevronRight className="side-chevron" size={15} /></Link>
              <Link href="/admin/experts"><UserRoundSearch size={18} /><span>Experts</span></Link>
              <Link href="/admin/jobs"><BriefcaseBusiness size={18} /><span>All jobs</span></Link>
              <Link href="/admin/tickets"><LifeBuoy size={18} /><span>Support &amp; disputes</span></Link>
              <Link href="/admin/payments"><CircleDollarSign size={18} /><span>Payments</span></Link>
              <div className="nav-label">Hiring</div>
              <Link href="/dashboard/client/jobs/new"><Plus size={18} /><span>Post a job</span></Link>
              <Link href="/dashboard/client/jobs"><FileCheck2 size={18} /><span>My posted jobs</span></Link>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/settings"><Settings size={17} />Settings</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit"><LogOut size={17} />Log out</button>
          </form>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-top">
          <div><span className="mobile-brand">n8nexperts</span></div>
          <div className="portal-top-right">
            <Link
              className="bell"
              href="/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell size={19} strokeWidth={2} />
              {unread > 0 && <span className="bell-count">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <div className="portal-user">
              <div className="user-avatar">{(session.name || session.email).slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{session.name || session.email.split("@")[0]}</strong>
                <span>{session.role}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="portal-content">{children}</div>
      </main>
    </div>
  );
}
