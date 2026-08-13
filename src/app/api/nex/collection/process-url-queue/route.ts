// POST /api/nex/collection/process-url-queue — run the queue worker.
//
// Auth:
//   · isAdminAuthed()  → admin-triggered manual runs (dashboard button)
//   · x-cron-secret    → future Vercel Cron entry (NOT wired to vercel.json yet ·
//                        per Philip 2026-08-13: prove the manual test first)
//
// Body:
//   { collection_type?: string, max_items?: number }
//
// Returns a BatchReport (see urlQueueProcessor.ts) so the admin can see
// exactly what happened to every URL processed in this run.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { processUrlQueue } from "@/lib/nex/collection/urlQueueProcessor";
import { getTradeCategory } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — worst-case fetch budget × cap

type Body = { collection_type?: string; max_items?: number };

export async function POST(req: NextRequest) {
  const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";
  const cronSecretEnv = process.env.CRON_SECRET ?? "";
  const cronOk = cronSecretEnv.length > 0 && cronSecretHeader === cronSecretEnv;
  const adminOk = await isAdminAuthed();
  if (!cronOk && !adminOk) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: Body = {};
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > 0) body = (await req.json()) as Body;
  } catch {
    // Empty body is fine — defaults apply
  }

  const collectionType = body.collection_type ?? "staircase_refacing";
  const category = getTradeCategory(collectionType);
  if (!category || !category.enabled) {
    return NextResponse.json({ ok: false, error: `category_not_enabled: ${collectionType}` }, { status: 400 });
  }

  const maxItems = Math.max(1, Math.min(50, body.max_items ?? 25));
  const report = await processUrlQueue({ collectionType, maxItems });
  return NextResponse.json({ ok: true, report });
}
