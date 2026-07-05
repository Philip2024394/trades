// POST /api/studio/assembly/apply
//
// Runs the assembly executor for the current merchant's brand. Reads
// every accepted-but-not-yet-applied decision, dispatches per action
// kind, and updates the row.
//
// Returns:
//   { ok: true, applied, queued, errors }
//
// Executor is idempotent — decisions already stamped `applied_at` are
// skipped by the query. Retryable errors (transient DB failure) leave
// applied_at null so the next apply call retries.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { runExecutorForBrand } from "@/lib/studio/assembly";

export const runtime = "nodejs";

export async function POST() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  try {
    const summary = await runExecutorForBrand({
      merchantId: session.merchant.id,
      brandId: session.brand.id
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "executor-error" },
      { status: 500 }
    );
  }
}
