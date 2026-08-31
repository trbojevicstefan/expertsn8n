import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({ status: z.enum(["OPEN", "CLOSED"]) });

/**
 * FILLED is system-owned: only atomic proposal acceptance can set it. Closing a
 * job immediately blocks new proposals because proposal creation requires OPEN.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) return NextResponse.json({ error: "Jobs are not editable right now." }, { status: 503 });

  const { id } = await params;
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("jobs").doc(id);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("NOT_FOUND:Job not found.");
      const job = snap.data() || {};
      if (job.clientId !== session.uid && !session.admin) {
        throw new Error("FORBIDDEN:This job belongs to another account.");
      }
      const current = String(job.status || "DRAFT");
      if (current === input.status) return;
      if (current === "FILLED" || job.contractId) {
        throw new Error("CONFLICT:A job with an active contract is controlled from the contract workspace.");
      }
      if (input.status === "CLOSED" && !["DRAFT", "OPEN", "MATCHING"].includes(current)) {
        throw new Error("CONFLICT:This job cannot be closed from its current state.");
      }
      if (input.status === "OPEN" && current !== "CLOSED") {
        throw new Error("CONFLICT:Only a closed job can be reopened manually.");
      }
      tx.set(ref, { status: input.status, updatedAt: new Date().toISOString() }, { merge: true });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update job.";
    const [kind, detail] = message.includes(":") ? message.split(/:(.*)/s, 2) : ["BAD_REQUEST", message];
    const status = kind === "NOT_FOUND" ? 404 : kind === "FORBIDDEN" ? 403 : kind === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: detail || "Could not update job." }, { status });
  }

  return NextResponse.json({ ok: true, status: input.status });
}
