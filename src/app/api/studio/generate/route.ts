// Slice E — Generate an app layout from a merchant prompt.
//
//   POST /api/studio/generate
//     Body: {
//       prompt: string,        // free-text description
//       tradeSlug?: string     // optional — skip LLM discovery if set
//     }
//     → {
//       ok,
//       generated: {
//         layoutJson,          // StudioLayoutJson ready for StudioLiveShell
//         themePresetId,       // for wrapping in <ThemeProvider>
//         picks,               // diagnostic: which section landed at each slot
//         tradeSlug,
//         discovery?           // if the LLM was called, its extraction
//       }
//     }
//
// Retrieval-first architecture:
//   • LLM extracts intent ONLY — tradeSlug + optional merchantName / hints
//   • Every downstream pick (theme, sections, KG content, assets) is
//     deterministic against the live registries
//   • Hallucinated trade slugs are rejected before composition — the
//     caller sees a 400, never a broken layout

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { aiGateway } from "@/lib/studio/aiGateway";
import "@/lib/studio/aiProviders"; // register anthropic provider
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { OUTCOME_SLUGS } from "@/lib/studio/blueprints";
import type { OutcomeSlug } from "@/lib/studio/blueprints";
import { BUSINESS_MODULES } from "@/lib/studio/modules";
import { composeHomeLayout } from "@/lib/studio/generate/composeLayout";
import { buildLayoutFromSeeds } from "@/lib/studio/blueprints/buildLayout";
import { packageForTrade } from "@/lib/knowledge";

export const runtime = "nodejs";

type PostBody = {
  prompt?: string;
  tradeSlug?: string;
};

type Discovery = {
  tradeSlug: string | null;
  outcomes: string[];
  merchantName: string | null;
  confidence: number;
  reasoning: string;
};

const OUTCOME_LABELS: Record<OutcomeSlug, string> = {
  "quote-requests": "More quote requests",
  "phone-calls": "Phone calls",
  "whatsapp-enquiries": "WhatsApp enquiries",
  "emergency-callout": "Emergency callout",
  "product-sales": "Sell products",
  "service-sales": "Book services",
  "project-showcase": "Showcase projects",
  "staff-recruitment": "Recruit trades",
  "local-coverage": "Local coverage",
  "trade-account": "Trade accounts",
  "equipment-hire": "Equipment hire",
  "training-signups": "Training signups"
};

const TRADE_SLUG_SET = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 8) {
    return NextResponse.json(
      { ok: false, error: "prompt-too-short" },
      { status: 400 }
    );
  }

  // Validate an explicit tradeSlug up front — the caller has skipped
  // discovery, so we have to reject unknown slugs cleanly.
  const providedTradeSlug = (body.tradeSlug ?? "").trim();
  if (providedTradeSlug && !TRADE_SLUG_SET.has(providedTradeSlug)) {
    return NextResponse.json(
      { ok: false, error: "unknown-trade-slug", tradeSlug: providedTradeSlug },
      { status: 400 }
    );
  }

  // ─── Step 1: intent extraction ────────────────────────────────
  let discovery: Discovery | null = null;
  let tradeSlug = providedTradeSlug;

  if (!tradeSlug) {
    const trades = TRADE_OFF_TRADES.map((t) => ({ slug: t.slug, label: t.label }));
    const outcomes = (OUTCOME_SLUGS as readonly string[]).map((slug) => ({
      slug,
      label: OUTCOME_LABELS[slug as OutcomeSlug] ?? slug
    }));
    const modules = BUSINESS_MODULES.map((m) => ({ slug: m.id, label: m.name }));

    const res = await aiGateway.complete({
      task: "business.discover",
      context: { payload: { description: prompt, trades, outcomes, modules } }
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error.code, detail: res.error.message },
        { status: 502 }
      );
    }

    const raw = res.result as {
      tradeSlug?: string | null;
      outcomes?: string[];
      merchantName?: string | null;
      confidence?: number;
      reasoning?: string;
    };

    const outcomeSet = new Set(OUTCOME_SLUGS as readonly string[]);
    const validTrade =
      raw.tradeSlug && TRADE_SLUG_SET.has(raw.tradeSlug) ? raw.tradeSlug : null;
    const validOutcomes = (raw.outcomes ?? [])
      .filter((o): o is string => typeof o === "string")
      .filter((o) => outcomeSet.has(o))
      .slice(0, 3);

    discovery = {
      tradeSlug: validTrade,
      outcomes: validOutcomes,
      merchantName:
        typeof raw.merchantName === "string" && raw.merchantName.trim()
          ? raw.merchantName.trim()
          : null,
      confidence:
        typeof raw.confidence === "number"
          ? Math.max(0, Math.min(1, raw.confidence))
          : 0,
      reasoning:
        typeof raw.reasoning === "string" ? raw.reasoning.slice(0, 280) : ""
    };

    if (!validTrade) {
      return NextResponse.json(
        {
          ok: false,
          error: "trade-not-detected",
          detail:
            "The prompt didn't map to a known trade. Pass tradeSlug explicitly or add trade-specific language to the prompt.",
          discovery
        },
        { status: 422 }
      );
    }
    tradeSlug = validTrade;
  }

  // ─── Step 2: deterministic composition ────────────────────────
  // Guard: we need a KG package to fill the section content. Every
  // TRADE_OFF slug should have one, but new trades sometimes ship
  // ahead of their package — surface that clearly.
  if (!packageForTrade(tradeSlug)) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-knowledge-package",
        detail: `No Knowledge Graph package registered for ${tradeSlug}. Section content would be empty.`,
        tradeSlug
      },
      { status: 422 }
    );
  }

  const composed = composeHomeLayout({
    tradeSlug,
    prompt,
    merchantName: discovery?.merchantName ?? undefined,
    // Outcome hints steer hero pick — the composer maps them itself.
    emergencyFirst: discovery?.outcomes.includes("emergency-callout"),
    productFirst: discovery?.outcomes.includes("product-sales"),
    seed: `generate:${session.brand.id}:${tradeSlug}`
  });

  // ─── Step 3: layout assembly (assets + defaults merge) ────────
  const layoutJson = await buildLayoutFromSeeds(composed.seeds, {
    assetContext: {
      industry: tradeSlug,
      style: composed.themePresetId,
      seed: `generate:${session.brand.id}:${tradeSlug}`
    }
  });

  return NextResponse.json({
    ok: true,
    generated: {
      layoutJson,
      themePresetId: composed.themePresetId,
      picks: composed.picks,
      tradeSlug,
      discovery
    }
  });
}
