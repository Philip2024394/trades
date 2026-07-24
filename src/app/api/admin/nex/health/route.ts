// GET /api/admin/nex/health
// Reads v_nex_knowledge_health for the Knowledge Health dashboard.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { readHealth } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const rows = await readHealth();
  return NextResponse.json({ ok: true, rows });
}
