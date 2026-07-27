// Shared helpers for the NEX knowledge pipeline.
// Read once — reused by validate, build, dedupe and voice-check.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const KNOWLEDGE_DIR = path.resolve(process.cwd(), "knowledge");
export const MASTER_FILE   = path.resolve(process.cwd(), "knowledge_master.json");

// Load every *.json in knowledge/ as { file, category, doc }
export function loadAllCategories() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return [];
  }
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const full = path.join(KNOWLEDGE_DIR, f);
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (err) {
      throw new Error(`Failed to parse ${f}: ${err.message}`);
    }
    return { file: f, category: doc.category ?? f.replace(".json", ""), doc };
  });
}

export function normaliseQuestion(q) {
  return String(q ?? "")
    .toLowerCase()
    .replace(/[?.!,;:'"]/g, "")
    .replace(/\b(is|are|was|were|does|do|did|can|will|would|should|the|a|an|of|for|to|my|i|it|this|that|from|on|in|by|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checksum(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 12);
}

export const REQUIRED_FIELDS = ["id", "kind", "question", "answer", "category_tag"];

// US → UK spelling triggers used by the voice checker.
// Words that ALWAYS indicate a US spelling regardless of context.
export const US_SPELLINGS = [
  "color", "colors", "colored", "coloring",
  "favor", "favors", "favored", "favoring",
  "realize", "realizes", "realized", "realizing",
  "organize", "organized", "organizing",
  "center", "centers", "centered",
  "traveled", "traveling", "traveler",
  "catalog", "catalogs",
  "aluminum",
  "gray",
  "tire", "tires",
  "curb",
  "gasoline",
  "elevator",
  "apartment"
];

// Context-sensitive US spellings — only flagged when the entry's answer
// ALSO matches the accompanying context regex. Prevents false positives
// on words that have valid UK-English uses. "check the manual" is UK;
// "cash a check" is US. "tell the story" is UK; "two-story house" is US.
// "software program" is UK; "TV program" is US.
export const US_CONTEXT_SPELLINGS = [
  {
    us: "check",
    uk: "cheque",
    context: /\b(bank|bounced|deposit(ed|s|ing)?|written?|wrote|writing|paper|blank|personal|cashier'?s?|cash(ed|ing)?|travell?er'?s?)\s+(a\s+|the\s+|his\s+|her\s+|my\s+|your\s+|their\s+|our\s+|one\s+|another\s+|for\s+a\s+|for\s+the\s+)?check(s)?\b|\bcheck(book|-book|s?[- ]?cashing|s?[- ]?register|ing\s+account)\b/i
  },
  {
    us: "checks",
    uk: "cheques",
    context: /\b(bank|bounced|deposit(ed|s|ing)?|written?|wrote|writing|paper|blank|personal|cashier'?s?|cash(ed|ing)?|travell?er'?s?)\s+(a\s+|the\s+|his\s+|her\s+|my\s+|your\s+|their\s+|our\s+|one\s+|another\s+|for\s+a\s+|for\s+the\s+)?checks\b/i
  },
  {
    us: "story",
    uk: "storey",
    context: /\b(one|two|three|four|five|six|seven|eight|nine|ten|multi|single|top|first|second|third|ground|upper|lower|\d+)[- ]?story\b/i
  },
  {
    us: "stories",
    uk: "storeys",
    context: /\b(one|two|three|four|five|six|seven|eight|nine|ten|multi|single|top|first|second|third|ground|upper|lower|several|many|\d+)[- ]?stories\b/i
  },
  {
    us: "program",
    uk: "programme",
    context: /\b(tv|television|radio|schedule|schedules|weekly|nightly|broadcast(ing)?|documentary|training|maintenance)\s+program\b|\bprogram\s+(schedule|guide|listing|listings|broadcast)\b/i
  },
  {
    us: "programs",
    uk: "programmes",
    context: /\b(tv|television|radio|schedule|schedules|weekly|nightly|broadcast(ing)?|documentary|training|maintenance)\s+programs\b|\bprograms\s+(schedule|guide|listing|listings|broadcast)\b/i
  },
  // "meter" — UK "metre" ONLY when it's the length unit; a device meter
  // (moisture meter, gas meter, electricity meter, parking meter) is UK.
  {
    us: "meter",
    uk: "metre",
    context: /\b(\d+(\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|square|cubic|running|linear|half a|quarter of a)[\s-]meter(s)?\b|\bmeter(s)?\s+(long|wide|deep|high|tall|thick|per|apart|away|in\s+(length|width|height|depth))\b/i
  },
  {
    us: "meters",
    uk: "metres",
    context: /\b(\d+(\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|square|cubic|running|linear)[\s-]meters\b|\bmeters\s+(long|wide|deep|high|tall|thick|per|apart|away|in\s+(length|width|height|depth))\b/i
  },
  // "truck" — UK "lorry" ONLY for a goods vehicle; compound terms like
  // "sack truck", "hand truck", "pallet truck", "pickup truck" are UK.
  {
    us: "truck",
    uk: "lorry",
    context: /\b(delivery|articulated|heavy[- ]?goods|hgv|dump|garbage|refuse|tow|tipper|flatbed|semi|18[- ]?wheeler|big[- ]?rig|mack)\s+truck\b|\btruck\s+(driver|drivers|cab|cabs|route|routes|stop|stops|convoy|convoys|park|parking\s+bay)\b/i
  },
  {
    us: "trucks",
    uk: "lorries",
    context: /\b(delivery|articulated|heavy[- ]?goods|hgv|dump|garbage|refuse|tow|tipper|flatbed|semi|18[- ]?wheeler|big[- ]?rig|mack)\s+trucks\b|\btrucks\s+(driver|drivers|cab|cabs|route|routes|stop|stops|convoy|convoys)\b/i
  }
];

// Banned phrases per saved memory rules
export const BANNED_PHRASES = [
  { pattern: /\bcheap(er|est|ly)?\b/i, rule: "Never use 'cheap' — use 'less expensive', 'more affordable', 'budget-friendly'" },
  { pattern: /\bin most cases\b/i,     rule: "Ban: 'In most cases' (spec-manual voice)" },
  { pattern: /\bprovided that\b/i,     rule: "Ban: 'provided that' (spec-manual voice)" },
  { pattern: /\bit should be noted\b/i,rule: "Ban: 'It should be noted' (spec-manual voice)" },
  { pattern: /\bworld[-\s]?class\b/i,  rule: "Ban: marketing fluff ('world-class')" },
  { pattern: /\bcutting[-\s]?edge\b/i, rule: "Ban: marketing fluff ('cutting-edge')" },
  { pattern: /\bbest[-\s]?in[-\s]?class\b/i, rule: "Ban: marketing fluff ('best-in-class')" },
  { pattern: /\brevolutionary\b/i,     rule: "Ban: marketing fluff ('revolutionary')" },
  { pattern: /\bindustry[-\s]?leading\b/i, rule: "Ban: marketing fluff ('industry-leading')" },
  { pattern: /\bas an ai\b/i,          rule: "Ban: never expose you're an AI" },
  { pattern: /\bthe brain\b/i,         rule: "Ban: never expose internal architecture ('the Brain')" },
  { pattern: /\bknowledge (base|pack)\b/i, rule: "Ban: never expose internal architecture ('knowledge base/pack')" },
  { pattern: /\bmemory layer\b/i,      rule: "Ban: never expose internal architecture ('memory layer')" },
  { pattern: /\blarge language model\b/i, rule: "Ban: never expose internal architecture ('LLM')" },
  { pattern: /\bretrieval[- ]augmented\b/i, rule: "Ban: never expose internal architecture ('RAG')" },
  { pattern: /\bsystem prompt\b/i,     rule: "Ban: never expose internal architecture ('system prompt')" }
];

// Positive voice markers — an answer with ZERO of these might be too spec-y
export const VOICE_MARKERS = [
  /\b(you'll|you're|you've|you'd|don't|it's|that's|can't|won't|isn't|aren't|there's|what's|here's|we're|we've)\b/i,
  /—/,                                                    // em dash
  /\b(you)\b/i                                            // direct address
];

export function fmtBytes(n) {
  if (n < 1024) return n + "B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + "KB";
  return (n / 1024 / 1024).toFixed(1) + "MB";
}
