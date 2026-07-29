#!/usr/bin/env node
// consolidate-refacing-lighting-evidence.mjs
//
// Master deliverable consolidator for the Refacing & Lighting research
// sprint (Philip 2026-07-28). Reads all evidence JSON files produced by
// the 5 research agents and emits the deliverables Philip specified:
//
//   1. MASTER_EVIDENCE_REPORT.md      — aggregate summary + counts
//   2. SOURCE_LIBRARY.json            — deduplicated sources
//   3. GAP_ANALYSIS.md                — expert_experience_required + unable_to_verify
//   4. CONTRADICTION_REPORT.md        — every conflicting_opinions entry
//   5. EXPERT_INTERVIEW_QUESTIONS.md  — from expert_experience_required + Section 13
//   6. HOMEOWNER_FAQ_LIST.md          — questions + misconceptions per audience
//   7. JOINER_FAQ_LIST.md
//   8. MANUFACTURER_FAQ_LIST.md
//   9. TERMINOLOGY_GLOSSARY.md        — any terminology discovered
//  10. TOPICS_CLASSIFICATION.md       — direct-authorable vs expert-required
//
// Governance:
//   · Zero brain content authored · this script only READS the evidence
//     files and RESHAPES them into deliverables.
//   · Every extracted string traces back to a specific agent's evidence
//     entry via a citation footprint (agent · section · topic).
//
// Zero dependencies · Node built-ins only.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";

const EV_DIR = resolve(process.cwd(), "data/nex-reference-brains/staircase-preparation/refacing_and_lighting_evidence");

if (!existsSync(EV_DIR)) {
  console.error("Evidence directory not found:", EV_DIR);
  process.exit(1);
}

// ---------- Load all evidence files ----------

const files = readdirSync(EV_DIR).filter(f => f.endsWith(".json") && !f.startsWith("SOURCE_LIBRARY"));
const bundles = files.map(f => {
  try {
    return { file: f, data: JSON.parse(readFileSync(join(EV_DIR, f), "utf-8")) };
  } catch (err) {
    console.warn("Skipping unreadable:", f, err.message);
    return null;
  }
}).filter(Boolean);

console.log(`Loaded ${bundles.length} evidence file(s):`);
for (const b of bundles) console.log(`  · ${b.file}`);

// ---------- Extractors ----------

// Walk any object looking for "topic-like" nodes (an object with sources
// or classification or summary field). Yields { path, node }.
function* walkTopics(root, pathParts = []) {
  if (!root || typeof root !== "object") return;
  if (Array.isArray(root)) return; // skip pure arrays

  const isTopic =
    ("summary" in root) ||
    ("classification" in root) ||
    ("sources" in root && Array.isArray(root.sources));

  if (isTopic && pathParts.length > 0) {
    yield { path: pathParts, node: root };
  }

  for (const [k, v] of Object.entries(root)) {
    if (k.startsWith("_")) continue;
    if (v && typeof v === "object") {
      yield* walkTopics(v, [...pathParts, k]);
    }
  }
}

// ---------- Deduplication ----------

const sourceLibrary = new Map(); // key: source_id or URL · value: canonical entry
function normaliseSource(s, provenance) {
  if (!s || typeof s !== "object") return null;
  const key = s.source_id ?? s.url ?? s.source_name;
  if (!key) return null;
  const existing = sourceLibrary.get(key);
  if (existing) {
    // Merge: keep verified over requires_manual_verification, keep first URL if present
    if (s.verification_status === "verified" && existing.verification_status !== "verified") {
      existing.verification_status = "verified";
    }
    if (!existing.url && s.url) existing.url = s.url;
    existing.cited_from.add(provenance);
    return existing;
  }
  const entry = {
    source_id: s.source_id ?? key,
    source_name: s.source_name ?? key,
    url: s.url ?? null,
    verification_status: s.verification_status ?? "unknown",
    cited_from: new Set([provenance]),
  };
  sourceLibrary.set(key, entry);
  return entry;
}

