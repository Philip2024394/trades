// POST /api/studio/ai/orchestrate
//
// The onboarding flow's "generate my profile" button hits this. Takes
// the 7 answers, decides which page slots the merchant asked for, and
// composes each slot in parallel against the section catalog.
//
// Every slot fires as its own composeOnce() call internally so we reuse
// the same LLM path + prompt caching + safety checks as the standalone
// compose endpoint. Result: 5-8 sections generated in one HTTP call,
// under $0.05 with a warm cache.

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

// Same rate-limit style as compose — but this is 1 request per merchant
// per 30 seconds because it fans out 5-8 LLM calls internally.
const RATE_LIMIT_MAX = 4;
const RATE_LIMIT_WINDOW_MS = 30 * 1000;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type Answers = {
  businessType?: string;
  trade?: string;
  offering?: "services" | "products" | "both";
  description?: string;
  city?: string;
  travelDistance?: string;
  deliversNational?: boolean;
  contactMethods?: string[];
  pages?: string[];
};

type OrchestrateBody = {
  slug?: string;
  edit_token?: string;
  answers?: Answers;
};

// Map from Q7 page selection → which section library to compose.
// Order defines page-render order too.
//
// The four rebadged libraries from the pre-task-#41 workaround
// (services / gallery / reviews / contact) now target their natural
// libraries because those sections register server-side via the
// .meta.ts sidecar pattern.
const PAGE_TO_LIBRARY: Array<{ id: string; library: string; intent: (a: Answers) => string }> = [
  {
    id: "profile",
    library: "hero",
    intent: (a) =>
      `Hero for a ${a.businessType} — a ${a.trade} in ${a.city ?? "the UK"}. ${a.description ?? ""}`.slice(0, 400)
  },
  {
    id: "services",
    library: "services",
    intent: (a) =>
      `Services menu for a ${a.trade} in ${a.city ?? "the UK"}. ${a.description ?? ""}`.slice(0, 300)
  },
  {
    id: "products",
    library: "product_grid",
    intent: (a) =>
      `Product grid for a ${a.trade} supplier${a.deliversNational ? " that delivers nationally" : ""}.`.slice(0, 200)
  },
  {
    id: "gallery",
    library: "gallery",
    intent: (a) =>
      `Photo gallery of recent work for a ${a.trade} in ${a.city ?? "the UK"}.`.slice(0, 200)
  },
  {
    id: "reviews",
    library: "testimonials",
    intent: (a) =>
      `Customer testimonials for a ${a.trade} in ${a.city ?? "the UK"} — real UK trades voice, first-name attribution.`.slice(0, 200)
  },
  {
    id: "faq",
    library: "faq",
    intent: (a) =>
      `Frequently asked questions for a ${a.trade} in ${a.city ?? "the UK"} — cover pricing, callouts, guarantees.`.slice(0, 200)
  },
  {
    id: "quote",
    library: "cta",
    intent: (a) =>
      `Call-to-action section for a ${a.trade} — nudge visitors to request a quote.`.slice(0, 200)
  },
  {
    id: "pricing",
    library: "pricing",
    intent: (a) =>
      `Pricing / tier section for a ${a.trade} — three tiers (starter / standard / premium) as a service menu.`.slice(0, 200)
  },
  {
    id: "contact",
    library: "contact",
    intent: (a) => {
      const methods = (a.contactMethods ?? []).join(", ");
      return `Contact section for a ${a.trade} in ${a.city ?? "the UK"} — surface these methods: ${methods}.`.slice(0, 300);
    }
  },
  {
    id: "map",
    library: "map",
    intent: (a) =>
      `Map embed for a ${a.trade} in ${a.city ?? "the UK"} showing service area.`.slice(0, 200)
  },
  {
    id: "booking",
    library: "newsletter",
    intent: (a) =>
      `Booking / newsletter section for a ${a.trade} — capture emails for quotes and updates.`.slice(0, 200)
  },
  {
    id: "videos",
    library: "video",
    intent: (a) =>
      `Video section for a ${a.trade} showing recent work / testimonials.`.slice(0, 200)
  }
];

