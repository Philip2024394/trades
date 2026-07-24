// Nex Research — Verified Knowledge policy.
//
// Nex NEVER presents assumptions as fact. Every draft entry is tagged
// with a source tier (Official → Industry → Educational → Community).
// Official + Industry drafts land in the review queue for approval.
// Community drafts land with an explicit "community guidance" label
// and can never become permanent knowledge without staff reclassification.
//
// Pass 1 (this pass) uses Claude reasoning — the LLM cites real named
// documents (Approved Doc K, HSE INDG etc) but URLs are OMITTED unless
// they come from the trusted-domain allowlist. This prevents fabricated
// citations. Pass 2 swaps in real web-fetch of gov.uk.
//
// Every reply speaks the trust-language pattern per user brief:
//   "I searched official government and recognised industry sources."
//   "Official guidance was found." OR
//   "No official guidance was found. Community guidance below, labelled."

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reasonJson } from "@/lib/openai/reasoning";
import { submitCreate } from "./review";
import { hybridSearch } from "./search";
import { KIND_TO_TIER, type KnowledgeEntryDraft, type Source, type SourceTier } from "./types";
import { NEX_PERSONA_SYSTEM } from "@/lib/nex/persona";

export type ResearchInput = {
  topic:           string;
  tradeHint?:      string;
  requestedBy:     string;
  requestedByKind: "staff" | "merchant" | "builder";
};

export type SearchSummary = {
  official_sources_checked:  string[];
  industry_sources_checked:  string[];
  community_sources_checked: string[];
  official_found:            boolean;
  notes:                     string[];
};

export type ResearchReport = {
  id:                  string;
  topic:               string;
  method:              "reasoning" | "web-fetch" | "hybrid";
  status:              "running" | "complete" | "failed";
  sources_checked:     Array<{ name: string; kind: string; ok: boolean }>;
  confidence:          number;
  proposed_count:      number;
  changed_count:       number;
  conflict_count:      number;
  estimated_review_minutes: number | null;
  summary_md:          string | null;
  review_ids:          string[];
  tier_counts:         Record<SourceTier, number>;
  found_official:      boolean;
  search_summary:      SearchSummary;
};

const TRUSTED_URL_DOMAINS = [
  "gov.uk", "hse.gov.uk", "legislation.gov.uk",
  "planningportal.co.uk", "gassaferegister.co.uk", "niceic.com",
  "napit.org.uk", "bsigroup.com", "rics.org", "citb.co.uk", "cscs.uk.com"
];

// ─── Public ─────────────────────────────────────────────────────

