// Marketing copy for the public site. Kept out of the page components so the
// homepage stays a composition of sections rather than a wall of literals.

export const trustStats = [
  { value: "1 in 9", label: "Applicants published", helper: "Every profile reviewed by a human" },
  { value: "€2.1M", label: "Funded through milestones", helper: "Released only on approved delivery" },
  { value: "4.96", label: "Average contract rating", helper: "Across 612 completed contracts" },
  { value: "31 hrs", label: "Median time to shortlist", helper: "From posting to first proposals" },
];

export const differentiators = [
  {
    icon: "target",
    title: "n8n only. Nothing else.",
    body: "General freelance sites bury n8n under four hundred other tags. Here the entire directory is people who build production n8n systems, so a shortlist takes an afternoon rather than three weeks of filtering.",
  },
  {
    icon: "eye",
    title: "You see the work, not adjectives",
    body: "Every published expert submits real workflow case studies — architecture, integrations, failure handling and the measured outcome. A screenshot of a canvas is not enough to get listed.",
  },
  {
    icon: "shield",
    title: "Money moves on delivery",
    body: "Funds sit in a funded milestone before work starts and release when you approve the submission. Nobody is chasing an invoice and nobody is working unpaid.",
  },
  {
    icon: "scale",
    title: "A written record, not a chat log",
    body: "Scope, milestones, submissions and decisions live on an auditable contract timeline. If something goes wrong, there is an actual record to resolve it against.",
  },
];

export const vettingSteps = [
  {
    step: "01",
    title: "Identity and CV",
    body: "A real name, a profile photo and a full CV. The CV stays private to the reviewer and never appears on the public profile.",
    detail: "34% rejected here",
  },
  {
    step: "02",
    title: "Workflow evidence",
    body: "At least one detailed case study: the business problem, the architecture, the integrations, how failures are handled, and what changed for the client.",
    detail: "41% rejected here",
  },
  {
    step: "03",
    title: "Technical review",
    body: "A reviewer who builds in n8n reads the submitted work, looking for error handling, idempotency, credential hygiene and whether the system is maintainable by someone else.",
    detail: "14% rejected here",
  },
  {
    step: "04",
    title: "Reference check",
    body: "We contact a previous client for at least one claimed engagement. Unverifiable outcomes are removed from the profile before it goes live.",
    detail: "8% rejected here",
  },
  {
    step: "05",
    title: "Published, then monitored",
    body: "Approved profiles go live and stay under review. Contract outcomes, dispute history and response times feed back into standing on the marketplace.",
    detail: "Ongoing",
  },
];

export const useCases = [
  { icon: "workflow", title: "Zapier and Make migrations", body: "Rebuild brittle automations as maintainable n8n workflows with shared error handling and environment-aware credentials.", tags: ["Migration", "Cost reduction"] },
  { icon: "bot", title: "AI agents and RAG pipelines", body: "Retrieval, drafting and classification workflows with confidence thresholds and human review where it actually matters.", tags: ["LLM", "Human-in-the-loop"] },
  { icon: "users", title: "CRM and revenue operations", body: "Lead enrichment, routing, deduplication and pipeline hygiene wired into HubSpot, Salesforce or Pipedrive.", tags: ["HubSpot", "Salesforce"] },
  { icon: "database", title: "Data sync and ETL", body: "Reliable movement between databases, warehouses and SaaS APIs, with idempotency and replay built in from the start.", tags: ["Postgres", "Warehouse"] },
  { icon: "activity", title: "Monitoring and incident recovery", body: "Audit existing workflows, then add retries, dead-letter queues, alerting and weekly health reporting you can trust.", tags: ["Observability", "Alerting"] },
  { icon: "plug", title: "Custom nodes and internal tooling", body: "Purpose-built nodes, internal approval flows and back-office tooling for teams that outgrew off-the-shelf automation.", tags: ["TypeScript", "Custom nodes"] },
];

export const howItWorks = [
  {
    step: "01",
    title: "Describe the outcome",
    body: "Post publicly, keep it invite-only, or shortlist directly from the directory. Describe the outcome you need rather than the node list — experts propose the architecture.",
    points: ["Public, private or invite-only", "Structured scope template", "No contact details required upfront"],
  },
  {
    step: "02",
    title: "Compare real proposals",
    body: "Proposals include the proposed approach, a milestone breakdown and a timeline. Clarifying questions run through the platform until you decide to move forward.",
    points: ["Milestone-level pricing", "Architecture stated upfront", "Contact guard until funding"],
  },
  {
    step: "03",
    title: "Fund the first milestone",
    body: "Funding is what starts the contract. Money is held against that milestone, and full messaging plus file exchange unlock for both sides at the same moment.",
    points: ["Funds held, not forwarded", "Messaging unlocks on funding", "Scope locked to the milestone"],
  },
  {
    step: "04",
    title: "Review, approve, release",
    body: "The expert submits against the milestone. You approve, request changes, or open a dispute. Approval releases the funds and the contract moves to the next milestone.",
    points: ["Submission-based delivery", "Change requests on record", "Dispute path if needed"],
  },
];

