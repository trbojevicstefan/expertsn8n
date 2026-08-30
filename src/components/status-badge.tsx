export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "info" | "danger" }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}
