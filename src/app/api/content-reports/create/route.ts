// POST /api/content-reports/create
//
// Records a public content report. Fires from:
//   - Canteen post 3-dot menu → "Report post"
//   - Merchant legal notice contact route (email → in-app form)
//   - Future in-app "Report" links across the platform
//
// The report lands in hammerex_content_reports with status='pending'
// and surfaces on /admin/red-zone. Admin reviews + resolves.
//
// Reporter contact is optional. IP is captured server-side for
// abuse-prevention (we throttle reports by IP in a follow-up).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  contentType?: unknown;
  contentId?: unknown;
  merchantSlug?: unknown;
  reporterName?: unknown;
  reporterEmail?: unknown;
  reason?: unknown;
  reportedBody?: unknown;
  severity?: unknown;
};

const VALID_TYPES = ["canteen-post", "yard-post", "trade-center-listing", "canteen-reply", "other"] as const;
const VALID_SEVERITY = ["critical", "high", "medium", "low"] as const;

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const contentType = typeof payload.contentType === "string" ? payload.contentType : "other";
  const contentTypeValid = (VALID_TYPES as readonly string[]).includes(contentType)
    ? contentType
    : "other";
  const contentId = typeof payload.contentId === "string" ? payload.contentId.trim() : null;
  const merchantSlug = typeof payload.merchantSlug === "string" ? payload.merchantSlug.trim() : null;
  const reporterName = typeof payload.reporterName === "string" ? payload.reporterName.trim().slice(0, 120) : null;
  const reporterEmail = typeof payload.reporterEmail === "string" ? payload.reporterEmail.trim().slice(0, 200) : null;
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const reportedBody = typeof payload.reportedBody === "string" ? payload.reportedBody.trim().slice(0, 5000) : null;
  const severity = typeof payload.severity === "string" && (VALID_SEVERITY as readonly string[]).includes(payload.severity)
    ? payload.severity
    : "medium";

  if (reason.length < 4) {
    return NextResponse.json({ ok: false, error: "reason-required" }, { status: 400 });
  }

  const reporterIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const insert = await supabaseAdmin
    .from("hammerex_content_reports")
    .insert({
      content_type: contentTypeValid,
      content_id: contentId,
      merchant_slug: merchantSlug,
      reporter_name: reporterName,
      reporter_email: reporterEmail,
      reporter_ip: reporterIp,
      reason,
      reported_body: reportedBody,
      severity,
      status: "pending"
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json(
      { ok: false, error: "db-error", message: insert.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: "pending",
    reportId: insert.data.id
  });
}
