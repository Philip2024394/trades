// Business Discovery API.
//
//   POST /api/studio/business-discovery
//     Body: { description: string }
//     → { ok, discovery: { tradeSlug, outcomes, coverage, modules, ... } }
//
// The merchant types a free-text description of their business. We ask
// the LLM to extract structured signals, then STRICTLY validate every
// slug against the live registries. Any hallucinated slug is dropped
// silently — never surfaced to the merchant.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { aiGateway } from "@/lib/studio/aiGateway";
import "@/lib/studio/aiProviders"; // register anthropic provider
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { OUTCOME_SLUGS } from "@/lib/studio/blueprints";
import type { OutcomeSlug } from "@/lib/studio/blueprints";
import { BUSINESS_MODULES } from "@/lib/studio/modules";

export const runtime = "nodejs";

type PostBody = { description?: string };

type LlmResult = {
  tradeSlug?: string | null;
  outcomes?: string[];
  coverage?: {
    national?: boolean;
    postcode?: string | null;
    radiusMi?: number | null;
  };
  modules?: string[];
  merchantName?: string | null;
  confidence?: number;
  reasoning?: string;
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
  const description = (body.description ?? "").trim();
  if (description.length < 8) {
    return NextResponse.json(
      { ok: false, error: "description-too-short" },
      { status: 400 }
    );
  }

  // Assemble corpora for the retrieval-constrained prompt.
  const trades = TRADE_OFF_TRADES.map((t) => ({
    slug: t.slug,
    label: t.label
  }));
  const outcomes = (OUTCOME_SLUGS as readonly string[]).map((slug) => ({
    slug,
    label: OUTCOME_LABELS[slug as OutcomeSlug] ?? slug
  }));
  const modules = BUSINESS_MODULES.map((m) => ({
    slug: m.id,
    label: m.name
  }));

  const res = await aiGateway.complete({
    task: "business.discover",
    context: {
      payload: { description, trades, outcomes, modules }
    }
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: res.error.code,
        detail: res.error.message
      },
      { status: 502 }
    );
  }

  const raw = res.result as LlmResult;

  // ─── STRICT validation — drop hallucinations silently ────────
  const tradeSet = new Set(TRADE_OFF_TRADES.map((t) => t.slug));
  const outcomeSet = new Set(OUTCOME_SLUGS as readonly string[]);
  const moduleSet = new Set(BUSINESS_MODULES.map((m) => m.id));

  const tradeSlug =
    raw.tradeSlug && tradeSet.has(raw.tradeSlug) ? raw.tradeSlug : null;
  const validOutcomes = (raw.outcomes ?? [])
    .filter((o): o is string => typeof o === "string")
    .filter((o) => outcomeSet.has(o))
    .slice(0, 3);
  const validModules = (raw.modules ?? [])
    .filter((m): m is string => typeof m === "string")
    .filter((m) => moduleSet.has(m))
    .slice(0, 4);

  const coverage = raw.coverage
    ? {
        national: Boolean(raw.coverage.national),
        postcode:
          typeof raw.coverage.postcode === "string" &&
          raw.coverage.postcode.trim()
            ? raw.coverage.postcode.trim().toUpperCase()
            : null,
        radiusMi:
          typeof raw.coverage.radiusMi === "number" &&
          raw.coverage.radiusMi > 0 &&
          raw.coverage.radiusMi <= 500
            ? Math.round(raw.coverage.radiusMi)
            : null
      }
    : { national: false, postcode: null, radiusMi: null };

  return NextResponse.json({
    ok: true,
    discovery: {
      tradeSlug,
      outcomes: validOutcomes,
      coverage,
      modules: validModules,
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
    }
  });
}
