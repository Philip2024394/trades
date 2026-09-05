// src/lib/nex/brain/commercial-intent.ts
//
// NEX Business International Market Intelligence v1
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · §6 §18 §27
//
// PURPOSE
//   Semantic classifier for commercial-search intents:
//     "find buyers in Japan" · "find importers" · "find distributors"
//     "find suppliers" · "find partners"
//   Extracts: objective_kind + target_market + optional product/industry.
//
// PRINCIPLE (§27 no duplicate agents · §18 semantic not phrase-list)
//   ONE coherent capability. New surface forms cost nothing when they
//   use the same structural vocabulary (verb + object + preposition +
//   location).

// ─── Types ─────────────────────────────────────────────────────

export type CommercialObjective =
  | "FIND_BUYERS"
  | "FIND_IMPORTERS"
  | "FIND_DISTRIBUTORS"
  | "FIND_RETAILERS"
  | "FIND_WHOLESALERS"
  | "FIND_SUPPLIERS"
  | "FIND_MANUFACTURERS"
  | "FIND_PARTNERS"
  | "FIND_MARKET_OPPORTUNITIES"
  | "FIND_POTENTIAL_CUSTOMERS"
  | "NONE";

export type SendActionDetection = {
  /** true when the message says "send it" / "send them the email" /
   *  "email them" / "message them" / "contact them autonomously". */
  is_send_action: boolean;
  action: "send_email" | "send_message" | "send_whatsapp" | "call" | "post" | "none";
  markers: string[];
};

export type DraftActionDetection = {
  /** true when the message says "draft an email" / "write a message" /
   *  "prepare an introduction". Drafting is ALLOWED in v1. */
  is_draft_action: boolean;
  action: "draft_email" | "draft_message" | "draft_introduction" | "none";
  markers: string[];
};

export type CommercialIntentDetection = {
  objective: CommercialObjective;
  target_market: string | null;
  target_product_hint: string | null;
  target_industry_hint: string | null;
  markers: string[];
  reason: string;
};

// ─── Vocabulary (EN + ID) ─────────────────────────────────────

const SEARCH_VERBS = new Set([
  "find", "search", "get", "show", "look", "give", "recommend", "suggest",
  "cari", "carikan", "tunjukkan", "berikan", "rekomendasikan",
]);

const OBJECTIVE_NOUNS: Record<string, CommercialObjective> = {
  buyer: "FIND_BUYERS", buyers: "FIND_BUYERS",
  pembeli: "FIND_BUYERS",
  importer: "FIND_IMPORTERS", importers: "FIND_IMPORTERS",
  importir: "FIND_IMPORTERS",
  distributor: "FIND_DISTRIBUTORS", distributors: "FIND_DISTRIBUTORS",
  distributors_id: "FIND_DISTRIBUTORS",
  retailer: "FIND_RETAILERS", retailers: "FIND_RETAILERS",
  pengecer: "FIND_RETAILERS",
  wholesaler: "FIND_WHOLESALERS", wholesalers: "FIND_WHOLESALERS",
  grosir: "FIND_WHOLESALERS",
  supplier: "FIND_SUPPLIERS", suppliers: "FIND_SUPPLIERS",
  pemasok: "FIND_SUPPLIERS",
  manufacturer: "FIND_MANUFACTURERS", manufacturers: "FIND_MANUFACTURERS",
  produsen: "FIND_MANUFACTURERS", pabrik: "FIND_MANUFACTURERS",
  partner: "FIND_PARTNERS", partners: "FIND_PARTNERS",
  mitra: "FIND_PARTNERS",
  customer: "FIND_POTENTIAL_CUSTOMERS", customers: "FIND_POTENTIAL_CUSTOMERS",
  pelanggan: "FIND_POTENTIAL_CUSTOMERS",
  opportunity: "FIND_MARKET_OPPORTUNITIES", opportunities: "FIND_MARKET_OPPORTUNITIES",
  peluang: "FIND_MARKET_OPPORTUNITIES",
};

const LOCATION_PREPOSITIONS = new Set([
  "in", "at", "around", "near", "to", "for", "from",
  "di", "ke", "dari", "sekitar", "dekat", "untuk",
]);

