// src/lib/nex/api/validators.ts
//
// Wave 11 remediation · closes F20 (broken null-byte detection) · F21
// (brain allowlist missing) · F25 (empty-string env vars pass truthy).
//
// Every API route validates request-boundary inputs BEFORE business
// logic runs. The validators here are the shared primitives — new
// routes MUST use them rather than inventing bespoke checks that
// eventually drift.

// ─────────────────────────────────────────────────────────────────────
// F21 · Brain-slug allowlist
// ─────────────────────────────────────────────────────────────────────
//
// The `brain` query param arrives from user-controlled URL space and
// used to be passed straight into listMemories() which resolves it
// into a filesystem path or DB key. Without an allowlist, an attacker
// could pass `../` traversal or probe for arbitrary brain names.
//
// The legal set is:
//   · TRADE brains from ADR-0033 (staircase, door, kitchen, ...)
//   · HQ brains from the roster in src/lib/nex/brain/router.ts
//     (normalised via normaliseBrain())
//
// The allowlist is a static set here to avoid an import cycle with
// router.ts. If the roster changes there, this set MUST be updated
// (brain-router tests will catch drift).

const TRADE_BRAIN_SLUGS = [
  "staircase", "door", "interior", "kitchen", "bathroom",
  "tools", "timber", "flooring", "lighting", "roofing", "marketing",
] as const;

// HQ brains from router.ts's HQ_BRAINS · pre-normalised.
// If router.ts::HQ_BRAINS changes, update this list.
const HQ_BRAIN_SLUGS = [
  "executive-brain",
  "legal-brain",
  "marketing-brain",
  "brand-brain",
  "sales-brain",
  "customer-service-brain",
  "finance-brain",
  "operations-brain",
  "security-brain",
  "strategy-room",
  "audience-intelligence-brain",
  "internal-audit",
] as const;

const KNOWN_BRAIN_SLUGS: ReadonlySet<string> = new Set<string>([
  ...TRADE_BRAIN_SLUGS,
  ...HQ_BRAIN_SLUGS,
]);

// Shape check applied FIRST as defense in depth. Even if a slug is on
// the allowlist, it must also match this shape (letters/digits/hyphens
// only, reasonable length). Blocks weird encoded characters.
const BRAIN_SLUG_SHAPE = /^[a-z][a-z0-9-]{2,60}$/;

export type BrainSlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: "missing" | "invalid_format" | "unknown_brain" };

/**
 * Validate a `brain` param from an API request. Returns a discriminated
 * union so callers pattern-match on the result rather than catch
 * exceptions. Missing param is a distinct reason from unknown/invalid.
 */
export function assertBrainSlug(input: unknown): BrainSlugCheck {
  if (typeof input !== "string" || input.length === 0) {
    return { ok: false, reason: "missing" };
  }
  // STRICT · no lowercase/trim coercion. The route boundary sees the
  // exact user-supplied string · variants like "Staircase" or " staircase "
  // fail shape check. Callers who want case-insensitive convenience must
  // lowercase before calling. This is deliberate: attacker fingerprinting
  // via case variants is blocked at the boundary.
  if (!BRAIN_SLUG_SHAPE.test(input)) {
    return { ok: false, reason: "invalid_format" };
  }
  if (!KNOWN_BRAIN_SLUGS.has(input)) {
    return { ok: false, reason: "unknown_brain" };
  }
  return { ok: true, slug: input };
}

/** Read-only export of the known brain set · for tests + docs. */
export function knownBrainSlugs(): ReadonlySet<string> {
  return KNOWN_BRAIN_SLUGS;
}

// ─────────────────────────────────────────────────────────────────────
// F20 · Real binary-vs-text detection
// ─────────────────────────────────────────────────────────────────────
//
// The prior code detected "binary" by counting SPACE characters in the
// UTF-8-decoded string (a bug — the variable was named nullBytes but
// counted spaces). A truly-binary file with few spaces (e.g. a small
// JPEG or PDF) would slip through and be pushed into the text pipeline,
// corrupting downstream extraction.
//
// Correct detection: scan the first N raw bytes for NUL (0x00). A
// well-formed text file NEVER contains NUL. Any NUL in the first 4 KB
// is a strong binary signal.

export type BinaryDetectionResult = {
  /** True if the byte stream is likely binary and should NOT be decoded as text. */
  isBinary: boolean;
  /** Number of NUL (0x00) bytes observed in the sample. */
  nulCount: number;
  /** Number of bytes actually sampled. */
  sampled: number;
};

/**
 * Detect whether a byte buffer is binary content that should not be
 * decoded as UTF-8. Samples up to `sampleSize` bytes (default 4096).
 *
 * Threshold: ≥1 NUL byte in the sample → treat as binary.
 * Rationale: legitimate text files (including CSV, JSON, XML, markdown,
 * HTML, YAML) do NOT contain NUL. Even one NUL is a strong signal.
 */
export function detectBinaryContent(bytes: Uint8Array, sampleSize = 4096): BinaryDetectionResult {
  const sampled = Math.min(bytes.length, sampleSize);
  let nulCount = 0;
  for (let i = 0; i < sampled; i++) {
    if (bytes[i] === 0) nulCount++;
  }
  return { isBinary: nulCount >= 1, nulCount, sampled };
}

// ─────────────────────────────────────────────────────────────────────
// F25 · Env-var non-empty requirement
// ─────────────────────────────────────────────────────────────────────
//
// `if (!process.env.X)` treats empty string as falsy — correct — but
// does not catch whitespace-only values (`"   "`) which pass truthy
// AND then break downstream (createClient throws with an internal
// error whose message leaks path/credential info).

export class MissingEnvError extends Error {
  code = "misconfigured" as const;
  constructor(public readonly varName: string) {
    super(`required env var ${varName} is unset or blank`);
  }
}

/**
 * Return the value of `name` from `env` (defaults to process.env).
 * Throws MissingEnvError when the value is unset, empty, or contains
 * only whitespace. The thrown error's `.code === "misconfigured"` so
 * it maps to the shared error envelope's safe code.
 */
export function requireEnvNonEmpty(name: string, env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string {
  const raw = env[name];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new MissingEnvError(name);
  }
  return raw;
}

/**
 * Non-throwing variant · returns either the trimmed value or null.
 * Use when the caller wants to make its own error decision.
 */
export function readEnvOrNull(name: string, env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string | null {
  const raw = env[name];
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  return raw;
}
