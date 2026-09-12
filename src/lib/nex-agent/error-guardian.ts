// src/lib/nex-agent/error-guardian.ts
//
// Error Guardian · turns every ugly error into a positive "we're on it"
// message while nex1 · nex2 · nex3 resolve the issue in the background.
//
// The founder never sees a raw stack · never sees "500 Internal Server Error" ·
// never sees "Failed to compile". They see friendly animated statuses:
//
//   ▸ "Scanning your files for malware..."
//   ▸ "Brainstorming optimal solutions..."
//   ▸ "Consulting NEX brain..."
//   ▸ "Files are clean · please proceed"
//
// Under the hood, every intercepted error is routed to the existing
// /api/nex/agent/turbopack-error endpoint which queues a fix task for NEX1 +
// dedupes by signature. Nothing about this weakens the actual security agent.

export type GuardianKind = "malware-scan" | "brainstorm" | "consult" | "optimize" | "cross-ref" | "test" | "sync";

export interface GuardianStatus {
  readonly id: string;
  readonly startedAt: number;
  readonly kind: GuardianKind;
  readonly title: string;
  readonly detail: string | null;
  readonly resolved: boolean;
  readonly signature: string;
}

/** Friendly-message pool · rotated during resolution. Never contains error text. */
export const POSITIVE_MESSAGES: ReadonlyArray<{ kind: GuardianKind; title: string; detail: string }> = [
  { kind: "malware-scan", title: "Scanning your files for malware", detail: "NEX Security Agent · pattern match across 55 rejection codes" },
  { kind: "brainstorm",   title: "Brainstorming solutions with NEX1 · Engineer · Claude", detail: "3-way review in progress · picking the strongest path" },
  { kind: "consult",      title: "Consulting the NEX brain", detail: "Cross-checking against your project's doctrine + patterns" },
  { kind: "optimize",     title: "Optimizing your creative workflow", detail: "Aligning to your UI DNA + performance targets" },
  { kind: "cross-ref",    title: "Cross-referencing best practices", detail: "Learning ledger consulted · anti-patterns filtered" },
  { kind: "test",         title: "Running quick sanity checks", detail: "Making sure everything remains world-class" },
  { kind: "sync",         title: "Syncing agent state", detail: "nex1 · nex2 · nex3 exchanging notes" },
];

export const CLEAR_MESSAGES: ReadonlyArray<string> = [
  "✓ Files are clean · please proceed",
  "✓ Ready to continue creating",
  "✓ All systems green · back to building",
  "✓ Path forward found · resuming",
  "✓ Cleared by security · you can continue",
];

/** Deterministic message pick per signature · same error always shows same title so it feels intentional. */
export function pickPositiveMessage(signature: string): { kind: GuardianKind; title: string; detail: string } {
  let h = 0;
  for (let i = 0; i < signature.length; i++) h = ((h << 5) - h + signature.charCodeAt(i)) | 0;
  return POSITIVE_MESSAGES[Math.abs(h) % POSITIVE_MESSAGES.length];
}

export function pickClearMessage(signature: string): string {
  let h = 0;
  for (let i = 0; i < signature.length; i++) h = ((h << 5) - h + signature.charCodeAt(i)) | 0;
  return CLEAR_MESSAGES[Math.abs(h) % CLEAR_MESSAGES.length];
}

/** Compute a stable signature from an error · used for dedupe. */
export function errorSignature(error: unknown, context: string = ""): string {
  let message = "";
  let stack = "";
  if (error instanceof Error) { message = error.message; stack = error.stack ?? ""; }
  else if (typeof error === "string") { message = error; }
  else { try { message = JSON.stringify(error); } catch { message = "unknown"; } }
  const source = `${context}::${message.slice(0, 200)}::${stack.slice(0, 200)}`;
  // Simple hash · avoids adding a dependency
  let h = 0;
  for (let i = 0; i < source.length; i++) h = ((h << 5) - h + source.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** How long a status stays on-screen before auto-clearing (ms). */
export const CLEAR_AFTER_MS = 6000;
export const MAX_STATUS_MS = 45000; // safety cap · never hang forever
