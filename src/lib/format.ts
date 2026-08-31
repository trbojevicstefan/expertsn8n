/** "3 days ago" for anything recent, a plain date beyond that. Accepts the ISO
 *  timestamps jobs store as well as the free-text values older records hold. */
export function postedLabel(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days <= 14) return `${days} day${days === 1 ? "" : "s"} ago`;

  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
