// POST /api/nex/brain-chat
//
// Generic Brain-routing chat endpoint for the NEX Platform. Accepts a
// brain_slug + message and dispatches to the registered Brain. Replaces
// /api/nex/staircase-chat as the platform-scale API; the old endpoint
// stays live as a thin alias for backward compatibility.
//
// Body: { brain_slug: string, message: string, history?: [{role, content}...] }
// Returns: { ok, brain_slug, brain_title, answer, citations, wood_cards?, status, ... }
//
// Note: /api/nex/chat is unavailable — it's the existing merchant chat
// endpoint with its own intent system. This endpoint is specifically
// for Brain-routed conversational surfaces.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getBrain, getGeneralBrain } from "@/lib/nex/platform/_registry";
import { composeStaircaseAnswer } from "@/lib/nex/brains/_composer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (process.env.NEX_BRAIN_RUNTIME_ENABLED !== "1") {
    return NextResponse.json({ ok: false, error: "runtime_disabled" }, { status: 503 });
  }

  let body: { brain_slug?: unknown; message?: unknown; history?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });

  // Resolve the target Brain from the registry — fall back to General
  // if the requested slug doesn't exist. Per Intent Router spec,
  // General is the always-available fallback, never Staircase.
  const requestedSlug = typeof body.brain_slug === "string" ? body.brain_slug.trim() : "";
  const target = (requestedSlug && getBrain(requestedSlug)) || getGeneralBrain();
  if (!target) {
    return NextResponse.json({ ok: false, error: "no_brains_available" }, { status: 503 });
  }
  if (!target.enabled || target.status !== "live") {
    return NextResponse.json({
      ok: true,
      brain_slug: target.slug,
      brain_title: target.title,
      answer: `I'm still learning about ${target.title.toLowerCase()} — I don't want to guess. Take my details and pass this to the team, or ask me about a related area I can help with confidently.`,
      citations: [],
      status: "brain_not_live"
    });
  }

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (Array.isArray(body.history)) {
    for (const raw of body.history) {
      if (raw && typeof raw === "object"
          && ((raw as { role?: unknown }).role === "user" || (raw as { role?: unknown }).role === "assistant")
          && typeof (raw as { content?: unknown }).content === "string") {
        history.push({
          role:    (raw as { role: "user" | "assistant" }).role,
          content: (raw as { content: string }).content
        });
      }
    }
  }

  try {
    // The composer's brain_slug parameter drives which Brain content
    // gets retrieved + which plugins fire (via the manifest). Staircase
    // enables all its plugins; General enables none.
    const composerSlug = target.slug === "staircases" ? "staircase" : target.slug;
    const result = await composeStaircaseAnswer({
      brain_slug: composerSlug,
      question:   message,
      history:    history.length > 0 ? history : undefined
    });
    return NextResponse.json({
      ok:             true,
      brain_slug:     target.slug,
      brain_title:    target.title,
      answer:         result.answer,
      citations:      result.citations,
      wood_cards:     result.wood_cards,
      visual_intent:  result.visual_intent,
      comparison:     result.comparison,
      expertise:      result.expertise,
      status:         result.status,
      brain_versions: result.brain_versions,
      presentation:   result.presentation,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "compose_failed" },
      { status: 500 }
    );
  }
}
