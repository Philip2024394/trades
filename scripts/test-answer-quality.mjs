// Answer-quality regression suite · Philip 2026-08-01 (v2: failure classification 2026-08-02)
//
// Tests the WHOLE pipeline (not just intent routing):
//   input → intent → retrieval → answer characteristics → images
//
// Each test case declares:
//   - intent           expected AdvisorAction
//   - must_contain[]   phrases the answer MUST include (case-insensitive)
//   - must_not_contain phrases the answer MUST NOT include (case-insensitive)
//   - images           "required" | "forbidden" | "optional"
//   - min_vb_confidence  when images required · lowest acceptable match confidence
//   - notes            what the test is exercising
//
// v2 · Failure type classification (Philip 2026-08-02):
//   Each failure is tagged with WHY it failed so the report tells you what to fix.
//   Failure types map directly to fix actions:
//     MISSING_KNOWLEDGE   · no suitable article exists       → author new content
//     WEAK_RETRIEVAL      · better article exists · unpicked  → improve ranking/tags
//     INCOMPLETE_ANSWER   · article exists · missing detail   → expand article
//     WRONG_BUSINESS      · business policy outdated/absent  → update Business Brain
//     WRONG_VISUAL        · incorrect image attached          → improve Visual Brain
//     HALLUCINATION       · AI invented unsupported facts     → highest priority · orchestration
//     ROUTING_MISMATCH    · intent detector chose wrong path  → intent classifier fix
//
// Failures show WHAT the pipeline got wrong end-to-end · not just where.
// Gaps in the current library will surface as failing test cases · that IS
// the value · treat failing cases as editorial input, not test brittleness.

const BASE = "http://localhost:3008/api/nex/staircase-chat";

const cases = [
  // ─── Staircase dimensions (Philip's example) ───
  {
    id:               "dim-staircase-width",
    input:            "What is the standard staircase width?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer"],
    must_contain:     ["width"],
    must_not_contain: ["baserail", "spindle", "I don't know", "not something I'm built for"],
    images:           "optional",
    notes:            "Standard UK domestic staircase width query · answer must reference width · not stray to baserail",
  },
  {
    id:               "dim-staircase-length",
    input:            "What's the minimum staircase length?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer"],
    must_contain:     ["length"],
    must_not_contain: ["I don't know", "not something I'm built for"],
    images:           "optional",
    notes:            "Minimum length query · surfaces gap if library has no length article",
  },

  // ─── Business policy (Philip's example) ───
  {
    id:               "biz-payment-cash",
    input:            "Can I pay cash?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer", "boundary_handoff", "capability_question", "scope_redirect"],
    must_not_contain: ["I don't know", "not something I'm built for"],
    images:           "forbidden",
    notes:            "Payment policy query · must NOT scope-redirect · library needs Business Brain content",
  },
  {
    id:               "biz-lead-time",
    input:            "What are your average lead times?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer", "boundary_handoff"],
    must_not_contain: ["I don't know"],
    images:           "forbidden",
    notes:            "Lead time query · Business Brain gap",
  },
  {
    id:               "biz-quote-email",
    input:            "Do you email quotations?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer", "boundary_handoff"],
    must_not_contain: ["I don't know"],
    images:           "forbidden",
    notes:            "Quote delivery method · Business Brain gap",
  },
  {
    id:               "biz-installer-qualified",
    input:            "Are your installers qualified?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer", "boundary_handoff"],
    must_not_contain: ["I don't know"],
    images:           "forbidden",
    notes:            "Installer qualification · Business Brain gap",
  },

  // ─── Component terminology (existing knowledge · should pass) ───
  {
    id:               "term-newel",
    input:            "What is a newel?",
    intent:           ["truth_retrieval", "grounded_composition", "truth_answer"],
    must_contain:     ["newel"],
    must_not_contain: ["I don't know"],
    images:           "optional",
    notes:            "Newel definition · authored article exists · should pass",
  },
  {
    id:               "term-tread",
    input:            "What is a tread?",
    intent:           ["truth_retrieval", "grounded_composition", "truth_answer"],
    must_contain:     ["tread"],
    must_not_contain: ["I don't know"],
    images:           "optional",
    notes:            "Tread definition · authored article exists",
  },
  {
    id:               "term-spindle-vs-baluster",
    input:            "What is the difference between spindles and balusters?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer"],
    must_contain:     ["spindle", "baluster"],
    must_not_contain: ["I don't know", "not something I'm built for"],
    images:           "optional",
    notes:            "Terminology comparison · library may need explicit comparison article",
  },

  // ─── Material knowledge ───
  {
    id:               "mat-oak-source",
    input:            "Does your oak come from Europe?",
    intent:           ["grounded_composition", "truth_retrieval", "truth_answer"],
    must_contain:     ["oak"],
    must_not_contain: ["I don't know"],
    images:           "optional",
    notes:            "Oak sourcing · Business Brain gap",
  },

  // ─── Design retrieval (Visual Brain integration) ───
  {
    id:               "vis-oak-straight-flight",
    input:            "Show me an oak straight-flight staircase",
    intent:           ["grounded_composition"],
    must_not_contain: ["I don't know", "not something I'm built for", "I can't display images"],
    images:           "required",
    min_vb_confidence: 0.15,
    notes:            "Design retrieval · Visual Brain has oak straight-flight designs · must attach ≥1 image",
  },
  {
    id:               "vis-modern-staircase",
    input:            "Show me a modern staircase with glass balustrade",
    intent:           ["grounded_composition"],
    must_not_contain: ["I can't display images", "I don't know"],
    images:           "required",
    min_vb_confidence: 0.10,
    notes:            "Design retrieval · modern + glass · Visual Brain must attach",
  },

  // ─── Content gaps (should honestly say no) ───
  {
    id:               "gap-under-stair-storage-image",
    input:            "show me images of under-stair storage",
    intent:           ["grounded_composition", "truth_answer", "truth_retrieval"],
    must_contain:     ["storage"],
    must_not_contain: ["walnut", "spiral", "I can't display images"],
    images:           "forbidden",
    notes:            "Under-stair storage · library has no confirmed images · must NOT substitute unrelated designs · must NOT hallucinate ability",
  },

  // ─── Social & meta intents (validate answer quality, not just routing) ───
  {
    id:               "meta-thanks",
    input:            "Thank you very much",
    intent:           ["social_affection"],
    must_contain:     ["staircase"],  // response should tie back to Nex role
    images:           "forbidden",
    notes:            "Thanks acknowledgment · must reference staircase specialism · not just a generic 'you're welcome'",
  },
  {
    id:               "meta-boss",
    input:            "Can I speak to your boss?",
    intent:           ["escalation_request"],
    must_contain:     ["Nex", "Stairplan"],
    must_not_contain: ["new build", "renovation"],
    images:           "forbidden",
    notes:            "Escalation · must mention Nex Stairplan team · must NOT restart project qualification",
  },
];

