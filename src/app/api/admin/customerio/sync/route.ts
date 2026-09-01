import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { drainCustomerIoOutbox, syncAllMarketplaceUsers } from "@/lib/customerio";

export async function POST() {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const [sync, outbox] = await Promise.all([syncAllMarketplaceUsers(), drainCustomerIoOutbox(100)]);
  return NextResponse.json({ ok: sync.failed === 0 && outbox.failed === 0, sync, outbox });
}
