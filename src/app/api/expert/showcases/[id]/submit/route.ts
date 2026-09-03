import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyAdmins } from "@/lib/notifications";
import { syncMarketplaceUser } from "@/lib/customerio";
import type { ShowcaseAttachment } from "@/lib/types";

/**
 * The second half of writing a showcase: hand in the draft once the evidence
 * is attached.
 *
 * Splitting it here is what lets the first step stay a form. A reviewer
 * judges the workflow export and what it looked like running, so a submission
 * without them is a round trip that was always going to end in "please attach
 * your workflow" -- for both sides.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Showcases are not available right now." }, { status: 503 });
  }

  const { id } = await params;
  const ref = adminDb().collection("expertShowcases").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Showcase not found." }, { status: 404 });

  const showcase = snap.data() || {};
  if (showcase.ownerUid !== session.uid) {
    return NextResponse.json({ error: "Not your showcase." }, { status: 403 });
  }
  if (showcase.reviewState && showcase.reviewState !== "DRAFT") {
    return NextResponse.json(
      { error: "This showcase has already been sent for review." },
      { status: 409 },
    );
  }

  const attachments = (showcase.attachments || []) as ShowcaseAttachment[];
  const missing = [
    ...(attachments.some((a) => a.kind === "workflow") ? [] : ["your exported n8n workflow JSON"]),
    ...(attachments.some((a) => a.kind === "image") ? [] : ["at least one screenshot"]),
  ];
  if (missing.length) {
    return NextResponse.json(
      { error: `Before review this showcase still needs ${missing.join(" and ")}.`, missing },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  await ref.set({ reviewState: "PENDING", submittedAt: nowIso, updatedAt: nowIso }, { merge: true });

  const profile = await adminDb().collection("expertProfiles").doc(String(showcase.expertId)).get();
  await notifyAdmins({
    type: "SHOWCASE_SUBMITTED",
    title: `${(profile.data() || {}).name || "An expert"} submitted a showcase`,
    body: String(showcase.title || ""),
    href: `/admin/experts/${showcase.expertId}`,
    expertId: String(showcase.expertId),
  });
  await syncMarketplaceUser(session.uid, "expert_showcase_submitted");

  return NextResponse.json({ ok: true, reviewState: "PENDING" });
}
