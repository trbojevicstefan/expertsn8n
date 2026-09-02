/**
 * `availability` was a free text box, and 27 people filled it with two
 * different answers to two different questions: eleven stated a weekly
 * capacity ("40 hrs / week", "15-20 hrs/week", "24hrs") and twelve stated the
 * shape of work they take ("Fixed-fee audits", "Available for subcontracting",
 * "Open to trial task"). Capacity already had a home in `hoursPerWeek`, so the
 * box was really collecting whatever the label failed to ask for.
 *
 * The three questions are separate now: when you can start, what shape of work
 * you take, and how many hours. Values are stored as the label itself rather
 * than a code, so every place that already prints `availability` keeps working
 * untouched.
 */
export const AVAILABILITY_OPTIONS = [
  "Available now",
  "Available within a month",
  "Open to the right project",
  "Not taking work right now",
] as const;

export const ENGAGEMENT_OPTIONS = [
  "Ongoing / retainer",
  "Fixed-scope project",
  "Subcontracting / overflow",
  "Trial task first",
  "Audit / consultation",
] as const;

export type Availability = (typeof AVAILABILITY_OPTIONS)[number];
export type EngagementType = (typeof ENGAGEMENT_OPTIONS)[number];

/** Green dot on the card and the public profile: only a real yes earns it. */
export function isOpenToWork(availability?: string): boolean {
  return availability === "Available now" || availability === "Available within a month";
}
