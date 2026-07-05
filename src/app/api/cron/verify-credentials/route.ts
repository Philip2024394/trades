// GET /api/cron/verify-credentials
//
// Vercel Cron (daily 08:00 UTC — see vercel.json) + optional pg_cron
// fallback. Walks credentials that haven't been checked in 20+ hours,
// runs the appropriate verifier, and updates status.
//
// Auth: shared CRON_SECRET, sent as `Authorization: Bearer <secret>`.
//
// Cap per run to keep the route inside Vercel's timeout. The next run
// picks up the tail (ordered last_check_at ASC NULLS FIRST so oldest
// checks recycle first).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyOne, type CredentialRow } from "@/lib/studio/credentials/orchestrator";
import { isAutoVerified } from "@/lib/studio/credentials/verifiers";
import type { CredentialScheme } from "@/lib/studio/blueprints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_RUN_CAP = 300;
const CHECK_STALE_HOURS = 20;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const ok = isVercelCron || (!!secret && auth === `Bearer ${secret}`);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const cutoff = new Date(
    Date.now() - CHECK_STALE_HOURS * 60 * 60 * 1000
  ).toISOString();

  const query = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("id, brand_id, scheme, number, status, display_label, last_check_at")
    .or(`last_check_at.is.null,last_check_at.lt.${cutoff}`)
    .order("last_check_at", { ascending: true, nullsFirst: true })
    .limit(PER_RUN_CAP);

  if (query.error) {
    return NextResponse.json(
      { ok: false, error: query.error.message },
      { status: 500 }
    );
  }
  const rows = (query.data ?? []) as (CredentialRow & { last_check_at: string | null })[];

  const summary = {
    total: rows.length,
    verified: 0,
    expired: 0,
    suspended: 0,
    notFound: 0,
    selfDeclared: 0,
    errors: 0,
    skipped: 0
  };

  for (const row of rows) {
    // Skip schemes with no auto-verifier when they're already self-declared
    // — prevents the cron from thrashing rows we can never confirm.
    if (
      !isAutoVerified(row.scheme as CredentialScheme) &&
      row.status === "self-declared"
    ) {
      summary.skipped += 1;
      await supabaseAdmin
        .from("studio_brand_credentials")
        .update({ last_check_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    const out = await verifyOne(row);
    if (!out.ok) {
      summary.errors += 1;
      continue;
    }
    switch (out.status) {
      case "verified":
        summary.verified += 1;
        break;
      case "expired":
        summary.expired += 1;
        break;
      case "suspended":
        summary.suspended += 1;
        break;
      case "not-found":
        summary.notFound += 1;
        break;
      case "self-declared":
        summary.selfDeclared += 1;
        break;
      default:
        summary.errors += 1;
    }
  }

  return NextResponse.json({ ok: true, summary });
}
