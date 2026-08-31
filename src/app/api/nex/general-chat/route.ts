// POST /api/nex/general-chat · general customer Nex Chat backend · Philip 2026-08-03.
//
// The customer-side general assistant endpoint. Called by the
// /nex-app/chat page (the clean general chat surface) and by the shell
// FAB. Deliberately separate from:
//   · /api/nex/chat            — MERCHANT-side Nex business assistant (Studio · BI · CX etc.)
//   · /api/nex/merchant-chat   — merchant-context intake (Trade Centre)
//   · /api/brains/[slug]/message — trade-brain reasoning (Staircase etc.)
//
// Philip 2026-08-31 · Stage 3.6 · The routing logic previously in-lined
// here now lives in src/lib/nex/brain/orchestrate.ts as the canonical
// NEX Brain. This route stays as the /nex-app/chat text surface and
// layers theme-persistence on top of the Brain's decisions. The exact
// same orchestrator is called by /api/nex-conv/chat (voice composer).

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  activateThemeByIntent,
  resetThemeForSession,
} from "@/lib/nex/themes/server-repo";
import { orchestrateChatTurn } from "@/lib/nex/brain/orchestrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readOptionalSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

type ChatBody = {
  message?: string;
  conversation_id?: string;
  /**
   * User's market context · Philip 2026-08-31 market-scoped-knowledge
   * doctrine · Stage 1 chat-route wiring. When "ID", staircase/plumber/
   * quotation keywords route to indonesian intent instead of the UK
   * trades cascade. When absent, defaults to "ID" because this
   * endpoint is the Indonesian NEX shell (/nex-app/chat). UK trade
   * clients must explicitly send "UK" to opt out.
   */
  market?: "ID" | "UK" | "US";
};

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id.length > 0
      ? body.conversation_id
      : randomUUID();

  const userMarket: "ID" | "UK" | "US" =
    body.market === "UK" || body.market === "US" || body.market === "ID"
      ? body.market
      : "ID";

  const composed = orchestrateChatTurn(message, { userMarket, conversationId });
  let { reply } = composed;
  const { suggestions, card, theme_command, intent, intent_reason } = composed;

  let theme_persisted: null | {
    active: unknown;
    theme_id: string;
    via: string;
    preview_expires_at: string | null;
  } = null;

  const sessionId = readOptionalSessionId(req);
  if (theme_command && sessionId) {
    try {
      if (theme_command.action === "reset") {
        const r = await resetThemeForSession(sessionId);
        theme_persisted = {
          active: r.active,
          theme_id: r.theme.id,
          via: "reset",
          preview_expires_at: null,
        };
      } else if (theme_command.action === "activate") {
        const r = await activateThemeByIntent(sessionId, theme_command.theme_id);
        if (r.ok) {
          theme_persisted = {
            active: r.active,
            theme_id: r.theme.id,
            via: r.via,
            preview_expires_at: r.preview?.expires_at ?? null,
          };
          if (r.via === "preview_granted") {
            reply +=
              " I've turned it on for the next 24 hours so you can experience it properly.";
          }
        }
      }
    } catch (err) {
      console.error("[nex-general-chat][theme_persist]", err);
    }
  }

  return NextResponse.json({
    ok: true,
    reply,
    suggestions,
    card,
    theme_command,
    theme_persisted,
    conversation_id: conversationId,
    served_by: "nex-general-chat-v2",
    intent: intent ?? null,
    intent_reason: intent_reason ?? null,
  });
}
