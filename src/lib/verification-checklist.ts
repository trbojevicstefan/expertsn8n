import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { buildVerificationChecklist, type VerificationChecklist } from "@/lib/verification-checklist-core";

export async function loadExpertVerificationChecklist(expertId: string): Promise<VerificationChecklist | null> {
  if (!firebaseAdminConfigured) return null;
  const db = adminDb();
  const [profileSnap, docsSnap, showcaseSnap] = await Promise.all([
    db.collection("expertProfiles").doc(expertId).get(),
    db.collection("expertDocuments").where("expertId", "==", expertId).limit(100).get(),
    db.collection("expertShowcases").where("expertId", "==", expertId).where("reviewState", "==", "APPROVED").limit(100).get(),
  ]);
  if (!profileSnap.exists) return null;
  return buildVerificationChecklist({
    profile: profileSnap.data() || {},
    documents: docsSnap.docs.map((doc) => doc.data() || {}),
    approvedShowcaseCount: showcaseSnap.size,
  });
}
