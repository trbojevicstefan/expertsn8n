import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";

/**
 * Streams a private Storage object to someone entitled to see it.
 *
 * Authorisation is derived from the path itself: `private/experts/{uid}/...`
 * belongs to that uid, and admins may read any of it. Nothing is signed, so a
 * copied link is useless to anyone else and there is no expiry to manage.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const storagePath = new URL(req.url).searchParams.get("path") || "";

  const match = /^private\/experts\/([^/]+)\//.exec(storagePath);
  if (!match) return NextResponse.json({ error: "Not a readable path." }, { status: 400 });
  if (match[1] !== session.uid && !session.admin) {
    return NextResponse.json({ error: "Not yours to read." }, { status: 403 });
  }

  const file = adminStorage().bucket().file(storagePath);
  if (!(await file.exists())[0]) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  const name = storagePath.split("/").pop() || "file";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