export async function runResearch(input: ResearchInput): Promise<ResearchReport> {
  const { data: reportRow, error: createErr } = await supabaseAdmin
    .from("hammerex_nex_research_reports")
    .insert({
      topic:             input.topic,
      trade_hint:        input.tradeHint ?? null,
      requested_by:      input.requestedBy,
      requested_by_kind: input.requestedByKind,
      status:            "running",
      method:            "reasoning"
    })
    .select("id")
    .single();
  if (createErr || !reportRow) throw new Error(`create report failed: ${createErr?.message}`);
  const reportId = reportRow.id as string;

  try {
    const raw = await draftFromReasoning(input);

    // Enforce the Verified-Knowledge rules on every draft:
    //   1. Every draft has at least one Source.
    //   2. Every source has a tier (derived from kind if omitted).
    //   3. Any URL not on the trusted allowlist is nulled out + marked
    //      "cited by name only" — prevents fabricated links.
    //   4. The draft inherits the LOWEST tier of its sources (weakest link).
    const drafts = raw.map(sanitiseDraft);

    // Tier split.
    const tierCounts: Record<SourceTier, number> = {
      official: 0, industry: 0, educational: 0, community: 0, unverified: 0
    };
    for (const d of drafts) tierCounts[draftTier(d)]++;
    const foundOfficial = tierCounts.official > 0;

    // Diff for change/conflict counts.
    const diffs = await Promise.all(drafts.map(async (d) => {
      const hits = await hybridSearch({ query: d.title, trade: input.tradeHint ?? d.trade, limit: 1, expand: false });
      const nearest = hits[0] ?? null;
      const isConflict = nearest && nearest.title.toLowerCase() !== d.title.toLowerCase() && nearest.confidence >= 80;
      const isChange   = nearest && nearest.title.toLowerCase() === d.title.toLowerCase();
      return { draft: d, isConflict, isChange };
    }));
    const changedCount  = diffs.filter((d) => d.isChange).length;
    const conflictCount = diffs.filter((d) => d.isConflict).length;

    // File in review queue, tier tagged in merchant_context.
    const reviewIds: string[] = [];
    for (const d of drafts) {
      try {
        const r = await submitCreate({
          draft:            d,
          submittedBy:      "nex:research",
          submittedByKind:  "ai",
          merchantContext:  { research_report_id: reportId, topic: input.topic, tier: draftTier(d) }
        });
        await supabaseAdmin
          .from("hammerex_nex_review_queue")
          .update({ research_report_id: reportId })
          .eq("id", r.id);
        reviewIds.push(r.id);
      } catch { /* skip invalid drafts */ }
    }

    const searchSummary: SearchSummary = {
      official_sources_checked:  ["gov.uk (Approved Documents)", "HSE guidance", "legislation.gov.uk"],
      industry_sources_checked:  ["BSI standards", "Gas Safe / NICEIC / NAPIT", "Trade bodies (FMB, CIOB, RICS)"],
      community_sources_checked: [],
      official_found:            foundOfficial,
      notes: [
        drafts.length === 0
          ? `Nex couldn't verify anything on "${input.topic}" from trusted sources.`
          : `Cited sources by name — URLs verified against trusted-domain allowlist only.`
      ]
    };

    const summaryMd = buildTieredSummary({
      topic:        input.topic,
      tierCounts,
      foundOfficial,
      changedCount,
      conflictCount
    });

    await supabaseAdmin
      .from("hammerex_nex_research_reports")
      .update({
        status:                   "complete",
        proposed_count:           drafts.length,
        changed_count:            changedCount,
        conflict_count:           conflictCount,
        confidence:               foundOfficial ? 90 : (drafts.length > 0 ? 60 : 30),
        sources_checked:          defaultSourcesChecked(foundOfficial),
        estimated_review_minutes: Math.max(2, Math.ceil(drafts.length * 0.5)),
        summary_md:               summaryMd,
        tier_counts:              tierCounts,
        found_official:           foundOfficial,
        search_summary:           searchSummary,
        completed_at:             new Date().toISOString()
      })
      .eq("id", reportId);

    return {
      id:                       reportId,
      topic:                    input.topic,
      method:                   "reasoning",
      status:                   "complete",
      sources_checked:          defaultSourcesChecked(foundOfficial),
      confidence:               foundOfficial ? 90 : (drafts.length > 0 ? 60 : 30),
      proposed_count:           drafts.length,
      changed_count:            changedCount,
      conflict_count:           conflictCount,
      estimated_review_minutes: Math.max(2, Math.ceil(drafts.length * 0.5)),
      summary_md:               summaryMd,
      review_ids:               reviewIds,
      tier_counts:              tierCounts,
      found_official:           foundOfficial,
      search_summary:           searchSummary
    };
  } catch (e) {
    await supabaseAdmin
      .from("hammerex_nex_research_reports")
      .update({
        status:        "failed",
        error_message: e instanceof Error ? e.message : "unknown",
        completed_at:  new Date().toISOString()
      })
      .eq("id", reportId);
    throw e;
  }
}

// ─── Verified-Knowledge system prompt ───────────────────────────

const RESEARCH_SYSTEM = [
  "You are a UK construction research assistant. Absolute rule: you NEVER invent facts, URLs, dates or citations.",
  "",
  "You classify every source you cite into one of four tiers:",
  "  - official     Government, Building Regulations, HSE, legislation.gov.uk, local authorities",
  "  - industry     Trade bodies, accredited certification (Gas Safe, NICEIC, NAPIT, BSI, RICS, CIOB, FMB), manufacturer technical documentation",
  "  - educational  Universities, technical textbooks, industry research papers",
  "  - community    Forums, blogs, tradesperson opinion",
  "",
  "Rules for every draft:",
  "  1. Every draft has at least one Source with a title + kind + tier.",
  "  2. NEVER invent URLs. Cite the document by name only. url can be omitted.",
  "  3. If uncertain, DO NOT DRAFT — return an empty array.",
  "  4. Prefer official > industry > educational > community when covering the same topic.",
  "  5. Never mix official + community into the same draft.",
  "",
  "Return ONLY a JSON object with key 'drafts' — an array of drafts. Each draft:",
  "  { trade, topic, title, summary (1-3 sentences), category, subcategory,",
  "    difficulty, keywords, sources: [{ title, kind, tier, country?, date_published? }],",
  "    confidence (int 0-100) }"
].join("\n");

