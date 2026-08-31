import Link from "next/link";
import { BadgeCheck, Bell, MessageSquareText, UserRoundSearch, Workflow } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { EmptyState } from "@/components/empty-state";
import { MarkAllRead } from "@/components/mark-all-read";
import { listNotifications, withUnread } from "@/lib/notifications";
import type { NotificationType } from "@/lib/types";

export const dynamic = "force-dynamic";

const ICONS: Record<NotificationType, React.ReactNode> = {
  PROFILE_SUBMITTED: <UserRoundSearch size={17} strokeWidth={2} />,
  SHOWCASE_SUBMITTED: <Workflow size={17} strokeWidth={2} />,
  REVIEW_DECISION: <BadgeCheck size={17} strokeWidth={2} />,
  MESSAGE: <MessageSquareText size={17} strokeWidth={2} />,
};

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function NotificationsPage() {
  const session = await requireSession();
  const items = withUnread(await listNotifications(session), session.uid);
  const unread = items.filter((n) => n.unread).length;

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Notifications</h1>
          <p>
            {session.admin
              ? "Profiles and showcases submitted for review, plus replies from experts."
              : "Decisions and messages from the review team."}
          </p>
        </div>
        {unread > 0 && <MarkAllRead count={unread} />}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell size={22} strokeWidth={1.9} />}
          title="Nothing yet"
          body={
            session.admin
              ? "When an expert submits a profile or a showcase, it lands here."
              : "When a reviewer looks at your profile or sends you a message, it lands here."
          }
        />
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.unread ? "notif unread" : "notif"}>
              <span className="notif-icon">{ICONS[n.type]}</span>
              <div>
                <Link href={n.href || "/dashboard"}>
                  <strong>{n.title}</strong>
                </Link>
                {n.body && <p>{n.body}</p>}
                <time>{when(n.createdAt)}</time>
              </div>
              {n.unread && <span className="notif-dot" aria-label="Unread" />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
