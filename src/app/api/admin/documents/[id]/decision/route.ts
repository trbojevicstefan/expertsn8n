import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const schema = z.object({ reviewState: z.enum(["APPROVED", "REJECTED", "PENDING"]) });

/** Documents were uploadable and readable but had no route out of PENDING,
 *  so the admin queue counted them forever. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Reviews are not available right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("expertDocuments").doc(id);
  if (!(await ref.get()).exists) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  await ref.set(
    { reviewState: input.reviewState, reviewedBy: session.uid, reviewedAt: nowIso },
    { merge: true },
  );

  return NextResponse.json({ ok: true, reviewState: input.reviewState });
}
