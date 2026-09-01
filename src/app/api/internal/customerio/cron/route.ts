import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { drainCustomerIoOutbox, syncAllMarketplaceUsers } from "@/lib/customerio";

function authorized(request: Request): boolean {
  const expected = process.env.CUSTOMERIO_CRON_SECRET || "";
  const received = request.headers.get("x-customerio-cron-secret") || "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1";
  const outbox = await drainCustomerIoOutbox(100);
  const sync = full ? await syncAllMarketplaceUsers() : null;
  return NextResponse.json({ ok: outbox.failed === 0 && (!sync || sync.failed === 0), outbox, sync });
}
