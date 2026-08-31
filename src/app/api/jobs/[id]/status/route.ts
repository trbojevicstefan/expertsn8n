import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({ status: z.enum(["OPEN", "CLOSED", "FILLED"]) });

/** A client controls the visibility of their own job. Admins can close one too. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Jobs are not editable right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const ref = adminDb().collection("jobs").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const job = snap.data() || {};
  if (job.clientId !== session.uid && !session.admin) {
    return NextResponse.json({ error: "This job belongs to another account." }, { status: 403 });
  }

  await ref.set({ status: input.status, updatedAt: new Date().toISOString() }, { merge: true });
  return NextResponse.json({ ok: true, status: input.status });
}
