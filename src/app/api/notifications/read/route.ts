import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { markAllRead } from "@/lib/notifications";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const marked = await markAllRead(session);
  return NextResponse.json({ ok: true, marked });
}
