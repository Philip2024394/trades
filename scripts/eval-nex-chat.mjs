#!/usr/bin/env node
// NEX chat evaluation harness (Patch B · 2026-07-29).
//
// Runs a curated question set against a live /api/nex/staircase-chat
// endpoint, scores each reply against the 7 language-quality gates
// from docs/nex/golden-replies.md, and writes summary + failures
// reports to data/nex/eval/reports/<timestamp>/.
//
// Usage:
//   # smoke test (rule-based gates only, no cost):
//   npm run nex:eval -- --api http://localhost:3008 --limit 5
//
//   # full run:
//   NEX_BRAIN_RUNTIME_ENABLED=1 OPENAI_API_KEY=... ANTHROPIC_API_KEY=... \
//     npm run nex:eval -- --api http://localhost:3008 --judge
//
//   # dry run (parse only, no API calls):
//   npm run nex:eval -- --dry-run
//
// Gates:
//   1. Sounds like a person speaking             (LLM-as-judge; requires --judge)
//   2. Complete sentences — no label fragments   (rule-based)
//   3. No catalogue language                     (rule-based)
//   4. No AI-opener phrases                      (rule-based)
//   5. GOV.UK plain English (UK spelling, no Latin abbreviations, sentence length)  (rule-based)
//   6. One useful next step (or clean close)     (LLM-as-judge; requires --judge)
//   7. Constitution compliance                   (LLM-as-judge; requires --judge)
//
// Without --judge, gates 1/6/7 are marked "skipped" and the pass rate
// is computed over the 4 rule-based gates only.
//
// Exit code: 0 always (this is an eval, not a blocker). The pass rate
// is the signal.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ─── CLI args ────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));

const API        = args.api || "http://localhost:3008";
const QUESTIONS  = args.questions || path.join(ROOT, "data", "nex", "eval", "questions.json");
const OUT_ROOT   = args.out || path.join(ROOT, "data", "nex", "eval", "reports");
const LIMIT      = args.limit ? parseInt(args.limit, 10) : Infinity;
const JUDGE      = Boolean(args.judge);
const DRY_RUN    = Boolean(args["dry-run"]);
const BASELINE   = args.baseline || null;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

// ─── Rule-based gates ────────────────────────────────────────────

// Gate 2 — complete sentences, no label fragments.
// Heuristic: catch product-page style like "Premium tier. Made to
// order." at the start of a paragraph, where two sub-5-word "sentences"
// stack. Allowed exceptions: single-clause emphasis with a dash,
// bullet lists, section headings.
function gate2_completeSentences(text) {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n\n+/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (trimmed.includes("—")) continue;
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    if (sentences.length < 2) continue;
    const first  = sentences[0].split(/\s+/).filter(Boolean);
    const second = sentences[1].split(/\s+/).filter(Boolean);
    if (first.length > 0 && first.length < 5 && second.length < 5) {
      return { passed: false, reason: `Fragment-like paragraph: "${trimmed.slice(0, 60)}"` };
    }
  }
  return { passed: true };
}

// Gate 3 — no catalogue language.
const CATALOGUE_PATTERNS = [
  /\bavailable\s+options\b/i,
  /\bfeatures\s*:/i,
  /\bspecifications\b/i,
  /\bproduct\s+description\b/i,
  /view\s*\|\s*quote/i,
  /\bbest\s+seller\b/i,
  /\bin\s+stock\s+now\b/i,
];
function gate3_noCatalogue(text) {
  for (const re of CATALOGUE_PATTERNS) {
    const m = text.match(re);
    if (m) return { passed: false, reason: `Catalogue phrase: "${m[0]}"` };
  }
  return { passed: true };
}

