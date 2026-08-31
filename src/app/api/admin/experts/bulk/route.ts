import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor, postMessage } from "@/lib/expert-messages";

const schema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(200),
  decision: z.enum(["VERIFIED", "PUBLISHED", "NEEDS_CHANGES", "REJECTED", "SUSPENDED"]),
  reason: z.string().min(3).max(1000),
});

const LABEL: Record<z.infer<typeof schema>["decision"], string> = {
  VERIFIED: "verified",
  PUBLISHED: "listed in the directory",
  NEEDS_CHANGES: "changes requested",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
};

/** Same split as the single decision: `verified` is the badge, `status` is
 *  visibility, and conflating them would drop profiles out of the directory. */
function profilePatch(decision: z.infer<typeof schema>["decision"]) {
  switch (decision) {
    case "VERIFIED": return { verified: true, status: "PUBLISHED" };
    case "PUBLISHED": return { status: "PUBLISHED" };
    case "NEEDS_CHANGES": return { verified: false, status: "NEEDS_CHANGES" };
    case "REJECTED": return { verified: false, status: "REJECTED" };
    case "SUSPENDED": return { verified: false, status: "SUSPENDED" };
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Reviews are not available right now." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Select at least one profile and write a short reason." },
      { status: 400 },
    );
  }

  const db = adminDb();
  const nowIso = new Date().toISOString();
  const refs = input.ids.map((id) => db.collection("expertProfiles").doc(id));
  const snaps = await db.getAll(...refs);

  const batch = db.batch();
  const applied: string[] = [];

  for (const snap of snaps) {
    if (!snap.exists) continue;
    batch.set(snap.ref, { ...profilePatch(input.decision), updatedAt: nowIso }, { merge: true });
    batch.set(
      db.collection("expertVerifications").doc(snap.id),
      { state: input.decision, reviewedBy: session.uid, reviewNotes: input.reason, reviewedAt: nowIso },
      { merge: true },
    );
    applied.push(snap.id);
  }

  if (applied.length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 404 });

  batch.create(db.collection("adminAuditLogs").doc(), {
    actorId: session.uid,
    actorEmail: session.email,
    action: `EXPERT_BULK_${input.decision}`,
    targetType: "expert",
    targetId: `${applied.length} profiles`,
    reason: input.reason,
    createdAt: nowIso,
  });

  await batch.commit();

  // Each person still gets the reason in their own thread and notification —
  // a bulk action on our side should not read as a silent change on theirs.
  await Promise.all(
    applied.map(async (expertId) => {
      const ownerUid = await ownerUidFor(expertId);
      if (!ownerUid) return;
      await postMessage({
        expertId,
        authorUid: session.uid,
        authorRole: "admin",
        authorName: session.name || "Marketplace review",
        body: `Decision: ${LABEL[input.decision]}.\n\n${input.reason}`,
      });
      await notifyUser(ownerUid, {
        type: "REVIEW_DECISION",
        title: `Your profile was reviewed: ${LABEL[input.decision]}`,
        body: input.reason.slice(0, 160),
        href: "/dashboard/expert/profile",
        expertId,
      });
    }),
  );

  return NextResponse.json({ ok: true, updated: applied.length });
}
