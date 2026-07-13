// POST /api/ai/dispatch — Trade Center's single AI entrypoint.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Every AI interaction on the platform routes
//    through this one endpoint. Cost routing + quota enforcement +
//    tool discovery all live here so no App has to reason about
//    which model to call.
//
// 2. Which future Apps benefit?  Every App with AI tools. Marketplace
//    (search_products / compare / alternatives), Orders (track /
//    cancel), Projects (estimate / quote), Fleet (dispatch), etc.
//
// 3. Which doc authorises?  ADR-052 + TRADE_CENTER_2_SPEC.md §19.5 +
//    PLATFORM_ARCHITECTURE §7.3 "The AI dispatcher endpoint".
//
// SSE streaming lands in ADR-052b. Week 4 ships JSON responses so
// the copilot works end-to-end while the streaming pipeline lands.

import { NextResponse } from "next/server";
import { bootstrapPlatform } from "@/platform/bootstrap";
import { dispatch } from "@/platform/aiTools/dispatcher";
import type { DispatchInput } from "@/platform/aiTools/dispatcher";

bootstrapPlatform();

export const dynamic = "force-dynamic";

type Payload = Partial<DispatchInput>;

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  const prompt = (payload.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "empty-prompt" },
      { status: 400 }
    );
  }
  if (prompt.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "prompt-too-long" },
      { status: 400 }
    );
  }

  try {
    const result = await dispatch({
      prompt,
      userTier: payload.userTier ?? "professional",
      userSlug: payload.userSlug,
      history: payload.history
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/ai/dispatch]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "dispatch-failed",
        detail: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}
