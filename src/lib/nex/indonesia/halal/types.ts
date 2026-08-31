// NEX Halal certification · types.
//
// Halal status is a first-class attribute on Entity records. The
// critical rule (Philip's mandate): NEVER conflate
//   · "no verified certification"
// with
//   · "not halal"
//
// The four states below preserve that distinction. Every state
// carries provenance and a verified-at timestamp so NEX can display
// "BPJPH certification verified 42 minutes ago" or "the business
// claims halal, but I found no verified certification record."

export type HalalStatus =
  | "certified"    // authoritative certification found (BPJPH or accepted equivalent)
  | "claimed"      // business asserts halal but no cert record located
  | "not_halal"    // explicitly not halal (e.g. serves pork · certified NON-halal is meaningful)
  | "unknown";     // insufficient signal · never assume

export type HalalAuthority = "BPJPH" | "MUI_legacy" | "self_declared" | "review_signal" | "other";

export type HalalCertification = {
  status: HalalStatus;
  authority: HalalAuthority;
  /** Official certificate reference · e.g. BPJPH cert number.
   *  Empty for "claimed" / "unknown". */
  certificateRef?: string;
  /** ISO date · when the certification was originally issued. */
  issuedAt?: string;
  /** ISO date · when NEX last verified the certification. */
  verifiedAt: string;
  /** ISO date · when the certification is due to expire (from BPJPH). */
  expiresAt?: string;
  /** Source URL / lookup used to verify. */
  sourceUrl?: string;
  /** Confidence in the state assignment (0..1). */
  confidence: number;
  /** Optional note surfaced in NEX answers when relevant. */
  note?: string;
};

/** How NEX should phrase the halal state to a user. Kept in the
 *  types file so the phrase library and the answer engine agree. */
export const HALAL_USER_PHRASES: Record<HalalStatus, (c: HalalCertification) => string> = {
  certified: (c) =>
    `BPJPH-certified halal${c.certificateRef ? ` · certificate ${c.certificateRef}` : ""} · verified ${c.verifiedAt.slice(0, 10)}.`,
  claimed: (_c) =>
    "The business claims to be halal, but I could not find a verified certification record. If halal matters to you, please confirm on-site.",
  not_halal: (_c) =>
    "Not halal — this venue serves non-halal items (e.g. pork or alcohol on the same premises).",
  unknown: (_c) =>
    "I don't have a verified halal status for this business.",
};
