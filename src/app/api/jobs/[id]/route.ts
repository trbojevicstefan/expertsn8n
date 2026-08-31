import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

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
  .refine((x) => x.budgetMax >= x.budgetMin, { message: "Maximum budget must be at least the minimum." });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "client" && !session.admin)) {
    return NextResponse.json({ error: "Client or admin authentication required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) return NextResponse.json({ error: "Jobs are not available right now." }, { status: 503 });

  const { id } = await params;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
    assertNoOffPlatformContact(input.description);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid job details." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("jobs").doc(id);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("NOT_FOUND:Job not found.");
      const job = snap.data() || {};
      if (job.clientId !== session.uid && !session.admin) throw new Error("FORBIDDEN:This job is not yours.");
      if (!["DRAFT", "OPEN"].includes(String(job.status))) {
        throw new Error("CONFLICT:Only draft or open jobs can be edited.");
      }
      if (Number(job.proposalCount || 0) > 0 && input.visibility !== job.visibility) {
        throw new Error("CONFLICT:Visibility cannot change after proposals have been received.");
      }
      tx.set(ref, { ...input, updatedAt: new Date().toISOString() }, { merge: true });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update job.";
    const [kind, detail] = message.includes(":") ? message.split(/:(.*)/s, 2) : ["BAD_REQUEST", message];
    const status = kind === "NOT_FOUND" ? 404 : kind === "FORBIDDEN" ? 403 : kind === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: detail || "Could not update job." }, { status });
  }

  return NextResponse.json({ ok: true, id });
}
