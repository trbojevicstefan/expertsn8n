import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { drainCustomerIoOutbox, reconcileDeletedAccounts, syncAllMarketplaceUsers } from "@/lib/customerio";

export async function POST() {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const reconcile = await reconcileDeletedAccounts();
  const [sync, outbox] = await Promise.all([syncAllMarketplaceUsers(), drainCustomerIoOutbox(100)]);
  return NextResponse.json({
    ok: reconcile.failed === 0 && sync.failed === 0 && outbox.failed === 0,
    reconcile,
    sync,
    outbox,
  });
}
