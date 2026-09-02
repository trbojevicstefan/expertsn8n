import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/auth/server";
import { unreadCount } from "@/lib/notifications";
import { expertNeedsShowcase } from "@/lib/expert-account";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [unread, needsShowcase] = await Promise.all([
    unreadCount(session),
    session.role === "expert" ? expertNeedsShowcase(session.uid) : Promise.resolve(false),
  ]);
  return (
    <DashboardShell session={session} unread={unread} needsShowcase={needsShowcase}>
      {children}
    </DashboardShell>
  );
}
