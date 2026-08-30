const patterns = [
  { type: "email", regex: /\b[A-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\))\s*[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone", regex: /(?:\+?\d[\d\s().-]{7,}\d)/g },
  { type: "url", regex: /(?:https?:\/\/|www\.)\S+/gi },
  { type: "social", regex: /\b(?:linkedin|telegram|whatsapp|discord|skype|signal)\b\s*[:@-]?\s*[\w.+-]{2,}/gi },
  { type: "handle", regex: /(^|\s)@[a-zA-Z0-9_]{3,}/g },
];

export function detectOffPlatformContact(value: string) {
  const hits = patterns.flatMap(({ type, regex }) => {
    regex.lastIndex = 0;
    return [...value.matchAll(regex)].map(match => ({ type, value: match[0].trim() }));
  });
  return { blocked: hits.length > 0, hits };
}

export function assertNoOffPlatformContact(value: string) {
  const result = detectOffPlatformContact(value);
  if (result.blocked) throw new Error("Contact details and external communication links are not allowed before a milestone is funded.");
}
