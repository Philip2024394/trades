// src/app/api/nex/create-banners/sandbox/ab-run/route.ts
//
// NEX Composition Engineering Wave · A/B endpoint
// ===============================================
// POST · runs old vs new compositor against an EXISTING raw job.
// No SDXL invocation · no manifest write · every output UNPROVEN.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { runAB } from "@/lib/nex/create-banners/sandbox/ab-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  source_job_id?: string;
  headline?: string;
  cta?: string;
  eyebrow?: string;
  subheadline?: string;
  trust_element?: string;
  footer_line?: string;
}

function newAbJobId(): string {
  return `ab-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json_body" },
      { status: 400 }
    );
  }
  const source_job_id = (body.source_job_id ?? "").trim();
  const headline = (body.headline ?? "").trim();
  const cta = (body.cta ?? "").trim();
  if (!source_job_id) {
    return NextResponse.json(
      { ok: false, error: "missing_source_job_id" },
      { status: 400 }
    );
  }
  if (!headline || !cta) {
    return NextResponse.json(
      { ok: false, error: "missing_headline_or_cta" },
      { status: 400 }
    );
  }
  const ab_job_id = newAbJobId();
  try {
    const outcome = await runAB({
      source_job_id,
      ab_job_id,
      headline,
      cta,
      eyebrow: body.eyebrow?.trim() || undefined,
      subheadline: body.subheadline?.trim() || undefined,
      trust_element: body.trust_element?.trim() || undefined,
      footer_line: body.footer_line?.trim() || undefined,
    });
    return NextResponse.json({
      ok: true,
      quality_status: "UNPROVEN",
      publication_allowed: false,
      outcome,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "ab_run_failed", reason },
      { status: 500 }
    );
  }
}
