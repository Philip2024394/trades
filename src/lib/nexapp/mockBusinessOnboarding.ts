// src/lib/nexapp/mockBusinessOnboarding.ts · Philip 2026-09-05
//
// NEX BUSINESS M1-A · Conversational Business Onboarding · Session Module
//
// LOCAL DRAFT ONLY. No production persistence. No taxonomy runtime access.
// No workforce activation. No fake AI. Deterministic question progression
// with owner-attributable structured facts.
//
// Doctrines locked (per M1-A authorization):
//   · One universal chat surface reused · onboarding is a CONTEXT/MODE
//   · Owner-controlled reply · NEX asks · owner answers · never invents
//   · Business Brain foundation · structured facts with provenance
//   · Taxonomy · no runtime queries · classification_status: "pending"
//   · Japan first-class · handled naturally if owner mentions it
//   · Offline-safe · localStorage only · works without network
//
// Architecture:
//   · Module-level singleton (session state + subscribers)
//   · getSessionState() / subscribe() → React consumers via useSyncExternalStore
//   · acceptOwnerReply(text) → called by shell composer submit when artifact
//     === "business-onboarding". Deterministically routes reply to the
//     currentAsk fact.
//   · editFact() / removeFactItem() / confirmProfile() / resetSession() →
//     called by the workspace's review + correction UI.
//
// This is honest: every fact traces to an owner utterance. Confidence is
// semantic ("explicit" | "confirmed" | "suggested"), not a fake percentage.

// ── Types ─────────────────────────────────────────────────────────────

export type FactStatus =
  | "owner_provided"       // owner said it in conversation
  | "owner_confirmed"      // owner explicitly confirmed via review UI
  | "nex_suggested"        // NEX offered · owner has not confirmed yet
  | "pending_confirmation" // in edit UI mid-flight
  | "not_provided";        // owner has not addressed this yet

export type FactSource =
  | "owner_conversation"
  | "owner_confirmation"
  | "nex_suggestion";

export type FactConfidence = "explicit" | "confirmed" | "suggested";

/** Single-value fact (company identity · business role · industry) */
export interface SingleFact {
  value: string | null;
  source: FactSource | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: FactStatus;
  confidence: FactConfidence | null;
  /** Reserved for future taxonomy classification (T3+). NEVER populated in M1-A. */
  classification_status?: "pending" | "classified" | null;
}

/** List fact item (products · services · markets · locations · goals) */
export interface ListFactItem {
  id: string;
  value: string;
  source: FactSource;
  createdAt: string;
  updatedAt: string;
  status: FactStatus;
  confidence: FactConfidence;
  /** Reserved for future taxonomy classification. NEVER populated in M1-A. */
  classification_status?: "pending" | "classified" | null;
}

export interface ListFact {
  items: ListFactItem[];
  /** Derived: not_provided when items.length === 0 · else owner_provided */
  status: FactStatus;
}

export type SingleFactKey = "companyIdentity" | "businessRole" | "industry";
export type ListFactKey = "products" | "services" | "markets" | "locations" | "goals";
export type FactKey = SingleFactKey | ListFactKey;

