"use client";

// Client-side tagger UI for /admin/image-tagger.
//
// Renders each pre-manifest image at ~360px wide with:
//   - Tags input (comma-separated, per ADR-0024 controlled vocab)
//   - Description textarea (multi-line, for semantic search matching
//     when NEX picks an image for a user's question)
//   - A+ hero-eligible toggle
//   - Optional notes field
//   - Original prompt field (fill retroactively if you remember)
//
// Draft state auto-saves to localStorage on every change so you can
// close the tab and come back. "Save all to server" writes the full
// manifest to data/nex-image-manifest.json via POST.

import { useCallback, useEffect, useMemo, useState } from "react";

type Candidate = {
  url: string;
  contexts: Array<{
    source?: string | null;
    category?: string | null;
    question?: string | null;
    caption?: string | null;
    material?: string | null;
    wood?: string | null;
    notes?: string | null;
    role?: string | null;
  }>;
};

type ManifestRow = {
  source?: string;
  original_prompt?: string | null;
  description?: string;
  tags?: string[];
  a_plus?: boolean;
  subject_domain?: string;
  created_at?: string;
  created_by?: string;
  notes?: string;
};

type DraftRow = {
  tagsInput: string;
  description: string;
  aPlus: boolean;
  notes: string;
  originalPrompt: string;
  subjectDomain: string;
  excluded: boolean; // "not in the brain" — hides from matcher
  // Enrichment fields — each lifts NEX's semantic-match quality when
  // scoring a user's staircase question against this image.
  setting: string;
  mood: string;
  viewType: string;
  colourPalette: string;
};

const LOCAL_KEY = "nex-image-tagger-draft-v1";

const TAG_VOCAB = [
  "oak",
  "walnut",
  "pine",
  "hardwood",
  "glass",
  "steel",
  "concrete",
  "floating",
  "cantilever",
  "curved",
  "helical",
  "spiral",
  "winder",
  "straight",
  "l-shape",
  "u-shape",
  "traditional",
  "modern",
  "contemporary",
  "industrial",
  "luxury",
  "period",
  "renovation",
  "new-build",
  "loft",
  "commercial",
  "residential",
  "balustrade",
  "handrail",
  "newel",
  "spindle",
  "painted",
  "stained",
  "natural",
  "matte",
  "gloss",
  "led-lit",
  "diagram",
  "detail-shot",
];

const DOMAIN_OPTIONS = [
  "staircase",
  "wood-sample",
  "hero-banner",
  "logo",
  "avatar",
  "diagram",
  "other",
];

const SETTING_OPTIONS = [
  "",
  "residential",
  "commercial",
  "showroom",
  "outdoor",
  "studio",
  "period-property",
  "new-build",
];

const MOOD_OPTIONS = [
  "",
  "minimalist",
  "warm",
  "luxurious",
  "industrial",
  "traditional",
  "cosy",
  "grand",
  "clinical",
  "moody",
];

const VIEW_OPTIONS = [
  "",
  "hero-shot",
  "wide",
  "detail",
  "close-up",
  "diagram",
  "top-down",
  "elevation",
];

const PALETTE_OPTIONS = [
  "",
  "warm",
  "cool",
  "neutral",
  "monochrome",
  "high-contrast",
  "mixed",
];

/** Auto-tag vocabulary — used by extractTagsFromDescription() to
 *  pull tags out of a rich MASTER IMAGE DESCRIPTION. Grouped by
 *  domain so we can add to it cleanly as new categories arrive.
 *  Each entry: [canonical_tag, ...aliases_or_variants_to_match]. */
const AUTO_TAG_VOCAB: Array<[string, ...string[]]> = [
  // ── Materials
  ["oak", "oak", "american oak", "white oak", "european oak"],
  ["walnut"],
  ["pine", "pine", "yellow pine", "white deal", "red deal"],
  ["hardwood"],
  ["softwood"],
  ["timber", "timber", "timbered", "wood cladding", "wood plank"],
  ["glass", "glass", "glass pane", "glass balustrade"],
  ["steel", "steel", "stainless steel"],
  ["iron", "iron", "wrought iron"],
  ["stone", "stone", "natural stone", "stone paving"],
  ["gravel"],
  ["brick"],
  ["concrete"],
  ["shingle", "shingle", "shingles"],
  ["felted", "felt roof", "felted", "torch-on felt", "torch on felt"],
  ["slate"],
  ["tile", "roof tile"],
  ["mdf"],
  ["reclaimed"],
  // ── Colours
  ["burgundy", "burgundy", "burgundy red"],
  ["red"],
  ["black", "black", "charcoal", "matte black"],
  ["white"],
  ["grey", "grey", "gray", "light grey", "light gray"],
  ["honey"],
  ["natural-wood", "natural wood", "natural timber", "honey brown"],
  ["painted"],
  ["stained"],
  ["dark"],
  // ── Elements (building / features)
  ["porch"],
  ["door", "door", "front door", "cottage door"],
  ["window", "window", "windows"],
  ["pathway", "pathway", "path"],
  ["staircase", "staircase", "stairs", "stair"],
  ["balustrade"],
  ["handrail"],
  ["newel"],
  ["spindle"],
  ["decking"],
  ["fence", "fence", "fencing"],
  ["roof", "roof", "gable roof", "pitched roof"],
  ["chimney"],
  ["beams", "beams", "exposed beams", "rafter"],
  ["floating", "floating stair", "cantilever"],
  ["curved", "curved", "helical", "spiral"],
  ["winder"],
  ["loft"],
  // ── Landscaping / garden
  ["garden", "garden", "cottage garden"],
  ["flowers", "flower", "flowers", "flowering"],
  ["trees", "tree", "trees", "woodland", "deciduous"],
  ["lawn"],
  ["shrubs", "shrub", "shrubs", "topiary"],
  ["planter", "planter", "flower box", "hanging basket"],
  ["mulch"],
  // ── Styles / mood
  ["rustic"],
  ["cottage"],
  ["farmhouse"],
  ["traditional"],
  ["contemporary", "contemporary", "modern"],
  ["luxury"],
  ["minimalist"],
  ["industrial"],
  ["warm", "warm", "inviting", "cosy"],
  ["premium"],
  ["photorealistic", "photorealistic", "ultra photorealistic", "architectural visualization"],
  ["woodland-cottage", "woodland cottage"],
  // ── Environments
  ["residential"],
  ["commercial"],
  ["outdoor"],
  ["indoor"],
  ["countryside"],
  ["showroom"],
  // ── View / camera
  ["hero-shot", "hero shot"],
  ["three-quarter-view", "three-quarter", "three quarter view", "front-left three-quarter"],
  ["wide-shot", "wide angle", "wide composition"],
  ["close-up", "close-up", "close up", "macro"],
  ["elevation"],
  ["eye-level", "eye level", "eye-level"],
  ["aerial"],
  // ── Lighting
  ["natural-daylight", "natural daylight", "natural light"],
  ["soft-shadows", "soft shadow", "soft shadows"],
  ["overcast"],
  ["led-lit", "led", "led under-tread"],
  ["hdr", "high dynamic range"],
];