// Gate 4 — no AI-opener phrases. Checked ONLY against the first line
// (openers are the failure mode; mid-response uses are less bad).
const AI_OPENER_PATTERNS = [
  /^certainly[!.]/i,
  /^absolutely[!.]/i,
  /^let'?s\s+dive\s+in/i,
  /^great\s+question[.!]/i,
  /^happy\s+to\s+help[.!]/i,
  /^here\s+is\s+a\s+quick\s+overview[.!]/i,
  /^let\s+me\s+break\s+it\s+down\s+for\s+you/i,
  /^as\s+an\s+ai/i,
  /^i'?d\s+be\s+happy\s+to\s+assist/i,
  /^thank\s+you\s+for\s+your\s+question/i,
  /^in\s+summary[,.]/i,
  /^i\s+hope\s+this\s+helps/i,
  /^please\s+note/i,
];
function gate4_noAIOpener(text) {
  const firstSentence = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  for (const re of AI_OPENER_PATTERNS) {
    const m = firstSentence.match(re);
    if (m) return { passed: false, reason: `AI opener: "${m[0]}"` };
  }
  return { passed: true };
}

// Gate 5 — GOV.UK plain English.
// - UK spelling (flag common US spellings)
// - No Latin abbreviations
// - Sentence length ≤ 30 words (soft ceiling — 25 is the aim,
//   30 is the fail threshold to avoid nitpicking)
const US_SPELLINGS_RE = /\b(colors?|colored|coloring|realize[dsr]?|realizing|centers?|centered|centering|organize[dsr]?|organizing|analyze[dsr]?|analyzing|specialize[dsr]?|specializing|gray|grayer|specialty|specialties|traveled|traveling|labeled|labeling|favor|favors|favored|honor|honors|honored|behavior|behaviors)\b/gi;
const LATIN_ABBREV_RE = /\b(e\.g\.|i\.e\.|etc\.\s|etc\.$)/i;
function gate5_plainEnglish(text) {
  const problems = [];
  const usMatches = text.match(US_SPELLINGS_RE);
  if (usMatches) {
    const unique = [...new Set(usMatches.map((s) => s.toLowerCase()))];
    problems.push(`US spellings: ${unique.slice(0, 5).join(", ")}`);
  }
  if (LATIN_ABBREV_RE.test(text)) problems.push("Latin abbreviation (e.g./i.e./etc.)");
  const sentences = text.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 30) {
      problems.push(`Long sentence (${words.length} words): "${s.slice(0, 50)}…"`);
      break; // report only the first one
    }
  }
  return problems.length === 0 ? { passed: true } : { passed: false, reason: problems.join("; ") };
}

// ─── LLM-as-judge (gates 1, 6, 7) ────────────────────────────────
async function llmJudge(reply, apiKey) {
  const prompt = `You are a strict language-quality evaluator for NEX, a UK staircase specialist AI. Judge this reply against three gates. Reply with ONLY a JSON object.

Reply to judge:
"""
${reply}
"""

Gates:
- gate1_person_speaking: does it sound like a UK staircase specialist speaking to a customer face-to-face (not a search result, product listing, or documentation page)?
- gate6_useful_next_step: does the reply end with one clear thing the user knows how to do next, OR is it a natural close where no next step is needed?
- gate7_constitution: does it respect ALL of: (a) no invented prices (£, $, exact numbers unless clearly generic ranges), (b) no pretended personal experience ("I have oak stairs at home"), (c) no disparaging competitors, (d) not defensive when challenged?

Respond with:
{"gate1": {"passed": true|false, "reason": "..."}, "gate6": {"passed": true|false, "reason": "..."}, "gate7": {"passed": true|false, "reason": "..."}}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system:     "You are a language-quality evaluator. Reply with ONLY the requested JSON, no prose.",
      messages:   [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Judge failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Judge returned no JSON: ${text}`);
  return JSON.parse(jsonMatch[0]);
}

// ─── Harness ─────────────────────────────────────────────────────

