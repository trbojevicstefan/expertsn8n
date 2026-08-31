export type UserRole="expert"|"client"|"admin";
export type VerificationState="DRAFT"|"SUBMITTED"|"UNDER_REVIEW"|"NEEDS_CHANGES"|"VERIFIED"|"PUBLISHED"|"REJECTED"|"SUSPENDED";
export type JobVisibility="PUBLIC"|"PRIVATE";export type JobStatus="DRAFT"|"OPEN"|"MATCHING"|"FILLED"|"CLOSED";export type ProposalStatus="SUBMITTED"|"SHORTLISTED"|"OFFERED"|"ACCEPTED"|"DECLINED"|"WITHDRAWN";export type MilestoneStatus="DRAFT"|"AWAITING_FUNDING"|"FUNDED"|"IN_PROGRESS"|"SUBMITTED"|"CHANGES_REQUESTED"|"DISPUTED"|"RELEASE_PENDING"|"RELEASED"|"REFUND_PENDING"|"REFUNDED";

/** Where a profile's photo stands. Profiles seeded from an application start
 *  at MISSING: they are public for launch, but the expert is asked for a photo
 *  and warned the profile goes hidden once the grace period is enforced. */
export type PhotoStatus="MISSING"|"PENDING_REVIEW"|"APPROVED";
export type ClaimState="UNCLAIMED"|"CLAIMED";
export type DocumentKind="cv"|"portfolio"|"certificate"|"id"|"other";

export interface ExpertLink{label:string;url:string}

export interface ExpertProfile{
  id:string;slug:string;name:string;title:string;bio:string;location:string;timezone:string;photoUrl:string;
  skills:string[];integrations:string[];hourlyRate:number;currency:string;availability:string;
  rating:number;reviewCount:number;completedProjects:number;verified:boolean;status:VerificationState;badges:string[];
  /** Seeded/claim fields. Optional so the existing demo fixtures still typecheck. */
  country?:string;links?:ExpertLink[];source?:"application"|"self-signup";
  photoStatus?:PhotoStatus;claimState?:ClaimState;claimedByUid?:string|null;claimedAt?:string|null;
  /** Optional detail that makes a profile answer a client's real questions.
   *  All optional so existing profiles stay valid. */
  companyName?:string;
  languages?:string[];
  yearsExperience?:number;
  hoursPerWeek?:number;
  minEngagement?:number;
  n8nExperience?:string[];
  /** Fields the expert still has to supply. Drives the completeness prompts. */
  missingFields?:string[];
  createdAt?:string;updatedAt?:string;
}

export interface ExpertDocument{
  id:string;expertId:string;kind:DocumentKind;fileName:string;storagePath:string;
  contentType:string;sizeBytes:number;uploadedAt:string;reviewState:"PENDING"|"APPROVED"|"REJECTED";
}

/** One per seeded candidate. `codeHash` is a SHA-256 of the plaintext code —
 *  the plaintext only ever exists in the operator's local sheet. */
export interface ClaimCode{
  expertId:string;email:string;codeHash:string;used:boolean;
  createdAt:string;usedAt?:string|null;usedByUid?:string|null;usedByEmail?:string|null;
}

export interface Showcase{id:string;expertId:string;title:string;summary:string;outcome:string;integrations:string[];complexity:"Intermediate"|"Advanced"|"Expert";}
export interface MarketplaceJob{id:string;clientId:string;clientName:string;title:string;description:string;skills:string[];integrations:string[];visibility:JobVisibility;status:JobStatus;budgetMin:number;budgetMax:number;currency:string;delivery:string;proposalCount:number;postedAt:string;verifiedPayment:boolean;}
export interface SessionUser{uid:string;email:string;name?:string;role:UserRole;admin?:boolean;}

export type NotificationType =
  | "PROFILE_SUBMITTED"
  | "SHOWCASE_SUBMITTED"
  | "REVIEW_DECISION"
  | "MESSAGE";

export interface AppNotification {
  id: string;
  /** Set for a notification aimed at one person. Null for the admin queue. */
  recipientUid: string | null;
  audience: "ADMIN" | "USER";
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  expertId?: string | null;
  /** Personal notifications use readAt; admin broadcasts track who has read. */
  readAt?: string | null;
  readBy?: string[];
  createdAt: string;
}

export interface ExpertMessage {
  id: string;
  expertId: string;
  authorUid: string;
  authorRole: "admin" | "expert";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ShowcaseAttachment {
  id: string;
  name: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  kind?: "image" | "workflow" | "file";
  /** Structure only. The raw export is never copied here. */
  workflow?: import("./n8n-workflow").N8nWorkflowSummary;
  parseError?: string;
}

/* ---------- contracts, chat and tickets ---------- */

export type ContractStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface ContractMilestone {
  id: string;
  title: string;
  amount: number;
  status: MilestoneStatus;
  fundedAt?: string | null;
  submittedAt?: string | null;
  releasedAt?: string | null;
  submissionNote?: string;
}

export interface Contract {
  id: string;
  jobId: string;
  jobTitle: string;
  proposalId: string;
  clientId: string;
  clientName: string;
  expertUid: string;
  expertId: string;
  expertName: string;
  totalAmount: number;
  currency: string;
  status: ContractStatus;
  /** Set the moment the first milestone is funded. Until then the contact
   *  guard applies and file exchange stays closed. */
  messagingUnlockedAt: string | null;
  milestones: ContractMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractMessage {
  id: string;
  contractId: string;
  authorUid: string;
  authorRole: "client" | "expert" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
}

export type TicketKind = "GENERAL" | "DISPUTE";
export type TicketState = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

/** One channel for anything a user needs staff to look at. A dispute is the
 *  same record with a contract attached, which additionally freezes release. */
export interface SupportTicket {
  id: string;
  kind: TicketKind;
  subject: string;
  body: string;
  state: TicketState;
  raisedByUid: string;
  raisedByName: string;
  raisedByRole: UserRole;
  contractId?: string | null;
  milestoneId?: string | null;
  amountAtRisk?: number | null;
  resolution?: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorUid: string;
  authorRole: UserRole;
  authorName: string;
  body: string;
  createdAt: string;
}
