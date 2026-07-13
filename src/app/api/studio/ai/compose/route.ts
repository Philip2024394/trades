// POST /api/studio/ai/compose
//
// The Studio's Lovable-parity brain. Takes a merchant's intent + their
// context (business name, trade, city, services, KG) and returns:
//   - which section to render (id)
//   - what params to fill (matches the section's editableFields schema)
//
// Prompt caching: the section catalog + system rubric are cached
// (~15K tokens) so a warmed request pays 10% on that prefix. Only the
// merchant context + user intent are fresh tokens.
//
// Auth: magic-link (slug + edit_token). Same pattern as every other
// merchant-scoped route.
//
// Rate limit: 30 requests / merchant / 5 minutes. Enough for a real
// editing session, not enough for runaway costs.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { completeWithUsage } from "@/lib/llm/anthropic";
import {
  getSectionCatalog,
  getCatalogEntry,
  type CatalogEntry
} from "@/lib/studio/ai/sectionCatalog";
import { checkRateAndLog, logUsage } from "@/lib/studio/ai/usage";
import { designConstitutionFor } from "@/lib/studio/ai/designConstitution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type ComposeBody = {
  slug?: string;
  edit_token?: string;
  intent?: string;
  library?: string;
};

type SectionProposal = {
  sectionId: string;
  reasoning: string;
  params: Record<string, unknown>;
};

// Cached rubric — describes the JOB to the model. Never changes across
// requests. Under prompt caching this is billed at 10% of input token
// cost after the first hit.
const CACHED_SYSTEM_RUBRIC = `You are the Studio composer for Thenetworkers — a UK-trades platform where merchants pay £14.99/month for a polished custom profile.

Your job: given a merchant's intent + business context, pick the single best-fit section from the catalog and fill its editable fields with content specific to that merchant.

Rules that are NON-NEGOTIABLE:
1. Return ONLY the section id from the provided catalog. Never invent an id.
2. Fill every field flagged aiPromptable with content specific to this merchant. Non-aiPromptable fields keep their catalog defaults.
3. Voice: UK trades-native. Short sentences. Direct. No "premium", "curated", "boutique", "elevated", "solutions", "empowering". Yes to "mate", "trades", "sparks", "smashed it", "on the tools".
4. Copy is real, not stock. Use the merchant's actual services, city, review count, years in business.
5. When the intent is ambiguous (e.g. "a hero"), default to trustAnchor for established trades and postcodeLocal for emergency/local trades.
6. Respect maxLength on every text field. Truncate cleanly, never mid-word.
7. Prefer sections marked bestForVerticals matching the merchant's trade.

Output format: JSON object with { sectionId: string, reasoning: string, params: Record<string, unknown> }. The reasoning is 1 sentence for the merchant-facing "why we picked this" tooltip.`;

async function loadMerchantContext(
  listingId: string
): Promise<{ context: string; trade: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "display_name, trading_name, city, primary_trade, bio, services_offered, qualifications, is_insured, dbs_checked, rating_count, follower_count, joined_at"
    )
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) return null;
  const name = data.trading_name?.trim() || data.display_name;
  const services = Array.isArray(data.services_offered)
    ? (data.services_offered as string[]).slice(0, 8).join(", ")
    : "";
  const quals = Array.isArray(data.qualifications)
    ? (data.qualifications as string[]).slice(0, 6).join(", ")
    : "";
  const yearsInTrade = data.joined_at
    ? Math.max(1, Math.floor((Date.now() - new Date(data.joined_at).getTime()) / (365 * 24 * 3600 * 1000)))
    : null;
  const context = [
    `Business name: ${name}`,
    `Primary trade: ${data.primary_trade}`,
    data.city ? `City: ${data.city}` : "",
    services ? `Services: ${services}` : "",
    quals ? `Qualifications: ${quals}` : "",
    data.is_insured ? "Insured: yes" : "",
    data.bio ? `Bio one-liner: ${data.bio.slice(0, 200)}` : "",
    (data.rating_count ?? 0) > 0
      ? `Reviews: ${data.rating_count} on record`
      : "",
    yearsInTrade ? `Years on Thenetworkers: ${yearsInTrade}` : ""
  ]
    .filter(Boolean)
    .join("\n");
  return { context, trade: data.primary_trade };
}

function pickCandidateSections(
  catalog: CatalogEntry[],
  library: string | null,
  trade: string
): CatalogEntry[] {
  let candidates = catalog;
  if (library) candidates = candidates.filter((c) => c.library === library);
  // Boost sections whose bestForVerticals include this trade —
  // send them first so the model sees them before token cutoff.
  candidates.sort((a, b) => {
    const aMatch = a.bestForVerticals?.includes(trade) ? 0 : 1;
    const bMatch = b.bestForVerticals?.includes(trade) ? 0 : 1;
    return aMatch - bMatch;
  });
  return candidates;
}

