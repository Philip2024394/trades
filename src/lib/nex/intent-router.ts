// Intent Router — classifies user input BEFORE anything reaches the
// AI composer. Client-safe (no server-only imports) so it can run
// in the browser to route Ask NEX inputs before they cost a request.
//
// Order of classification (never sends everything to AI):
//   1. Navigation intents ("open my messages", "settings", "profile")
//   2. Database lookups ("show my invoices", "my quotes")
//   3. Messenger intents ("message [name]", "new chat")
//   4. Specific Business Brain (keyword-matched)
//   5. General Brain (always-available fallback for AI questions)
//
// The keyword table is a static compile-time list mirrored from the
// platform Brain registry (server side). Keep in sync when new Brains
// launch. Runtime discovery of Brains still happens server-side via
// _registry.ts — this client-safe list is just for router hints.

export type IntentKind = "navigation" | "database" | "brain" | "ai" | "messenger";

export type IntentResult = {
  kind:       IntentKind;
  target?:    string;         // e.g. "/nex-app/messages" for navigation, "staircases" for brain
  reason:     string;
  confidence: number;
  original:   string;
};

// ─── Pattern tables ──────────────────────────────────────────────

const NAVIGATION_PATTERNS: Array<{ re: RegExp; target: string; reason: string }> = [
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(messages?|chats?|inbox)\b/, target: "/nex-app/messages", reason: "user wants messages" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(profile|account|settings)\b/, target: "/nex-app/profile", reason: "user wants profile/settings" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(home|dashboard)\b/, target: "/nex-app", reason: "user wants home" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(marketplace|market)\b/, target: "/nex-app/marketplace", reason: "user wants marketplace" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(businesses?|contacts?)\b/, target: "/nex-app/businesses", reason: "user wants businesses/contacts" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(tools?)\b/, target: "/nex-app/tools", reason: "user wants tools" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(documents?|files?)\b/, target: "/nex-app/documents", reason: "user wants documents" },
  { re: /\b(open|show|go to|take me to)\s+(my\s+)?(website\s+studio|logo\s+studio|image\s+studio)\b/, target: "/nex-app/studios", reason: "user wants studios" }
];

const DATABASE_PATTERNS: Array<{ re: RegExp; target: string; reason: string }> = [
  { re: /\b(show|list|view|see)\s+(my\s+)?(invoices?|bills?)\b/, target: "invoices", reason: "user wants their invoices" },
  { re: /\b(show|list|view|see)\s+(my\s+)?(quotes?|estimates?)\b/, target: "quotes", reason: "user wants their quotes" },
  { re: /\b(show|list|view|see)\s+(my\s+)?(bookings?|appointments?)\b/, target: "bookings", reason: "user wants their bookings" },
  { re: /\b(show|list|view|see)\s+(my\s+)?(projects?|jobs?)\b/, target: "projects", reason: "user wants their projects" },
  { re: /\b(show|list|view|see)\s+(my\s+)?(orders?|purchases?)\b/, target: "orders", reason: "user wants their orders" }
];

const MESSENGER_PATTERNS: Array<{ re: RegExp; target: string; reason: string }> = [
  { re: /\b(message|text|dm|chat with|write to)\s+([\w'\s]+)\b/i, target: "compose", reason: "user wants to message someone" },
  { re: /\b(new\s+chat|start\s+chat|new\s+message)\b/, target: "new", reason: "user wants to start a chat" }
];

// Client-safe Brain keyword table. Server-side platform registry is
// still the source of truth; this table mirrors keywords for router
// use only. When a new Brain goes live, add its keywords here too.
const BRAIN_KEYWORDS: Array<{ slug: string; title: string; keywords: string[] }> = [
  {
    slug: "staircases", title: "Nex Staircases",
    keywords: ["staircase", "stair", "stairs", "handrail", "banister", "balustrade", "spindle", "newel", "tread", "riser", "cut string", "closed string", "winder", "loft stair", "spiral stair", "kite winder", "approved doc k"]
  }
];

// ─── Public API ──────────────────────────────────────────────────

export function classifyIntent(input: string): IntentResult {
  const normalised = input.trim().toLowerCase();
  if (!normalised) {
    return { kind: "brain", target: "general", reason: "empty input — routing to General", confidence: 0.1, original: input };
  }

  // 1. Navigation
  for (const p of NAVIGATION_PATTERNS) {
    if (p.re.test(normalised)) {
      return { kind: "navigation", target: p.target, reason: p.reason, confidence: 0.92, original: input };
    }
  }

  // 2. Database
  for (const p of DATABASE_PATTERNS) {
    if (p.re.test(normalised)) {
      return { kind: "database", target: p.target, reason: p.reason, confidence: 0.9, original: input };
    }
  }

  // 3. Messenger
  for (const p of MESSENGER_PATTERNS) {
    if (p.re.test(normalised)) {
      return { kind: "messenger", target: p.target, reason: p.reason, confidence: 0.85, original: input };
    }
  }

  // 4. Specific Brain (keyword match)
  for (const b of BRAIN_KEYWORDS) {
    for (const kw of b.keywords) {
      if (normalised.includes(kw.toLowerCase())) {
        return { kind: "brain", target: b.slug, reason: `matched Brain "${b.title}"`, confidence: 0.8, original: input };
      }
    }
  }

  // 5. General Brain fallback — always available, never Staircase
  return { kind: "brain", target: "general", reason: "general knowledge fallback", confidence: 0.5, original: input };
}
