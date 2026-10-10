// src/app/api/nex/create-banners/sandbox/generate/route.ts
//
// NEX Create Banners · Sandbox generation endpoint · 2026-09-23
// =============================================================
// POST · starts one sandbox job. Returns { job_id }.
// Kicks off SDXL generation + composition in background.
// Every output stamped UNPROVEN · never published · never manifest-written.

import { NextRequest, NextResponse } from "next/server";
import { startSandboxJob } from "@/lib/nex/create-banners/sandbox/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  business_display_name?: string;
  product_or_service_label?: string;
  campaign_objective?: string;
  headline?: string;
  cta?: string;
  distinct_seeds?: number;
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
  const trim = (s: string | undefined) => (s ?? "").trim();
  const business = trim(body.business_display_name);
  const product = trim(body.product_or_service_label);
  const objective = trim(body.campaign_objective);
  const headline = trim(body.headline);
  const cta = trim(body.cta);
  if (!business || !product || !objective || !headline || !cta) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_required_fields",
        required: [
          "business_display_name",
          "product_or_service_label",
          "campaign_objective",
          "headline",
          "cta",
        ],
      },
      { status: 400 }
    );
  }
  const seedsCount = Number.isFinite(body.distinct_seeds)
    ? Math.max(1, Math.min(4, Number(body.distinct_seeds)))
    : 3;

  const job = startSandboxJob({
    business_display_name: business,
    product_or_service_label: product,
    campaign_objective: objective,
    headline,
    cta,
    distinct_seeds: seedsCount,
  });

  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    total_variants: job.total_variants,
    quality_status: job.quality_status,
    publication_allowed: job.publication_allowed,
    reference_sha256_used: job.reference_sha256_used,
    poll_url: `/api/nex/create-banners/sandbox/job/${job.job_id}`,
  });
}
