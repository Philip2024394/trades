// POST /api/nex/staircase-chat
//
// Public admin-testing endpoint for chatting with Nex Staircases.
// Feature-flagged behind NEX_BRAIN_RUNTIME_ENABLED. No auth for now —
// admin (Philip) uses this to test the Brain end-to-end before proper
// merchant/homeowner packaging is designed.
//
// Body: { message: string, history?: [{role, content}...] }
// Returns: { ok, answer, citations, status, brain_versions }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { composeStaircaseAnswer } from "@/lib/nex/brains/_composer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NEX_BRAIN_RUNTIME_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "brain_runtime_disabled" },
      { status: 503 }
    );
  }

  let body: {
    message?: unknown;
    history?: unknown;
    expertise_override?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.message !== "string" || body.message.trim() === "") {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }

  const rawOverride = typeof body.expertise_override === "string" ? body.expertise_override : "";
  const expertiseOverride =
    rawOverride === "trade" || rawOverride === "homeowner" || rawOverride === "unknown"
      ? rawOverride
      : undefined;

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (Array.isArray(body.history)) {
    for (const raw of body.history) {
      if (
        raw &&
        typeof raw === "object" &&
        (raw as { role?: unknown }).role !== undefined &&
        typeof (raw as { content?: unknown }).content === "string"
      ) {
        const r = (raw as { role: string }).role;
        if (r === "user" || r === "assistant") {
          history.push({ role: r, content: (raw as { content: string }).content });
        }
      }
    }
  }

  try {
    const result = await composeStaircaseAnswer({
      brain_slug:        "staircase",
      question:          body.message.trim(),
      history:           history.length > 0 ? history : undefined,
      expertiseOverride: expertiseOverride
    });
    return NextResponse.json({
      ok:              true,
      answer:          result.answer,
      citations:       result.citations,
      wood_cards:      result.wood_cards,
      visual_intent:   result.visual_intent,
      comparison:      result.comparison,
      expertise:       result.expertise,
      status:          result.status,
      brain_versions:  result.brain_versions
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "internal_error" },
      { status: 500 }
    );
  }
}
