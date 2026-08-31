import Link from "next/link";

/** Shown wherever the marketplace genuinely has nothing yet. Says so plainly
 *  rather than padding the screen with placeholder rows. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="empty-state card">
      {icon && <span className="empty-state-icon">{icon}</span>}
      <strong>{title}</strong>
      <p>{body}</p>
      {action && (
        <Link className="button button-secondary" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
