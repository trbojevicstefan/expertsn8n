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

/**
 * Official brand marks, drawn from Simple Icons (CC0) rather than redrawn by
 * hand, so each one is the real shape at any size.
 *
 * Five of the names in the strip are deliberately absent: Salesforce, OpenAI,
 * Slack, Google Workspace and AWS have all been removed from that set at their
 * owners' request. Approximating a trademark from memory is worse than not
 * drawing it, so those fall through to a wordmark set in the same rhythm.
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