export const caseStudies = [
  {
    company: "Northstar Commerce",
    sector: "E-commerce · 140 staff",
    title: "67 Zapier automations rebuilt in six weeks",
    body: "A patchwork of Zaps and cron scripts was failing silently and nobody owned it. The rebuild consolidated everything into 21 n8n workflows with shared error handling and a single alerting channel.",
    metrics: [
      { value: "€2,400", label: "Monthly tooling saved" },
      { value: "94%", label: "Fewer silent failures" },
      { value: "6 wks", label: "End to end" },
    ],
  },
  {
    company: "Atlas Legal",
    sector: "Legal services · 60 staff",
    title: "Document intake with AI extraction and human review",
    body: "Intake was three people copying fields out of PDFs. The new pipeline classifies documents, extracts structured fields, and routes anything below the confidence threshold to a human queue.",
    metrics: [
      { value: "11 hrs", label: "Saved per week" },
      { value: "99.2%", label: "Field accuracy after review" },
      { value: "4 wks", label: "To production" },
    ],
  },
  {
    company: "Mercury Studio",
    sector: "Agency · 25 staff",
    title: "Production monitoring across 35 client workflows",
    body: "Client automations broke quietly and the agency found out from the client. A standardised retry, dead-letter and alerting layer now covers every workflow, with a weekly health report.",
    metrics: [
      { value: "0", label: "Client-reported outages since" },
      { value: "35", label: "Workflows under monitoring" },
      { value: "10 days", label: "Delivery" },
    ],
  },
];

export const testimonials = [
  {
    quote: "We had already burned two contractors from a general freelance site. The difference here was that we could read actual architecture write-ups before talking to anyone.",
    name: "Sofia Lindqvist",
    role: "Head of Revenue Operations",
    company: "Northstar Commerce",
  },
  {
    quote: "The milestone flow removed the awkward part. We funded, they built, we approved. No invoice chasing, no arguing about what was in scope.",
    name: "Daniel Reyes",
    role: "Operations Director",
    company: "Atlas Legal",
  },
  {
    quote: "I applied twice. The first submission was rejected for thin error handling, which was fair. That is exactly why clients here take the profiles seriously.",
    name: "Luka Petrovic",
    role: "Senior Automation Engineer",
    company: "Published expert",
  },
];

export const comparisonRows = [
  { feature: "Talent pool", generic: "Every skill on earth, n8n as a tag", ours: "n8n specialists only" },
  { feature: "Profile evidence", generic: "Self-declared skills and star ratings", ours: "Reviewed workflow case studies" },
  { feature: "Vetting", generic: "Automated, or none at all", ours: "Human review at five stages" },
  { feature: "Payment", generic: "Hourly tracking or upfront transfer", ours: "Funded milestones, released on approval" },
  { feature: "Scope record", generic: "Chat history", ours: "Auditable contract timeline" },
  { feature: "Dispute handling", generic: "Generic support ticket", ours: "Reviewer who understands the work" },
];

export const pricing = [
  {
    audience: "For clients",
    price: "Free",
    line: "No fee to post, search or hire",
    points: [
      "Unlimited job posts and invitations",
      "Full directory and case study access",
      "Milestone protection included",
      "Payment processing passed through at cost",
    ],
    cta: { label: "Post a job", href: "/sign-up" },
    highlight: false,
  },
  {
    audience: "For experts",
    price: "10%",
    line: "Platform fee on released milestones",
    points: [
      "No fee to apply or maintain a profile",
      "No bidding credits, ever",
      "Paid on approval, not on invoice terms",
      "Drops to 5% after €25k earned with one client",
    ],
    cta: { label: "Apply as an expert", href: "/sign-up" },
    highlight: true,
  },
];

export const faqs = [
  {
    q: "How is this different from hiring on a general freelance platform?",
    a: "General platforms optimise for volume across every skill. The n8n tag there is a filter on a database of millions, and nothing in the profile tells you whether someone has run automations in production. Here the directory is n8n specialists only, and a profile does not go live until a reviewer has read real workflow case studies and checked a reference.",
  },
  {
    q: "What exactly does verified mean on a profile?",
    a: "It means a human reviewed the identity details, the CV, at least one detailed workflow case study, and contacted a previous client about a claimed engagement. It does not mean we guarantee the outcome of your project — it means the person is who they say they are and has demonstrably done the work.",
  },
  {
    q: "How does milestone funding protect me?",
    a: "You fund a milestone before work begins. Those funds are held against that milestone rather than forwarded to the expert. When the expert submits and you approve, the funds release. If you request changes, the milestone stays open. If you cannot reach agreement, either side can open a dispute and a reviewer examines the contract record.",
  },
  {
    q: "Why can I not share my email before funding?",
    a: "Proposals and clarification messages pass through a contact guard that blocks direct contact details and external links until a milestone is funded. It keeps the pre-contract stage on record, which is what makes disputes resolvable. Once funding lands, full messaging and file exchange unlock immediately.",
  },
  {
    q: "What does it cost?",
    a: "Nothing for clients — posting, searching, inviting and hiring are free, and payment processing is passed through at cost. Experts pay a 10% platform fee on released milestones, dropping to 5% after €25,000 earned with the same client. There are no bidding credits and no subscription on either side.",
  },
  {
    q: "How long does expert approval take?",
    a: "Most applications get a decision within five working days, and roughly one in nine applicants is published. The most common rejection reason is a case study that describes what a workflow does without explaining how it handles failure.",
  },
  {
    q: "Can I hire someone for ongoing maintenance rather than a project?",
    a: "Yes. Retainer-style contracts run as recurring milestones — you fund a period, the expert works against it, and you approve at the end of each cycle. Most monitoring and support engagements on the platform are structured this way.",
  },
  {
    q: "What happens if the work is not delivered?",
    a: "If a submission does not meet the agreed milestone, you request changes and the milestone stays funded but unreleased. If the expert stops responding or the disagreement is fundamental, you open a dispute. A reviewer reads the contract timeline, the milestone scope and the submissions, and decides on release or refund.",
  },
];

export const integrationLogos = [
  "HubSpot", "Salesforce", "OpenAI", "Anthropic", "Slack", "PostgreSQL",
  "Stripe", "Google Workspace", "Notion", "Supabase", "AWS", "Airtable",
];