function fallbackProposal(
  candidates: CatalogEntry[],
  context: string
): SectionProposal {
  const pick = candidates[0];
  if (!pick) {
    return {
      sectionId: "",
      reasoning: "No section catalog available",
      params: {}
    };
  }
  // Deterministic fallback — same shape as an LLM proposal. Merchant
  // still gets a working section; just less voicey.
  const params: Record<string, unknown> = {};
  for (const f of pick.fields) {
    params[f.key] = f.default;
  }
  return {
    sectionId: pick.id,
    reasoning: `Fallback pick — ${pick.name} matches the requested library. AI unavailable so defaults used. Context: ${context.slice(0, 60)}...`,
    params
  };
}

function validateProposal(
  raw: unknown,
  catalog: CatalogEntry[]
): SectionProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { sectionId?: unknown; reasoning?: unknown; params?: unknown };
  const sectionId = typeof p.sectionId === "string" ? p.sectionId : "";
  if (!sectionId) return null;
  const entry = catalog.find((c) => c.id === sectionId);
  if (!entry) return null;
  const reasoning = typeof p.reasoning === "string" ? p.reasoning.slice(0, 240) : "";
  const rawParams =
    p.params && typeof p.params === "object" ? (p.params as Record<string, unknown>) : {};

  // Enforce field schema — never let the LLM inject unknown keys and
  // apply defaults + maxLength truncation on every known field.
  const params: Record<string, unknown> = {};
  for (const f of entry.fields) {
    const v = rawParams[f.key];
    if (v === undefined || v === null) {
      params[f.key] = f.default;
      continue;
    }
    if (f.kind === "text" && typeof v === "string") {
      params[f.key] = f.maxLength ? v.slice(0, f.maxLength) : v;
    } else {
      params[f.key] = v;
    }
  }
  return { sectionId, reasoning, params };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ComposeBody;
  try {
    body = (await req.json()) as ComposeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const intent = s(body.intent);
  const library = s(body.library) || null;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (!intent) {
    return NextResponse.json(
      { ok: false, error: "intent_required" },
      { status: 400 }
    );
  }

  const { data: listing, error: lErr } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (lErr || !listing || !constantTimeEq(listing.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }

  if (!(await checkRateAndLog(listing.id, "compose", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  const ctx = await loadMerchantContext(listing.id);
  if (!ctx) {
    await logUsage({
      listingId: listing.id,
      endpoint: "compose",
      status: "error",
      errorCode: "merchant_context_missing",
      promptSnippet: intent
    });
    return NextResponse.json(
      { ok: false, error: "merchant_context_missing" },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  const catalog = getSectionCatalog();
  const candidates = pickCandidateSections(catalog, library, ctx.trade);
  if (candidates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_sections" },
      { status: 500 }
    );
  }

  // Cached prefix: the section catalog JSON. This is the same across
  // every request within the 5-minute prompt cache TTL, so subsequent
  // calls pay ~10% of input token cost on this ~15K token payload.
  const catalogJson = JSON.stringify(
    candidates.map((c) => ({
      id: c.id,
      name: c.name,
      library: c.library,
      description: c.description,
      bestForVerticals: c.bestForVerticals,
      fields: c.fields.map((f) => ({
        key: f.key,
        role: f.role,
        kind: f.kind,
        maxLength: f.maxLength,
        aiPromptable: f.aiPromptable
      }))
    })),
    null,
    0
  );
  const cachedSystem = `${CACHED_SYSTEM_RUBRIC}\n\n---\n${designConstitutionFor("customer-facing")}\n\n---\nCATALOG (${candidates.length} sections available):\n${catalogJson}`;

  const userMessage = `MERCHANT CONTEXT:\n${ctx.context}\n\nINTENT:\n"${intent}"\n\nReturn a JSON object matching { sectionId, reasoning, params }. sectionId MUST be one of the catalog ids above.`;

  const result = await completeWithUsage({
    system:
      "Return ONLY valid JSON. No markdown fences. No prose before or after.",
    cachedSystem,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1200,
    temperature: 0.3
  });

  let proposal: SectionProposal | null = null;
  if (result?.text) {
    try {
      const cleaned = result.text
        .replace(/^\s*```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned) as unknown;
      proposal = validateProposal(parsed, catalog);
    } catch {
      proposal = null;
    }
  }

  const latencyMs = Date.now() - startedAt;

  if (!proposal) {
    proposal = fallbackProposal(candidates, ctx.context);
  }

  await logUsage({
    listingId: listing.id,
    endpoint: "compose",
    status: result?.text ? "ok" : "ai_unavailable",
    sectionId: proposal.sectionId || null,
    promptSnippet: intent,
    inputTokens: result?.usage.inputTokens ?? 0,
    outputTokens: result?.usage.outputTokens ?? 0,
    cacheReadTokens: result?.usage.cacheReadTokens ?? 0,
    cacheCreationTokens: result?.usage.cacheCreationTokens ?? 0,
    latencyMs
  });

  return NextResponse.json({
    ok: true,
    proposal,
    usage: result?.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0
    },
    catalogEntry: getCatalogEntry(proposal.sectionId)
  });
}
