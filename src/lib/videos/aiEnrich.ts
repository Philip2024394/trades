// Networkers TV Phase 2 AI enrichment pipeline.
//
// v1 pipeline (REAL video reading):
//   1. Download video → Groq Whisper large-v3 → real transcript
//      of what the trade actually said
//   2. Real transcript + title/category context → Claude Sonnet 4.6
//      for structured enrichment (FAQs, tools, materials grounded
//      in what was actually spoken)
//   3. Store transcript + enrichment on hammerex_videos
//   4. Ask AI queries then use the real transcript as context —
//      answers grounded in actual video content, not fabrication
//
// What v1 still does NOT do (Phase 3):
//   • Vision frame sampling for visual product/tool detection
//     (Bosch vs Makita drill — can't tell from audio alone)
// This lands as a follow-on with Anthropic Vision + ffmpeg frame
// extraction.

import { completeJson } from "@/lib/llm/anthropic";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { transcribeVideoUrl } from "@/lib/videos/whisperTranscribe";

export type EnrichmentResult = {
  description_expanded: string;
  keywords:             string[];
  hashtags:             string[];
  chapters:             Array<{ start_s: number; title: string }>;
  faqs:                 Array<{ q: string; a: string }>;
  tools_detected:       Array<{ name: string; brand?: string }>;
  materials_detected:   Array<{ name: string; brand?: string }>;
  products_detected:    Array<{ name: string; brand?: string; sku?: string }>;
  regulations_cited:    string[];
  safety_notices:       string[];
  estimated_time_hours: number | null;
  estimated_cost_gbp:   number | null;
  difficulty:           "beginner" | "intermediate" | "advanced" | "specialist" | null;
  suggested_questions:  string[];  // 3-5 pre-computed prompts for the Ask-AI UI
};

const SYSTEM = `You are a UK construction + trades knowledge specialist enriching videos for Networkers TV — a UK-specific trade video platform for professional trades + homeowners. You produce ONLY structured JSON — no prose, no markdown fences.

Enrichment rules:
- All prices in GBP (£). All durations in UK working hours.
- Regulations must cite UK-specific standards (Building Regs, BS 7671, Part L/P, HSE, CDM 2015, IET 18th Edition, Gas Safe, etc.)
- Products/brands must be UK-market (British Gypsum, Knauf, Marley, Wickes, Screwfix stock, etc.)
- Suggested questions must be genuinely useful — one homeowner cost/scope question, one trade technical question, one apprentice learning question, one safety/reg question.
- Evidence-first: if you can't confidently infer a field from the input, use null or empty array — never fabricate.

Return exactly this JSON shape:
{
  "description_expanded": "string — 2-3 sentence factual overview",
  "keywords": ["array of 8-15 UK-trade keywords"],
  "hashtags": ["array of 5-8 hashtags without # prefix"],
  "chapters": [{"start_s": 0, "title": "Intro"}, {"start_s": 15, "title": "..."}],
  "faqs": [{"q": "question", "a": "concise answer"}],
  "tools_detected": [{"name": "tool", "brand": "optional brand"}],
  "materials_detected": [{"name": "material", "brand": "optional brand"}],
  "products_detected": [{"name": "product", "brand": "optional", "sku": "optional"}],
  "regulations_cited": ["UK standard references"],
  "safety_notices": ["short bulletpoints"],
  "estimated_time_hours": 0.5 | null,
  "estimated_cost_gbp": 100 | null,
  "difficulty": "beginner" | "intermediate" | "advanced" | "specialist" | null,
  "suggested_questions": ["4-5 pre-computed prompts"]
}`;

