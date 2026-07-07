// POST /api/os/cron/vault/process-bundles
//
// Cron-triggered bundle processor. Reads queued os_project_bundle_exports
// rows and generates the manifest + HTML index for each. Protected by
// CRON_SECRET header — call this from your scheduler (Vercel Cron,
// GitHub Actions, EasyCron) at whatever cadence you like.
//
// Response is a structured summary of the batch — the scheduler can
// log it for monitoring.

import { NextResponse } from "next/server";
import { runBundleWorker } from "@/lib/os/vault/bundleWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Extend serverless runtime — ZIP-generation can take a while when
// signing many attachments per bundle.
export const maxDuration = 300; // seconds

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "cron_not_configured" },
      { status: 503 }
    );
  }

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== cronSecret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  let batchSize = 10;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      batchSize?: number;
    };
    if (typeof body.batchSize === "number" && body.batchSize > 0) {
      batchSize = Math.min(body.batchSize, 100);
    }
  } catch {
    // no body / bad JSON — use default batch size
  }

  try {
    const result = await runBundleWorker(batchSize);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "worker_failed", message },
      { status: 500 }
    );
  }
}

// GET returns run status for smoke-testing (no processing).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "cron_not_configured" },
      { status: 503 }
    );
  }
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== cronSecret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true, ready: true });
}
