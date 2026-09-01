import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { syncAllMarketplaceUsers } from "@/lib/customerio";

export async function POST() {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const result = await syncAllMarketplaceUsers();
  return NextResponse.json({ ok: result.failed === 0, ...result });
}