export async function enrichVideoMetadata(input: {
  title:        string;
  description?: string | null;
  category?:    string | null;
  tradeSlug?:   string | null;
  city?:        string | null;
  durationSeconds?: number | null;
  /** REAL transcript from Whisper — the actual content that was
   *  spoken in the video. When provided, all enrichment is grounded
   *  in what was said, not fabricated from the title. */
  transcript?:  string | null;
}): Promise<EnrichmentResult | null> {
  const context = [
    `Video title: ${input.title}`,
    input.description   ? `Description: ${input.description}` : "",
    input.category      ? `Category: ${input.category}` : "",
    input.tradeSlug     ? `Trade: ${input.tradeSlug}` : "",
    input.city          ? `City: ${input.city}` : "",
    input.durationSeconds ? `Duration: ${input.durationSeconds} seconds` : "",
    input.transcript ? `\nFULL TRANSCRIPT (what was actually spoken in the video — enrich strictly from this, not from the title alone):\n${input.transcript}` : ""
  ].filter(Boolean).join("\n");

  // Direct fetch — bypasses the shared wrapper because the wrapper
  // defaults to claude-opus-4-7 (which rejects the temperature
  // parameter). Sonnet 4.6 supports temperature + is faster + cheaper
  // for structured enrichment.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  let enrichment: EnrichmentResult | null = null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":       "application/json",
        "x-api-key":          key,
        "anthropic-version":  "2023-06-01"
      },
      body: JSON.stringify({
        model:       "claude-sonnet-4-6",
        max_tokens:  4000,
        temperature: 0.3,
        system:      SYSTEM,
        messages:    [{ role: "user", content: `Enrich this UK trade video:\n\n${context}\n\nReturn the JSON.` }]
      })
    });
    if (!res.ok) {
      console.error("[aiEnrich] anthropic non-OK:", res.status);
      return null;
    }
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const raw  = (data.content ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    enrichment = JSON.parse(cleaned) as EnrichmentResult;
  } catch (e) {
    console.error("[aiEnrich] error:", e instanceof Error ? e.message : String(e));
    return null;
  }

  return enrichment;
}

/** Detect which Knowledge Engine trade pack + activity tags apply
 *  to a video, based on its title/transcript/existing enrichment.
 *  Uses a lightweight Claude call to map free-text into the
 *  canonical trade + tag ontology. */
