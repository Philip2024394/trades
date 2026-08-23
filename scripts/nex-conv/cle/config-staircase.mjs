// NEX Conversation Learning Engine · staircase brain config.
//
// One config file per domain · NEVER a separate codebase per domain
// (Universal-engine anti-pattern per pinned doctrine).
//
// Doctrine anchors:
//   · project_nex_conversation_learning_engine_2026_08_21 (CLE placement)
//   · project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//     (universal engine per domain config · never fork)
//
// This is the first CLE config · shipped alongside the smoke test. Restaurant/
// Hotel/Taxi/Food-delivery/Trades attach as sibling config files later. All
// consume the same CLE cycle framework (detect · generate · score · store).

export const staircaseCleConfig = {
  brain: "staircase_brain",
  displayName: "Staircase (trades vertical)",

  // Concept vocabulary (existing staircase brain · already seeded in
  // nex.conv_intents + nex.conv_entities via ADR-0044 ingestion). CLE reads
  // this to know what the domain is "about" for weakness classification.
  conceptVocabulary: [
    "material",       // oak · walnut · glass · steel
    "style",          // modern · traditional · industrial · rustic
    "component",      // handrail · balustrade · newel · tread
    "regulation",     // building-regs · fire-safety
    "price_dimension",// per-metre · flat-quote · design-fee
    "location",       // installer-region · showroom
    "service",        // survey · install · design
  ],

  // Weakness detector thresholds · tuned per domain (staircase has ~178 turns
  // and long clarification sequences · thresholds reflect that).
  detectors: {
    daysBack: 30,
    minSignalEvidence: 2,           // need >=2 conversations for a signal to fire
    highLatencyMs: 8000,            // turns > 8s = investigate
    lowConfidenceRetrievalGap: true,// turns with empty used_item_ids = signal
    repeatedTextWindowSec: 300,     // same customer text within 5min in same convo
  },

  // Candidate generator strategies enabled for this domain. Each strategy
  // maps a weakness kind to a candidate-payload generator. Smoke ships two.
  candidateStrategies: [
    "add_clarification_ki",   // unknown-intent turns → new draft KI proposing an intent example
    "add_intent_example",     // empty-retrieval turns → add a training example to an existing intent
  ],

  // Score thresholds · must clear to become "ready for review" (admin promote)
  scoreThresholds: {
    promotionFloor: 0.70,           // heuristic score floor for smoke
    regressionMarginRequired: 0.05, // full-eval future gate
    languageNeutralityRequired: true,
    doctrinePassRequired: true,
  },

  // Kill switch (mirrors acquisition machine · always-check pattern).
  killSwitchEngaged: false,
};
