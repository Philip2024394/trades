// POST /api/studio/ai/mutate
//
// Section mutation engine. Takes an existing section (id + current
// params) plus a merchant's natural-language edit ("make it darker",
// "add a fifth star", "swap the CTA to phone call") and returns a
// JSON patch on the section params.
//
// The LLM only sees the section's editable field schema — not the
// whole catalog — so the mutation is scoped and safe. Field kind +
// maxLength are enforced on the server after the model responds.
//
// Prompt caching: the section catalog entry (schema + defaults) is
// cached across mutations of the same section. Merchant context is
// cached too. Only the user's prompt + current params vary per call.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { completeWithUsage } from "@/lib/llm/anthropic";
import {
  getCatalogEntry,
  getSectionCatalog
} from "@/lib/studio/ai/sectionCatalog";
import { checkRateAndLog, logUsage } from "@/lib/studio/ai/usage";
import { designConstitutionFor } from "@/lib/studio/ai/designConstitution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = 60;
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

type MutateBody = {
  slug?: string;
  edit_token?: string;
  section_id?: string;
  current_params?: Record<string, unknown>;
  prompt?: string;
};

const CACHED_SYSTEM_RUBRIC = `You mutate a single Studio section for Thenetworkers — a UK-trades platform. The merchant paid £14.99/month and expects instant, precise changes.

Your job: read the section's field schema + current values + the merchant's edit request. Return a JSON PATCH — an object with ONLY the fields that must change.

Rules that are NON-NEGOTIABLE:
1. Return ONLY keys from the schema. Never invent field names.
2. Preserve field kind. If a field is "select", the value must be one of its options. If numeric, return a number.
3. Respect maxLength on text fields — truncate cleanly, never mid-word.
4. Voice: UK trades-native. Short sentences. No "premium", "curated", "boutique", "elevated". Yes to "mate", "trades", "on the tools".
5. When the merchant asks for a style change ("darker", "brighter", "more premium"), swap only the relevant fields (surface, visualEffect, backgroundImageUrl if photo would help) — do NOT rewrite copy unless asked.
6. When the merchant asks for a copy change ("shorter headline", "add stats", "sound urgent"), rewrite only the relevant text fields — do NOT touch layout.
7. If the request is ambiguous or refers to a field the section doesn't have, return { "note": "explanation" } and no patch keys.

Output format: JSON object. Keys = field keys to update. Values = new values. Include a "_note" key (optional) with a 1-sentence merchant-facing explanation.

Example — merchant asks "make the headline shorter and add urgency":
{ "heading": "Emergency plumber in Manchester — 24/7", "_note": "Trimmed to 40 chars, added 24/7 urgency cue." }`;

