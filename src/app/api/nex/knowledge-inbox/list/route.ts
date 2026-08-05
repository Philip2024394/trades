// GET /api/nex/knowledge-inbox/list
//
// Returns the full inbox snapshot: every InboxItem in the store plus
// the persistent stats. The client uses this on mount and after every
// mutation to refresh the queue. Disk is the source of truth; React
// state is a display cache.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/nex/knowledge-inbox/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const snapshot = await readSnapshot();
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    console.error("[knowledge-inbox.list] failed:", err);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}
