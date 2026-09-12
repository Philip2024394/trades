// POST /api/nex/shadow/observe
// body: { utterance: string, session_id?: string }
// Fire-and-forget shadow recording. Never blocks. Never throws to caller.

import { NextResponse } from "next/server";
import { observeShadow } from "@/lib/nex-shadow/shadow-recorder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any = {};
  try { body = await req.json(); } catch { /* silent */ }
  const utterance = typeof body?.utterance === "string" ? body.utterance : "";
  const session_id = typeof body?.session_id === "string" && body.session_id ? body.session_id : "shadow-anonymous";
  // Observer is intentionally synchronous but non-throwing · we return a
  // 202 ACCEPTED with no useful body so callers cannot derive live-response
  // behaviour from this endpoint.
  try { observeShadow({ utterance, session_id }); } catch { /* SH-2 · never propagate */ }
  return new NextResponse(null, { status: 202, headers: { "Cache-Control": "no-store" } });
}