export interface BusinessProfileDraft {
  version: 1;
  companyIdentity: SingleFact;
  businessRole: SingleFact;
  industry: SingleFact;
  products: ListFact;
  services: ListFact;
  markets: ListFact;
  locations: ListFact;
  goals: ListFact;
  confirmed: boolean;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingMessage {
  id: string;
  role: "nex" | "owner" | "system";
  text: string;
  createdAt: string;
  /** For NEX messages · which fact this question is targeting */
  factTargetKey?: FactKey;
}

export type CurrentAsk = FactKey | "review" | "complete";

export interface OnboardingSessionState {
  draft: BusinessProfileDraft;
  messages: OnboardingMessage[];
  currentAsk: CurrentAsk;
  reviewOpen: boolean;
}

// ── LocalStorage key (LOCKED per M1-A authorization §8) ───────────────

const STORAGE_KEY = "nex.business-profile.draft.v1";

// ── Constants ─────────────────────────────────────────────────────────

// Deterministic question progression. Each entry pairs (fact to fill) with
// (NEX's opening line for that ask). No LLM. No hidden inference. Exact
// wording is intentionally calm + owner-friendly per the marketing owner-
// experience/language doctrine.
const QUESTION_SEQUENCE: Array<{ key: FactKey; nexPrompt: string; hint?: string }> = [
  {
    key: "companyIdentity",
    nexPrompt: "Tell me about your business. What's it called and what do you do?",
  },
  {
    key: "industry",
    nexPrompt: "Got it. What kind of business is it — what industry are you in?",
  },
  {
    key: "products",
    nexPrompt: "What products do you sell? You can list several.",
    hint: "list",
  },
  {
    key: "markets",
    nexPrompt: "Where would you like to sell more — which markets or countries?",
    hint: "list",
  },
  {
    key: "businessRole",
    nexPrompt:
      "And your role — do you make the products yourself, export them, distribute them, or something else?",
  },
];

// After the sequence · offer optional strategic follow-ups the owner can
// tap into. Each of these can be skipped.
const OPTIONAL_FOLLOWUPS: Array<{ key: FactKey; nexPrompt: string; hint?: string }> = [
  {
    key: "services",
    nexPrompt: "Do you also offer any services? (You can skip if not.)",
    hint: "list",
  },
  {
    key: "locations",
    nexPrompt: "Any specific locations that matter — factories, warehouses, ports?",
    hint: "list",
  },
  {
    key: "goals",
    nexPrompt: "Finally · any specific goals I should keep in mind?",
    hint: "list",
  },
];

// ── Session state (module singleton) ──────────────────────────────────

let state: OnboardingSessionState = createInitialState();
const subscribers = new Set<() => void>();

/** Cached snapshot for useSyncExternalStore identity stability */
let snapshotCache: OnboardingSessionState | null = null;

function markMutated() {
  // Create NEW top-level state + draft + messages references so React
  // consumers (useSyncExternalStore + useMemo) detect the change.
  // Without this, in-place mutations don't trigger re-render and the
  // review card renders stale "Still needed" chips even though the
  // underlying items were updated.
  state = {
    ...state,
    draft: { ...state.draft, updatedAt: new Date().toISOString() },
    messages: [...state.messages],
  };
  snapshotCache = null;
  persist();
  for (const cb of subscribers) cb();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silent per Product Creator pattern · storage may be full or blocked
  }
}

// ── Public API ────────────────────────────────────────────────────────

export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

export function getSessionState(): OnboardingSessionState {
  if (snapshotCache) return snapshotCache;
  snapshotCache = state;
  return state;
}

export function ensureSessionLoaded(): void {
  // Called on workspace mount. Loads localStorage if present · otherwise
  // seeds the opening NEX message. Idempotent.
  if (typeof window === "undefined") return;
  if (state.messages.length > 0) return; // already initialized in this app run
  const raw = safeReadStorage();
  if (raw) {
    state = raw;
    snapshotCache = null;
    // If we loaded a session but there was never an opening NEX message
    // (edge case), seed it now.
    if (state.messages.length === 0) seedOpeningMessage();
  } else {
    seedOpeningMessage();
  }
  for (const cb of subscribers) cb();
}

