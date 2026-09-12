// src/components/nex-app/shell/chat-artifacts.ts
//
// Stage 3.41 · Client-side response mapper (Philip 2026-08-31).
//
// Takes the raw JSON response from /api/nex-conv/chat and pulls out
// the conversational artifacts that should render inline in the chat
// stream:
//
//   · voice_reply          → the friend-voice text the user reads
//   · world_cards          → inline card carousel of World records
//   · pending_proposal     → "Shall I send it?" prompt + confirm buttons
//   · action_audit         → terminal state pill (Verified / Unknown / etc)
//
// This is a pure function so it's easy to unit-test and any chat
// surface (ChatSurface, NexWidget, future canonical chat) can adopt
// it with one call.

export type ChatArtifactVoice = {
  text: string;
  mode: "HANGOUT" | "TASK";
  intent: string;
};

export type ChatArtifactWorldCard = {
  refId?: string;
  name: string;
  category?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  distanceLine?: string;   // "0.14km from Malioboro"
  priceLine?: string;      // "from Rp 300k/night" · or undefined when unpublished
  missingFieldPills: readonly string[];    // e.g. ["no price published"]
};

export type ChatArtifactPendingProposal = {
  actionId:        string;
  targetCanonical: string;
  kind:            string;      // "contact_via_whatsapp"
  messageBody?:    string;
  language:        "en" | "id";
};

export type ChatArtifactAudit = {
  finalState: "VERIFIED" | "UNKNOWN" | "FAILED" | "BLOCKED";
  targetCanonical: string;
  reason?: string;
};

export type ChatArtifacts = {
  voiceReply?:      ChatArtifactVoice;
  worldCards:       readonly ChatArtifactWorldCard[];
  pendingProposal?: ChatArtifactPendingProposal;
  audit?:           ChatArtifactAudit;
};

/**
 * Map an API JSON response to the artifact set. Defensive parsing —
 * every field is treated as unknown and validated before use.
 */
export function mapChatResponseToArtifacts(json: unknown): ChatArtifacts {
  const j = (json ?? {}) as Record<string, unknown>;

  return {
    voiceReply:      extractVoiceReply(j.voice_reply),
    worldCards:      extractWorldCards(j.world_cards),
    pendingProposal: extractPendingProposal(j.pending_proposal_snapshot),
    audit:           extractAudit(j.action_audit),
  };
}

// ─── voice_reply ──────────────────────────────────────────────────

function extractVoiceReply(raw: unknown): ChatArtifactVoice | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { en?: unknown; id?: unknown; mode?: unknown; intent?: unknown };
  // Prefer EN by default · the caller is free to pick ID by re-mapping
  // on the language they already know. Keeping this pure so the mapper
  // doesn't need to know the user's language.
  const text = typeof r.en === "string" && r.en.length > 0 ? r.en
             : typeof r.id === "string" && r.id.length > 0 ? r.id
             : undefined;
  const mode = r.mode === "HANGOUT" || r.mode === "TASK" ? r.mode : undefined;
  const intent = typeof r.intent === "string" ? r.intent : undefined;
  if (!text || !mode || !intent) return undefined;
  return { text, mode, intent };
}

/** Same mapper but picks the ID rendering. */
export function extractVoiceReplyID(raw: unknown): ChatArtifactVoice | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { en?: unknown; id?: unknown; mode?: unknown; intent?: unknown };
  const text = typeof r.id === "string" && r.id.length > 0 ? r.id : undefined;
  const mode = r.mode === "HANGOUT" || r.mode === "TASK" ? r.mode : undefined;
  const intent = typeof r.intent === "string" ? r.intent : undefined;
  if (!text || !mode || !intent) return undefined;
  return { text, mode, intent };
}

// ─── world_cards ──────────────────────────────────────────────────

function extractWorldCards(raw: unknown): readonly ChatArtifactWorldCard[] {
  const list = extractCardArray(raw);
  return list.map(toWorldCard).filter((c): c is ChatArtifactWorldCard => !!c);
}

