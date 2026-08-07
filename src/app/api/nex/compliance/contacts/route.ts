// GET /api/nex/compliance/contacts?state=&search=&limit= — list suppressed contacts
import { NextResponse } from "next/server";
import { listSuppressed } from "@/lib/nex/compliance/engine";
import type { ComplianceState } from "@/lib/nex/compliance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: ComplianceState[] = ["allowed","suppressed_soft","suppressed_hard","unsubscribed","complaint","manual_block"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state");
  const state = stateParam && (VALID as string[]).includes(stateParam) ? stateParam as ComplianceState : undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const limit  = Number(url.searchParams.get("limit") ?? 100);
  const rows = await listSuppressed({ state, search, limit });
  return NextResponse.json({ ok: true, contacts: rows });
}
