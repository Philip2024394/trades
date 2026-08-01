// Newel Brain quality test · Philip 2026-08-02
//
// Tests the 5 categories Philip specified: Basic · Design · Engineering · Business · Visual.
// Each test case also reports the specific evidence path (which knowledge article(s) the answer
// drew from) so Philip can trace every answer back to its source — that's the citation/evidence
// path check he flagged.

const BASE = "http://localhost:3008/api/nex/staircase-chat";

const cases = [
  // ─── Basic knowledge ───
  { cat: "Basic",       q: "What is a newel post?",                                    contains: ["newel"],     hint: "should describe structural + architectural role" },
  { cat: "Basic",       q: "What is the purpose of a newel?",                          contains: ["support", "handrail"] },
  { cat: "Basic",       q: "How many types of newel are there?",                       must_not_contain: ["12 types", "10 types", "8 types", "9 types"], hint: "should NOT invent a fake fixed number" },

  // ─── Design ───
  { cat: "Design",      q: "Which newel suits a modern oak staircase?",                contains: ["square"] },
  { cat: "Design",      q: "What size newel for a luxury staircase?",                  contains: ["120"] },
  { cat: "Design",      q: "Difference between square and turned newels?",             contains: ["square", "turned"] },

  // ─── Engineering ───
  { cat: "Engineering", q: "Why does my newel wobble?",                                contains: ["fixing"], hint: "should trace to fixing/installation failure content" },
  { cat: "Engineering", q: "How are newels fixed?",                                    contains: ["bolt", "screw"] },
  { cat: "Engineering", q: "Can a newel support glass?",                               contains: ["glass"] },

  // ─── Business ───
  { cat: "Business",    q: "Why are some newels expensive?",                           contains: ["timber", "material"] },
  { cat: "Business",    q: "Can I buy replacement newels?",                            contains: ["replace"] },

  // ─── Sizes (Philip flagged this as needing coverage) ───
  { cat: "Sizes",       q: "What size wood newel post?",                               contains: ["mm"], hint: "specific gap Philip flagged · answer must include actual dimensions like 90mm, 100mm etc" },
  { cat: "Sizes",       q: "How tall should a newel post be?",                         contains: ["mm"], hint: "should reference finished-floor height range" },

  // ─── Visual (Visual Brain integration) ───
  { cat: "Visual",      q: "Show me oak newels",                                       imgs_ok: true, hint: "should retrieve Visual Brain images if any oak newel designs are confirmed" },
];

async function ask(message) {
  const conv = `nb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: conv }),
  });
  return res.json();
}

function isNewelSource(id) {
  return /newel/i.test(id);
}

(async () => {
  const byCat = {};
  const evidencePath = [];
  for (const c of cases) {
    const j = await ask(c.q);
    const answer = String(j.answer || "");
    const lower = answer.toLowerCase();
    const action = j.advisor?.action || "(none)";
    const vb = j.visual_brain || [];
    const citations = j.citations || [];
    const newelCitations = citations.filter((c) => isNewelSource(c.ref_id || c.source || ""));

    // Verdict
    const failures = [];
    if (c.contains) {
      const missing = c.contains.filter((p) => !lower.includes(p.toLowerCase()));
      if (missing.length > 0) failures.push(`missing: ${JSON.stringify(missing)}`);
    }
    if (c.must_not_contain) {
      const leaks = c.must_not_contain.filter((p) => lower.includes(p.toLowerCase()));
      if (leaks.length > 0) failures.push(`leaked: ${JSON.stringify(leaks)}`);
    }
    // Consider it "answered from newel corpus" if any citation source contains "newel"
    // OR if the answer text visibly draws on the newel taxonomy
    const answeredFromNewel = newelCitations.length > 0 || /\b(newel|balustrade|baluster|handrail)\b/i.test(answer);

    const verdict = failures.length === 0 && answeredFromNewel;
    (byCat[c.cat] ??= { pass: 0, fail: 0 })[verdict ? "pass" : "fail"] += 1;

    console.log(`${verdict ? "✓" : "✗"} [${c.cat}] "${c.q}"`);
    console.log(`   action=${action} · citations=${citations.length} · newel-sourced=${newelCitations.length} · vb=${vb.length}`);
    if (failures.length) console.log(`   ${failures.join(" · ")}`);
    console.log(`   answer: "${answer.slice(0, 180)}..."`);

    evidencePath.push({
      q:               c.q,
      cat:             c.cat,
      action,
      citations:       citations.map((c) => c.ref_id || c.source || "").slice(0, 5),
      newel_citations: newelCitations.length,
    });
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("NEWEL BRAIN QUALITY TEST · Category breakdown");
  console.log("=".repeat(60));
  for (const [cat, tally] of Object.entries(byCat)) {
    const total = tally.pass + tally.fail;
    console.log(`  ${cat.padEnd(14)} ${tally.pass}/${total}`);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("CITATION / EVIDENCE PATH · which articles produced answers?");
  console.log("=".repeat(60));
  const articleHits = {};
  for (const e of evidencePath) {
    for (const c of e.citations) {
      const filename = String(c).split(/[\\/]/).pop() || c;
      articleHits[filename] = (articleHits[filename] || 0) + 1;
    }
  }
  for (const [file, count] of Object.entries(articleHits).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${count}x  ${file}`);
  }
})();
