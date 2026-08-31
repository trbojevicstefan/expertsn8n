import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { postMessage } from "@/lib/expert-messages";
import { notifyAdmins } from "@/lib/notifications";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Messaging is not available right now." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }

  const userSnap = await adminDb().collection("users").doc(session.uid).get();
  const expertId = (userSnap.data() || {}).expertId;
  if (typeof expertId !== "string" || !expertId) {
    return NextResponse.json({ error: "No expert profile is linked to this account." }, { status: 404 });
  }

  const profileSnap = await adminDb().collection("expertProfiles").doc(expertId).get();
  const name = (profileSnap.data() || {}).name || session.name || session.email;

  const message = await postMessage({
    expertId,
    authorUid: session.uid,
    authorRole: "expert",
    authorName: name,
    body: input.body.trim(),
  });

  await notifyAdmins({
    type: "MESSAGE",
    title: `${name} replied`,
    body: input.body.trim().slice(0, 160),
    href: `/admin/experts/${expertId}`,
    expertId,
  });

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
