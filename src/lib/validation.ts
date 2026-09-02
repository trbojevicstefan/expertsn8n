import type { ZodError } from "zod";

/**
 * Turns a rejected payload into something the person can act on.
 *
 * Every route used to answer "Check the fields and try again", which is true
 * and useless: an expert whose imported profile carried 36 skills against a
 * cap of 20 could edit for an hour without ever learning which field was the
 * problem. These messages name the field, the limit, and what was sent.
 */
type Issue = ZodError["issues"][number];

/**
 * Array indices carry no meaning to a person, so `links.0.url` is looked up as
 * `links.url` -- otherwise a bad link reads as "Links is not valid" and leaves
 * them hunting for which part.
 */
function label(path: PropertyKey[], labels: Record<string, string>): string {
  const named = path.map(String).filter((part) => !/^\d+$/.test(part));
  const key = named.join(".") || String(path[0] ?? "");
  const fallback = named[named.length - 1] || key;
  return (
    labels[key] ||
    labels[String(path[0] ?? "")] ||
    fallback.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
  );
}

function unit(origin: unknown, plural: boolean): string {
  if (origin === "array") return plural ? "entries" : "entry";
  if (origin === "string") return plural ? "characters" : "character";
  return "";
}

function describe(issue: Issue, labels: Record<string, string>): string {
  const name = label(issue.path as PropertyKey[], labels);
  const i = issue as Issue & { origin?: unknown; maximum?: number; minimum?: number };

  if (issue.code === "too_big" && typeof i.maximum === "number") {
    const u = unit(i.origin, i.maximum !== 1);
    return `${name}: at most ${i.maximum}${u ? ` ${u}` : ""}.`;
  }
  if (issue.code === "too_small" && typeof i.minimum === "number") {
    if (i.minimum === 1 && i.origin === "array") return `${name}: add at least one.`;
    const u = unit(i.origin, i.minimum !== 1);
    return `${name}: at least ${i.minimum}${u ? ` ${u}` : ""}.`;
  }
  if (issue.code === "invalid_type") return `${name} is required.`;
  if (issue.code === "invalid_format") {
    const format = (issue as Issue & { format?: string }).format;
    if (format === "url") return `${name} must be a full web address starting with https://`;
    if (format === "email") return `${name} is not a valid email address.`;
    return `${name} is not in a valid format.`;
  }
  if (issue.code === "invalid_value") return `${name} is not one of the allowed options.`;
  return `${name}: ${issue.message}`;
}

/** One readable sentence per field, deduplicated, capped so it stays legible. */
export function describeZodIssues(
  error: ZodError,
  labels: Record<string, string> = {},
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "") + issue.code;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(describe(issue, labels));
    if (lines.length === 4) break;
  }
  return lines.join(" ");
}

/** Field paths only — never the values — so logs stay free of personal data. */
export function issueFields(error: ZodError): string {
  return [...new Set(error.issues.map((issue) => String(issue.path[0] ?? "")))].filter(Boolean).join(", ");
}
