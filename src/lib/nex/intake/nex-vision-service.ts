// NEX Vision Service · NEX-OWNED INTERFACE.
//
// Doctrine anchor: project_nex_owns_intelligence_capabilities_2026_08_22
//
// Vision is a NEX capability with a REPLACEABLE IMPLEMENTATION LAYER.
// Consumers of this interface MUST NOT import a specific provider
// (OpenRouter · Claude Vision · Google Vision · etc.) directly. All
// consumers depend on this interface only. Providers are pluggable via
// selectVisionProvider().
//
// Provider-swap test: if any current implementation disappears, NEX must
// continue operating without rewriting anything above this interface.

/** What NEX asks a vision provider to do. Deliberately narrow · adapter-
 *  friendly. Providers may return null for capabilities they can't offer. */
export interface NexVisionRequest {
  imageBytes?: Buffer;
  imageUrl?: string;
  mimeType?: string;
  /** Optional hint about what NEX wants back. Providers may honour or ignore. */
  hint?: "concept" | "text" | "objects" | "any";
}

/** What NEX gets back. All fields optional · provider may return partial
 *  results. Consumers must never require any specific field. */
export interface NexVisionResponse {
  /** Provider identity captured for provenance · always populated. */
  provider: string;
  /** Provider version / model id if known · captured for audit. */
  providerVersion?: string;
  /** When the extraction happened. */
  extractedAt: string;
  /** Vision-derived observations · free-form list · never authoritative. */
  observations: NexVisionObservation[];
  /** Text detected in the image (if provider does OCR-like extraction). */
  detectedText?: string;
  /** Confidence 0-100 · provider's self-reported. */
  confidence?: number;
  /** Non-fatal errors · degraded-but-partial results are fine. */
  warnings?: string[];
}

export interface NexVisionObservation {
  kind: "object" | "text" | "color" | "attribute" | "concept";
  value: string;
  confidence?: number;
}

/** THE INTERFACE. Every NEX consumer talks to this · never to a specific
 *  provider directly. Adapters implement this. */
export interface NexVisionService {
  /** Provider identity · used in provenance. */
  readonly name: string;
  /** Analyse an image. Returns null if this provider cannot handle it ·
   *  consumer must degrade gracefully (fall back to description + OCR). */
  analyse(req: NexVisionRequest): Promise<NexVisionResponse | null>;
}
