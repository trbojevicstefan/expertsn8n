import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor } from "@/lib/expert-messages";
import { syncMarketplaceUser } from "@/lib/customerio";

const schema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(100),
  reviewState: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  reason: z.string().max(1000).default(""),
});

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
    return NextResponse.json({ error: "Select at least one showcase." }, { status: 400 });
  }

  const db = adminDb();
  const nowIso = new Date().toISOString();
  const refs = input.ids.map((id) => db.collection("expertShowcases").doc(id));
  const snaps = await db.getAll(...refs);

  const batch = db.batch();
  const touchedExperts = new Set<string>();
  let updated = 0;

  for (const snap of snaps) {
    if (!snap.exists) continue;
    batch.set(
      snap.ref,
      {
        reviewState: input.reviewState,
        reviewedBy: session.uid,
        reviewedAt: nowIso,
        reviewNotes: input.reason,
        updatedAt: nowIso,
      },
      { merge: true },
    );
    const expertId = (snap.data() || {}).expertId;
    if (typeof expertId === "string" && expertId) touchedExperts.add(expertId);
    updated++;
  }

  if (updated === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 404 });

  batch.create(db.collection("adminAuditLogs").doc(), {
    actorId: session.uid,
    actorEmail: session.email,
    action: `SHOWCASE_BULK_${input.reviewState}`,
    targetType: "showcase",
    targetId: `${updated} showcases`,
    reason: input.reason,
    createdAt: nowIso,
  });

  await batch.commit();

  // One notification per expert rather than one per showcase.
  await Promise.all(
    [...touchedExperts].map(async (expertId) => {
      const ownerUid = await ownerUidFor(expertId);
      if (!ownerUid) return;
      await notifyUser(ownerUid, {
        type: "REVIEW_DECISION",
        title:
          input.reviewState === "APPROVED"
            ? "Your showcases were approved"
            : "Your showcases were reviewed",
        body: `${updated} showcase${updated === 1 ? "" : "s"} set to ${input.reviewState.toLowerCase()}.`,
        href: "/dashboard/expert/showcases",
        expertId,
      });
      await syncMarketplaceUser(ownerUid, `expert_showcases_${input.reviewState.toLowerCase()}`);
    }),
  );

  return NextResponse.json({ ok: true, updated });
}