function extractCardArray(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as { cards?: unknown; records?: unknown; hits?: unknown; payload?: { hits?: unknown } };
  // Composer's PresentedCardSet uses `cards`.
  if (Array.isArray(r.cards))   return r.cards;
  if (Array.isArray(r.records)) return r.records;
  if (Array.isArray(r.hits))    return r.hits;
  if (Array.isArray(r.payload?.hits)) return r.payload.hits!;
  return [];
}

function toWorldCard(raw: unknown): ChatArtifactWorldCard | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" && r.name.length > 0 ? r.name : null;
  if (!name) return null;

  const rating      = typeof r.rating === "number" ? r.rating : undefined;
  const reviewCount = typeof r.reviewCount === "number" || typeof r.review_count === "number"
                        ? Number(r.reviewCount ?? r.review_count)
                        : undefined;
  const distanceKm  = typeof r.distanceKm === "number" ? r.distanceKm : undefined;
  const distanceArea = typeof r.distanceArea === "string" ? r.distanceArea : undefined;

  // Price: PresentedCard has price already formatted as a string ·
  // WorldRecord has it numeric. Handle both.
  let priceLine: string | undefined;
  if (typeof r.price === "string" && r.price.length > 0) {
    priceLine = r.price;
  } else {
    const priceRaw = r.price ?? r.priceIdr ?? r.price_idr;
    if (typeof priceRaw === "number" && priceRaw > 0) {
      priceLine = `from Rp ${priceRaw.toLocaleString("id-ID")}`;
    }
  }

  const distanceLine = distanceKm !== undefined
    ? `${distanceKm.toFixed(2)}km${distanceArea ? ` from ${distanceArea}` : ""}`
    : (typeof r.location === "string" ? r.location : undefined);

  const missing: string[] = [];
  if (priceLine === undefined) missing.push("no price published");
  if (rating === undefined)    missing.push("no rating published");

  // Category: PresentedCard uses `subline` (e.g. "Hotel · Yogyakarta") ·
  // WorldRecord uses `category` (e.g. "hotel"). Prefer the raw category.
  const category = typeof r.category === "string" ? r.category
                 : typeof r.subline === "string" ? r.subline.split("·")[0].trim()
                 : undefined;

  return {
    refId:        typeof r.id === "string" ? r.id : (typeof r.refId === "string" ? r.refId : undefined),
    name,
    category,
    imageUrl:     typeof r.heroImage === "string" ? r.heroImage : (typeof r.image === "string" ? r.image : undefined),
    rating,
    reviewCount,
    priceLine,
    distanceLine,
    missingFieldPills: missing,
  };
}

// ─── pending_proposal_snapshot ────────────────────────────────────

function extractPendingProposal(raw: unknown): ChatArtifactPendingProposal | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const actionId        = typeof r.actionId === "string" ? r.actionId : undefined;
  const targetCanonical = typeof r.targetCanonical === "string" ? r.targetCanonical : undefined;
  const kind            = typeof r.kind === "string" ? r.kind : undefined;
  if (!actionId || !targetCanonical || !kind) return undefined;
  return {
    actionId, targetCanonical, kind,
    messageBody: typeof r.messageBody === "string" ? r.messageBody : undefined,
    language:    r.language === "id" ? "id" : "en",
  };
}

// ─── action_audit terminal ────────────────────────────────────────

function extractAudit(raw: unknown): ChatArtifactAudit | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const finalState = r.finalState;
  if (finalState !== "VERIFIED" && finalState !== "UNKNOWN" && finalState !== "FAILED" && finalState !== "BLOCKED") {
    return undefined;
  }
  const target = r.target as { canonical?: unknown } | undefined;
  const verification = r.verification as { reason?: unknown } | undefined;
  const blockedReason = typeof r.blockedReason === "string" ? r.blockedReason : undefined;
  const targetCanonical = typeof target?.canonical === "string" ? target.canonical : "";
  const reason = typeof verification?.reason === "string" ? verification.reason : blockedReason;
  return { finalState, targetCanonical, reason };
}