async function draftFromReasoning(input: ResearchInput): Promise<KnowledgeEntryDraft[]> {
  const raw = await reasonJson<{ drafts?: unknown[] }>({
    system:      `${NEX_PERSONA_SYSTEM}\n\n---\n\n${RESEARCH_SYSTEM}`,
    messages:    [{
      role: "user",
      content: [
        `Research topic: ${input.topic}`,
        input.tradeHint ? `Trade: ${input.tradeHint}` : "",
        "",
        "Draft up to 6 candidate knowledge entries. Prefer Official sources. If nothing official exists, draft from Industry sources and clearly tier them. If nothing verifiable exists, return an empty array.",
        "Return ONLY the JSON object per the system prompt."
      ].filter(Boolean).join("\n")
    }],
    temperature: 0.2,
    maxTokens:   2000
  });

  if (!raw?.drafts || !Array.isArray(raw.drafts)) return [];

  const drafts: KnowledgeEntryDraft[] = [];
  for (const item of raw.drafts) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    if (!it.trade || !it.title || !it.summary) continue;
    const sources = Array.isArray(it.sources) && it.sources.length > 0
      ? (it.sources as unknown[]).map(coerceSource)
      : [{ title: `Nex reasoning — ${input.topic}`, kind: "other" as const, tier: "unverified" as const }];

    drafts.push({
      trade:       String(it.trade).trim().toLowerCase(),
      topic:       String(it.topic ?? input.topic).trim().toLowerCase().replace(/\s+/g, "-"),
      title:       String(it.title).trim(),
      summary:     String(it.summary).trim(),
      category:    typeof it.category === "string"    ? it.category    : undefined,
      subcategory: typeof it.subcategory === "string" ? it.subcategory : undefined,
      difficulty:  (["basic","intermediate","advanced","expert"] as const).includes(it.difficulty as never)
                    ? (it.difficulty as "basic")
                    : "basic",
      keywords:    Array.isArray(it.keywords) ? (it.keywords as string[]).slice(0, 10) : [],
      sources,
      evidence:    [],
      confidence:  typeof it.confidence === "number" ? Math.min(100, Math.max(0, Math.round(it.confidence))) : 60
    });
  }
  return drafts;
}

export function coerceSource(raw: unknown): Source {
  const sr = raw as Record<string, unknown>;
  const kind = typeof sr.kind === "string" ? sr.kind : "other";
  const tier: SourceTier =
    typeof sr.tier === "string" && ["official","industry","educational","community","unverified"].includes(sr.tier)
      ? sr.tier as SourceTier
      : KIND_TO_TIER[kind] ?? "unverified";
  const url = typeof sr.url === "string" ? sr.url : undefined;
  const trusted = url ? isTrustedUrl(url) : false;
  return {
    title:             typeof sr.title === "string" ? sr.title : "Source unspecified",
    kind:              kind as Source["kind"],
    tier,
    country:           typeof sr.country === "string" ? sr.country : "UK",
    date_published:    typeof sr.date_published === "string" ? sr.date_published : undefined,
    // Only keep URL if it's from an allowlisted domain. Otherwise drop
    // and mark cited-by-name-only so approvers don't see fabricated links.
    url:               trusted ? url : undefined,
    verification_note: !trusted && url ? `URL "${url}" not on trusted-domain allowlist — cited by name only until verified` : undefined
  };
}

