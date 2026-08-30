/** Seeded profiles start without a photo, so every avatar has to degrade to
 *  something deliberate rather than a broken image. */
export function Avatar({
  name,
  src,
  size = "lg",
  className = "",
}: {
  name: string;
  src?: string;
  size?: "sm" | "lg" | "xl";
  className?: string;
}) {
  const cls = `avatar avatar-${size} ${className}`.trim();
  if (src) return <img className={cls} src={src} alt={`${name} profile photo`} />;

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className={`${cls} avatar-initials`} role="img" aria-label={`${name} — no profile photo yet`}>
      {initials || "?"}
    </span>
  );
}