const CACHED_SYSTEM_RUBRIC = `You are the Studio composer for The Network — a UK-trades platform where merchants pay £14.99/month for a polished custom profile.

Your job: given a merchant's intent + business context, pick the single best-fit section from the catalog and fill its editable fields with content specific to that merchant.

Rules that are NON-NEGOTIABLE:
1. Return ONLY the section id from the provided catalog. Never invent an id.
2. Fill every field flagged aiPromptable with content specific to this merchant. Non-aiPromptable fields keep their catalog defaults.
3. Voice: UK trades-native. Short sentences. Direct. No "premium", "curated", "boutique", "elevated", "solutions", "empowering". Yes to "mate", "trades", "sparks", "smashed it", "on the tools".
4. Copy is real, not stock. Use the merchant's actual services, city, review count, years in business.
5. When the intent is ambiguous, prefer sections marked bestForVerticals matching the merchant's trade.
6. Respect maxLength on every text field. Truncate cleanly, never mid-word.

Output format: JSON object with { sectionId: string, reasoning: string, params: Record<string, unknown> }. The reasoning is 1 sentence for the merchant-facing "why we picked this" tooltip.`;

type ComposeOne = {
  slot: string;
  library: string;
  proposal: {
    sectionId: string;
    reasoning: string;
    params: Record<string, unknown>;
  } | null;
  catalogEntry: CatalogEntry | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
};

function fallbackParamsFor(entry: CatalogEntry): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const f of entry.fields) {
    params[f.key] = f.default;
  }
  return params;
}

function validateProposal(
  raw: unknown,
  catalog: CatalogEntry[]
): { sectionId: string; reasoning: string; params: Record<string, unknown> } | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as {
    sectionId?: unknown;
    reasoning?: unknown;
    params?: unknown;
  };
  const sectionId = typeof p.sectionId === "string" ? p.sectionId : "";
  if (!sectionId) return null;
  const entry = catalog.find((c) => c.id === sectionId);
  if (!entry) return null;
  const reasoning = typeof p.reasoning === "string" ? p.reasoning.slice(0, 240) : "";
  const rawParams =
    p.params && typeof p.params === "object"
      ? (p.params as Record<string, unknown>)
      : {};
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

async function composeOne(
  library: string,
  intent: string,
  merchantContext: string,
  merchantTrade: string,
  cachedSystem: string
): Promise<ComposeOne> {
  const catalog = getSectionCatalog();
  const candidates = catalog
    .filter((c) => c.library === library)
    .sort((a, b) => {
      const aMatch = a.bestForVerticals?.includes(merchantTrade) ? 0 : 1;
      const bMatch = b.bestForVerticals?.includes(merchantTrade) ? 0 : 1;
      return aMatch - bMatch;
    });

  if (candidates.length === 0) {
    return {
      slot: "",
      library,
      proposal: null,
      catalogEntry: null,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0
      }
    };
  }

  const userMessage = `MERCHANT CONTEXT:\n${merchantContext}\n\nINTENT:\n"${intent}"\n\nReturn JSON matching { sectionId, reasoning, params }. sectionId MUST be one of the catalog ids above.`;

  const result = await completeWithUsage({
    system: "Return ONLY valid JSON. No markdown fences. No prose before or after.",
    cachedSystem,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1200,
    temperature: 0.3
  });

  let proposal: {
    sectionId: string;
    reasoning: string;
    params: Record<string, unknown>;
  } | null = null;

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

  if (!proposal) {
    // Deterministic fallback — pick top candidate, fill defaults.
    const pick = candidates[0];
    if (pick) {
      proposal = {
        sectionId: pick.id,
        reasoning: `Fallback pick — ${pick.name} matches the ${library} library.`,
        params: fallbackParamsFor(pick)
      };
    }
  }

  return {
    slot: "",
    library,
    proposal,
    catalogEntry: proposal ? getCatalogEntry(proposal.sectionId) : null,
    usage: result?.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0
    }
  };
}