async function detectKnowledgeContext(input: {
  title:       string;
  transcript?: string | null;
  category?:   string | null;
  toolsDetected?: Array<{ name: string; brand?: string }>;
  materialsDetected?: Array<{ name: string; brand?: string }>;
}): Promise<{
  tradeSlug:            string | null;
  activityTags:         string[];
  installationStage:    string | null;
  commonMistakes:       string[];
}> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { tradeSlug: null, activityTags: [], installationStage: null, commonMistakes: [] };
  }

  // Load available trades + tags from the KB so we route only to
  // packs that actually exist (no fabrication).
  const { data: tradesRows } = await supabaseAdmin
    .from("hammerex_knowledge_trades")
    .select("slug, display_name, description");
  const { data: tagsRows } = await supabaseAdmin
    .from("hammerex_knowledge_video_tags")
    .select("slug, trade_slug, display_name, tag_kind, description");

  const trades = (tradesRows ?? []) as Array<{ slug: string; display_name: string; description: string | null }>;
  const tags   = (tagsRows ?? []) as Array<{ slug: string; trade_slug: string; display_name: string; tag_kind: string; description: string | null }>;

  if (trades.length === 0) {
    return { tradeSlug: null, activityTags: [], installationStage: null, commonMistakes: [] };
  }

  const context = [
    `Title: ${input.title}`,
    input.category ? `Category: ${input.category}` : "",
    input.toolsDetected?.length ? `Detected tools: ${input.toolsDetected.map(t => t.name).join(", ")}` : "",
    input.materialsDetected?.length ? `Detected materials: ${input.materialsDetected.map(m => m.name).join(", ")}` : "",
    input.transcript ? `\nTranscript:\n${input.transcript.slice(0, 2000)}` : ""
  ].filter(Boolean).join("\n");

  const tradeList = trades.map(t => `- ${t.slug}: ${t.display_name}${t.description ? ` — ${t.description}` : ""}`).join("\n");
  const tagList   = tags.map(t => `- ${t.slug} [${t.tag_kind}] (${t.trade_slug}): ${t.display_name}`).join("\n");

  const system = `You classify UK trade videos into the Trade Knowledge Engine ontology. Return ONLY valid JSON. Do not fabricate slugs — use exact matches from the lists provided.`;
  const user = `AVAILABLE TRADES:\n${tradeList}\n\nAVAILABLE VIDEO TAGS:\n${tagList}\n\nVIDEO:\n${context}\n\nReturn JSON in exactly this shape:\n{\n  "trade_slug": "concrete" | ... | null,\n  "activity_tags": ["concrete-mix","slab-domestic"],\n  "installation_stage": "prep" | "pour" | "finish" | "cure" | null,\n  "common_mistakes": ["short list of 0-3 mistakes evident from the transcript"]\n}\n\nOnly use slugs from the lists. If no trade fits, return null for trade_slug.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 500,
        temperature: 0.1,
        system,
        messages: [{ role: "user", content: user }]
      })
    });
    if (!res.ok) return { tradeSlug: null, activityTags: [], installationStage: null, commonMistakes: [] };
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const raw  = (data.content ?? []).filter(p => p.type === "text").map(p => p.text ?? "").join("");
    const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed  = JSON.parse(cleaned) as {
      trade_slug:         string | null;
      activity_tags:      string[];
      installation_stage: string | null;
      common_mistakes:    string[];
    };
    // Validate slugs exist
    const validTradeSlugs = new Set(trades.map(t => t.slug));
    const validTagSlugs   = new Set(tags.map(t => t.slug));
    const cleanTrade  = parsed.trade_slug && validTradeSlugs.has(parsed.trade_slug) ? parsed.trade_slug : null;
    const cleanTags   = (parsed.activity_tags ?? []).filter(t => validTagSlugs.has(t));
    return {
      tradeSlug:         cleanTrade,
      activityTags:      cleanTags,
      installationStage: parsed.installation_stage ?? null,
      commonMistakes:    parsed.common_mistakes ?? []
    };
  } catch (e) {
    console.error("[detectKnowledgeContext] error:", e instanceof Error ? e.message : String(e));
    return { tradeSlug: null, activityTags: [], installationStage: null, commonMistakes: [] };
  }
}

/** Fetch a video row, enrich it via Anthropic, write results back.
 *  Idempotent — safe to re-run on the same video_id (overwrites
 *  the enrichment fields). Returns success + a summary of what was
 *  populated. */
export async function processVideoAI(videoId: string): Promise<{
  ok: boolean;
  populated?: string[];
  error?:     string;
}> {
  const { data: video, error: fetchErr } = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, title, description, video_url, category_slug, trade_slug, city, duration_seconds, transcript")
    .eq("id", videoId)
    .maybeSingle();

  if (fetchErr || !video) {
    return { ok: false, error: "video-not-found" };
  }

  // Step 1 — REAL transcript via Whisper (grounds enrichment in what
  // the trade actually said). Re-transcribes if the existing
  // transcript is missing; skip if already present + non-empty.
  let transcript: string | null = video.transcript ?? null;
  if (!transcript || transcript.trim().length === 0) {
    const trans = await transcribeVideoUrl(video.video_url);
    transcript = trans?.text ?? null;
  }

  // Step 2 — Claude Sonnet enrichment, grounded in real transcript
  const enrichment = await enrichVideoMetadata({
    title:           video.title,
    description:     video.description,
    category:        video.category_slug,
    tradeSlug:       video.trade_slug,
    city:            video.city,
    durationSeconds: video.duration_seconds,
    transcript
  });

  if (!enrichment) {
    return { ok: false, error: "enrichment-failed" };
  }

  // Step 3 — Video Intelligence: detect trade pack + activity tags
  // and link relevant KB entries. Trade-agnostic — the classifier
  // picks from whatever trades + tags exist in the KB.
  const detection = await detectKnowledgeContext({
    title:             video.title,
    transcript,
    category:          video.category_slug,
    toolsDetected:     enrichment.tools_detected,
    materialsDetected: enrichment.materials_detected
  });

  // Step 4 — Persist transcript + enrichment + detection on hammerex_videos.
  const updatePayload: Record<string, unknown> = {
    transcript,
    keywords:                    enrichment.keywords ?? [],
    hashtags:                    enrichment.hashtags ?? [],
    chapters:                    enrichment.chapters ?? [],
    faqs:                        enrichment.faqs ?? [],
    tools_detected:              enrichment.tools_detected ?? [],
    materials_detected:          enrichment.materials_detected ?? [],
    products_detected:           enrichment.products_detected ?? [],
    regulations_cited:           enrichment.regulations_cited ?? [],
    safety_notices:              enrichment.safety_notices ?? [],
    estimated_time_hours:        enrichment.estimated_time_hours,
    estimated_cost_gbp:          enrichment.estimated_cost_gbp,
    difficulty:                  enrichment.difficulty,
    knowledge_pack_trade:        detection.tradeSlug,
    detected_activities:         detection.activityTags,
    detected_installation_stage: detection.installationStage,
    detected_common_mistakes:    detection.commonMistakes,
    last_reviewed_at:            new Date().toISOString()
  };

  // If the user didn't supply a description, use the LLM's expanded one
  if (!video.description && enrichment.description_expanded) {
    updatePayload.description = enrichment.description_expanded;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("hammerex_videos")
    .update(updatePayload)
    .eq("id", videoId);

  if (updateErr) {
    return { ok: false, error: "update-failed: " + updateErr.message };
  }

  // Step 5 — Link the video to relevant KB entries via the pivot
  // table. Uses tag overlap on the detected activity tags.
  if (detection.tradeSlug && detection.activityTags.length > 0) {
    const { data: matchingEntries } = await supabaseAdmin
      .from("hammerex_knowledge_entries")
      .select("id, video_tags")
      .eq("trade_slug", detection.tradeSlug)
      .eq("moderation_status", "approved")
      .overlaps("video_tags", detection.activityTags)
      .limit(20);

    if (matchingEntries && matchingEntries.length > 0) {
      // Clear existing links, insert fresh
      await supabaseAdmin.from("hammerex_video_knowledge_links").delete().eq("video_id", videoId);
      const rows = matchingEntries.map((e: { id: string; video_tags: string[] }) => {
        const overlap = e.video_tags.filter(t => detection.activityTags.includes(t)).length;
        const score   = Math.min(0.5 + (overlap * 0.15), 1.0);
        return { video_id: videoId, entry_id: e.id, match_score: score, match_type: "tag" };
      });
      await supabaseAdmin.from("hammerex_video_knowledge_links").insert(rows);
    }
  }

  const populated = Object.entries(updatePayload)
    .filter(([, v]) => Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined)
    .map(([k]) => k);

  return { ok: true, populated };
}

export type AskVideoSource = {
  title:     string;
  url:       string;
  origin:    "knowledge-base" | "web-search";
  publisher?: string;
};

/** Structured answer sections. `summary` is always present; the
 *  rest are optional so simple questions stay short. */
export type AnswerSections = {
  summary?:            string;
  technical?:          string;
  bestPractice?:       string;
  commonMistakes?:     string;
  safety?:             string;
  materials?:          string;
  tools?:              string;
  proTips?:            string;
  standards?:          string;
  whenYouNeedAPro?:    string;
};

export type AskVideoResult = {
  ok:                 boolean;
  answer?:            string;             // main conversational answer (always present)
  sections?:          AnswerSections;     // structured deep-dive (optional)
  sources?:           AskVideoSource[];
  knowledgeHitCount?: number;             // how many KB entries were used
  needsSpecialist?:   boolean;
  specialistTrade?:   string | null;      // slug for /trades/[trade] link
  merchantCategories?: string[];          // for "Need this done?" recommender
  tradeCategories?:   string[];
  error?:             string;
};

/** Ask AI a question about a specific video. Uses the video's
 *  enriched metadata + live UK web search (gov.uk, HSE, etc)
 *  as context. Returns a short conversational answer, cited
 *  sources, and a specialist-trade hint when the topic would
 *  genuinely benefit from a real trade. */
export async function askVideoAI(videoId: string, question: string): Promise<AskVideoResult> {
  const { data: video } = await supabaseAdmin
    .from("hammerex_videos")
    .select("title, description, category_slug, trade_slug, city, duration_seconds, transcript, chapters, faqs, tools_detected, materials_detected, products_detected, regulations_cited, safety_notices, estimated_time_hours, estimated_cost_gbp, difficulty, detected_activities, knowledge_pack_trade")
    .eq("id", videoId)
    .maybeSingle();

  if (!video) return { ok: false, error: "video-not-found" };

  // ═══ Step 1 — KB retrieval (Trade Knowledge Engine) ═══════════════
  // Filter to the video's knowledge pack + its detected activity
  // tags for a targeted RAG hit. Falls back to full-text if
  // embeddings unavailable.
  const { searchKnowledge, recordCitations, buildKnowledgeContext } =
    await import("@/lib/knowledge/search");

  const kbHits = await searchKnowledge(question, {
    tradeSlugs:    video.knowledge_pack_trade ? [video.knowledge_pack_trade] : undefined,
    videoTags:     video.detected_activities?.length ? video.detected_activities : undefined,
    topK:          5,
    minConfidence: 0.7
  });
  const kbContext = buildKnowledgeContext(kbHits);

  // Aggregate merchant + trade categories from cited KB entries
  // — used by the "Need this done?" recommender in the UI.
  const merchantCatSet = new Set<string>();
  const tradeCatSet    = new Set<string>();
  for (const h of kbHits) {
    for (const c of h.merchant_categories) merchantCatSet.add(c);
    for (const c of h.trade_categories)    tradeCatSet.add(c);
  }

  const context = JSON.stringify({
    title:              video.title,
    description:        video.description,
    category:           video.category_slug,
    trade:              video.trade_slug,
    city:               video.city,
    duration_seconds:   video.duration_seconds,
    transcript_excerpt: (video.transcript ?? "").slice(0, 3000),
    chapters:           video.chapters ?? [],
    faqs:               video.faqs ?? [],
    tools:              video.tools_detected ?? [],
    materials:          video.materials_detected ?? [],
    products:           video.products_detected ?? [],
    regulations:        video.regulations_cited ?? [],
    safety:             video.safety_notices ?? [],
    estimated_time:     video.estimated_time_hours,
    estimated_cost:     video.estimated_cost_gbp,
    difficulty:         video.difficulty
  }, null, 2);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "anthropic-key-missing" };

  // System prompt — SHORT conversational answer FIRST (that's what
  // the user sees), optional structured deep-dive sections SECOND
  // (rendered collapsibly by the UI). KB-first, then web search,
  // then LLM knowledge. Every fact cited.
  const system = `You are the AI on Networkers TV — a UK trade video/knowledge platform. A homeowner or trade is watching this specific video and asked a question.

