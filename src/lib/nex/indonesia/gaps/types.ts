// NEX Indonesia · Knowledge-gap types.
//
// Turns "NEX couldn't answer that" into structured acquisition work.
//
// Loop the user described (Philip 2026-08-30):
//
//   USER → QUESTION → RETRIEVAL → INSUFFICIENT EVIDENCE →
//   KNOWLEDGE_GAP → PRIORITY SCORE → ACQUISITION QUEUE →
//   WALKER → NEW EVIDENCE → ENTITY RECORD → NEX KNOWS IT NEXT TIME
//
// The KnowledgeGap is the durable record of "we should learn this."
// One question from one user creates one Gap. Repeated identical (or
// semantically-clustered) questions BUMP the frequency of the same
// Gap — priority scales with how many users hit it. When a walker
// eventually produces new evidence and the retrieval starts
// answering the question, the Gap is marked RESOLVED with the
// evidence attached.

export type GapStatus =
  | "OPEN"          // detected · no acquisition scheduled yet
  | "QUEUED"        // handed to the acquisition queue
  | "IN_PROGRESS"   // a walker is actively acquiring
  | "PARTIALLY_RESOLVED" // some evidence gathered · still below threshold
  | "RESOLVED"      // evidence now sufficient · answer becomes possible
  | "DEFERRED"      // deliberately not pursued (out of scope / infeasible)
  | "STALE";        // was open but no acquisition activity in N days

export type KnowledgeGap = {
  /** Stable ID · hash of intent + normalised subject. Same question
   *  reported twice bumps frequency instead of creating a duplicate. */
  id: string;
  /** Intent bucket the classifier assigned. */
  intent: string;
  /** What NEX was trying to answer, in normalised form. */
  normalisedQuery: string;
  /** Original raw user query (last-seen · we don't retain all). */
  lastRawQuery: string;
  /** Which walkers/domains SHOULD be able to answer this if they had data. */
  suggestedWalkers: string[];
  /** Geographic scope · region or province slug when applicable. */
  scope?: string;
  /** Number of distinct sessions that hit this gap. */
  frequency: number;
  /** ISO date · first time this gap was detected. */
  firstSeenAt: string;
  /** ISO date · most recent time this gap was hit. */
  lastSeenAt: string;
  /** Which retrieval result made us classify this as a gap. */
  reason:
    | "no_hits"                 // retrieval returned nothing
    | "low_confidence"          // hits below confidence threshold
    | "stale_only"              // only stale records matched
    | "requires_live"           // asks for live data we don't have
    | "requires_service"        // asks about a service/entity outside scope
    | "user_marked_unhelpful";  // future · user thumbs-down
  /** How this gap should be prioritised. Higher = more urgent. */
  priority: number;
  status: GapStatus;
  /** ISO date · when the gap moved to its current status. */
  statusChangedAt: string;
  /** Evidence collected while trying to resolve. */
  evidenceRefs: string[];
};

export type GapObservation = {
  intent: string;
  rawQuery: string;
  reason: KnowledgeGap["reason"];
  scope?: string;
  suggestedWalkers?: string[];
};

export type GapRegistrySnapshot = {
  schemaVersion: number;
  updatedAt: string;
  gaps: KnowledgeGap[];
};