// Popular country tokens (multi-word handled separately below).
const COUNTRY_TOKENS = new Set([
  "japan", "korea", "china", "vietnam", "thailand", "malaysia", "singapore",
  "indonesia", "philippines", "cambodia", "laos", "myanmar",
  "australia", "canada", "usa", "america", "uk", "britain",
  "germany", "france", "netherlands", "italy", "spain",
  "uae", "emirates", "saudi", "arabia", "qatar", "kuwait", "oman",
  "india", "pakistan", "bangladesh", "sri", "lanka",
  "brazil", "mexico", "argentina", "chile",
  "russia", "turkey", "egypt",
]);

// Multi-word markets — matched on lowered joined tokens.
const MULTI_WORD_MARKETS: ReadonlyArray<string> = [
  "south korea", "north korea",
  "united states", "united states of america",
  "united kingdom", "great britain",
  "united arab emirates",
  "saudi arabia",
  "sri lanka",
  "hong kong",
  "new zealand",
];

// Send / draft vocabulary ─────────────────────────────────────
const SEND_TOKENS = new Set([
  "send", "email", "message", "whatsapp", "call", "post", "text", "dm", "contact",
  "kirim", "kirimkan", "hubungi", "telepon", "sms",
]);
const DRAFT_TOKENS = new Set([
  "draft", "write", "compose", "prepare", "template",
  "buatkan", "buat", "siapkan", "tulis",
]);
const AUTONOMOUS_MARKERS = new Set([
  "auto", "automatically", "autopilot", "on my behalf",
  "otomatis",
]);

// ─── Tokenizer ────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Market extraction ───────────────────────────────────────

function extractMarket(originalMessage: string, tks: string[]): string | null {
  const joined = tks.join(" ");
  // Multi-word markets first
  for (const m of MULTI_WORD_MARKETS) {
    if (joined.includes(m)) {
      // Preserve original case
      const rx = new RegExp(m.split(" ").map(escapeRx).join("\\s+"), "i");
      const found = rx.exec(originalMessage);
      return found ? found[0].replace(/\s+/g, " ") : m;
    }
  }
  // Look for country token after a location preposition
  for (let i = 0; i < tks.length - 1; i++) {
    if (LOCATION_PREPOSITIONS.has(tks[i]) && COUNTRY_TOKENS.has(tks[i + 1])) {
      return capitaliseFromOriginal(originalMessage, tks[i + 1]);
    }
  }
  // Fall back to any country token in the message
  for (const tok of tks) {
    if (COUNTRY_TOKENS.has(tok)) return capitaliseFromOriginal(originalMessage, tok);
  }
  return null;
}