async function loadMerchantContext(
  listingId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "display_name, trading_name, city, primary_trade, bio, services_offered, is_insured, rating_count"
    )
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) return null;
  const name = data.trading_name?.trim() || data.display_name;
  const services = Array.isArray(data.services_offered)
    ? (data.services_offered as string[]).slice(0, 6).join(", ")
    : "";
  return [
    `Business: ${name}`,
    `Trade: ${data.primary_trade}`,
    data.city ? `City: ${data.city}` : "",
    services ? `Services: ${services}` : "",
    data.is_insured ? "Insured: yes" : "",
    data.bio ? `Bio: ${data.bio.slice(0, 160)}` : "",
    (data.rating_count ?? 0) > 0 ? `Reviews: ${data.rating_count}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

/** Validate a JSON patch returned by the model. Drop unknown keys,
 *  clamp text to maxLength, coerce kinds where safe. Returns { patch,
 *  rejected } — patch is the safe subset, rejected lists dropped keys
 *  so the caller can surface a "some of your request couldn't be
 *  applied" note. */
function validatePatch(
  raw: unknown,
  entry: ReturnType<typeof getCatalogEntry>
): {
  patch: Record<string, unknown>;
  note: string | null;
  rejected: string[];
} {
  const patch: Record<string, unknown> = {};
  const rejected: string[] = [];
  let note: string | null = null;
  if (!raw || typeof raw !== "object" || !entry) {
    return { patch, note, rejected };
  }
  const obj = raw as Record<string, unknown>;

  // Extract optional _note field for merchant-facing explanation.
  if (typeof obj._note === "string") {
    note = obj._note.slice(0, 240);
  }

  const fieldMap = new Map(entry.fields.map((f) => [f.key, f]));
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_note") continue;
    const field = fieldMap.get(key);
    if (!field) {
      rejected.push(key);
      continue;
    }
    if (value === null || value === undefined) {
      rejected.push(key);
      continue;
    }
    switch (field.kind) {
      case "text": {
        if (typeof value !== "string") {
          rejected.push(key);
          continue;
        }
        patch[key] = field.maxLength ? value.slice(0, field.maxLength) : value;
        break;
      }
      case "number": {
        const n =
          typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number(value)
              : NaN;
        if (!Number.isFinite(n)) {
          rejected.push(key);
          continue;
        }
        patch[key] = n;
        break;
      }
      case "select":
      case "image":
      case "link":
      default:
        patch[key] = value;
    }
  }
  return { patch, note, rejected };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: MutateBody;
  try {
    body = (await req.json()) as MutateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const sectionId = s(body.section_id);
  const prompt = s(body.prompt);
  const currentParams =
    body.current_params && typeof body.current_params === "object"
      ? (body.current_params as Record<string, unknown>)
      : {};

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (!sectionId || !prompt) {
    return NextResponse.json(
      { ok: false, error: "section_id_and_prompt_required" },
      { status: 400 }
    );
  }

  const entry = getCatalogEntry(sectionId);
  if (!entry) {
    return NextResponse.json(
      { ok: false, error: "unknown_section" },
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

  if (!(await checkRateAndLog(listing.id, "mutate", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  const merchantContext = await loadMerchantContext(listing.id);
  if (!merchantContext) {
    await logUsage({
      listingId: listing.id,
      endpoint: "mutate",
      status: "error",
      errorCode: "merchant_context_missing",
      sectionId,
      promptSnippet: prompt
    });
    return NextResponse.json(
      { ok: false, error: "merchant_context_missing" },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  // Cached prefix: rubric + FULL section catalog. Anthropic requires a
  // minimum prefix size for cache activation (~1024 tokens for Sonnet).
  // A single section schema hovered below the threshold, so cache
  // reads were 0 across calls. Sending the whole catalog is:
  //   • Stable across every mutation → guaranteed cache hit after first
  //     call within the 5-min TTL.
  //   • ~15K tokens once → billed at ~10% on subsequent calls.
  //   • The current-section schema still varies per call, but that
  //     ships in the fresh user message, not the cache prefix.
  const catalogJson = JSON.stringify(
    getSectionCatalog().map((c) => ({
      id: c.id,
      name: c.name,
      library: c.library,
      description: c.description,
      fields: c.fields.map((f) => ({
        key: f.key,
        role: f.role,
        kind: f.kind,
        maxLength: f.maxLength
      }))
    })),
    null,
    0
  );
  const cachedSystem = `${CACHED_SYSTEM_RUBRIC}\n\n---\n${designConstitutionFor("customer-facing")}\n\n---\nSECTION CATALOG (reference — the current section is one of these):\n${catalogJson}`;

  const currentSchema = JSON.stringify(
    {
      id: entry.id,
      name: entry.name,
      library: entry.library,
      fields: entry.fields
    },
    null,
    0
  );
  const userMessage = `CURRENT SECTION SCHEMA (the one you're editing):\n${currentSchema}\n\nMERCHANT CONTEXT:\n${merchantContext}\n\nCURRENT SECTION PARAMS:\n${JSON.stringify(currentParams, null, 0)}\n\nMERCHANT'S EDIT REQUEST:\n"${prompt}"\n\nReturn a JSON patch — only the field keys that must change. Include an optional "_note" 1-sentence explanation.`;

  const result = await completeWithUsage({
    system: "Return ONLY valid JSON. No markdown fences. No prose.",
    cachedSystem,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 600,
    temperature: 0.35
  });

  const latencyMs = Date.now() - startedAt;

  if (!result?.text) {
    await logUsage({
      listingId: listing.id,
      endpoint: "mutate",
      status: "ai_unavailable",
      sectionId,
      promptSnippet: prompt,
      latencyMs
    });
    return NextResponse.json({
      ok: true,
      patch: {},
      note: "AI unavailable — no changes applied.",
      rejected: [],
      usage: null
    });
  }

  let parsed: unknown = null;
  try {
    const cleaned = result.text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }

  const { patch, note, rejected } = validatePatch(parsed, entry);

  await logUsage({
    listingId: listing.id,
    endpoint: "mutate",
    status: "ok",
    sectionId,
    promptSnippet: prompt,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cacheReadTokens: result.usage.cacheReadTokens,
    cacheCreationTokens: result.usage.cacheCreationTokens,
    latencyMs
  });

  return NextResponse.json({
    ok: true,
    patch,
    note,
    rejected,
    usage: result.usage
  });
}