async function callChat(userMessage) {
  const res = await fetch(`${API}/api/nex/staircase-chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      message:         userMessage,
      history:         [],
      conversation_id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      intent:          "general",
      recent_ids:      [],
    }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`API returned not-ok: ${JSON.stringify(j).slice(0, 200)}`);
  return {
    answer:        String(j.answer ?? ""),
    stage:         String(j.stage ?? ""),
    retrieved_ids: Array.isArray(j.retrieved_ids) ? j.retrieved_ids : [],
  };
}

function tsStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function summariseGates(perQ) {
  const gateNames = ["gate1", "gate2", "gate3", "gate4", "gate5", "gate6", "gate7"];
  const gates = {};
  for (const name of gateNames) {
    const attempted = perQ.filter((q) => q.gates[name] && q.gates[name].status !== "skipped");
    const passed = attempted.filter((q) => q.gates[name].passed);
    gates[name] = {
      attempted: attempted.length,
      passed:    passed.length,
      pass_rate: attempted.length === 0 ? null : +(passed.length / attempted.length).toFixed(3),
    };
  }
  const allSevenAttempted = perQ.filter((q) =>
    gateNames.every((g) => q.gates[g] && q.gates[g].status !== "skipped")
  );
  const allSevenPassed = allSevenAttempted.filter((q) =>
    gateNames.every((g) => q.gates[g].passed)
  );
  return {
    gates,
    overall: {
      attempted: allSevenAttempted.length,
      passed:    allSevenPassed.length,
      pass_rate: allSevenAttempted.length === 0 ? null : +(allSevenPassed.length / allSevenAttempted.length).toFixed(3),
    },
  };
}

async function main() {
  const qFile = JSON.parse(fs.readFileSync(QUESTIONS, "utf-8"));
  const questions = qFile.questions.slice(0, LIMIT);
  console.log(`Loaded ${questions.length} questions from ${path.relative(ROOT, QUESTIONS)}`);

  if (DRY_RUN) {
    console.log("--dry-run: parsed OK, exiting.");
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (JUDGE && !anthropicKey) {
    console.error("--judge requires ANTHROPIC_API_KEY. Aborting.");
    process.exit(1);
  }

  const runId = tsStamp();
  const outDir = path.join(OUT_ROOT, runId);
  fs.mkdirSync(outDir, { recursive: true });

  const perQ = [];
  let i = 0;
  for (const q of questions) {
    i++;
    process.stdout.write(`  [${i}/${questions.length}] ${q.id} · ${q.user_message.slice(0, 50)}... `);
    let chat;
    try {
      chat = await callChat(q.user_message);
    } catch (err) {
      console.log(`ERROR: ${err.message.slice(0, 80)}`);
      perQ.push({
        ...q,
        error: err.message,
        gates: {
          gate1: { status: "skipped" }, gate2: { status: "skipped" },
          gate3: { status: "skipped" }, gate4: { status: "skipped" },
          gate5: { status: "skipped" }, gate6: { status: "skipped" },
          gate7: { status: "skipped" },
        },
      });
      continue;
    }

    const gates = {
      gate2: { ...gate2_completeSentences(chat.answer), status: "checked" },
      gate3: { ...gate3_noCatalogue(chat.answer),       status: "checked" },
      gate4: { ...gate4_noAIOpener(chat.answer),        status: "checked" },
      gate5: { ...gate5_plainEnglish(chat.answer),      status: "checked" },
      gate1: { status: "skipped" },
      gate6: { status: "skipped" },
      gate7: { status: "skipped" },
    };

    if (JUDGE) {
      try {
        const judge = await llmJudge(chat.answer, anthropicKey);
        gates.gate1 = { ...judge.gate1, status: "checked" };
        gates.gate6 = { ...judge.gate6, status: "checked" };
        gates.gate7 = { ...judge.gate7, status: "checked" };
      } catch (err) {
        console.log(`\n    judge error: ${err.message.slice(0, 80)}`);
      }
    }

    const ruleGates = ["gate2", "gate3", "gate4", "gate5"];
    const rulePass = ruleGates.every((g) => gates[g].passed);
    const status = rulePass ? "✓" : "✗";
    console.log(status);

    perQ.push({
      id:             q.id,
      user_message:   q.user_message,
      expected_intent:q.expected_intent,
      tags:           q.tags,
      reply:          chat.answer,
      stage:          chat.stage,
      retrieved_ids:  chat.retrieved_ids,
      gates,
    });
  }

  // ─── Reports ────────────────────────────────────────────────
  const summary = summariseGates(perQ);
  const withReplies = perQ.filter((q) => !q.error).length;
  const errors = perQ.length - withReplies;

  const summaryJson = {
    run_id:              runId,
    api:                 API,
    judge_enabled:       JUDGE,
    total_questions:     questions.length,
    replies_received:    withReplies,
    api_errors:          errors,
    per_gate:            summary.gates,
    overall_pass_rate:   summary.overall,
  };

  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summaryJson, null, 2));
  fs.writeFileSync(path.join(outDir, "per-question.json"), JSON.stringify(perQ, null, 2));

  // Markdown summary
  const md = renderMarkdown(summaryJson, perQ);
  fs.writeFileSync(path.join(outDir, "summary.md"), md);

  // Failures only
  const failuresMd = renderFailures(perQ);
  fs.writeFileSync(path.join(outDir, "failures.md"), failuresMd);

  console.log(`\nReport written to ${path.relative(ROOT, outDir)}/`);
  console.log(`  Rule-based pass rate: ${formatPassRate(perQ.filter(q => !q.error), ["gate2","gate3","gate4","gate5"])}`);
  if (JUDGE) {
    console.log(`  All-7-gate pass rate:  ${summary.overall.pass_rate === null ? "n/a" : (summary.overall.pass_rate * 100).toFixed(1) + "%"}`);
  }

  // Baseline comparison
  if (BASELINE) {
    try {
      const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf-8"));
      const delta = renderDelta(baseline, summaryJson);
      fs.writeFileSync(path.join(outDir, "delta.md"), delta);
      console.log(`  Delta vs baseline written to delta.md`);
    } catch (err) {
      console.log(`  Baseline comparison skipped: ${err.message}`);
    }
  }
}

function formatPassRate(entries, gateNames) {
  const attempted = entries.filter((q) => gateNames.every((g) => q.gates[g] && q.gates[g].status !== "skipped"));
  if (attempted.length === 0) return "n/a";
  const passed = attempted.filter((q) => gateNames.every((g) => q.gates[g].passed));
  return `${((passed.length / attempted.length) * 100).toFixed(1)}% (${passed.length}/${attempted.length})`;
}

function renderMarkdown(summary, perQ) {
  const lines = [];
  lines.push(`# NEX Chat Eval — ${summary.run_id}`);
  lines.push("");
  lines.push(`- API: \`${summary.api}\``);
  lines.push(`- Judge enabled: ${summary.judge_enabled ? "yes" : "no (rule-based gates 2/3/4/5 only)"}`);
  lines.push(`- Questions: ${summary.total_questions}`);
  lines.push(`- Replies received: ${summary.replies_received}`);
  lines.push(`- API errors: ${summary.api_errors}`);
  lines.push("");
  lines.push("## Per-gate pass rate");
  lines.push("");
  lines.push("| Gate | Description | Attempted | Passed | Pass rate |");
  lines.push("|---|---|---:|---:|---:|");
  const descs = {
    gate1: "Sounds like a person speaking (LLM-judged)",
    gate2: "Complete sentences — no label fragments",
    gate3: "No catalogue language",
    gate4: "No AI-opener phrases",
    gate5: "GOV.UK plain English",
    gate6: "One useful next step (LLM-judged)",
    gate7: "Constitution compliance (LLM-judged)",
  };
  for (const [name, desc] of Object.entries(descs)) {
    const g = summary.per_gate[name];
    const rate = g.pass_rate === null ? "n/a" : `${(g.pass_rate * 100).toFixed(1)}%`;
    lines.push(`| ${name} | ${desc} | ${g.attempted} | ${g.passed} | ${rate} |`);
  }
  lines.push("");
  lines.push("## Overall (all 7 gates)");
  lines.push("");
  const o = summary.overall_pass_rate;
  const oRate = o.pass_rate === null ? "n/a" : `${(o.pass_rate * 100).toFixed(1)}%`;
  lines.push(`- ${o.passed} / ${o.attempted} = **${oRate}**`);
  lines.push("");
  lines.push("_Target: 95%+ before shipping a language-quality release._");
  lines.push("");
  lines.push("## Retrieval diagnostics");
  lines.push("");
  const retStats = summariseRetrieval(perQ);
  lines.push(`- Turns with retrieval: ${retStats.with_retrieval} / ${retStats.total}`);
  lines.push(`- Turns gated by threshold: ${retStats.gated}`);
  lines.push(`- Unique golden IDs used: ${retStats.unique_ids.length}`);
  if (retStats.unique_ids.length > 0) {
    lines.push(`- Most-used IDs: ${retStats.top_ids.map(([id, n]) => `${id} (${n})`).join(", ")}`);
  }
  if (retStats.unused_ids.length > 0) {
    lines.push(`- Not seen in this run: ${retStats.unused_ids.slice(0, 12).join(", ")}${retStats.unused_ids.length > 12 ? ", …" : ""}`);
  }
  return lines.join("\n") + "\n";
}

function summariseRetrieval(perQ) {
  const total = perQ.length;
  const with_retrieval = perQ.filter((q) => Array.isArray(q.retrieved_ids) && q.retrieved_ids.length > 0).length;
  const gated = total - with_retrieval - perQ.filter((q) => q.error).length;
  const counts = new Map();
  for (const q of perQ) {
    for (const id of q.retrieved_ids ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const top_ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  // Determine unused: read golden library IDs from the embeddings file
  let all_ids = [];
  try {
    const embPath = path.join(ROOT, "data", "nex", "golden-replies.embeddings.json");
    const embs = JSON.parse(fs.readFileSync(embPath, "utf-8"));
    all_ids = embs.map((e) => e.id);
  } catch { /* ignore */ }
  const usedSet = new Set([...counts.keys()]);
  const unused_ids = all_ids.filter((id) => !usedSet.has(id));
  return {
    total,
    with_retrieval,
    gated,
    unique_ids: [...counts.keys()],
    top_ids,
    unused_ids,
  };
}

function renderFailures(perQ) {
  const lines = ["# Failures", ""];
  const failures = perQ.filter((q) => {
    if (q.error) return true;
    return Object.entries(q.gates).some(([, g]) => g.status === "checked" && !g.passed);
  });
  if (failures.length === 0) return "# Failures\n\nNone.\n";
  for (const q of failures) {
    lines.push(`## ${q.id}`);
    lines.push("");
    lines.push(`**User:** ${q.user_message}`);
    if (q.tags?.length) lines.push(`**Tags:** ${q.tags.join(", ")}`);
    lines.push("");
    if (q.error) {
      lines.push(`**API error:** ${q.error}`);
      lines.push("");
      continue;
    }
    lines.push("**Reply:**");
    lines.push("");
    lines.push("> " + q.reply.replace(/\n/g, "\n> "));
    lines.push("");
    lines.push("**Failed gates:**");
    for (const [name, g] of Object.entries(q.gates)) {
      if (g.status === "checked" && !g.passed) {
        lines.push(`- **${name}** — ${g.reason ?? "(no reason)"}`);
      }
    }
    lines.push("");
    if (q.retrieved_ids?.length) {
      lines.push(`**Retrieved:** ${q.retrieved_ids.join(", ")}`);
    } else {
      lines.push(`**Retrieved:** none (gated or unavailable)`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

function renderDelta(baseline, current) {
  const lines = [`# Delta vs ${baseline.run_id ?? "baseline"}`, ""];
  lines.push("| Gate | Baseline | Current | Δ |");
  lines.push("|---|---:|---:|---:|");
  for (const name of ["gate1","gate2","gate3","gate4","gate5","gate6","gate7"]) {
    const b = baseline.per_gate?.[name]?.pass_rate;
    const c = current.per_gate?.[name]?.pass_rate;
    const fmt = (x) => x === null || x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`;
    const delta = (b !== null && b !== undefined && c !== null && c !== undefined)
      ? `${((c - b) * 100).toFixed(1)}pp`
      : "n/a";
    lines.push(`| ${name} | ${fmt(b)} | ${fmt(c)} | ${delta} |`);
  }
  const b = baseline.overall_pass_rate?.pass_rate;
  const c = current.overall_pass_rate?.pass_rate;
  const fmt = (x) => x === null || x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`;
  const delta = (b !== null && b !== undefined && c !== null && c !== undefined)
    ? `${((c - b) * 100).toFixed(1)}pp`
    : "n/a";
  lines.push("");
  lines.push(`**Overall:** ${fmt(b)} → ${fmt(c)} (${delta})`);
  return lines.join("\n") + "\n";
}

main().catch((err) => {
  console.error("\nEval failed:", err.message ?? err);
  process.exit(1);
});