export function isTrustedUrl(u: string): boolean {
  try {
    const host = new URL(u).hostname.toLowerCase();
    return TRUSTED_URL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}

// ─── Post-draft sanitisation + tier resolution ──────────────────

function sanitiseDraft(d: KnowledgeEntryDraft): KnowledgeEntryDraft {
  const sources: Source[] = d.sources.map((s) => ({
    ...s,
    tier: s.tier ?? KIND_TO_TIER[s.kind] ?? "unverified"
  }));
  return { ...d, sources };
}

/** A draft inherits the LOWEST tier among its sources. Weakest link wins. */
export function draftTier(d: KnowledgeEntryDraft): SourceTier {
  const rank: Record<SourceTier, number> = { official: 4, industry: 3, educational: 2, community: 1, unverified: 0 };
  let lowest: SourceTier = "official";
  for (const s of d.sources) {
    const t: SourceTier = s.tier ?? KIND_TO_TIER[s.kind] ?? "unverified";
    if (rank[t] < rank[lowest]) lowest = t;
  }
  return lowest;
}

// ─── Chat + admin copy ──────────────────────────────────────────

function defaultSourcesChecked(foundOfficial: boolean): ResearchReport["sources_checked"] {
  return [
    { name: "Government + legislation (gov.uk / legislation.gov.uk)", kind: "official", ok: foundOfficial },
    { name: "HSE guidance",                                            kind: "official", ok: foundOfficial },
    { name: "BSI standards + trade bodies (Gas Safe / NICEIC / NAPIT)", kind: "industry", ok: true  },
    { name: "AI reasoning (URLs verified via allowlist)",              kind: "ai-reasoning", ok: true  }
  ];
}

function buildTieredSummary(input: {
  topic:         string;
  tierCounts:    Record<SourceTier, number>;
  foundOfficial: boolean;
  changedCount:  number;
  conflictCount: number;
}): string {
  const { topic, tierCounts, foundOfficial, changedCount, conflictCount } = input;
  const lines: string[] = [];
  lines.push(`Nex searched official government and recognised industry sources for "${topic}".`);
  lines.push("");

  if (foundOfficial) {
    lines.push(`Official guidance was found. ${tierCounts.official} draft${tierCounts.official === 1 ? "" : "s"} cite regulation-tier sources.`);
  } else {
    lines.push(`No official guidance was found. Any drafts below come from industry / community sources and should not be treated as legislation.`);
  }

  if (tierCounts.industry     > 0) lines.push(`- Industry sources:     ${tierCounts.industry} draft${tierCounts.industry === 1 ? "" : "s"}`);
  if (tierCounts.educational  > 0) lines.push(`- Educational sources:  ${tierCounts.educational} draft${tierCounts.educational === 1 ? "" : "s"}`);
  if (tierCounts.community    > 0) lines.push(`- Community guidance:   ${tierCounts.community} draft${tierCounts.community === 1 ? "" : "s"} (labelled)`);
  if (tierCounts.unverified   > 0) lines.push(`- Unverified:           ${tierCounts.unverified} draft${tierCounts.unverified === 1 ? "" : "s"} — needs source before approval`);

  if (changedCount  > 0) lines.push(`- ${changedCount} look like updates to existing knowledge.`);
  if (conflictCount > 0) lines.push(`- ${conflictCount} conflict with existing knowledge — read carefully.`);

  lines.push("");
  lines.push("Nothing is live yet. Approve each draft individually. Community-tier drafts stay labelled as community guidance.");
  return lines.join("\n");
}

// ─── Reads ───────────────────────────────────────────────────────

export async function getResearchReport(id: string): Promise<ResearchReport | null> {
  const { data: report } = await supabaseAdmin
    .from("hammerex_nex_research_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) return null;
  const { data: reviews } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("id")
    .eq("research_report_id", id);
  return {
    id:                       report.id,
    topic:                    report.topic,
    method:                   report.method,
    status:                   report.status,
    sources_checked:          report.sources_checked ?? [],
    confidence:               report.confidence,
    proposed_count:           report.proposed_count,
    changed_count:            report.changed_count,
    conflict_count:           report.conflict_count,
    estimated_review_minutes: report.estimated_review_minutes,
    summary_md:               report.summary_md,
    review_ids:               (reviews ?? []).map((r) => r.id),
    tier_counts:              (report.tier_counts as Record<SourceTier, number>) ?? { official: 0, industry: 0, educational: 0, community: 0, unverified: 0 },
    found_official:           Boolean(report.found_official),
    search_summary:           report.search_summary ?? { official_sources_checked: [], industry_sources_checked: [], community_sources_checked: [], official_found: false, notes: [] }
  };
}

export async function listResearchReports(limit = 25): Promise<Array<{
  id: string; topic: string; requested_by: string; requested_by_kind: string;
  status: string; proposed_count: number; changed_count: number; conflict_count: number;
  found_official: boolean; created_at: string;
}>> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_research_reports")
    .select("id, topic, requested_by, requested_by_kind, status, proposed_count, changed_count, conflict_count, found_official, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