function safeReadStorage(): OnboardingSessionState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingSessionState;
    // Version + shape sanity — reject malformed / stale so we don't crash.
    if (!parsed || parsed.draft?.version !== 1) return null;
    if (!Array.isArray(parsed.messages)) return null;
    if (typeof parsed.currentAsk !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function seedOpeningMessage() {
  const first = QUESTION_SEQUENCE[0];
  state.messages = [
    {
      id: newId("m"),
      role: "nex",
      text: first.nexPrompt,
      createdAt: new Date().toISOString(),
      factTargetKey: first.key,
    },
  ];
  state.currentAsk = first.key;
  persist();
}

/**
 * Called by the shell composer submit when the active artifact is
 * business-onboarding. Deterministically attributes the owner's reply to
 * the currentAsk fact · updates the draft · advances to the next ask ·
 * emits the next NEX message.
 *
 * Never guesses across fact boundaries. Never merges into unrelated fields.
 * Owner is always answering the question just asked.
 */
export function acceptOwnerReply(rawText: string): void {
  const text = rawText.trim();
  if (!text) return;

  const askedKey = state.currentAsk;
  const now = new Date().toISOString();

  // Append owner message
  state.messages = [
    ...state.messages,
    { id: newId("m"), role: "owner", text, createdAt: now },
  ];

  if (askedKey === "review" || askedKey === "complete") {
    // Owner typed a message while in review/complete state · treat it as
    // a request for NEX to say something. NEX responds with a calm
    // "your draft is here · tap a fact to edit" · no fake AI extraction.
    state.messages.push({
      id: newId("m"),
      role: "nex",
      text: "Your draft is on the review card. Tap any fact to edit, or Confirm to save locally.",
      createdAt: now,
    });
    markMutated();
    return;
  }

  // Attribute to the currentAsk fact
  applyOwnerReplyToFact(askedKey as FactKey, text, now);

  // Advance to next ask
  const next = pickNextAsk();
  if (next.kind === "sequence") {
    state.currentAsk = next.def.key;
    state.messages.push({
      id: newId("m"),
      role: "nex",
      text: next.def.nexPrompt,
      createdAt: new Date().toISOString(),
      factTargetKey: next.def.key,
    });
  } else if (next.kind === "review") {
    state.currentAsk = "review";
    state.reviewOpen = true;
    state.messages.push({
      id: newId("m"),
      role: "nex",
      text:
        "Thanks — that's enough to start. Here's what I've got. Tap any fact to correct, add anything I missed, then tap Confirm.",
      createdAt: new Date().toISOString(),
    });
  }
  markMutated();
}

function applyOwnerReplyToFact(key: FactKey, text: string, now: string): void {
  const asListFact = key === "products" || key === "services" || key === "markets" || key === "locations" || key === "goals";
  if (asListFact) {
    const items = parseListReply(text).map((v): ListFactItem => ({
      id: newId("i"),
      value: v,
      source: "owner_conversation",
      createdAt: now,
      updatedAt: now,
      status: "owner_provided",
      confidence: "explicit",
      classification_status: null,
    }));
    // Append to existing list (owner may have added over multiple turns).
    // Filter duplicates by case-insensitive value.
    const existing = state.draft[key as ListFactKey].items;
    const seen = new Set(existing.map((it) => it.value.toLowerCase()));
    const fresh = items.filter((it) => !seen.has(it.value.toLowerCase()));
    state.draft[key as ListFactKey].items = [...existing, ...fresh];
    state.draft[key as ListFactKey].status = "owner_provided";
  } else {
    state.draft[key as SingleFactKey] = {
      value: text,
      source: "owner_conversation",
      createdAt: now,
      updatedAt: now,
      status: "owner_provided",
      confidence: "explicit",
      classification_status: null,
    };
  }
}

/**
 * Simple deterministic list parse. Owner types "Tuna, shrimp and lobster"
 * → ["Tuna", "shrimp", "lobster"]. No fancy NLP · no AI · works well for
 * the typical short answer pattern. If parse yields nothing sensible we
 * fall back to a single-item list with the full text.
 */
export function parseListReply(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  // Normalize " and " · " & " · ",and " to commas
  const normalized = cleaned
    .replace(/,\s*and\s+/gi, ", ")
    .replace(/\s+and\s+/gi, ", ")
    .replace(/\s+&\s+/g, ", ")
    .replace(/\s*[.;]\s*$/, ""); // strip trailing punctuation
  const parts = normalized
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/^\s+|\s+$/g, "").replace(/^["']|["']$/g, ""));
  return parts.length > 0 ? parts : [cleaned];
}

function pickNextAsk(): { kind: "sequence"; def: typeof QUESTION_SEQUENCE[number] } | { kind: "review" } {
  // Advance through main sequence · then check minimum completion.
  const currentIdx = QUESTION_SEQUENCE.findIndex((q) => q.key === state.currentAsk);
  const nextIdx = currentIdx + 1;
  if (nextIdx < QUESTION_SEQUENCE.length) {
    return { kind: "sequence", def: QUESTION_SEQUENCE[nextIdx] };
  }
  // Main sequence done. Offer review.
  return { kind: "review" };
}

/**
 * Manual review trigger · e.g. owner taps a "Review what I've told NEX"
 * chip before the sequence naturally completes.
 */
export function openReview(): void {
  state.reviewOpen = true;
  state.currentAsk = "review";
  markMutated();
}

/**
 * Manually edit a single-value fact (from the review card). status becomes
 * pending_confirmation until owner confirms; if value equals the previous
 * value we treat as re-confirmation.
 */
export function editSingleFact(key: SingleFactKey, value: string | null): void {
  const now = new Date().toISOString();
  if (value === null || value.trim() === "") {
    state.draft[key] = {
      value: null,
      source: null,
      createdAt: null,
      updatedAt: now,
      status: "not_provided",
      confidence: null,
      classification_status: null,
    };
  } else {
    state.draft[key] = {
      value: value.trim(),
      source: "owner_confirmation",
      createdAt: state.draft[key].createdAt ?? now,
      updatedAt: now,
      status: "owner_confirmed",
      confidence: "confirmed",
      classification_status: null,
    };
  }
  markMutated();
}

/** Remove a single item from a list fact (from the review card). */
export function removeListItem(key: ListFactKey, itemId: string): void {
  const list = state.draft[key];
  const next = list.items.filter((it) => it.id !== itemId);
  state.draft[key] = {
    items: next,
    status: next.length === 0 ? "not_provided" : "owner_provided",
  };
  markMutated();
}

/** Add an item to a list fact from the review card. */
export function addListItem(key: ListFactKey, value: string): void {
  const v = value.trim();
  if (!v) return;
  const now = new Date().toISOString();
  const items = state.draft[key].items;
  const seen = new Set(items.map((it) => it.value.toLowerCase()));
  if (seen.has(v.toLowerCase())) return; // dedupe
  const next: ListFactItem = {
    id: newId("i"),
    value: v,
    source: "owner_confirmation",
    createdAt: now,
    updatedAt: now,
    status: "owner_confirmed",
    confidence: "confirmed",
    classification_status: null,
  };
  state.draft[key].items = [...items, next];
  state.draft[key].status = "owner_provided";
  markMutated();
}

/** Owner explicitly confirms the whole profile (from the review card). */
export function confirmProfile(): void {
  const now = new Date().toISOString();
  const promoteSingle = (f: SingleFact): SingleFact => {
    if (f.status === "not_provided" || f.value === null) return f;
    return { ...f, status: "owner_confirmed", confidence: "confirmed", updatedAt: now };
  };
  const promoteList = (f: ListFact): ListFact => ({
    items: f.items.map((it) => ({ ...it, status: "owner_confirmed", confidence: "confirmed", updatedAt: now })),
    status: f.items.length === 0 ? "not_provided" : "owner_confirmed",
  });
  state.draft.companyIdentity = promoteSingle(state.draft.companyIdentity);
  state.draft.businessRole    = promoteSingle(state.draft.businessRole);
  state.draft.industry        = promoteSingle(state.draft.industry);
  state.draft.products        = promoteList(state.draft.products);
  state.draft.services        = promoteList(state.draft.services);
  state.draft.markets         = promoteList(state.draft.markets);
  state.draft.locations       = promoteList(state.draft.locations);
  state.draft.goals           = promoteList(state.draft.goals);
  state.draft.confirmed = true;
  state.draft.confirmedAt = now;
  state.currentAsk = "complete";
  state.messages.push({
    id: newId("m"),
    role: "system",
    text: "Draft saved locally on this device. It will be persisted to the Business Brain when M1-B is authorized.",
    createdAt: now,
  });
  markMutated();
}

/** Reset · wipes the session and localStorage. Used by the "Start again" affordance. */
export function resetSession(): void {
  state = createInitialState();
  snapshotCache = null;
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
  seedOpeningMessage();
  for (const cb of subscribers) cb();
}

// ── Completion analysis (per M1-A §5 minimum criteria) ───────────────

export function minimumProfileMet(d: BusinessProfileDraft = state.draft): boolean {
  // A · company identity
  const hasIdentity = d.companyIdentity.status !== "not_provided" && !!d.companyIdentity.value;
  // B · business role
  const hasRole     = d.businessRole.status !== "not_provided"    && !!d.businessRole.value;
  // C · industry
  const hasIndustry = d.industry.status !== "not_provided"        && !!d.industry.value;
  // D · at least one product OR service
  const hasOffering = d.products.items.length > 0 || d.services.items.length > 0;
  // E · at least one strategic context (market OR location OR goal)
  const hasStrategic = d.markets.items.length > 0 || d.locations.items.length > 0 || d.goals.items.length > 0;
  return hasIdentity && hasRole && hasIndustry && hasOffering && hasStrategic;
}

export function missingMinimumKeys(d: BusinessProfileDraft = state.draft): string[] {
  const missing: string[] = [];
  if (d.companyIdentity.status === "not_provided" || !d.companyIdentity.value) missing.push("companyIdentity");
  if (d.businessRole.status    === "not_provided" || !d.businessRole.value)    missing.push("businessRole");
  if (d.industry.status        === "not_provided" || !d.industry.value)        missing.push("industry");
  if (d.products.items.length === 0 && d.services.items.length === 0)          missing.push("productOrService");
  if (d.markets.items.length === 0 && d.locations.items.length === 0 && d.goals.items.length === 0) {
    missing.push("marketOrLocationOrGoal");
  }
  return missing;
}

// ── Factory + helpers ─────────────────────────────────────────────────

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialState(): OnboardingSessionState {
  return {
    draft: createEmptyDraft(),
    messages: [],
    currentAsk: "companyIdentity",
    reviewOpen: false,
  };
}

function createEmptyDraft(): BusinessProfileDraft {
  const now = new Date().toISOString();
  const emptySingle: SingleFact = {
    value: null, source: null, createdAt: null, updatedAt: null,
    status: "not_provided", confidence: null, classification_status: null,
  };
  const emptyList: ListFact = { items: [], status: "not_provided" };
  return {
    version: 1,
    companyIdentity: { ...emptySingle },
    businessRole:    { ...emptySingle },
    industry:        { ...emptySingle },
    products:  { ...emptyList },
    services:  { ...emptyList },
    markets:   { ...emptyList },
    locations: { ...emptyList },
    goals:     { ...emptyList },
    confirmed: false,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Constants exported for the workspace UI ───────────────────────────

export const FACT_LABEL: Record<FactKey, string> = {
  companyIdentity: "Company",
  businessRole:    "Business role",
  industry:        "Industry",
  products:        "Products",
  services:        "Services",
  markets:         "Markets",
  locations:       "Locations",
  goals:           "Goals",
};

export const SINGLE_FACT_KEYS: SingleFactKey[] = ["companyIdentity", "businessRole", "industry"];
export const LIST_FACT_KEYS: ListFactKey[] = ["products", "services", "markets", "locations", "goals"];

/** For the workspace to render the localStorage key transparently */
export const BUSINESS_PROFILE_DRAFT_KEY = STORAGE_KEY;