async function loadMerchantContext(
  listingId: string,
  answers: Answers
): Promise<{ context: string; trade: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "display_name, trading_name, city, primary_trade, bio, services_offered, qualifications, is_insured, rating_count, joined_at"
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
  const context = [
    `Business name: ${name}`,
    `Business type: ${answers.businessType ?? "tradesperson"}`,
    `Trade: ${answers.trade ?? data.primary_trade}`,
    `Offering: ${answers.offering ?? "services"}`,
    answers.description ? `Description: ${answers.description}` : "",
    answers.city ? `Town/City: ${answers.city}` : (data.city ? `City: ${data.city}` : ""),
    answers.travelDistance ? `Travel radius: ${answers.travelDistance}` : "",
    answers.deliversNational ? "Delivers products nationally: yes" : "",
    (answers.contactMethods ?? []).length > 0
      ? `Contact methods: ${(answers.contactMethods ?? []).join(", ")}`
      : "",
    services ? `Services: ${services}` : "",
    quals ? `Qualifications: ${quals}` : "",
    data.is_insured ? "Insured: yes" : "",
    data.bio ? `Bio one-liner: ${data.bio.slice(0, 200)}` : "",
    (data.rating_count ?? 0) > 0
      ? `Reviews: ${data.rating_count} on record`
      : ""
  ]
    .filter(Boolean)
    .join("\n");
  return { context, trade: answers.trade ?? data.primary_trade };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: OrchestrateBody;
  try {
    body = (await req.json()) as OrchestrateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const answers = body.answers ?? {};

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
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

  if (!(await checkRateAndLog(listing.id, "orchestrate", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  const ctx = await loadMerchantContext(listing.id, answers);
  if (!ctx) {
    await logUsage({
      listingId: listing.id,
      endpoint: "orchestrate",
      status: "error",
      errorCode: "merchant_context_missing"
    });
    return NextResponse.json(
      { ok: false, error: "merchant_context_missing" },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  // Persist the answers on the listing so re-runs / edits reuse them.
  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      updated_at: new Date().toISOString()
    })
    .eq("id", listing.id);

  // Which slots to compose? Q7 pages + always-on slots (hero + cta).
  const requestedPages = new Set(answers.pages ?? []);
  const alwaysOn = new Set(["profile"]);
  const slots = PAGE_TO_LIBRARY.filter(
    (p) => alwaysOn.has(p.id) || requestedPages.has(p.id)
  );

  // Cached prefix: the section catalog scoped to just the libraries
  // we'll compose. Same across all N calls in this request → 90% off
  // input tokens after the first one within 5 minutes.
  const libraries = Array.from(new Set(slots.map((s) => s.library)));
  const catalog = getSectionCatalog().filter((c) => libraries.includes(c.library));
  const catalogJson = JSON.stringify(
    catalog.map((c) => ({
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
  const cachedSystem = `${CACHED_SYSTEM_RUBRIC}\n\n---\n${designConstitutionFor("customer-facing")}\n\n---\nCATALOG (${catalog.length} sections available):\n${catalogJson}`;

  // Fire all compose calls in parallel — the catalog is cached so
  // subsequent hits pay 10% on the ~10-15K prefix.
  //
  // Drop any slot where the compose came back without a valid
  // proposal + catalogEntry (e.g. library has no registered sections,
  // or LLM returned malformed output that didn't validate). This
  // stops "Unknown" placeholders leaking into the merchant's review.
  const composedRaw = await Promise.all(
    slots.map(async (slot) => {
      const one = await composeOne(
        slot.library,
        slot.intent(answers),
        ctx.context,
        ctx.trade,
        cachedSystem
      );
      return { ...one, slot: slot.id };
    })
  );
  const composed = composedRaw.filter(
    (c) =>
      c.proposal &&
      c.proposal.sectionId &&
      c.catalogEntry &&
      c.catalogEntry.name
  );

  const totalUsage = composed.reduce(
    (acc, c) => ({
      inputTokens: acc.inputTokens + c.usage.inputTokens,
      outputTokens: acc.outputTokens + c.usage.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + c.usage.cacheReadTokens,
      cacheCreationTokens:
        acc.cacheCreationTokens + c.usage.cacheCreationTokens
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0
    }
  );

  await logUsage({
    listingId: listing.id,
    endpoint: "orchestrate",
    status: composed.length > 0 ? "ok" : "ai_unavailable",
    inputTokens: totalUsage.inputTokens,
    outputTokens: totalUsage.outputTokens,
    cacheReadTokens: totalUsage.cacheReadTokens,
    cacheCreationTokens: totalUsage.cacheCreationTokens,
    latencyMs: Date.now() - startedAt
  });

  return NextResponse.json({
    ok: true,
    results: composed,
    totalUsage
  });
}