function capitaliseFromOriginal(message: string, token: string): string {
  const rx = new RegExp(`\\b${escapeRx(token)}\\b`, "i");
  const m = rx.exec(message);
  return m ? m[0] : token.charAt(0).toUpperCase() + token.slice(1);
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Classifier ──────────────────────────────────────────────

export function classifyCommercialIntent(message: string): CommercialIntentDetection {
  const t = tokens(message);
  const markers: string[] = [];
  const none = (reason: string): CommercialIntentDetection => ({
    objective: "NONE", target_market: null,
    target_product_hint: null, target_industry_hint: null,
    markers, reason,
  });
  if (t.length === 0) return none("empty");

  // 1 · SEARCH-VERB + OBJECTIVE_NOUN → commercial intent
  const searchIdx = t.findIndex((x) => SEARCH_VERBS.has(x));
  let objective: CommercialObjective = "NONE";
  let objectiveIdx = -1;

  for (let i = 0; i < t.length; i++) {
    const asObj = OBJECTIVE_NOUNS[t[i]];
    if (asObj) {
      objective = asObj;
      objectiveIdx = i;
      markers.push(`objective:${asObj}`);
      break;
    }
  }

  if (objective === "NONE") return none("no_objective_noun");

  if (searchIdx < 0) {
    // Also allow bare "buyers in Japan" as a fresh objective statement
    // when it looks like a task fragment (short, contains objective noun
    // + location).
    if (t.length > 8) {
      markers.push("no_search_verb_but_long");
      return none("no_search_verb");
    }
    markers.push("bare_objective_task_fragment");
  }

  const target_market = extractMarket(message, t);
  if (target_market) markers.push(`market:${target_market}`);

  // 2 · Product hint · look for common industry/product tokens before
  // the objective noun. Very conservative — only fires when a known token
  // is present.
  const PRODUCT_HINTS: Record<string, { product?: string; industry?: string }> = {
    seafood: { product: "seafood", industry: "seafood" },
    fish: { product: "fish", industry: "seafood" },
    tuna: { product: "tuna", industry: "seafood" },
    salmon: { product: "salmon", industry: "seafood" },
    shrimp: { product: "shrimp", industry: "seafood" },
    coffee: { product: "coffee", industry: "coffee" },
    tea: { product: "tea", industry: "tea" },
    textile: { industry: "textile" }, textiles: { industry: "textile" },
    furniture: { industry: "furniture" },
    electronics: { industry: "electronics" },
    software: { industry: "software" },
  };
  let target_product_hint: string | null = null;
  let target_industry_hint: string | null = null;
  for (let i = 0; i < objectiveIdx; i++) {
    const hint = PRODUCT_HINTS[t[i]];
    if (hint) {
      target_product_hint = hint.product ?? target_product_hint;
      target_industry_hint = hint.industry ?? target_industry_hint;
      markers.push(`product_hint:${t[i]}`);
      break;
    }
  }

  return {
    objective,
    target_market,
    target_product_hint,
    target_industry_hint,
    markers,
    reason: `commercial_intent:${objective}`,
  };
}

// ─── Send-action detector (§10 · autonomy boundary) ───────────

export function detectSendAction(message: string): SendActionDetection {
  const t = tokens(message);
  const markers: string[] = [];
  // Verb-based · "send it" / "email them" / "message them" / "contact them"
  for (let i = 0; i < t.length; i++) {
    if (SEND_TOKENS.has(t[i])) {
      // Guard: if a DRAFT token appears earlier in the same clause, this
      // is a draft-and-then-you'll-send phrasing — not autonomous.
      const earlierDraft = t.slice(0, i).some((x) => DRAFT_TOKENS.has(x));
      if (earlierDraft) {
        markers.push(`send_verb_after_draft:${t[i]}`);
        continue;
      }
      const action: SendActionDetection["action"] =
        t[i] === "email" || (t.slice(i, i + 3).includes("email")) ? "send_email"
        : t[i] === "whatsapp" ? "send_whatsapp"
        : t[i] === "call" ? "call"
        : t[i] === "post" ? "post"
        : t[i] === "message" ? "send_message"
        : "send_email";
      markers.push(`send_verb:${t[i]}`);
      return { is_send_action: true, action, markers };
    }
  }
  // "on my behalf" / "autopilot" / "otomatis" — autonomous markers
  for (const tok of t) {
    if (AUTONOMOUS_MARKERS.has(tok)) {
      markers.push(`autonomous_marker:${tok}`);
      return { is_send_action: true, action: "send_email", markers };
    }
  }
  return { is_send_action: false, action: "none", markers };
}

// ─── Draft-action detector (§10 · allowed) ────────────────────

export function detectDraftAction(message: string): DraftActionDetection {
  const t = tokens(message);
  const markers: string[] = [];
  const draftIdx = t.findIndex((x) => DRAFT_TOKENS.has(x));
  if (draftIdx < 0) return { is_draft_action: false, action: "none", markers };
  // Determine target: email / message / introduction / template
  const tail = t.slice(draftIdx + 1).join(" ");
  const action: DraftActionDetection["action"] =
    /\bemail\b|\bemails?\b/.test(tail) ? "draft_email"
    : /\bintroduction|intro\b/.test(tail) ? "draft_introduction"
    : /\bmessage|whatsapp|dm\b/.test(tail) ? "draft_message"
    : "draft_email";
  markers.push(`draft_verb:${t[draftIdx]}`);
  markers.push(`draft_target:${action}`);
  return { is_draft_action: true, action, markers };
}