═══ FACT HIERARCHY (use in this order) ═══
1. KNOWLEDGE BASE ENTRIES (marked [KB-1], [KB-2]... below) — these are verified UK-specific trade knowledge with sources. Prefer them over your general knowledge whenever they cover the question.
2. Video transcript — ground truth for what the trade in the video actually said.
3. Live web search — USE ONLY when neither the KB nor transcript covers the question, especially for current UK regulations, Building Regs values, BS EN spec numbers, HSE guidance, planning-portal requirements. Restricted to trusted UK sources.
4. Your general trade knowledge — last resort, and mark uncertain claims.

═══ NEVER FABRICATE ═══
If you can't find the answer in KB + transcript + web + general knowledge, say so honestly and use the [SPECIALIST:] marker. Do not invent regulation numbers, brand names, product SKUs, or exact prices.

═══ ANSWER FORMAT ═══
Your response must have TWO parts, separated exactly by "\\n\\n=== DETAILS ===\\n\\n":

PART 1 · CONVERSATIONAL ANSWER (always required):
- SHORT. 2-3 sentences for typical questions. 5 max.
- Like texting a mate who does the trade. Not a spec sheet.
- Pick THE most likely scenario, answer THAT one. Never a table of "here are 3 options".
- If missing detail, best-guess + ONE short follow-up at the end.
- No markdown tables. No headers in Part 1. Bullets only for real lists.

