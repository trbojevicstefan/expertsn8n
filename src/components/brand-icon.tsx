import {
  siAirtable,
  siAnthropic,
  siHubspot,
  siN8n,
  siNotion,
  siPostgresql,
  siStripe,
  siSupabase,
} from "simple-icons";
import { RETIRED_MARKS } from "./retired-brand-marks";

/**
 * Official brand marks, drawn from Simple Icons (CC0) rather than redrawn by
 * hand, so each one is the real shape at any size.
 *
 * Five of them no longer ship in the current release and come from a pinned
 * copy instead; see `retired-brand-marks`. Anything with no mark at all still
 * falls through to a wordmark rather than an approximation.
 */
const MARKS: Record<string, { path: string; title: string }> = {
  n8n: siN8n,
  HubSpot: siHubspot,
  Anthropic: siAnthropic,
  PostgreSQL: siPostgresql,
  Stripe: siStripe,
  Notion: siNotion,
  Supabase: siSupabase,
  Airtable: siAirtable,
  ...RETIRED_MARKS,
};

export function BrandIcon({ name, size = 21 }: { name: string; size?: number }) {
  const mark = MARKS[name];

  if (!mark) {
    return <b className="brand-wordmark">{name}</b>;
  }

  return (
    <span className="brand-icon" title={name}>
      <svg
        role="img"
        aria-label={name}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
      >
        <path d={mark.path} />
      </svg>
    </span>
  );
}
