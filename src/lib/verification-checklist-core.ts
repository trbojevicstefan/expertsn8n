export interface VerificationProfileInput {
  name?: string;
  title?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  hourlyRate?: number;
  availability?: string;
  skills?: string[];
  n8nExperience?: string[];
  photoStatus?: string;
  photoUrl?: string;
  missingFields?: string[];
}

export interface VerificationDocumentInput {
  kind?: string;
  reviewState?: string;
}

export interface VerificationChecklistItem {
  key: "photo" | "identity" | "cv" | "n8n" | "workflow" | "profile";
  label: string;
  complete: boolean;
  detail: string;
}

export interface VerificationChecklist {
  items: VerificationChecklistItem[];
  readyToPublish: boolean;
  missing: string[];
}

export function buildVerificationChecklist(input: {
  profile: VerificationProfileInput;
  documents: VerificationDocumentInput[];
  approvedShowcaseCount: number;
}): VerificationChecklist {
  const profile = input.profile;
  const approved = input.documents.filter((document) => document.reviewState === "APPROVED");
  const hasPhoto = profile.photoStatus === "APPROVED" && Boolean(profile.photoUrl);
  const hasIdentity = approved.some((document) => document.kind === "id");
  const hasCv = approved.some((document) => document.kind === "cv");
  const hasN8nEvidence =
    (profile.n8nExperience || []).some((value) => value.trim().length > 0) ||
    (profile.skills || []).some((value) => value.toLowerCase().includes("n8n"));
  const fieldsComplete =
    Boolean(profile.name?.trim()) &&
    Boolean(profile.title?.trim()) &&
    Boolean(profile.bio?.trim()) &&
    Boolean(profile.location?.trim()) &&
    Boolean(profile.timezone?.trim()) &&
    Number(profile.hourlyRate || 0) > 0 &&
    Boolean(profile.availability?.trim()) &&
    (profile.skills || []).length > 0 &&
    (profile.missingFields || []).filter((field) => field !== "photo").length === 0;

  const items: VerificationChecklistItem[] = [
    { key: "photo", label: "Approved profile photo", complete: hasPhoto, detail: hasPhoto ? "Approved" : "A reviewed profile photo is required." },
    { key: "identity", label: "Identity evidence", complete: hasIdentity, detail: hasIdentity ? "Approved" : "An approved ID document is required." },
    { key: "cv", label: "CV / work history", complete: hasCv, detail: hasCv ? "Approved" : "An approved CV is required." },
    { key: "n8n", label: "n8n experience evidence", complete: hasN8nEvidence, detail: hasN8nEvidence ? "Present" : "Add n8n experience or n8n as a verified skill." },
    { key: "workflow", label: "Workflow evidence", complete: input.approvedShowcaseCount > 0, detail: input.approvedShowcaseCount > 0 ? `${input.approvedShowcaseCount} approved showcase(s)` : "At least one approved workflow showcase is required." },
    { key: "profile", label: "Profile completeness", complete: fieldsComplete, detail: fieldsComplete ? "Complete" : "Complete title, bio, location, timezone, rate, availability and skills." },
  ];

  const missing = items.filter((item) => !item.complete).map((item) => item.label);
  return { items, readyToPublish: missing.length === 0, missing };
}