PART 2 · STRUCTURED DETAILS (optional — only include sections that add real value):
Use these exact section headers with ### markdown. Skip any that aren't relevant.
### Summary
### Technical
### Best Practice
### Common Mistakes
### Safety
### Materials
### Tools
### Pro Tips
### Standards
### When you need a pro

Each section: 1-3 sentences max. Concise. UK-specific.

═══ SPECIALIST HANDOFF ═══
If the topic is regs-sensitive, needs on-site inspection, or the answer materially depends on project specifics — after Part 2 (or after Part 1 if no Part 2), append on its own final line:
    [SPECIALIST:<trade-slug>]
Slugs: bricklayer, plumber, electrician, roofer, plasterer, carpenter, tiler, building-merchant, structural-engineer, gas-engineer, heating-engineer, groundworker, concrete-contractor, driveway-installer.
Don't add the marker for everyday questions the KB/transcript already answered fully. Don't mention "connect with a specialist" in the answer text — the marker triggers a UI button.

═══ SOURCE CITATIONS ═══
When citing a fact from the KB, mention the publisher inline, e.g. "per the Concrete Centre" or "per gov.uk Approved Doc A". Same for web results.

═══ EXAMPLES OF THE STYLE ═══

Q: "How much concrete for 4m × 4m slab?"
A: "For a standard 100mm patio slab that's 1.6 m³ (~64 × 25kg bags or a small ready-mix load). Per the Concrete Centre. If it's a drive at 150mm you'd need 2.4 m³. What's the use — patio or drive?"
(no Part 2 needed — simple maths, KB covered it)

