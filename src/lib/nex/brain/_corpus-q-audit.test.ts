// src/lib/nex/brain/_corpus-q-audit.test.ts
//
// AUDIT-ONLY Corpus Q · Question / Request / Command language
// (Philip 2026-09-01).
//
// 200 sentences · never productionised as pattern lists.
//
// Constitutional focus of this corpus (Philip's exact contract):
//   Ordinary questions beginning with What / When / Where / How / Why /
//   Come / Can / Could MUST NOT be absorbed as refinement merely
//   because they contain words like `yang`, `more`, `nearest`,
//   `recommended`, `maximum`, `paling`, etc.
//
// Deliberate traps (Philip's explicit call-outs):
//   · "What size yang bener buat jacket ini?"           — question
//   · "Where is the nearest automated luggage storage locker?" — question
//   · "What menu option yang paling recommended di sini?" — question
//   · "What gym membership program yang pas buat gw?"   — question
//
// This audit runs the traps + a sample of the corpus through
// detectRefinement + detectAbandonment. It hard-asserts the traps
// fail-closed AND reports all false positives found in the sample.

import { describe, expect, it } from "vitest";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { extractEntities } from "./entities";

// ═══════════════════════════════════════════════════════════════════
// PART A · Philip's four EXPLICIT deliberate traps
// ═══════════════════════════════════════════════════════════════════

const PHILIP_EXPLICIT_TRAPS = [
  // Contains `yang` but is a question, not a refinement
  "What size yang bener buat jacket ini?",
  // Contains `nearest` but is a question, not a refinement
  "Where is the nearest automated luggage storage locker?",
  // Contains `yang paling` but is a question, not a refinement
  "What menu option yang paling recommended di sini?",
  // Contains `yang` but is a question, not a refinement
  "What gym membership program yang pas buat gw?",
];

