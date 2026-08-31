import { requireSession } from "@/lib/auth/server";
import { ShowcaseManager } from "@/components/showcase-manager";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { Showcase } from "@/lib/types";

export const dynamic = "force-dynamic";

async function showcasesForUid(uid: string): Promise<(Showcase & { reviewState?: string })[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb().collection("expertShowcases").where("ownerUid", "==", uid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Showcase & { reviewState?: string; createdAt?: string })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default async function Showcases() {
  const session = await requireSession();
  const items = await showcasesForUid(session.uid);
  return <ShowcaseManager initial={items} uid={session.uid} />;
}
