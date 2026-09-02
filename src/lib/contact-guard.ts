/**
 * Blocks contact details before a milestone is funded — without blocking the
 * work itself.
 *
 * On an n8n marketplace the messenger names are integration names first and
 * contact channels second: "WhatsApp AI assistants", "Telegram bots" and
 * "LinkedIn outreach" describe automations people are hired to build. So a
 * platform name only counts when it is actually handing over a handle, which
 * means an explicit `:`, `=` or `@` between the two. A bare name followed by a
 * word is a description, not a contact.
 */
const patterns = [
  { type: "email", regex: /\b[A-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\))\s*[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone", regex: /(?:\+?\d[\d\s().-]{7,}\d)/g },
  { type: "url", regex: /(?:https?:\/\/|www\.)\S+/gi },
  {
    type: "social",
    regex: /\b(?:linkedin|telegram|whatsapp|discord|skype|signal)\b\s*(?:[:=]|\bat\b)?\s*@[\w.+-]{2,}|\b(?:linkedin|telegram|whatsapp|discord|skype|signal)\b\s*[:=]\s*[\w.+-]{3,}/gi,
  },
  { type: "handle", regex: /(^|\s)@[a-zA-Z0-9_]{3,}/g },
];

function digitCount(value: string): number {
  return (value.match(/\d/g) || []).length;
}

/**
 * A written date range reads like a phone number to a loose digit pattern
 * ("2019 - 2024" is eight digits), and experience is usually described in
 * exactly that shape. A real number either carries a country prefix or is
 * longer than any year range.
 */
function isPlausiblePhone(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("+") || digitCount(trimmed) >= 9;
}

export function detectOffPlatformContact(value: string) {
  const hits = patterns.flatMap(({ type, regex }) => {
    regex.lastIndex = 0;
    return [...value.matchAll(regex)]
      .map((match) => ({ type, value: match[0].trim() }))
      .filter((hit) => hit.type !== "phone" || isPlausiblePhone(hit.value));
  });
  return { blocked: hits.length > 0, hits };
}

export function assertNoOffPlatformContact(value: string) {
  const { blocked, hits } = detectOffPlatformContact(value);
  if (!blocked) return;

  // Naming what was matched is the difference between a fixable message and a
  // dead end: the previous wording left people editing at random.
  const quoted = [...new Set(hits.map((hit) => hit.value))].slice(0, 3).map((v) => `“${v.slice(0, 60)}”`);
  throw new Error(
    `Contact details and external links are not allowed before a milestone is funded. Please remove ${quoted.join(", ")}.`,
  );
}