describe("Corpus Q · Philip's explicit deliberate traps MUST NOT fire refinement", () => {
  it.each(PHILIP_EXPLICIT_TRAPS)("'%s' is a question, not refinement", (msg) => {
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART B · Interrogative-opener sample from Corpus Q
// ═══════════════════════════════════════════════════════════════════
//
// A representative subset of the 200-sentence Q corpus, chosen to
// stress-test the "question vs refinement" boundary. Contains
// sentences with the words that most commonly false-positive
// (yang / nearest / recommended / paling / lebih / official / direct
// / non-refundable / instant / cheaper / genuine / electric).

const CORPUS_Q_SAMPLE = [
  // Section 1 · commerce questions
  "What size yang bener buat jacket ini?",
  "When exactly promo gajiaannya start, admin?",
  "Where can I find the official store banner?",
  "How do I apply multiple voucher code sekaligus?",
  "Come drop physical tracking receipt-nya gih.",
  "Why is the live discount percentage dropped?",
  "What if koper-nya pas dateng defect?",
  "When does the clearance flash sale window close?",
  "Where is the courier pickup scanning point located?",
  "How can I request custom wrapping paper package?",
  "Come check the unboxing verification footage list.",
  "Why choose the marketplace instead of official brand?",
  "What criteria rating yang bikin merchant-nya trusted?",
  "When will the restock variant black arrive?",
  "Where should I upload the damage claim photos?",
  "How to cancel seasonal pre-order batch securely?",
  "Come here, liat cashback balance-ku mantap bgt.",
  "Why did the auto-reject refund resolution protocol trigger?",
  "What about bundling this item with extra freebies?",
  "When is the estimated sorting hub clearance timestamp?",
  // Section 2 · ride questions
  "What vehicle license plate is matched on app?",
  "When will the nearest driver accept my ride?",
  "Where is the precise lobby entrance pin location?",
  "How do I calculate emergency breakdown towing fees?",
  "Come closer to shelter drop-off section lane, pak.",
  "Why is the rainy season surge pricing crazy?",
  // Section 3 · hotel questions
  "What accommodation suite type yang masih kosong?",
  "When is the absolute latest checkout time window?",
  "Where can I claim the free cancellation voucher?",
  "How do I split payment invoice manually later?",
  "Come to the front desk counter queue row.",
  "Why are there hidden local service tax charges?",
  "What features are included in staycation package deal?",
  "When does the infinity pool renovation phase complete?",
  "Where can I verify my identity via passport?",
  "How to handle delayed room readiness error protocol?",
  "Come check out the glamping resort campsite area.",
  "Why are the non-refundable cancellation terms so rigid?",
  "Where is the nearest automated luggage storage locker?",     // trap
  "How can I apply credit card installment 0%?",
  // Section 4 · restaurant questions
  "What menu option yang paling recommended di sini?",           // trap
  "When is our exact table booking slot window?",
  "Where can I find authentic local street food?",
  "How do I split the dining check itemized?",
  "Come taste the chef recommendation special dish now.",
  "Why did they add unexpected fine-dining corkage fee?",
  "What if the automated food ordering screen glitched?",
  "When does the rooftop bar close last order?",
  "Where is the restaurant halal validation document pinned?",
  "How to apply the digital platform reservation coupon?",
  // Section 5 · office questions
  "What task backlog item yang priority-nya high?",
  "When is the server cluster technical deployment window?",
  "Where can I locate the shared spreadsheet link?",
  "How to clear configuration caching telemetry logs fast?",
  "Come review the corporate expense auditing schema grids.",
  "Why is the data extraction utility timeline looping?",
  // Section 6 · gym/travel questions
  "What gym membership program yang pas buat gw?",               // trap
  "When does our flight schedule window configuration open?",
  "Where can I find high-protein meal preparation kits?",
  "How do I adjust automatic biometrics sensor tracking?",
  "Come check your custom weight training posture alignment.",
  "Why is my body fat tracking algorithm inaccurate?",
  "Where can I locate the nearest crossfit station?",            // suspected fp
  "What if the passport validation sequence lookup times out?",
];

// ═══════════════════════════════════════════════════════════════════
// PART B.1 · Regression pins per Philip's "BOTH sentence + neighbour"
//            contract. For every DEFECT sentence, the NEIGHBOUR must
//            still fire refinement (guard is scoped to interrogative
//            openers, not to the refinement vocabulary itself).
// ═══════════════════════════════════════════════════════════════════

const DEFECT_PLUS_NEIGHBOUR: Array<{ defect: string; neighbour: string; family: string }> = [
  {
    defect:    "Where is the nearest automated luggage storage locker?",
    neighbour: "the nearest one",
    family:    "require",
  },
  {
    defect:    "Where can I locate the nearest crossfit station?",
    neighbour: "the nearest",
    family:    "require",
  },
  {
    defect:    "When will the nearest driver accept my ride?",
    neighbour: "yang nearest",
    family:    "require",
  },
  {
    defect:    "Where can I find the official store banner?",
    neighbour: "yang official store aja",
    family:    "require",
  },
  {
    defect:    "Why are the non-refundable cancellation terms so rigid?",
    neighbour: "yang non-refundable",
    family:    "require",
  },
  {
    defect:    "What menu option yang paling recommended di sini?",
    neighbour: "yang paling recommended",
    family:    "comparative",
  },
];

describe("Corpus Q defect + neighbour · question fails-closed but statement still fires", () => {
  it.each(DEFECT_PLUS_NEIGHBOUR)("defect '$defect' → no refinement · neighbour '$neighbour' → refinement/$family", ({ defect, neighbour, family }) => {
    // Defect (question form) must NOT fire
    expect(detectRefinement(defect).matched).toBe(false);
    // Neighbour (statement form) MUST still fire
    const rn = detectRefinement(neighbour);
    expect(rn.matched).toBe(true);
    if (rn.matched) expect(rn.family).toBe(family);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART B.2 · Extra guard-preservation pins
// ═══════════════════════════════════════════════════════════════════
//
// Ensure the interrogative-opener guard does NOT block legitimate
// imperative-form refinement requests like "show me yang cheaper".

describe("Corpus Q guard · imperative-form refinements still fire", () => {
  it.each([
    ["show me yang cheaper",       "comparative"],
    ["show me the cheaper one",    "comparative"],
    ["tell me yang paling murah",  "comparative"],
    ["give me yang direct flight", "require"],
    ["I want yang recommended",    "require"],
  ])("'%s' still fires refinement / %s (imperative ≠ interrogative)", (msg, family) => {
    const r = detectRefinement(msg);
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.family).toBe(family);
  });
});

describe("Corpus Q · interrogative-opener sample · reports false positives", () => {
  it("no question sentence fires refinement or abandonment (hard assertion)", () => {
    const fireList: Array<{ sentence: string; kind: string; family?: string }> = [];
    for (const s of CORPUS_Q_SAMPLE) {
      const ab = detectAbandonment(s);
      const rf = detectRefinement(s);
      if (ab.matched) fireList.push({ sentence: s, kind: "abandonment" });
      if (rf.matched) fireList.push({ sentence: s, kind: "refinement", family: rf.family });
    }

    // Print report before assertion
    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  CORPUS Q · Question/Request/Command · Audit-Only Report");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`Sample size: ${CORPUS_Q_SAMPLE.length}`);
    lines.push(`False positives (refinement or abandonment): ${fireList.length}`);
    if (fireList.length > 0) {
      lines.push("");
      lines.push("⚠ FALSE POSITIVES:");
      for (const f of fireList) {
        const tag = f.family ? `${f.kind}/${f.family}` : f.kind;
        lines.push(`   [${tag.padEnd(28)}] "${f.sentence}"`);
      }
    }
    lines.push("═════════════════════════════════════════════════════════════════════");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    expect(fireList.length).toBe(0);
  });
});