// ---------- Consolidate ----------

const allTopics = []; // { agent, section, topic, path, summary, classification, confidence_score, sources, conflicts[], experts[], misconceptions[], related[] }

for (const b of bundles) {
  const agentName = b.data._meta?.agent ?? basename(b.file, ".json");
  for (const { path, node } of walkTopics(b.data)) {
    const section = path[0] ?? "unknown";
    const topic = path.slice(1).join(".") || path[0];
    const provenance = `${agentName}::${path.join(".")}`;

    // Normalise sources
    const sources = Array.isArray(node.sources)
      ? node.sources.map(s => normaliseSource(s, provenance)).filter(Boolean)
      : [];

    allTopics.push({
      agent: agentName,
      section,
      topic,
      path: path.join("."),
      summary: node.summary ?? null,
      classification: node.classification ?? node.status ?? "unknown",
      confidence_score: typeof node.confidence_score === "number" ? node.confidence_score : null,
      sources_count: sources.length,
      conflicts: node.conflicting_opinions ?? [],
      experts: node.expert_experience_required ?? [],
      misconceptions: node.homeowner_misconceptions ?? [],
      related: node.related_topics ?? [],
      // Section 13 special: suggested_interview_questions_for_certified_experts
      interview_questions: node.suggested_interview_questions_for_certified_experts ?? [],
      why_expert_required: node.why_expert_required ?? null,
    });
  }
}

console.log(`\nExtracted ${allTopics.length} topic entries · ${sourceLibrary.size} unique sources`);

// ---------- Deliverable 1: MASTER_EVIDENCE_REPORT.md ----------

