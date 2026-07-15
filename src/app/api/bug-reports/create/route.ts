// POST /api/bug-reports/create
//
// Site-wide "Report an issue" form endpoint. Fires from the
// /report-an-issue page and (later) from the drawer link. Records
// bugs, broken links, and feature requests in hammerex_bug_reports
// with status='open'. Feeds /admin/red-zone user category.
//
// Anonymous by default. Reporter email optional (helps close the
// loop). IP + user-agent captured server-side for the admin to
// judge legitimacy vs. abuse.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  kind?: unknown;
  body?: unknown;
  pageUrl?: unknown;
  reporterEmail?: unknown;
  severity?: unknown;
};

const VALID_KINDS = ["bug", "broken-link", "feature-request"] as const;
const VALID_SEVERITY = ["critical", "high", "medium", "low"] as const;

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const kind = typeof payload.kind === "string" && (VALID_KINDS as readonly string[]).includes(payload.kind)
    ? payload.kind
    : "bug";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const pageUrl = typeof payload.pageUrl === "string" ? payload.pageUrl.trim().slice(0, 500) : null;
  const reporterEmail = typeof payload.reporterEmail === "string" ? payload.reporterEmail.trim().slice(0, 200) : null;
  const severity = typeof payload.severity === "string" && (VALID_SEVERITY as readonly string[]).includes(payload.severity)
    ? payload.severity
    : "medium";

  if (body.length < 10) {
    return NextResponse.json({ ok: false, error: "body-too-short" }, { status: 400 });
  }

  const reporterIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const insert = await supabaseAdmin
    .from("hammerex_bug_reports")
    .insert({
      kind,
      body,
      page_url: pageUrl,
      reporter_email: reporterEmail,
      reporter_ip: reporterIp,
      user_agent: userAgent,
      severity,
      status: "open"
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
    status: "open",
    reportId: insert.data.id
  });
}
