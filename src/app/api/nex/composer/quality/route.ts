// POST /api/nex/composer/quality — { blocks, subject?, preview_text?, campaign_type? }
// Returns { checks: QualityCheck[] · counts_by_severity }
import { NextResponse } from "next/server";
import { runQualityChecks } from "@/lib/nex/composer/quality";
import type { Block, QualityCheck, QualitySeverity } from "@/lib/nex/composer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { blocks?: Block[]; subject?: string | null; preview_text?: string | null; campaign_type?: "marketing" | "transactional" | "announcement" | "newsletter" };

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const checks = runQualityChecks({
    blocks: Array.isArray(body.blocks) ? body.blocks : [],
    subject: body.subject ?? null,
    preview_text: body.preview_text ?? null,
    campaign_type: body.campaign_type ?? "marketing",
  });
  const counts: Record<QualitySeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const c of checks as QualityCheck[]) counts[c.severity] += 1;
  return NextResponse.json({ ok: true, checks, counts_by_severity: counts });
}
