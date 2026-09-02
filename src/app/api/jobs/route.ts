import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { describeZodIssues } from "@/lib/validation";
import { syncMarketplaceUser } from "@/lib/customerio";

const JOB_LABELS: Record<string, string> = {
  title: "Job title",
  description: "Description",
  skills: "Skills",
  integrations: "Integrations",
  budgetMin: "Minimum budget",
  budgetMax: "Maximum budget",
  currency: "Currency",
  delivery: "Delivery timeframe",
  visibility: "Visibility",
};

const schema = z
  .object({
    title: z.string().min(8).max(120),
    description: z.string().min(40).max(8000),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
    budgetMin: z.coerce.number().min(100),
    budgetMax: z.coerce.number().min(100),
    delivery: z.string().min(2).max(80),
    skills: z.array(z.string().min(1).max(48)).max(20).default([]),
    integrations: z.array(z.string().min(1).max(48)).max(20).default([]),
  })
  .refine((x) => x.budgetMax >= x.budgetMin, {
    message: "Maximum budget must be at least the minimum.",
  });

export async function POST(req: Request) {
  const session = await getSession();
  // Admins post on behalf of the marketplace as well as clients.
  if (!session || (session.role !== "client" && !session.admin)) {
    return NextResponse.json({ error: "Client or admin authentication required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: describeZodIssues(parsed.error, JOB_LABELS) }, { status: 400 });
  }

  try {
    const input = parsed.data;
    assertNoOffPlatformContact(input.description);

    const nowIso = new Date().toISOString();
    const ref = adminDb().collection("jobs").doc();

    await ref.set({
      ...input,
      clientId: session.uid,
      clientName: session.name || session.email,
      // Posted jobs go live immediately. They previously landed in DRAFT with
      // nothing anywhere able to move them out of it, so every job a client
      // posted was invisible for good.
      status: "OPEN",
      currency: "EUR",
      proposalCount: 0,
      verifiedPayment: false,
      // The card reads postedAt; without it the date line rendered blank.
      postedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await syncMarketplaceUser(session.uid, "job_created");

    return NextResponse.json({ id: ref.id, status: "OPEN" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid job" }, { status: 400 });
  }
}
