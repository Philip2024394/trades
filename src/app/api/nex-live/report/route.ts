// src/app/api/nex-live/report/route.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Report content endpoint
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §7 · §8 · §11 · §17
//
// Any authenticated user may report published NEX Live media.
//
// Body:
//   {
//     media_id: string,
//     reason: "copyright" | "impersonation" | "misleading" | "harassment" | "unsafe" | "other",
//     reporter_statement: string    // free-text, max 2000 chars
//   }
//
// §8 immutable · report is appended to persistent JSONL. Reporting
// alone transitions ACTIVE → REPORTED (does NOT restrict / remove).
// Restriction requires a review decision at /api/nex-live/review.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { createReport, readMediaVisibility, type ReportReason } from "@/lib/nex/live/report";
import { readActiveDeclaration } from "@/lib/nex/live/media-declaration-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REASONS: ReportReason[] = [
  "copyright", "impersonation", "misleading", "harassment", "unsafe", "other",
];

export async function POST(req: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: `unauthenticated:${auth.error ?? "unknown"}` },
      { status: 401 },
    );
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "body_required" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const media_id = typeof b.media_id === "string" ? b.media_id.trim() : "";
  if (!media_id) return NextResponse.json({ ok: false, error: "media_id_required" }, { status: 400 });
  const reason = b.reason;
  if (typeof reason !== "string" || !ALLOWED_REASONS.includes(reason as ReportReason)) {
    return NextResponse.json(
      { ok: false, error: `reason_must_be:${ALLOWED_REASONS.join("|")}` },
      { status: 400 },
    );
  }
  const reporter_statement = typeof b.reporter_statement === "string"
    ? b.reporter_statement.trim() : "";
  if (reporter_statement.length < 5) {
    return NextResponse.json({ ok: false, error: "reporter_statement_min_5_chars" }, { status: 400 });
  }

  // Sanity: the media must have a declaration (i.e. be NEX-Live-published).
  // Reports against media that has never been declared are rejected
  // (this prevents the report endpoint being used to spam arbitrary media_ids).
  const decl = readActiveDeclaration(media_id);
  if (!decl) {
    return NextResponse.json(
      { ok: false, error: "media_not_published_via_nex_live" },
      { status: 404 },
    );
  }

  const previousVisibility = readMediaVisibility(media_id);
  const report = createReport({
    media_id,
    reporter_user_id: auth.user.supabase_user_id,
    reason: reason as ReportReason,
    reporter_statement,
  });
  const newVisibility = readMediaVisibility(media_id);

  return NextResponse.json({
    ok: true,
    report: {
      report_id: report.report_id,
      media_id,
      reason: report.reason,
      status: report.status,
      created_at_iso: report.created_at_iso,
    },
    previous_visibility: previousVisibility,
    new_visibility: newVisibility,
    honesty: {
      note: "Report recorded. Content remains visible pending moderator review — filing a report does not itself remove content.",
    },
  });
}
