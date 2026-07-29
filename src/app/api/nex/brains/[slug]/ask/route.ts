// POST /api/nex/brains/[slug]/ask
//
// Thin orchestration layer. All business logic lives in the Brain
// Runtime (src/lib/nex/brains/_runtime.ts) — this route just:
//   1. Parses input
//   2. Calls runtime.askBrain(...)
//   3. Returns the BrainAnswerEnvelope
//
// The response ALWAYS carries the full explainability payload (answer ·
// evidence · trade_rule · reason · confidence · brain_slug ·
// brain_version · brain_version_id · answered_at · answer_kind).
// This is what makes Nex visibly different from a generic chatbot —
// the user can see the provenance behind every answer.

import { NextResponse, type NextRequest } from "next/server";
import { askBrain, runtimeEnabled } from "@/lib/nex/brains/_runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AskBody = {
  query?: unknown;
  country?: unknown;
  language?: unknown;
  channel?: unknown;
  required_capabilities?: unknown;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!runtimeEnabled()) {
    return NextResponse.json(
      { ok: false, error: "brain_runtime_disabled" },
      { status: 503 }
    );
  }

  const { slug } = await params;
  if (!slug || !/^[a-z][a-z0-9_-]{1,63}$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "query_required" }, { status: 400 });
  }
  if (body.query.length > 4000) {
    return NextResponse.json({ ok: false, error: "query_too_long" }, { status: 400 });
  }

  const country =
    typeof body.country === "string" ? body.country : undefined;
  const language =
    typeof body.language === "string" ? body.language : undefined;
  const channel =
    body.channel === "chat" || body.channel === "web" || body.channel === "mobile" || body.channel === "admin_preview"
      ? body.channel
      : "api";
  const required_capabilities =
    Array.isArray(body.required_capabilities)
      ? (body.required_capabilities.filter((c): c is string => typeof c === "string") as unknown as Parameters<typeof askBrain>[0]["required_capabilities"])
      : undefined;

  try {
    const result = await askBrain({
      query: body.query,
      brain_slug: slug,
      country,
      language,
      channel,
      required_capabilities,
    });
    return NextResponse.json({
      ok: true,
      ...result.envelope,
      answer_id: result.answer_id,
      compatibility_result: result.compatibility_result,
      runtime_used: result.runtime_used,
      brain_source: result.brain_load.source,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "brain_ask_failed", detail },
      { status: 500 }
    );
  }
}