Q: "Do I need Building Control for a driveway?"
A: "You don't need Building Control for the driveway itself. Planning kicks in if it's over 5 m² of impermeable surface draining to a highway — per planningportal.co.uk. Use permeable paving or a soakaway to stay permitted development.

=== DETAILS ===

### Standards
Town and Country Planning (General Permitted Development) Order 2008 introduced the 5 m² rule after urban flooding concerns.

### When you need a pro
For borderline cases, phone your local authority planning department — the call is free and definitive.

[SPECIALIST:driveway-installer]"`;

  let answerText = "";
  let sources: AskVideoSource[] = [];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":       "application/json",
        "x-api-key":          key,
        "anthropic-version":  "2023-06-01"
      },
      body: JSON.stringify({
        model:       "claude-haiku-4-5-20251001",
        max_tokens:  600,
        temperature: 0.4,
        system,
        tools: [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
          allowed_domains: [
            "gov.uk",
            "hse.gov.uk",
            "planningportal.co.uk",
            "bsigroup.com",
            "trustmark.org.uk",
            "iet.org",
            "gassaferegister.co.uk",
            "niceic.com",
            "nhbc.co.uk",
            "communities.gov.uk"
          ],
          user_location: { type: "approximate", country: "GB" }
        }],
        messages: [
          { role: "user", content: [
              kbContext
                ? `KNOWLEDGE BASE (verified UK trade knowledge — prefer these over general knowledge):\n\n${kbContext}\n\n`
                : "",
              `VIDEO CONTEXT:\n${context}\n\nQUESTION: ${question}`
            ].join("") }
        ]
      })
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[askVideoAI] anthropic non-OK:", res.status, body.slice(0, 300));
      return { ok: false, error: "llm-failed" };
    }

    const data = await res.json() as {
      content?: Array<{
        type: string;
        text?: string;
        // web_search_tool_result blocks contain the search results
        content?: Array<{ type: string; url?: string; title?: string }>;
      }>;
    };

    // Concatenate all text blocks (skipping tool_use / tool_result)
    answerText = (data.content ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    // Harvest sources from web_search_tool_result blocks
    const seen = new Set<string>();
    for (const block of data.content ?? []) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result" && r.url && !seen.has(r.url)) {
            seen.add(r.url);
            sources.push({ title: r.title ?? r.url, url: r.url });
          }
        }
      }
    }
  } catch (e) {
    console.error("[askVideoAI] error:", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "llm-failed" };
  }

  if (!answerText) return { ok: false, error: "empty-answer" };

  // Strip the model's "thinking-aloud" preamble that sometimes leaks
  // through when the web_search tool fires. Examples:
  //   "I need to search for X to give you the right answer."
  //   "Let me look this up on gov.uk..."
  //   "I'll check the current regulations for you."
  answerText = answerText
    .replace(/^\s*(I need to|I'll|I will|Let me|I'm going to|I'd better)[^.]*\.\s*/i, "")
    .replace(/^\s*(Let me search|Let me check|Let me look)[^.]*\.\s*/i, "")
    .trim();

  // Extract [SPECIALIST:<trade-slug>] marker from the end of the
  // answer (model appends it when a real trade would help).
  let needsSpecialist = false;
  let specialistTrade: string | null = null;
  const markerMatch = answerText.match(/\[SPECIALIST:([a-z0-9-]+)\]\s*$/i);
  if (markerMatch) {
    needsSpecialist = true;
    specialistTrade = markerMatch[1].toLowerCase();
    answerText = answerText.slice(0, markerMatch.index).trim();
  }

  // Split into conversational answer (Part 1) + structured sections (Part 2)
  const [convAnswer, detailsBlock] = answerText.split(/\n\n=== DETAILS ===\n\n/);
  const cleanAnswer = (convAnswer ?? answerText).trim();
  const sections    = detailsBlock ? parseSections(detailsBlock) : undefined;

  // Merge KB sources with web-search sources (dedupe by URL)
  const seenUrls = new Set(sources.map(s => s.url));
  const kbSources: AskVideoSource[] = kbHits
    .filter(h => h.source_url && !seenUrls.has(h.source_url))
    .map(h => ({
      title:     h.title + (h.source_publisher ? ` (${h.source_publisher})` : ""),
      url:       h.source_url as string,
      origin:    "knowledge-base",
      publisher: h.source_publisher ?? undefined
    }));
  const webSources: AskVideoSource[] = sources.map(s => ({
    ...s,
    origin: "web-search" as const
  }));
  const mergedSources = [...kbSources, ...webSources].slice(0, 6);

  // Track which entries the AI cited (fire-and-forget analytics)
  if (kbHits.length > 0) {
    recordCitations(kbHits.map(h => h.id)).catch(() => undefined);
  }

  return {
    ok: true,
    answer:             cleanAnswer,
    sections,
    sources:            mergedSources.length > 0 ? mergedSources : undefined,
    knowledgeHitCount:  kbHits.length,
    needsSpecialist,
    specialistTrade,
    merchantCategories: merchantCatSet.size > 0 ? Array.from(merchantCatSet) : undefined,
    tradeCategories:    tradeCatSet.size > 0    ? Array.from(tradeCatSet)    : undefined
  };
}

/** Split "### Section\n...text..." markdown into AnswerSections. */
function parseSections(block: string): AnswerSections {
  const out: AnswerSections = {};
  const chunks = block.split(/^### /m).filter(Boolean);
  const map: Record<string, keyof AnswerSections> = {
    "summary":            "summary",
    "technical":          "technical",
    "best practice":      "bestPractice",
    "common mistakes":    "commonMistakes",
    "safety":             "safety",
    "materials":          "materials",
    "tools":              "tools",
    "pro tips":           "proTips",
    "standards":          "standards",
    "when you need a pro":"whenYouNeedAPro"
  };
  for (const chunk of chunks) {
    const nl    = chunk.indexOf("\n");
    if (nl < 0) continue;
    const label = chunk.slice(0, nl).trim().toLowerCase();
    const body  = chunk.slice(nl + 1).trim();
    const key   = map[label];
    if (key && body) out[key] = body;
  }
  return out;
}
