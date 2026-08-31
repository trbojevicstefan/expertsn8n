import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";

/**
 * Streams an expert document to a reviewer. Deliberately not a signed URL:
 * the bytes go through an authenticated request, so a link cannot leak a CV to
 * anyone who is not an admin, and there is nothing to expire.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const { id } = await params;
  const snap = await adminDb().collection("expertDocuments").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const doc = snap.data() as { storagePath: string; fileName: string; contentType: string };
  const file = adminStorage().bucket().file(doc.storagePath);
  if (!(await file.exists())[0]) {
    return NextResponse.json({ error: "File is missing from storage." }, { status: 404 });
  }

  const [buffer] = await file.download();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