/** Extract likely tags from a big description. Matches vocab
 *  entries case-insensitively; returns canonical tags deduped. */
function extractTagsFromDescription(text: string): string[] {
  if (!text) return [];
  const hay = text.toLowerCase();
  const found = new Set<string>();
  for (const [canonical, ...aliases] of AUTO_TAG_VOCAB) {
    const terms = aliases.length > 0 ? aliases : [canonical];
    for (const term of terms) {
      // Word-boundary match for short terms; substring for phrases
      const pattern =
        term.length <= 3
          ? new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i")
          : new RegExp(term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&"), "i");
      if (pattern.test(hay)) {
        found.add(canonical);
        break;
      }
    }
  }
  return [...found];
}

/** Infer subject_domain / setting / mood / view / palette from a
 *  rich description so the enrichment fields also auto-populate.
 *  Only fills in fields that are currently empty — never overwrites. */
function inferStructuredFromDescription(
  text: string,
  current: {
    subjectDomain: string;
    setting: string;
    mood: string;
    viewType: string;
    colourPalette: string;
  }
) {
  const t = text.toLowerCase();
  const patch: Partial<typeof current> = {};

  // subject_domain
  if (!current.subjectDomain || current.subjectDomain === "staircase") {
    if (/\bcabin|shed|garden building|tiny house|log home|garden room\b/.test(t))
      patch.subjectDomain = "hero-banner";
    else if (/staircase|stairs?|balustrade|newel/.test(t))
      patch.subjectDomain = "staircase";
  }
  // setting
  if (!current.setting) {
    if (/showroom/.test(t)) patch.setting = "showroom";
    else if (/commercial|office|hotel|lobby/.test(t)) patch.setting = "commercial";
    else if (/outdoor|garden|woodland|countryside/.test(t)) patch.setting = "outdoor";
    else if (/period|victorian|edwardian|georgian/.test(t)) patch.setting = "period-property";
    else if (/new build|new-build/.test(t)) patch.setting = "new-build";
    else if (/residential|home|cottage/.test(t)) patch.setting = "residential";
  }
  // mood
  if (!current.mood) {
    if (/luxur|premium/.test(t)) patch.mood = "luxurious";
    else if (/rustic|cottage|cosy|cozy|warm and inviting/.test(t)) patch.mood = "cosy";
    else if (/minimalist|clean lines/.test(t)) patch.mood = "minimalist";
    else if (/industrial/.test(t)) patch.mood = "industrial";
    else if (/traditional/.test(t)) patch.mood = "traditional";
    else if (/warm|inviting/.test(t)) patch.mood = "warm";
    else if (/grand/.test(t)) patch.mood = "grand";
  }
  // viewType
  if (!current.viewType) {
    if (/three[- ]quarter|3\/4/.test(t)) patch.viewType = "hero-shot";
    else if (/wide angle|wide composition|wide-angle/.test(t)) patch.viewType = "wide";
    else if (/close[- ]up|close up|macro/.test(t)) patch.viewType = "close-up";
    else if (/detail(ed)? shot|detail of/.test(t)) patch.viewType = "detail";
    else if (/elevation/.test(t)) patch.viewType = "elevation";
    else if (/top[- ]down|aerial|bird.?s eye/.test(t)) patch.viewType = "top-down";
    else if (/diagram|schematic/.test(t)) patch.viewType = "diagram";
  }
  // colourPalette
  if (!current.colourPalette) {
    if (/warm.*(tone|palette)|honey|amber|burgundy/.test(t)) patch.colourPalette = "warm";
    else if (/cool.*(tone|palette)|grey|blue tint/.test(t)) patch.colourPalette = "cool";
    else if (/monochrome|black and white/.test(t)) patch.colourPalette = "monochrome";
    else if (/high[- ]contrast/.test(t)) patch.colourPalette = "high-contrast";
    else if (/neutral/.test(t)) patch.colourPalette = "neutral";
    else if (/colour variations|multiple colour|mixed/.test(t)) patch.colourPalette = "mixed";
  }
  return patch;
}

function firstContext(c: Candidate): string {
  const parts: string[] = [];
  for (const ctx of c.contexts) {
    if (ctx.category) parts.push(`category: ${ctx.category}`);
    if (ctx.question) parts.push(`Q: ${ctx.question.slice(0, 120)}`);
    if (ctx.caption) parts.push(`caption: ${ctx.caption.slice(0, 120)}`);
    if (ctx.material) parts.push(`material: ${ctx.material}`);
    if (ctx.wood) parts.push(`wood: ${ctx.wood}`);
    if (ctx.notes) parts.push(`notes: ${ctx.notes.slice(0, 100)}`);
    if (ctx.role) parts.push(`role: ${ctx.role}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "no known context";
}

function guessDomainFromContexts(c: Candidate): string {
  const text = firstContext(c).toLowerCase();
  if (/wood|timber|oak|pine|walnut|maple|cherry|mahogany/.test(text) && !/staircase|stair/.test(text))
    return "wood-sample";
  if (/hero|background|banner/.test(text)) return "hero-banner";
  if (/logo|brand/.test(text)) return "logo";
  if (/diagram|schematic/.test(text)) return "diagram";
  return "staircase";
}

function emptyDraft(c: Candidate): DraftRow {
  return {
    tagsInput: "",
    description: "",
    aPlus: false,
    notes: "",
    originalPrompt: "",
    subjectDomain: guessDomainFromContexts(c),
    excluded: false,
    setting: "",
    mood: "",
    viewType: "",
    colourPalette: "",
  };
}

function rowToDraft(row: ManifestRow & Record<string, unknown>): DraftRow {
  return {
    tagsInput: (row.tags ?? []).join(", "),
    description: row.description ?? "",
    aPlus: row.a_plus ?? false,
    notes: row.notes ?? "",
    originalPrompt: row.original_prompt ?? "",
    subjectDomain: row.subject_domain ?? "staircase",
    excluded: (row.excluded as boolean) ?? false,
    setting: (row.setting as string) ?? "",
    mood: (row.mood as string) ?? "",
    viewType: (row.view_type as string) ?? "",
    colourPalette: (row.colour_palette as string) ?? "",
  };
}

function draftToRow(draft: DraftRow): ManifestRow & Record<string, unknown> {
  const tags = draft.tagsInput
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  return {
    source: "ai_generated",
    original_prompt: draft.originalPrompt.trim() || null,
    description: draft.description.trim(),
    tags,
    a_plus: draft.aPlus,
    excluded: draft.excluded || undefined,
    subject_domain: draft.subjectDomain,
    setting: draft.setting || undefined,
    mood: draft.mood || undefined,
    view_type: draft.viewType || undefined,
    colour_palette: draft.colourPalette || undefined,
    created_at: new Date().toISOString(),
    created_by: "philip",
    notes: draft.notes.trim(),
  };
}

function isTagged(d: DraftRow): boolean {
  return (
    d.tagsInput.trim().length > 0 || d.description.trim().length > 0
  );
}

export default function ImageTaggerClient({
  candidates: initialCandidates,
  existingRows,
  totalInApp,
  savedCount,
  bannerCount,
}: {
  candidates: Candidate[];
  existingRows: Record<string, ManifestRow>;
  totalInApp: number;
  savedCount: number;
  bannerCount: number;
}) {
  // Candidates is now stateful — Philip can add new URLs (via the
  // "Add image URL" input in the header) and swap an existing URL
  // for a different ImageKit URL via the per-card "Replace URL" tool.
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "untagged" | "tagged" | "flagged" | "a-plus" | "excluded" | "banners"
  >("all");
  const [newUrlInput, setNewUrlInput] = useState("");

  // ADR-0029 telemetry — 8 counters. validationFlags maps URL → server-
  // returned validation_flags[]. sessionCounts tracks what changed this
  // session (Collections Updated · Material Journeys Created · Cover
  // Images Applied · Admin Reviews Required).
  type ServerFlag = {
    code: string;
    severity: "critical" | "warning" | "info";
    rule: string;
    message: string;
  };
  const [validationFlags, setValidationFlags] = useState<
    Record<string, ServerFlag[]>
  >({});
  const [sessionCounts, setSessionCounts] = useState({
    collectionsUpdated: 0,
    materialJourneysCreated: 0,
    coverImagesApplied: 0,
    completedThisSession: 0,
  });
  const [seenCollections, setSeenCollections] = useState<Set<string>>(new Set());
  const [seenJourneys, setSeenJourneys] = useState<Set<string>>(new Set());

  // Initialise: existing manifest > localStorage > empty
  useEffect(() => {
    let localDrafts: Record<string, DraftRow> = {};
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (raw) localDrafts = JSON.parse(raw);
    } catch {
      // ignore
    }
    const init: Record<string, DraftRow> = {};
    for (const c of candidates) {
      // ADR-0033 defensive-merge: ALWAYS spread emptyDraft(c) first so
      // any missing field on an older-format localStorage draft OR
      // manifest row still resolves to a defined string/boolean. Prevents
      // the React "controlled input changing to uncontrolled" warning
      // when new DraftRow fields are added between deploys.
      const base = emptyDraft(c);
      if (existingRows[c.url]) {
        init[c.url] = { ...base, ...rowToDraft(existingRows[c.url]) };
      } else if (localDrafts[c.url]) {
        init[c.url] = { ...base, ...localDrafts[c.url] };
      } else {
        init[c.url] = base;
      }
    }
    setDrafts(init);
  }, [candidates, existingRows]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (Object.keys(drafts).length === 0) return;
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(drafts));
    } catch {
      // ignore quota errors
    }
  }, [drafts]);

  const updateDraft = useCallback(
    (url: string, patch: Partial<DraftRow>) => {
      // Defensive merge — if `d[url]` is undefined (initial render before
      // the init useEffect fires, or a URL added mid-session via addNewImage),
      // spreading undefined produces a partial object with missing string
      // fields, which flips inputs from controlled to uncontrolled. Find
      // the matching candidate so we can seed with a full emptyDraft.
      setDrafts((d) => {
        const existing = d[url];
        if (existing) {
          return { ...d, [url]: { ...existing, ...patch } };
        }
        const candidate = candidates.find((c) => c.url === url);
        const base = candidate
          ? emptyDraft(candidate)
          : {
              tagsInput: "",
              description: "",
              aPlus: false,
              notes: "",
              originalPrompt: "",
              subjectDomain: "staircase",
              excluded: false,
              setting: "",
              mood: "",
              viewType: "",
              colourPalette: "",
            };
        return { ...d, [url]: { ...base, ...patch } };
      });
    },
    [candidates]
  );

  const stats = useMemo(() => {
    const total = candidates.length;
    let tagged = 0;
    let aPlus = 0;
    let excluded = 0;
    // Per-domain outstanding-work counters — helps Philip see how many
    // banners / avatars / staircase shots etc. still need descriptions.
    const byDomain: Record<string, number> = {};
    for (const c of candidates) {
      const d = drafts[c.url];
      if (d && isTagged(d)) tagged++;
      if (d && d.aPlus) aPlus++;
      if (d && d.excluded) excluded++;
      const dom = d?.subjectDomain ?? "unknown";
      byDomain[dom] = (byDomain[dom] ?? 0) + 1;
    }
    return { total, tagged, aPlus, excluded, untagged: total - tagged, byDomain };
  }, [drafts, candidates]);

  const visible = useMemo(() => {
    return candidates.filter((c) => {
      const d = drafts[c.url];
      if (!d) return true;
      if (filter === "untagged") return !isTagged(d) && !d.excluded;
      if (filter === "tagged") return isTagged(d) && !d.excluded;
      if (filter === "flagged") {
        const flags = validationFlags[c.url] ?? [];
        return flags.some(
          (f) => f.severity === "critical" || f.severity === "warning"
        );
      }
      if (filter === "a-plus") return d.aPlus && !d.excluded;
      if (filter === "excluded") return d.excluded;
      if (filter === "banners") {
        const blob = c.contexts
          .map((ctx) => [ctx.source, ctx.role, ctx.notes, ctx.caption].filter(Boolean).join(" "))
          .join(" ")
          .toLowerCase();
        return /hero|banner|cover/.test(blob) || d.subjectDomain === "hero-banner";
      }
      return true; // "all" — includes excluded
    });
  }, [candidates, drafts, filter, validationFlags]);

  // ADR-0029 flagged count (used in header + filter tab)
  const flaggedCount = useMemo(() => {
    let n = 0;
    for (const c of candidates) {
      const flags = validationFlags[c.url] ?? [];
      if (flags.some((f) => f.severity === "critical" || f.severity === "warning")) n++;
    }
    return n;
  }, [candidates, validationFlags]);

  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Only send rows that have at least tags OR description.
      // At save time, back-fill any missing tags from the description
      // AND populate empty structured fields so lazy usage
      // (paste description, hit save) still stores rich metadata.
      const payload: Record<string, ManifestRow> = {};
      const savedUrls: string[] = [];
      for (const [url, draft] of Object.entries(drafts)) {
        if (!isTagged(draft)) continue;
        const currentTags = draft.tagsInput
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        const autoTags = extractTagsFromDescription(draft.description);
        const mergedTags = Array.from(new Set([...currentTags, ...autoTags]));
        const structural = inferStructuredFromDescription(draft.description, {
          subjectDomain: draft.subjectDomain,
          setting: draft.setting,
          mood: draft.mood,
          viewType: draft.viewType,
          colourPalette: draft.colourPalette,
        });
        const enrichedDraft: DraftRow = {
          ...draft,
          tagsInput: mergedTags.join(", "),
          subjectDomain: structural.subjectDomain ?? draft.subjectDomain,
          setting: structural.setting ?? draft.setting,
          mood: structural.mood ?? draft.mood,
          viewType: structural.viewType ?? draft.viewType,
          colourPalette: structural.colourPalette ?? draft.colourPalette,
        };
        payload[url] = draftToRow(enrichedDraft);
        savedUrls.push(url);
      }
      const res = await fetch("/api/admin/image-tagger/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "save_failed");
      }
      setSavedAt(new Date().toLocaleTimeString());

      // ADR-0029 — capture server-returned validation flags per URL.
      // Flagged rows STAY VISIBLE in the tagger; only clean rows disappear.
      const returnedFlags = (data.validation_flags ?? {}) as Record<
        string,
        ServerFlag[]
      >;
      setValidationFlags((v) => ({ ...v, ...returnedFlags }));

      // Session telemetry — update the 8 counters
      const newCollections = new Set(seenCollections);
      const newJourneys = new Set(seenJourneys);
      let completedInc = 0;
      for (const url of savedUrls) {
        completedInc++;
        const draft = drafts[url];
        if (!draft) continue;
        // Best-effort — reads what the parser is inferring locally, since
        // full server knowledge shape isn't in scope here.
        const collectionHint = draft.description.match(/Category:\s*([^\n]+)/i)?.[1]?.trim();
        if (collectionHint) newCollections.add(collectionHint);
        const journeyHint = draft.description.match(/Material Journey Stage:\s*([^\n]+)/i)?.[1]?.trim();
        if (journeyHint) newJourneys.add(journeyHint);
      }
      setSeenCollections(newCollections);
      setSeenJourneys(newJourneys);
      setSessionCounts((s) => ({
        ...s,
        completedThisSession: s.completedThisSession + completedInc,
        collectionsUpdated: newCollections.size,
        materialJourneysCreated: newJourneys.size,
      }));

      // Remove just-saved CLEAN rows from the tagger view. Flagged
      // rows stay OPEN per ADR-0029 "Flagged images MUST NEVER be skipped".
      // Excluded rows stay too so they can be un-excluded.
      setCandidates((cs) =>
        cs.filter((c) => {
          const d = drafts[c.url];
          if (!d) return true;
          if (d.excluded) return true;
          if (!savedUrls.includes(c.url)) return true;
          const flags = returnedFlags[c.url] ?? [];
          const hasBlockingFlag = flags.some(
            (f) => f.severity === "critical" || f.severity === "warning"
          );
          return hasBlockingFlag; // keep flagged rows visible
        })
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }, [drafts]);

  const insertTag = useCallback(
    (url: string, tag: string) => {
      const current = drafts[url]?.tagsInput ?? "";
      const currentTags = current
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (currentTags.includes(tag)) return;
      const next = [...currentTags, tag].join(", ");
      updateDraft(url, { tagsInput: next });
    },
    [drafts, updateDraft]
  );

  const saveOne = useCallback(
    async (url: string, opts: { asDraft?: boolean } = {}) => {
      const draft = drafts[url];
      if (!draft || !isTagged(draft)) return;
      // Enrich the row exactly like Save All does — auto-fill tags
      // + structural fields from the description before shipping.
      const currentTags = draft.tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const autoTags = extractTagsFromDescription(draft.description);
      const mergedTags = Array.from(new Set([...currentTags, ...autoTags]));
      const structural = inferStructuredFromDescription(draft.description, {
        subjectDomain: draft.subjectDomain,
        setting: draft.setting,
        mood: draft.mood,
        viewType: draft.viewType,
        colourPalette: draft.colourPalette,
      });
      const enriched: DraftRow = {
        ...draft,
        tagsInput: mergedTags.join(", "),
        subjectDomain: structural.subjectDomain ?? draft.subjectDomain,
        setting: structural.setting ?? draft.setting,
        mood: structural.mood ?? draft.mood,
        viewType: structural.viewType ?? draft.viewType,
        colourPalette: structural.colourPalette ?? draft.colourPalette,
      };
      try {
        const endpoint = opts.asDraft
          ? "/api/admin/image-tagger/save?as_draft=1"
          : "/api/admin/image-tagger/save";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: { [url]: draftToRow(enriched) } }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          // Surface the specific ADR-0033 refusal reason to the user
          const reason =
            data.reason ??
            (data.error === "save_marginal_needs_draft_flag"
              ? "MASTER SCORE 50-69 — click 'Save as Draft' if you want to save anyway, or enrich the description to lift the score above 70."
              : data.error === "save_refused"
              ? "Save refused per ADR-0033 Rule #7 — description needs enrichment."
              : "save_failed");
          throw new Error(reason);
        }

        // ADR-0029 — capture returned flags, keep flagged rows OPEN
        const rowFlags = ((data.validation_flags ?? {}) as Record<string, ServerFlag[]>)[url] ?? [];
        setValidationFlags((v) => ({ ...v, [url]: rowFlags }));

        const hasBlockingFlag = rowFlags.some(
          (f) => f.severity === "critical" || f.severity === "warning"
        );

        // Only vanish if CLEAN (no critical/warning flags) and not excluded
        if (!enriched.excluded && !hasBlockingFlag) {
          setCandidates((cs) => cs.filter((c) => c.url !== url));
        }

        // Session telemetry
        const collectionHint = enriched.description.match(/Category:\s*([^\n]+)/i)?.[1]?.trim();
        const journeyHint = enriched.description.match(/Material Journey Stage:\s*([^\n]+)/i)?.[1]?.trim();
        setSeenCollections((s) => {
          if (collectionHint) s = new Set(s).add(collectionHint);
          setSessionCounts((sc) => ({ ...sc, collectionsUpdated: s.size }));
          return s;
        });
        setSeenJourneys((s) => {
          if (journeyHint) s = new Set(s).add(journeyHint);
          setSessionCounts((sc) => ({ ...sc, materialJourneysCreated: s.size }));
          return s;
        });
        setSessionCounts((s) => ({
          ...s,
          completedThisSession: s.completedThisSession + 1,
        }));

        setSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "save_failed");
      }
    },
    [drafts, seenCollections, seenJourneys]
  );

  const addNewImage = useCallback(() => {
    const url = newUrlInput.trim();
    if (!url || !url.startsWith("http")) return;
    if (candidates.some((c) => c.url === url)) {
      // Already in the list; scroll to it.
      const el = document.getElementById(`img-${url}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setNewUrlInput("");
      return;
    }
    const newCandidate: Candidate = {
      url,
      contexts: [{ source: "manually-added", role: "user_supplied" }],
    };
    setCandidates((cs) => [newCandidate, ...cs]);
    setDrafts((d) => ({ ...d, [url]: emptyDraft(newCandidate) }));
    setNewUrlInput("");
  }, [newUrlInput, candidates]);

  const replaceUrl = useCallback(
    (oldUrl: string, newUrl: string) => {
      const trimmed = newUrl.trim();
      if (!trimmed || !trimmed.startsWith("http") || trimmed === oldUrl) return;
      setCandidates((cs) =>
        cs.map((c) =>
          c.url === oldUrl
            ? {
                ...c,
                url: trimmed,
                contexts: [
                  ...c.contexts,
                  { source: "url-replaced", notes: `was: ${oldUrl}` },
                ],
              }
            : c
        )
      );
      setDrafts((d) => {
        const moved = d[oldUrl];
        const next = { ...d };
        delete next[oldUrl];
        if (moved) next[trimmed] = moved;
        return next;
      });
    },
    []
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-bold text-black">
              NEX Image Tagger — Intelligence Builder
            </h1>
            <div className="text-[10px] text-black/60">
              ADR-0029 · 500,000 image mindset · every save teaches NEX
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || stats.tagged === 0}
            className="rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to manifest"}
          </button>
        </div>
        {/* ADR-0029 mandatory 8-counter dashboard */}
        <div className="mx-auto grid max-w-6xl grid-cols-4 gap-x-4 gap-y-2 border-t border-black/5 bg-neutral-50/60 px-4 py-2 text-[10px] md:grid-cols-8">
          <Counter label="Total Images" value={totalInApp} />
          <Counter
            label="Completed"
            value={savedCount + sessionCounts.completedThisSession}
            colour="emerald"
          />
          <Counter label="Remaining" value={stats.total} />
          <Counter
            label="Flagged"
            value={flaggedCount}
            colour={flaggedCount > 0 ? "red" : "neutral"}
          />
          <Counter
            label="Collections Updated"
            value={sessionCounts.collectionsUpdated}
          />
          <Counter
            label="Material Journeys"
            value={sessionCounts.materialJourneysCreated}
          />
          <Counter
            label="Cover Images Applied"
            value={sessionCounts.coverImagesApplied}
          />
          <Counter
            label="Admin Reviews Required"
            value={flaggedCount}
            colour={flaggedCount > 0 ? "red" : "neutral"}
          />
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3 text-[11px]">
          {(
            [
              "all",
              "untagged",
              "flagged",
              "banners",
              "tagged",
              "a-plus",
              "excluded",
            ] as const
          ).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 ${
                filter === f
                  ? "bg-black text-white"
                  : f === "flagged" && flaggedCount > 0
                  ? "border border-red-500 bg-red-50 text-red-700"
                  : "border border-black/10 bg-white text-black/70"
              }`}
            >
              {f === "all"
                ? `All (${stats.total})`
                : f === "untagged"
                ? `Untagged (${stats.untagged})`
                : f === "flagged"
                ? `Flagged (${flaggedCount})`
                : f === "banners"
                ? `Banners (${bannerCount})`
                : f === "tagged"
                ? `Tagged (${stats.tagged})`
                : f === "a-plus"
                ? `A+ (${stats.aPlus})`
                : `Excluded (${stats.excluded})`}
            </button>
          ))}
          {savedAt && (
            <span className="ml-auto text-emerald-700">
              ✓ saved to server at {savedAt}
            </span>
          )}
          {saveError && (
            <span className="ml-auto text-red-600">Error: {saveError}</span>
          )}
        </div>
        {/* Per-domain outstanding-work counters */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 border-t border-black/5 px-4 py-2 text-[10px]">
          <span className="font-semibold text-black/50">Needs description:</span>
          {Object.entries(stats.byDomain)
            .sort((a, b) => b[1] - a[1])
            .map(([dom, n]) => (
              <span
                key={dom}
                className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-mono text-black/70"
              >
                {dom}: <span className="font-bold text-black">{n}</span>
              </span>
            ))}
        </div>
        {/* Add-new-image URL row */}
        <div className="mx-auto flex max-w-6xl items-center gap-2 border-t border-black/5 px-4 py-2 text-[11px]">
          <span className="font-semibold text-black/70">Add image URL:</span>
          <input
            type="url"
            value={newUrlInput}
            onChange={(e) => setNewUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNewImage();
              }
            }}
            placeholder="https://ik.imagekit.io/5vv5pw26q/…"
            spellCheck={false}
            className="flex-1 rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] text-black placeholder:text-black/40 outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={addNewImage}
            disabled={!newUrlInput.trim() || !newUrlInput.trim().startsWith("http")}
            className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white hover:bg-black/85 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {visible.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-black/60">
            No images match this filter.
          </div>
        )}
        {visible.map((candidate) => {
          const url = candidate.url;
          const draft = drafts[url] ?? emptyDraft(candidate);
          const context = firstContext(candidate);
          return (
            <CardWithLiveScore
              key={url}
              url={url}
              candidate={candidate}
              draft={draft}
              context={context}
              validationFlags={validationFlags}
              updateDraft={updateDraft}
              insertTag={insertTag}
              saveOne={saveOne}
              replaceUrl={replaceUrl}
            />
          );
        })}
      </main>
    </div>
  );
}

// ── The extracted per-card component (for useLiveScore hook) ────

type ServerFlagLocal = {
  code: string;
  severity: "critical" | "warning" | "info";
  rule: string;
  message: string;
};

function CardWithLiveScore({
  url,
  candidate,
  draft,
  context,
  validationFlags,
  updateDraft,
  insertTag,
  saveOne,
  replaceUrl,
}: {
  url: string;
  candidate: Candidate;
  draft: DraftRow;
  context: string;
  validationFlags: Record<string, ServerFlagLocal[]>;
  updateDraft: (url: string, patch: Partial<DraftRow>) => void;
  insertTag: (url: string, tag: string) => void;
  saveOne: (url: string) => Promise<void>;
  replaceUrl: (oldUrl: string, newUrl: string) => void;
}) {
  const { score: liveScore, loading: scoreLoading } = useLiveScore(
    draft.description,
    draft.originalPrompt
  );
  return (
    <ArticleBody
      url={url}
      candidate={candidate}
      draft={draft}
      context={context}
      validationFlags={validationFlags}
      updateDraft={updateDraft}
      insertTag={insertTag}
      saveOne={saveOne}
      replaceUrl={replaceUrl}
      liveScore={liveScore}
      scoreLoading={scoreLoading}
    />
  );
}

function ArticleBody({
  url,
  candidate,
  draft,
  context,
  validationFlags,
  updateDraft,
  insertTag,
  saveOne,
  replaceUrl,
  liveScore,
  scoreLoading,
}: {
  url: string;
  candidate: Candidate;
  draft: DraftRow;
  context: string;
  validationFlags: Record<string, ServerFlagLocal[]>;
  updateDraft: (url: string, patch: Partial<DraftRow>) => void;
  insertTag: (url: string, tag: string) => void;
  saveOne: (url: string) => Promise<void>;
  replaceUrl: (oldUrl: string, newUrl: string) => void;
  liveScore: ScoreResponse | null;
  scoreLoading: boolean;
}) {
  return (
            <article
              key={url}
              id={`img-${url}`}
              className={`rounded-2xl border bg-white p-4 ${
                (validationFlags[url]?.some(
                  (f) => f.severity === "critical" || f.severity === "warning"
                ) ?? false)
                  ? "border-2 border-red-500 shadow-lg shadow-red-500/10"
                  : "border-black/10"
              }`}
            >
              {(validationFlags[url]?.length ?? 0) > 0 && (
                <ReviewRequiredBanner flags={validationFlags[url]!} />
              )}
              {/* Per-card top strip: live MASTER SCORE ring · status · save */}
              <div className="mb-3 flex items-center gap-3 border-b border-black/5 pb-3">
                {/* Live MASTER SCORE — updates 500ms after description changes */}
                <CircularScore
                  score={liveScore}
                  loading={scoreLoading}
                  passesGate={liveScore?.passes_gate ?? false}
                  primaryBrain={liveScore?.primary_brain ?? null}
                />
                <div className="flex flex-1 flex-col gap-1 text-[10px]">
                  {isTagged(draft) ? (
                    <span className="text-emerald-700">
                      ● draft has tags + description
                    </span>
                  ) : (
                    <span className="text-black/50">
                      ○ needs description or tags
                    </span>
                  )}
                  {liveScore && liveScore.primary_brain && (
                    <span className="text-black/60">
                      primary brain: <span className="font-mono font-semibold text-black">{liveScore.primary_brain.replace("_brain", "")}</span>
                    </span>
                  )}
                  {liveScore && liveScore.collection_memberships.length > 0 && (
                    <span className="text-black/60">
                      collections ({liveScore.collection_memberships.length}):{" "}
                      <span className="text-black/80">{liveScore.collection_memberships.slice(0, 3).join(" · ")}
                      {liveScore.collection_memberships.length > 3 ? " …" : ""}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => saveOne(url)}
                    disabled={
                      !isTagged(draft) ||
                      scoreLoading ||
                      !liveScore ||
                      !liveScore.passes_gate
                    }
                    title={
                      scoreLoading || !liveScore
                        ? "Computing score…"
                        : !liveScore.passes_gate
                        ? `Score ${liveScore.master_score}/100 — below the 70 intelligence gate. Enrich the description to unlock save.`
                        : "Save this row into NEX intelligence"
                    }
                    className="rounded-full bg-orange-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {scoreLoading ? "Computing…" : "Save + move to brain"}
                  </button>
                  {liveScore &&
                    !liveScore.passes_gate &&
                    liveScore.master_score >= 50 &&
                    liveScore.primary_brain && (
                      <button
                        type="button"
                        onClick={() => saveOne(url, { asDraft: true })}
                        title={`Score ${liveScore.master_score}/100 — marginal. Save as draft only; NOT part of NEX intelligence, filtered from all reads.`}
                        className="rounded-full border border-amber-500 bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        Save as Draft
                      </button>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px_1fr]">
              {/* Image + context */}
              <div>
                <div className="overflow-hidden rounded-xl border border-black/5 bg-neutral-100">
                  <img
                    src={url}
                    alt=""
                    className="block w-full"
                    loading="lazy"
                  />
                </div>
                <div className="mt-2 break-all font-mono text-[10px] text-black/50">
                  {decodeURIComponent(url.split("/").pop() ?? "")}
                </div>
                <div className="mt-2 text-[10px] leading-snug text-black/60">
                  <span className="font-semibold text-black/80">
                    Known context:
                  </span>{" "}
                  {context}
                </div>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-3">
                {/* Description — priority field for NEX semantic matching.
                    Paste the MASTER IMAGE DESCRIPTION here — tags,
                    subject_domain, setting, mood, view, palette all
                    auto-extract as you type. */}
                <label className="block">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-black/60">
                      Description
                    </span>
                    <span className="text-[10px] text-black/40">
                      (paste the MASTER IMAGE DESCRIPTION · tags auto-extract on paste)
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={draft.description}
                    onChange={(e) =>
                      updateDraft(url, { description: e.target.value })
                    }
                    placeholder="Paste the full MASTER IMAGE DESCRIPTION here. Multi-section format is fine — every section gets stored verbatim and tags/mood/view/setting auto-populate from the text."
                    spellCheck={true}
                    lang="en-GB"
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 outline-none focus:border-orange-500"
                  />
                  {/* Auto-detected tag suggestions from the description */}
                  {draft.description.trim().length > 20 && (
                    <AutoTagSuggestions
                      description={draft.description}
                      currentTagsInput={draft.tagsInput}
                      onAcceptAll={(tags) => {
                        // Merge auto-tags with existing manual ones
                        const existing = draft.tagsInput
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean);
                        const merged = Array.from(
                          new Set([...existing, ...tags])
                        );
                        // Also auto-populate structured fields where empty
                        const structuralPatch = inferStructuredFromDescription(
                          draft.description,
                          {
                            subjectDomain: draft.subjectDomain,
                            setting: draft.setting,
                            mood: draft.mood,
                            viewType: draft.viewType,
                            colourPalette: draft.colourPalette,
                          }
                        );
                        updateDraft(url, {
                          tagsInput: merged.join(", "),
                          ...structuralPatch,
                        });
                      }}
                      onAcceptOne={(tag) => insertTag(url, tag)}
                    />
                  )}
                </label>

                {/* Tags */}
                <label className="block">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-black/60">
                      Tags
                    </span>
                    <span className="text-[10px] text-black/40">
                      (comma separated · click chips below to add)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={draft.tagsInput}
                    onChange={(e) =>
                      updateDraft(url, { tagsInput: e.target.value })
                    }
                    placeholder="oak, floating, modern, glass, luxury"
                    spellCheck={true}
                    lang="en-GB"
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 outline-none focus:border-orange-500"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {TAG_VOCAB.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => insertTag(url, t)}
                        className="rounded-full border border-black/10 bg-neutral-50 px-2 py-0.5 text-[10px] text-black/60 hover:bg-orange-50 hover:text-orange-700"
                      >
                        +{t}
                      </button>
                    ))}
                  </div>
                </label>

                {/* Original prompt (retroactive best-effort) */}
                <label className="block">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-black/60">
                    Original prompt (if you remember)
                  </div>
                  <textarea
                    rows={2}
                    value={draft.originalPrompt}
                    onChange={(e) =>
                      updateDraft(url, { originalPrompt: e.target.value })
                    }
                    placeholder="The prompt you used in ChatGPT / DALL-E. Optional."
                    spellCheck={true}
                    lang="en-GB"
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 outline-none focus:border-orange-500"
                  />
                </label>

                {/* Row: subject_domain · a_plus · exclude · notes */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_100px_120px_1fr]">
                  <label className="block">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
                      Subject domain
                    </div>
                    <select
                      value={draft.subjectDomain}
                      onChange={(e) =>
                        updateDraft(url, { subjectDomain: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/15 bg-white px-2 py-1.5 text-sm text-black"
                    >
                      {DOMAIN_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
                      A+ hero-ready
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={draft.aPlus}
                        onChange={(e) =>
                          updateDraft(url, { aPlus: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      <span
                        className={`text-xs ${
                          draft.aPlus ? "text-emerald-700" : "text-black/50"
                        }`}
                      >
                        {draft.aPlus ? "A+" : "not A+"}
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
                      Exclude from NEX
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={draft.excluded}
                        onChange={(e) =>
                          updateDraft(url, { excluded: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      <span
                        className={`text-xs ${
                          draft.excluded ? "text-red-600" : "text-black/50"
                        }`}
                      >
                        {draft.excluded ? "hidden" : "in brain"}
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
                      Notes (optional)
                    </div>
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) =>
                        updateDraft(url, { notes: e.target.value })
                      }
                      spellCheck={true}
                      lang="en-GB"
                      autoCorrect="on"
                      autoCapitalize="sentences"
                      className="w-full rounded-xl border border-black/15 bg-white px-3 py-1.5 text-sm text-black placeholder:text-black/40 outline-none focus:border-orange-500"
                    />
                  </label>
                </div>

                {/* Enrichment fields — lifts NEX matching quality when
                    scoring user staircase questions against images. */}
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/60">
                    Enrichment (optional but boosts semantic match)
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <select
                      value={draft.setting}
                      onChange={(e) =>
                        updateDraft(url, { setting: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/15 bg-white px-2 py-1.5 text-sm text-black"
                    >
                      <option value="">Setting…</option>
                      {SETTING_OPTIONS.filter((v) => v).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.mood}
                      onChange={(e) =>
                        updateDraft(url, { mood: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/15 bg-white px-2 py-1.5 text-sm text-black"
                    >
                      <option value="">Mood / style…</option>
                      {MOOD_OPTIONS.filter((v) => v).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.viewType}
                      onChange={(e) =>
                        updateDraft(url, { viewType: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/15 bg-white px-2 py-1.5 text-sm text-black"
                    >
                      <option value="">View type…</option>
                      {VIEW_OPTIONS.filter((v) => v).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.colourPalette}
                      onChange={(e) =>
                        updateDraft(url, { colourPalette: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/15 bg-white px-2 py-1.5 text-sm text-black"
                    >
                      <option value="">Colour palette…</option>
                      {PALETTE_OPTIONS.filter((v) => v).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Replace URL — swap this entry for a different ImageKit URL */}
                <details className="border-t border-black/5 pt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-black/60 hover:text-black">
                    Replace this URL with a different one
                  </summary>
                  <ReplaceUrlControl
                    currentUrl={url}
                    onReplace={(newUrl) => replaceUrl(url, newUrl)}
                  />
                </details>
              </div>
              </div>
            </article>
  );
}

// ── ADR-0033 · Live MASTER SCORE ring on each card ──────────────

type ScoreResponse = {
  master_score: number;
  band: "excellent" | "good" | "marginal" | "poor";
  passes_gate: boolean;
  primary_brain: string | null;
  collection_memberships: string[];
  breakdown: {
    image_intelligence: number;
    collection_intelligence: number;
    relationship_intelligence: number;
    future_intelligence: number;
    creative_intelligence: number;
  };
  hint?: string;
};

/** Debounced live-score hook — calls /api/admin/image-tagger/score
 *  500ms after the description stops changing. Returns null until first
 *  successful call. */
function useLiveScore(description: string, masterAiPrompt: string | undefined) {
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!description || description.trim().length < 20) {
      setScore(null);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/image-tagger/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, master_ai_prompt: masterAiPrompt ?? null }),
          signal: controller.signal,
        });
        const data = (await res.json()) as ScoreResponse & { ok: boolean };
        if (data.ok) setScore(data);
      } catch {
        // ignore aborts / network errors
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [description, masterAiPrompt]);
  return { score, loading };
}

/** Big round percent ring — one per card. Shows MASTER SCORE, colour-
 *  coded per ADR-0033 bands. Ring fills clockwise from 12 o'clock. */
function CircularScore({
  score,
  loading,
  passesGate,
  primaryBrain,
}: {
  score: ScoreResponse | null;
  loading: boolean;
  passesGate: boolean;
  primaryBrain: string | null;
}) {
  const val = score?.master_score ?? 0;
  const band = score?.band ?? "poor";
  // Colour bands
  const colour =
    band === "excellent"
      ? "#10b981"
      : band === "good"
      ? "#059669"
      : band === "marginal"
      ? "#f59e0b"
      : "#dc2626";
  const label =
    band === "excellent"
      ? "EXCELLENT"
      : band === "good"
      ? "GOOD"
      : band === "marginal"
      ? "MARGINAL"
      : "POOR";
  const size = 76;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (val / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 400ms ease, stroke 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none" style={{ color: colour }}>
            {loading ? "…" : val}
          </span>
          <span className="text-[8px] font-medium leading-none text-black/40">/ 100</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: colour + "20", color: colour }}
        >
          {label}
        </span>
        {passesGate ? (
          <span className="text-[8px] font-semibold uppercase tracking-wider text-emerald-600">
            ✓ enters intelligence
          </span>
        ) : primaryBrain === null && val > 0 ? (
          <span className="text-[8px] font-semibold uppercase tracking-wider text-red-600">
            no brain match
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── ADR-0029 8-counter dashboard cell ────────────────────────────

function Counter({
  label,
  value,
  colour = "black",
}: {
  label: string;
  value: number;
  colour?: "black" | "emerald" | "red" | "neutral";
}) {
  const valueClass =
    colour === "emerald"
      ? "text-emerald-700"
      : colour === "red"
      ? "text-red-600"
      : colour === "neutral"
      ? "text-black/40"
      : "text-black";
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-medium uppercase tracking-wider text-black/50">
        {label}
      </span>
      <span className={`font-mono text-sm font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

// ── ADR-0029 flagged-row REVIEW REQUIRED banner ──────────────────

function ReviewRequiredBanner({
  flags,
}: {
  flags: Array<{
    code: string;
    severity: "critical" | "warning" | "info";
    rule: string;
    message: string;
  }>;
}) {
  const critical = flags.filter((f) => f.severity === "critical");
  const warnings = flags.filter((f) => f.severity === "warning");
  const infos = flags.filter((f) => f.severity === "info");
  return (
    <div className="mb-3 rounded-xl border-2 border-red-500 bg-red-50 p-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-red-700">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.485 2.495a1.75 1.75 0 013.03 0l6.28 10.875A1.75 1.75 0 0116.28 16H3.72a1.75 1.75 0 01-1.515-2.63L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        REVIEW REQUIRED
        <span className="text-[10px] font-normal text-red-600/70">
          · {flags.length} {flags.length === 1 ? "flag" : "flags"}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-[11px]">
        {critical.map((f) => (
          <div key={f.code} className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-red-600 px-1.5 py-px text-[9px] font-bold uppercase text-white">
              critical
            </span>
            <span className="text-black/80">{f.message}</span>
          </div>
        ))}
        {warnings.map((f) => (
          <div key={f.code} className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-amber-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">
              warning
            </span>
            <span className="text-black/80">{f.message}</span>
          </div>
        ))}
        {infos.map((f) => (
          <div key={f.code} className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-blue-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">
              info
            </span>
            <span className="text-black/80">{f.message}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-red-600/60">
        Per ADR-0029, flagged images must never be skipped. Edit the fields
        above to resolve, then re-save.
      </div>
    </div>
  );
}

function AutoTagSuggestions({
  description,
  currentTagsInput,
  onAcceptAll,
  onAcceptOne,
}: {
  description: string;
  currentTagsInput: string;
  onAcceptAll: (tags: string[]) => void;
  onAcceptOne: (tag: string) => void;
}) {
  const suggested = useMemo(
    () => extractTagsFromDescription(description),
    [description]
  );
  const existingSet = useMemo(
    () =>
      new Set(
        currentTagsInput
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      ),
    [currentTagsInput]
  );
  const missing = suggested.filter((t) => !existingSet.has(t));
  if (missing.length === 0) {
    return (
      <div className="mt-1.5 text-[10px] text-emerald-700">
        ✓ All {suggested.length} auto-detected tags already applied.
      </div>
    );
  }
  return (
    <div className="mt-1.5 rounded-xl border border-orange-200 bg-orange-50/60 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="font-semibold text-orange-700">
          Auto-detected from description ({missing.length} new):
        </span>
        <button
          type="button"
          onClick={() => onAcceptAll(missing)}
          className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-orange-700"
        >
          Apply all + auto-fill fields
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {missing.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onAcceptOne(t)}
            className="rounded-full bg-white px-2 py-0.5 text-[10px] text-orange-700 shadow-sm hover:bg-orange-100"
          >
            +{t}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReplaceUrlControl({
  currentUrl,
  onReplace,
}: {
  currentUrl: string;
  onReplace: (newUrl: string) => void;
}) {
  const [value, setValue] = useState(currentUrl);
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        className="flex-1 rounded-lg border border-black/15 bg-white px-2 py-1 font-mono text-[11px] text-black outline-none focus:border-orange-500"
      />
      <button
        type="button"
        onClick={() => onReplace(value)}
        disabled={!value.trim() || value.trim() === currentUrl}
        className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white hover:bg-black/85 disabled:opacity-40"
      >
        Replace
      </button>
    </div>
  );
}
