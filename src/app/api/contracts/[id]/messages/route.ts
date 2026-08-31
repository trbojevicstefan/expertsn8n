import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { notifyUser } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Contract } from "@/lib/types";

const schema = z.object({ body: z.string().min(1).max(4000) });

/**
 * Contract chat between the client and the expert.
 *
 * Before the first milestone is funded the contact guard applies, which is the
 * rule the whole marketplace is built on: the pre-contract conversation stays
 * on the record so a dispute has something to be resolved against.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Messaging is not available right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }

  const db = adminDb();
  const snap = await db.collection("contracts").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  const contract = { id: snap.id, ...snap.data() } as Contract;
  const isClient = contract.clientId === session.uid;
  const isExpert = contract.expertUid === session.uid;
  if (!isClient && !isExpert && !session.admin) {
    return NextResponse.json({ error: "This contract is not yours." }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "contract.message.user-contract",
    identity: `${session.uid}:${id}`,
    limit: 60,
    windowMs: 60 * 1000,
    message: "You are sending messages too quickly. Try again in a moment.",
  });
  if (limited) return limited;

  const body = input.body.trim();
  if (!contract.messagingUnlockedAt) {
    try {
      assertNoOffPlatformContact(body);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Not allowed yet." }, { status: 400 });
    }
  }

  const nowIso = new Date().toISOString();
  const role = session.admin && !isClient && !isExpert ? "admin" : isClient ? "client" : "expert";

  const ref = await db.collection("contractMessages").add({
    contractId: id,
    authorUid: session.uid,
    authorRole: role,
    authorName: session.name || session.email,
    body,
    createdAt: nowIso,
  });

  await db.collection("contracts").doc(id).set({ updatedAt: nowIso }, { merge: true });

  const otherUid = isClient ? contract.expertUid : contract.clientId;
  if (otherUid && otherUid !== session.uid) {
    await notifyUser(otherUid, {
      type: "MESSAGE",
      title: `New message on ${contract.jobTitle}`,
      body: body.slice(0, 160),
      href: `/contracts/${id}`,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: ref.id, contractId: id, authorUid: session.uid, authorRole: role,
        authorName: session.name || session.email, body, createdAt: nowIso,
      },
    },
    { status: 201 },
  );
}
