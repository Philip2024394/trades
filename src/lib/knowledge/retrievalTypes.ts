// AI Retrieval Architecture — types.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Every LLM query on our platform gets retrieval-first context. The
// LLM is not free to invent — it's given a bounded set of cited nodes
// from the Knowledge Graph and asked to answer using them.
//
// Retrieval order is strict + deterministic:
//   1. Merchant   — this specific merchant's credentials, coverage,
//                   published blueprint, brand
//   2. Package    — their Knowledge Package's services, FAQs, workflow,
//                   extensions (matches their trade)
//   3. Domain     — horizontal Domain contracts, compliance sources,
//                   AI hooks
//   4. Global     — cross-cutting patterns (not yet implemented — Stage
//                   6+ marketplace-contributed knowledge)
//
// Every RetrievalNode carries a citation. Never a bare fact.

/** Which layer of the Knowledge Graph a retrieval node came from.
 *  Consumers can attribute + weight by layer (merchant > package >
 *  domain > global for personalisation). */
export type RetrievalLayer = "merchant" | "package" | "domain" | "global";

/** Semantic type of a retrieval node. Consumers filter by type when
 *  the query is narrow ("only compliance", "only FAQs"). */
export type RetrievalNodeType =
  // Domain layer
  | "domain-capability"
  | "domain-entity"
  | "domain-ai-hook"
  | "domain-integration"
  | "domain-compliance"
  // Package layer (inherited + extension)
  | "package-service"
  | "package-customer-type"
  | "package-workflow-step"
  | "package-faq"
  | "package-extension-hook"
  | "package-extension-compliance"
  // Merchant layer
  | "merchant-credential"
  | "merchant-coverage"
  | "merchant-blueprint";

/** Every node returned from the retriever. `content` is the actual
 *  text the LLM will see; `source` is the citation string the LLM
 *  MUST include when using this node. */
export type RetrievalNode = {
  /** Stable id — `<layer>.<type>.<localId>`. Deterministic so tests
   *  can assert on retrieval sets. */
  id: string;
  layer: RetrievalLayer;
  type: RetrievalNodeType;
  title: string;
  content: string;
  /** Citation the LLM cites when referencing this node. External
   *  facts get a URL; internal facts get "internal:<path>". */
  citation: string;
  /** Lexical keywords for scoring. Optional. */
  keywords?: string[];
  /** Assigned by the retriever after scoring — 0..1. */
  score?: number;
};

/** Input to the retriever. `intent` is the raw user question or
 *  system-generated task description. `keywords` are optional pre-
 *  extracted terms that boost matching. */
export type RetrievalQuery = {
  intent: string;
  keywords?: string[];
  /** Narrow to a subset of node types. Empty = all types. */
  types?: RetrievalNodeType[];
  /** Cap on nodes returned. Default 12. */
  maxResults?: number;
};

/** Merchant-specific context passed in by the caller. The API layer
 *  loads these from the DB and hands them to the retriever — the
 *  retriever itself is a pure function so it stays testable + fast. */
export type MerchantContext = {
  tradeSlug: string;
  brandName?: string;
  city?: string;
  coveragePostcode?: string | null;
  coverageRadiusMi?: number | null;
  heldCredentials?: Array<{
    scheme: string;
    status: string;
    number: string;
    displayLabel?: string | null;
  }>;
  publishedBlueprintSlug?: string | null;
};

/** Result shape. Consumers pipe `nodes` into their LLM prompt. */
export type RetrievalResult = {
  nodes: RetrievalNode[];
  meta: {
    layersUsed: RetrievalLayer[];
    totalCandidates: number;
    /** Deduped citation list — the LLM can be told "cite from these
     *  exactly". */
    citedSources: string[];
  };
};