function writeMaster() {
  const byClass = allTopics.reduce((m, t) => {
    const k = t.classification ?? "unknown";
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  const bySection = allTopics.reduce((m, t) => {
    m[t.section] = (m[t.section] ?? 0) + 1;
    return m;
  }, {});
  const avgConf = allTopics
    .filter(t => typeof t.confidence_score === "number")
    .reduce((sum, t, _, arr) => sum + t.confidence_score / arr.length, 0);

  const lines = [];
  lines.push("# Refacing & Lighting Evidence · Master Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Sprint:** Philip 2026-07-28 · 14 sections · ~277 topics targeted`);
  lines.push(`**Governance:** Layer 1 evidence only · zero brain content authored`);
  lines.push("");
  lines.push("## Aggregate metrics");
  lines.push("");
  lines.push(`- **Total topic entries extracted:** ${allTopics.length}`);
  lines.push(`- **Unique sources catalogued:** ${sourceLibrary.size}`);
  lines.push(`- **Avg confidence score:** ${avgConf.toFixed(2)}`);
  lines.push(`- **Total conflicting_opinions flagged:** ${allTopics.reduce((s, t) => s + t.conflicts.length, 0)}`);
  lines.push(`- **Total expert_experience_required flags:** ${allTopics.reduce((s, t) => s + t.experts.length, 0)}`);
  lines.push(`- **Total homeowner_misconceptions flagged:** ${allTopics.reduce((s, t) => s + t.misconceptions.length, 0)}`);
  lines.push("");
  lines.push("## Classification breakdown");
  lines.push("");
  lines.push("| Classification | Count |");
  lines.push("|---|---:|");
  for (const [k, v] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");
  lines.push("## Topics per section");
  lines.push("");
  lines.push("| Section | Topics |");
  lines.push("|---|---:|");
  for (const [k, v] of Object.entries(bySection).sort()) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");
  lines.push("## Deliverable files produced");
  lines.push("");
  lines.push("- `MASTER_EVIDENCE_REPORT.md` — this file");
  lines.push("- `SOURCE_LIBRARY.json` — deduplicated source catalogue");
  lines.push("- `GAP_ANALYSIS.md` — expert_experience_required + unable_to_verify + thin coverage");
  lines.push("- `CONTRADICTION_REPORT.md` — every conflicting_opinions entry with provenance");
  lines.push("- `EXPERT_INTERVIEW_QUESTIONS.md` — questions for certified experts to answer");
  lines.push("- `HOMEOWNER_FAQ_LIST.md` — homeowner-facing questions + misconception refuters");
  lines.push("- `JOINER_FAQ_LIST.md` — joiner-facing questions");
  lines.push("- `MANUFACTURER_FAQ_LIST.md` — manufacturer-facing questions");
  lines.push("- `TERMINOLOGY_GLOSSARY.md` — terminology discovered across sections");
  lines.push("- `TOPICS_CLASSIFICATION.md` — direct-authorable vs expert-required split");
  lines.push("");
  lines.push("## Next legitimate step");
  lines.push("");
  lines.push("Certified experts open these deliverables and use them as scaffolding to author brain content. Zero AI-authored trade knowledge enters the brain. Every expert-authored entry cites the sources in `SOURCE_LIBRARY.json`.");

  writeFileSync(join(EV_DIR, "MASTER_EVIDENCE_REPORT.md"), lines.join("\n"), "utf-8");
}

// ---------- Deliverable 2: SOURCE_LIBRARY.json ----------

function writeSourceLibrary() {
  const arr = Array.from(sourceLibrary.values()).map(s => ({
    ...s,
    cited_from: Array.from(s.cited_from),
  })).sort((a, b) => {
    // verified first, then by name
    if (a.verification_status === "verified" && b.verification_status !== "verified") return -1;
    if (a.verification_status !== "verified" && b.verification_status === "verified") return 1;
    return (a.source_name || "").localeCompare(b.source_name || "");
  });
  const out = {
    _meta: {
      purpose: "Deduplicated source library across all Refacing & Lighting evidence agents",
      generated: new Date().toISOString(),
      total_sources: arr.length,
      verified: arr.filter(s => s.verification_status === "verified").length,
      requires_manual_verification: arr.filter(s => s.verification_status === "requires_manual_verification").length,
      other: arr.filter(s => !["verified", "requires_manual_verification"].includes(s.verification_status)).length,
    },
    sources: arr,
  };
  writeFileSync(join(EV_DIR, "SOURCE_LIBRARY.json"), JSON.stringify(out, null, 2), "utf-8");
}

// ---------- Deliverable 3: GAP_ANALYSIS.md ----------

function writeGapAnalysis() {
  const lines = [];
  lines.push("# Gap Analysis · Refacing & Lighting Evidence Sprint");
  lines.push("");
  lines.push("Topics where authoritative published sources are thin or absent · expert experience needed to fill.");
  lines.push("");
  const byClass = {
    expert_experience_required: allTopics.filter(t => (t.classification || "").includes("expert")),
    unable_to_verify: allTopics.filter(t => (t.classification || "").includes("unable_to_verify")),
    requires_manual_verification: allTopics.filter(t => (t.classification || "").includes("requires_manual_verification")),
  };
  for (const [cls, list] of Object.entries(byClass)) {
    lines.push(`## ${cls} (${list.length})`);
    lines.push("");
    for (const t of list.slice(0, 100)) {
      lines.push(`### ${t.section} · ${t.topic}`);
      if (t.summary) lines.push(`> ${t.summary.slice(0, 240)}${t.summary.length > 240 ? "…" : ""}`);
      if (t.experts && t.experts.length > 0) {
        lines.push("");
        lines.push("**Expert experience required:**");
        for (const e of t.experts) lines.push(`- ${e}`);
      }
      if (t.why_expert_required) {
        lines.push("");
        lines.push(`**Why expert required:** ${t.why_expert_required}`);
      }
      lines.push("");
    }
    if (list.length > 100) lines.push(`… and ${list.length - 100} more`);
    lines.push("");
  }
  writeFileSync(join(EV_DIR, "GAP_ANALYSIS.md"), lines.join("\n"), "utf-8");
}

// ---------- Deliverable 4: CONTRADICTION_REPORT.md ----------

function writeContradictions() {
  const lines = [];
  lines.push("# Contradiction Report · Refacing & Lighting Evidence Sprint");
  lines.push("");
  lines.push("Every `conflicting_opinions` entry captured across all 5 agents · with provenance.");
  lines.push("");
  const withConflicts = allTopics.filter(t => t.conflicts.length > 0);
  lines.push(`**Total topics with conflicts:** ${withConflicts.length}`);
  lines.push(`**Total individual conflicts:** ${withConflicts.reduce((s, t) => s + t.conflicts.length, 0)}`);
  lines.push("");
  for (const t of withConflicts) {
    lines.push(`## ${t.section} · ${t.topic}`);
    lines.push(`_(from ${t.agent})_`);
    lines.push("");
    for (const c of t.conflicts) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }
  writeFileSync(join(EV_DIR, "CONTRADICTION_REPORT.md"), lines.join("\n"), "utf-8");
}

// ---------- Deliverable 5: EXPERT_INTERVIEW_QUESTIONS.md ----------

function writeInterviewQuestions() {
  const lines = [];
  lines.push("# Expert Interview Questions");
  lines.push("");
  lines.push("Questions for certified staircase experts to answer, drawn from every `expert_experience_required` flag + Section 13 trade-experience areas.");
  lines.push("");
  lines.push("**Use these questions in structured expert interviews. Answers become citable `origin_type: named_expert` content (Rule C).**");
  lines.push("");
  const withInterview = allTopics.filter(t => t.interview_questions.length > 0 || t.experts.length > 0);
  for (const t of withInterview) {
    lines.push(`## ${t.section} · ${t.topic}`);
    lines.push("");
    if (t.why_expert_required) {
      lines.push(`*${t.why_expert_required}*`);
      lines.push("");
    }
    if (t.interview_questions.length > 0) {
      for (const q of t.interview_questions) lines.push(`- ${q}`);
    } else if (t.experts.length > 0) {
      lines.push("**Craft-knowledge areas needing expert input:**");
      for (const e of t.experts) lines.push(`- ${e}`);
    }
    lines.push("");
  }
  writeFileSync(join(EV_DIR, "EXPERT_INTERVIEW_QUESTIONS.md"), lines.join("\n"), "utf-8");
}

// ---------- Deliverable 6, 7, 8: FAQ lists by audience ----------

function writeFAQ(audience, path, sectionFilter, extractor) {
  const lines = [];
  lines.push(`# ${audience} FAQ List · Refacing & Lighting`);
  lines.push("");
  lines.push(`Questions ${audience.toLowerCase()}s are likely to ask · drawn from evidence sprint · with published source coverage where available.`);
  lines.push("");
  const relevant = allTopics.filter(sectionFilter);
  for (const t of relevant) {
    const extracted = extractor(t);
    if (!extracted || extracted.length === 0) continue;
    lines.push(`## ${t.section} · ${t.topic}`);
    lines.push("");
    for (const item of extracted) lines.push(`- ${item}`);
    lines.push("");
  }
  writeFileSync(join(EV_DIR, path), lines.join("\n"), "utf-8");
}

// ---------- Deliverable 9: TERMINOLOGY_GLOSSARY.md ----------

function writeTerminology() {
  const lines = [];
  lines.push("# Terminology Glossary · Refacing & Lighting");
  lines.push("");
  lines.push("Terms encountered across evidence · brief topic-level descriptions of what sources discuss (NOT formal definitions).");
  lines.push("");
  lines.push("**Note:** Formal definitions require certified expert authoring. This glossary maps terms to source coverage only.");
  lines.push("");
  // Extract topics whose path implies a term (materials, styles, elements, techniques)
  const terminologyPaths = allTopics.filter(t =>
    /section_[234]|materials|styles|elements|components/i.test(t.section) ||
    /(^|_)(oak|ash|walnut|beech|maple|pine|sapele|tulipwood|mdf|veneered|engineered|hardwood|laminate|vinyl|stone|metal|glass)(_|$)/i.test(t.topic)
  );
  for (const t of terminologyPaths) {
    if (!t.summary) continue;
    const term = t.topic.replace(/_/g, " ");
    lines.push(`## ${term}`);
    lines.push("");
    lines.push(`${t.summary.slice(0, 400)}${t.summary.length > 400 ? "…" : ""}`);
    lines.push("");
    lines.push(`*Source count: ${t.sources_count} · Classification: ${t.classification}*`);
    lines.push("");
  }
  writeFileSync(join(EV_DIR, "TERMINOLOGY_GLOSSARY.md"), lines.join("\n"), "utf-8");
}

// ---------- Deliverable 10: TOPICS_CLASSIFICATION.md ----------

function writeClassification() {
  const direct = allTopics.filter(t =>
    /^(verified|evidenced)/i.test(t.classification || "") ||
    (typeof t.confidence_score === "number" && t.confidence_score >= 0.75 && t.sources_count >= 2)
  );
  const expert = allTopics.filter(t =>
    (t.classification || "").includes("expert") ||
    t.experts.length >= 2 ||
    (t.classification || "").includes("unable_to_verify")
  );
  const intermediate = allTopics.filter(t => !direct.includes(t) && !expert.includes(t));

  const lines = [];
  lines.push("# Topics Classification · Direct-Authorable vs Expert-Required");
  lines.push("");
  lines.push("Every topic assigned to one of three buckets to guide authoring prioritisation.");
  lines.push("");
  lines.push(`- **Directly authorable from published evidence:** ${direct.length}`);
  lines.push(`- **Intermediate (partial published coverage · expert should verify):** ${intermediate.length}`);
  lines.push(`- **Expert experience required (no published source · craft knowledge only):** ${expert.length}`);
  lines.push("");
  const write = (title, list) => {
    lines.push(`## ${title} (${list.length})`);
    lines.push("");
    for (const t of list) {
      lines.push(`- **${t.section} · ${t.topic}** · confidence ${t.confidence_score ?? "—"} · ${t.sources_count} sources · ${t.classification}`);
    }
    lines.push("");
  };
  write("Directly authorable from published evidence", direct);
  write("Intermediate — partial coverage", intermediate);
  write("Expert experience required", expert);
  writeFileSync(join(EV_DIR, "TOPICS_CLASSIFICATION.md"), lines.join("\n"), "utf-8");
}

// ---------- Run ----------

writeMaster();
writeSourceLibrary();
writeGapAnalysis();
writeContradictions();
writeInterviewQuestions();

// Three FAQ lists
writeFAQ("Homeowner", "HOMEOWNER_FAQ_LIST.md",
  t => /homeowner|section_12|misconception/i.test(JSON.stringify(t).slice(0, 500)) || t.misconceptions.length > 0,
  t => t.misconceptions.length > 0 ? t.misconceptions.map(m => `Refute: "${m}"`) : (t.summary ? [t.summary.slice(0, 200)] : [])
);
writeFAQ("Joiner", "JOINER_FAQ_LIST.md",
  t => /section_[45]|elements|manufacturing|joinery/i.test(t.section) || t.experts.length > 0,
  t => t.experts.length > 0 ? t.experts : (t.summary ? [t.summary.slice(0, 200)] : [])
);
writeFAQ("Manufacturer", "MANUFACTURER_FAQ_LIST.md",
  t => /section_[248]|materials|styles|manufacturing/i.test(t.section),
  t => {
    const items = [];
    if (t.experts.length > 0) items.push(...t.experts);
    if (t.summary && items.length === 0) items.push(t.summary.slice(0, 200));
    return items;
  }
);

writeTerminology();
writeClassification();

console.log(`\n✓ 10 deliverables written to ${EV_DIR}`);
