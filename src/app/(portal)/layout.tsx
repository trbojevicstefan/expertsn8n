import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/auth/server";
import { unreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const unread = await unreadCount(session);
  return (
    <DashboardShell session={session} unread={unread}>
      {children}
    </DashboardShell>
  );
}