// ─── Runner ──────────────────────────────────────────────────────
async function ask(message) {
  const conv = `aq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conv }),
  });
  return res.json();
}

function checkContains(text, phrases) {
  const lower = text.toLowerCase();
  const missing = phrases.filter((p) => !lower.includes(p.toLowerCase()));
  return { ok: missing.length === 0, missing };
}
function checkNotContains(text, phrases) {
  const lower = text.toLowerCase();
  const present = phrases.filter((p) => lower.includes(p.toLowerCase()));
  return { ok: present.length === 0, present };
}
function checkImages(vb, requirement, minConfidence) {
  if (requirement === "required") {
    if (!vb || vb.length === 0) return { ok: false, reason: "expected ≥1 image · got 0" };
    if (minConfidence && !vb.some((v) => v.confidence >= minConfidence)) {
      return { ok: false, reason: `all images below min_vb_confidence=${minConfidence} · top=${Math.max(...vb.map((v) => v.confidence)).toFixed(2)}` };
    }
    return { ok: true };
  }
  if (requirement === "forbidden") {
    if (vb && vb.length > 0) return { ok: false, reason: `expected 0 images · got ${vb.length}` };
    return { ok: true };
  }
  return { ok: true }; // optional
}

// ─── Failure classifier · Philip 2026-08-02 · v2 ────────────────
// Maps each failure to a fix action so the report tells you WHAT to work on.

const FIX_ACTIONS = {
  MISSING_KNOWLEDGE: "Author new content · Stage 1 raw notes → factory pipeline",
  WEAK_RETRIEVAL:    "Improve ranking / retrieval tags on existing article",
  INCOMPLETE_ANSWER: "Expand existing article to cover missing detail",
  WRONG_BUSINESS:    "Update Business Brain policy content",
  WRONG_VISUAL:      "Improve Visual Brain metadata / add missing designs",
  HALLUCINATION:     "Orchestration fix · highest priority · prompt or safety-net",
  ROUTING_MISMATCH:  "Intent classifier fix in social-intents / feedback / kitchen etc.",
};

function classifyFailure(action, failureMessage, testCase) {
  // Routing mismatch · intent was wrong
  if (failureMessage.startsWith("intent:")) return "ROUTING_MISMATCH";
  // Hallucination · answer contains banned image-referring phrases when no images attached
  if (/leaked.*I can'?t display images|leaked.*this image shows|leaked.*the gallery below/i.test(failureMessage)) {
    return "HALLUCINATION";
  }
  // Wrong visual · image required but none · OR wrong image content
  if (failureMessage.startsWith("images:") && testCase.images === "required") return "WRONG_VISUAL";
  if (failureMessage.startsWith("images:") && testCase.images === "forbidden") return "WRONG_VISUAL";
  // must_not_contain leak · content leaked in ("baserail" appearing when asking about width) = weak retrieval
  if (failureMessage.startsWith("must_not_contain leaked:")) return "WEAK_RETRIEVAL";
  // must_contain missing · answer lacked required term · could be missing knowledge OR incomplete
  if (failureMessage.startsWith("must_contain missing:")) {
    // If this is a business-domain test and the answer is generic → wrong_business
    if (/biz-|policy|payment|quote|lead|installer|showroom/i.test(testCase.id)) return "WRONG_BUSINESS";
    // If action is scope_redirect · then no knowledge existed → MISSING_KNOWLEDGE
    if (action === "scope_redirect" || action === "greeting") return "MISSING_KNOWLEDGE";
    // Otherwise the article exists but is incomplete
    return "INCOMPLETE_ANSWER";
  }
  return "MISSING_KNOWLEDGE";  // conservative default
}

(async () => {
  const results = [];
  for (const c of cases) {
    const j = await ask(c.input);
    const answer = String(j.answer ?? "");
    const action = j.advisor?.action ?? "(none)";
    const vb = j.visual_brain ?? [];

    const failures = [];
    if (Array.isArray(c.intent) ? !c.intent.includes(action) : c.intent !== action) {
      failures.push(`intent: expected ${JSON.stringify(c.intent)} got ${action}`);
    }
    if (c.must_contain) {
      const r = checkContains(answer, c.must_contain);
      if (!r.ok) failures.push(`must_contain missing: ${JSON.stringify(r.missing)}`);
    }
    if (c.must_not_contain) {
      const r = checkNotContains(answer, c.must_not_contain);
      if (!r.ok) failures.push(`must_not_contain leaked: ${JSON.stringify(r.present)}`);
    }
    if (c.images) {
      const r = checkImages(vb, c.images, c.min_vb_confidence);
      if (!r.ok) failures.push(`images: ${r.reason}`);
    }

    // Classify each failure so the report shows the fix action, not just the symptom.
    const classified = failures.map((f) => ({
      message: f,
      type:    classifyFailure(action, f, c),
    }));

    results.push({ id: c.id, notes: c.notes, action, vbCount: vb.length, answer: answer.slice(0, 140), failures: classified });
  }

  // ─── Report ───
  let passCount = 0;
  let failCount = 0;
  const typeCounts = {};
  for (const r of results) {
    const marker = r.failures.length === 0 ? "✓" : "✗";
    console.log(`${marker} ${r.id.padEnd(30)} · action=${r.action.padEnd(24)} · vb=${r.vbCount}`);
    if (r.failures.length > 0) {
      for (const f of r.failures) {
        console.log(`    · [${f.type}] ${f.message}`);
        typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
      }
      console.log(`    · answer: ${JSON.stringify(r.answer)}...`);
      console.log(`    · notes: ${r.notes}`);
      failCount += 1;
    } else {
      passCount += 1;
    }
  }
  console.log("\n" + "=".repeat(64));
  console.log(`ANSWER-QUALITY SUITE · ${passCount} pass · ${failCount} fail · ${results.length} tests`);
  console.log("=".repeat(64));

  if (Object.keys(typeCounts).length > 0) {
    console.log("\nFAILURE BREAKDOWN BY TYPE:");
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type.padEnd(20)} ${count}  · fix: ${FIX_ACTIONS[type]}`);
    }
  }

  console.log("");
  console.log("Failing cases are GAPS in the current library, not test brittleness.");
  console.log("Each failure is now tagged with its fix action · use the breakdown above to plan editorial or engineering work.");
})();
