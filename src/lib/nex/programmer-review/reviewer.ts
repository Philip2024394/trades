// src/lib/nex/programmer-review/reviewer.ts
//
// NEX Programmer Agent · Phase C · deterministic review engine
// Philip 2026-09-05 · AUTHORIZE · PHASE C
//
// Contract:
//   input:  ReviewRequest (requirement · implementation · tests ·
//           evidence · claims · optional Phase B knowledge ids)
//   output: ReviewResponse (verdict · confidence · findings ·
//           evidence_inspected · knowledge_used · reasoning_trace)
//
// Discipline enforced:
//   · Reviewer NEVER treats claimed_by=claude as authority for
//     correctness (§13 · §20 · §32). A Claude claim is a claim, not
//     evidence. The reviewer inspects INDEPENDENT evidence.
//   · Verdict is DERIVED from findings + evidence-completeness rules.
//     Never manually settable.
//   · Confidence is INDEPENDENT of verdict — verdict can be UNCERTAIN
//     with HIGH confidence in that uncertainty (§16).
//   · REJECT requires at least one CRITICAL finding.
//   · Reviewer has NO WRITE AUTHORITY: no commit · no deploy · no
//     database · no filesystem writes beyond returned response.

import { readKnowledge, readSkills, readExperiences } from "@/lib/nex/programmer-learning/store";
import type { KnowledgeItem, SkillItem, ExperienceItem } from "@/lib/nex/programmer-learning/types";
import { analyzeTestQuality, tallyFindingsBySeverity } from "./test-quality";
import type {
  Finding,
  FindingCategory,
  FindingSeverity,
  ReviewConfidence,
  ReviewRequest,
  ReviewResponse,
  ReviewVerdict,
} from "./types";

let _fid = 0;
function nextFindingId(prefix: string): string {
  _fid += 1;
  return `${prefix}_${Date.now().toString(36)}_${_fid}`;
}

// ─── Individual rule checks · each returns 0..N findings ─────────
//
// Rules are pure functions of the ReviewRequest. Applied in a fixed
// order so the verdict derivation is deterministic and reproducible.

/** RULE R1 · Requirement-vs-summary mismatch (semantic).
 *
 *  Detects when the implementation summary contradicts the requirement
 *  via presence of contradiction markers in the summary. Never assumes
 *  the requirement is right OR wrong · only flags obvious mismatches.
 *
 *  DISCIPLINE (Phase D lesson · 2026-09-05):
 *   The original implementation triggered on every must-verb that did
 *   not appear literally in the summary. This produced a 75% false-
 *   positive rate on the correct-code benchmark corpus because:
 *   · adverbs (safely · always · only) were captured as "verbs"
 *   · word forms didn't match (return vs returns vs returning)
 *   · synonyms didn't match (verify vs checks)
 *
 *  Fixed approach:
 *   · Skip common adverbs / mode words that follow "must" but aren't
 *     the actual verb
 *   · Use STEM matching (return matches returns/returning/returned)
 *   · Skip the rule entirely when the summary is substantive
 *     (≥40 chars) — trust the caller-supplied summary as-authored
 *     when it demonstrates engagement; test-quality checks (R5) catch
 *     the actual gaps. Only fire when summary is trivially thin.
 *   · Still MATERIAL when it fires · because a thin summary + a
 *     mandatory verb absence is a real signal. */
const R1_MUST_WORD_SKIPWORDS = new Set([
  // adverbs / mode words often placed after "must"
  "safely", "always", "never", "only", "first", "then", "immediately",
  "correctly", "properly", "reliably", "eventually", "asynchronously",
  "synchronously", "atomically", "carefully", "quickly", "efficiently",
  // articles/determiners that occasionally slip in
  "a", "an", "the", "some", "any",
  // vacuously satisfied "still" / "also"
  "still", "also", "not",
]);

function ruleRequirementMismatch(req: ReviewRequest): Finding[] {
  const findings: Finding[] = [];
  const summary = req.implementation.summary.toLowerCase();
  // Skip R1 entirely when summary is substantive (≥40 chars) · rely on
  // R5 test-quality to catch actual gaps · avoids false positives from
  // synonym/word-form mismatches that don't indicate missing behavior.
  if (summary.length >= 40) return [];
  const requirement = req.requirement.toLowerCase();
  const mustMatches = Array.from(requirement.matchAll(/\b(?:must|shall|required to|has to)\s+(\w+)(?:\s+(\w+))?/g));
  for (const m of mustMatches) {
    // Prefer the SECOND word when the first is an adverb/mode word
    const firstWord = (m[1] ?? "").trim();
    const secondWord = (m[2] ?? "").trim();
    const verb = R1_MUST_WORD_SKIPWORDS.has(firstWord) && secondWord ? secondWord : firstWord;
    if (!verb || verb.length < 3) continue;
    if (R1_MUST_WORD_SKIPWORDS.has(verb)) continue;
    // Stem-friendly check: match verb OR verb+s OR verb+es OR verb+ing OR verb-final-e-dropped forms
    const stems = uniqueStems(verb);
    let found = false;
    for (const s of stems) if (summary.includes(s)) { found = true; break; }
    if (!found) {
      findings.push({
        finding_id: nextFindingId("f"),
        severity: "MATERIAL",
        category: "requirement_mismatch",
        message: `Requirement mandates '${m[0]}' but implementation summary (${summary.length} chars) does not describe any form of '${verb}'.`,
        rationale: "A required behavior absent from a thin implementation summary suggests the behavior was not implemented or was not considered.",
        evidence_pointer: `review:${req.review_id}:requirement vs implementation.summary`,
        affected_behavior: verb,
        recommended_correction: `Confirm '${verb}' is implemented and describe it in the implementation summary; add a test if missing.`,
      });
    }
  }
  return findings;
}

/** Return the verb + a small set of morphological variants for stem
 *  matching. Handles regular English inflection: -s · -es · -ing · -ed.
 *  Not linguistically complete · just enough to eliminate the most
 *  common R1 false positives (return vs returns · handle vs handles). */
function uniqueStems(verb: string): string[] {
  const out = new Set<string>([verb]);
  out.add(verb + "s");
  out.add(verb + "es");
  out.add(verb + "ing");
  out.add(verb + "ed");
  if (verb.endsWith("e")) {
    const stem = verb.slice(0, -1);
    out.add(stem + "ing");
    out.add(stem + "ed");
  }
  if (verb.endsWith("y") && verb.length > 3) {
    const stem = verb.slice(0, -1);
    out.add(stem + "ies");
    out.add(stem + "ied");
  }
  return Array.from(out);
}

/** RULE R2 · Security requirements & violations. */
function ruleSecurity(req: ReviewRequest): Finding[] {
  const findings: Finding[] = [];
  const violations = req.requirement_details.security_violations_observed ?? [];
  for (const v of violations) {
    findings.push({
      finding_id: nextFindingId("f"),
      severity: "CRITICAL",
      category: "security",
      message: `Security violation observed: ${v}`,
      rationale: "Security violations block acceptance regardless of functional test outcome.",
      evidence_pointer: `review:${req.review_id}:security_violations_observed`,
      affected_behavior: "Security posture · access control · data protection",
      recommended_correction: `Remove the violation before this implementation may ship. Add negative security tests to prevent regression.`,
    });
  }
  const secReqs = req.requirement_details.security_requirements ?? [];
  const summary = req.implementation.summary.toLowerCase();
  // SKIP GUARD (same discipline as R3 · Phase D lesson 2026-09-05):
  // When tests already cover every required edge case AND passed,
  // trust that the security behavior is exercised. The keyword-in-summary
  // check is a weak signal ("authorization" as a keyword may not appear
  // literally even when the implementation correctly checks ownership).
  // Only fire when there's no test evidence · avoids false positives
  // on correct implementations that use domain-specific vocabulary.
  const required = new Set((req.requirement_details.edge_cases_required ?? []).map((s) => s.toLowerCase().trim()));
  const covered = new Set((req.requirement_details.edge_cases_covered ?? []).map((s) => s.toLowerCase().trim()));
  let allEdgeCasesCovered = required.size > 0;
  for (const r of required) if (!covered.has(r)) { allEdgeCasesCovered = false; break; }
  const skipR2Warning = allEdgeCasesCovered && req.tests.passed > 0;

  for (const s of secReqs) {
    if (skipR2Warning) continue;
    const keyword = pickSecurityKeyword(s);
    if (keyword && !summary.includes(keyword.toLowerCase()) && violations.length === 0) {
      // Only warn when there's no explicit violation · avoid double-counting
      findings.push({
        finding_id: nextFindingId("f"),
        severity: "WARNING",
        category: "security",
        message: `Security requirement '${s}' has no evidence in implementation summary.`,
        rationale: "The requirement is stated but the summary does not describe how it is enforced.",
        evidence_pointer: `review:${req.review_id}:security_requirements`,
        affected_behavior: s,
        recommended_correction: `Document where and how '${s}' is enforced. Add a security test asserting it.`,
      });
    }
  }
  return findings;
}

function pickSecurityKeyword(req: string): string | null {
  const lower = req.toLowerCase();
  const words = [
    "authentication", "authorization", "csrf", "xss", "injection",
    "encryption", "authz", "authn", "rate limit", "audit",
    "hmac", "signature", "idempotency", "timing-safe", "timing safe",
    "constant-time", "constant time", "session", "token", "credential",
    "sanitiz", "validate", "escape", "cors", "hash", "salt", "tls",
  ];
  for (const w of words) if (lower.includes(w)) return w;
  return null;
}

/** RULE R3 · Unsupported claims (§8 §12).
 *
 *  A claim is UNSUPPORTED when it asserts distinctive behaviors that
 *  neither test coverage nor runtime evidence establishes.
 *
 *  CRITICAL DISCIPLINE: this rule DOES NOT fire when tests already
 *  cover every required edge case. Token-mismatch between claim
 *  wording and test-summary wording is not evidence of missing
 *  behavior — it's often just synonym-choice. Only fire when there's
 *  a genuine gap in coverage of REQUIRED behaviors. */
function ruleUnsupportedClaims(req: ReviewRequest): Finding[] {
  const claim = req.implementation.claim ?? "";
  if (!claim.trim()) return [];
  // SKIP GUARD: when tests already cover all required edge cases,
  // trust that the behaviors are established. Token mismatch alone
  // isn't evidence of missing behavior — avoids false-positive
  // rejection of correct-but-idiomatic-different code (§18).
  const required = new Set((req.requirement_details.edge_cases_required ?? []).map((s) => s.toLowerCase().trim()));
  const covered = new Set((req.requirement_details.edge_cases_covered ?? []).map((s) => s.toLowerCase().trim()));
  let allEdgeCasesCovered = required.size > 0;
  for (const r of required) if (!covered.has(r)) { allEdgeCasesCovered = false; break; }
  if (allEdgeCasesCovered && req.tests.passed > 0) return [];

  const findings: Finding[] = [];
  const evidence = ((req.tests.summary ?? "") + " " + (req.runtime_evidence ?? []).join(" ")).toLowerCase();
  const claimTokens = claim.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 5);
  const uncovered: string[] = [];
  for (const tok of claimTokens) {
    if (COMMON_ENGLISH.has(tok)) continue;
    if (!evidence.includes(tok)) uncovered.push(tok);
  }
  const meaningful = claimTokens.filter((t) => !COMMON_ENGLISH.has(t));
  // Higher threshold to reduce false positives on distinctive-domain claims.
  if (meaningful.length >= 3 && uncovered.length / meaningful.length > 0.6) {
    findings.push({
      finding_id: nextFindingId("f"),
      severity: "MATERIAL",
      category: "unsupported_claim",
      message: `Claim uses ${uncovered.length} distinctive term(s) not backed by test summary or runtime evidence: ${uncovered.slice(0, 5).join(", ")}`,
      rationale: "The implementer's claim contains substantive terms with no corresponding evidence in tests or runtime observations.",
      evidence_pointer: `review:${req.review_id}:implementation.claim vs (tests.summary + runtime_evidence)`,
      affected_behavior: "Any behavior asserted by the unsupported claim",
      recommended_correction: `Add tests or runtime evidence covering: ${uncovered.slice(0, 5).join(", ")}. Or narrow the claim to match evidence.`,
    });
  }
  return findings;
}

const COMMON_ENGLISH = new Set([
  "the", "and", "for", "with", "this", "that", "these", "those",
  "from", "into", "onto", "which", "when", "where", "what", "user",
  "users", "then", "than", "have", "has", "will", "would", "should",
  "could", "must", "does", "code", "implementation", "call", "calls",
  "return", "returns", "value", "values", "input", "output",
  "correct", "correctly", "handles", "handle", "expected", "actual",
  "supports", "support", "provides", "provide", "given", "based",
  "using", "based", "type", "check", "checks", "empty",
]);

/** RULE R4 · Runtime evidence completeness.
 *
 *  Runtime evidence is required when the requirement is behavior-driven.
 *  Missing runtime evidence for a behavioral requirement contributes to
 *  UNCERTAINTY. */
function ruleRuntimeEvidence(req: ReviewRequest): Finding[] {
  const findings: Finding[] = [];
  const hasRuntime = (req.runtime_evidence ?? []).length > 0;
  const behavioralRequirement = /\b(behav|respond|reject|return|redirect|emit|produce|throw|fail|log)\w*\b/i.test(req.requirement);
  if (behavioralRequirement && !hasRuntime && req.tests.passed === 0) {
    findings.push({
      finding_id: nextFindingId("f"),
      severity: "MATERIAL",
      category: "insufficient_evidence",
      message: "Behavioral requirement with neither tests nor runtime evidence.",
      rationale: "A behavioral requirement (does X when Y) needs at least one of: unit tests or runtime evidence. Neither is present.",
      evidence_pointer: `review:${req.review_id}:runtime_evidence + tests.passed`,
      affected_behavior: "All behaviors described by the requirement",
      recommended_correction: "Provide runtime evidence (log / HTTP probe / test-runner output) or unit tests exercising the requirement.",
    });
  }
  return findings;
}

/** RULE R6 · Knowledge-derived pattern gap (Y-W5-1-C · 2026-09-07).
 *
 *  When Phase B knowledge is consulted, this rule inspects each
 *  KnowledgeItem for statements describing a REQUIRED pattern
 *  ("must have X" · "requires X" · "should include X" · "must handle X")
 *  in a domain that overlaps the review request, and emits a MATERIAL
 *  finding when the request's evidence does not cover that pattern.
 *
 *  SAFETY DISCIPLINE — knowledge is ADDITIVE, never SUBTRACTIVE:
 *   · Knowledge NEVER produces CRITICAL findings — only R2 (security)
 *     can produce CRITICAL. Safety verdicts remain owned by R1-R5.
 *   · Knowledge NEVER removes a finding produced by R1-R5.
 *   · Knowledge NEVER downgrades a severity.
 *   · Only VERIFIED knowledge fires (DISCOVERED/CHECKED/SUPERSEDED/
 *     REJECTED are inspected for provenance only, not applied).
 *   · Confidence gate: knowledge below 0.7 confidence does not fire.
 *   · Domain-relevance gate: knowledge's domain root must appear in
 *     the request text before its patterns are evaluated.
 *   · Determinism: pure function of (request, knowledge) inputs.
 *   · Auditability: every finding pins the specific knowledge_id +
 *     authority tier in the evidence_pointer + rationale.
 *
 *  Effect on verdict flow (via existing deriveVerdict):
 *   · Can push ACCEPT → NEEDS_CHANGES by adding a MATERIAL finding.
 *   · CANNOT push NEEDS_CHANGES → ACCEPT (findings only accumulate).
 *   · CANNOT bypass V1 CRITICAL → REJECT.
 *   · CANNOT bypass V2 evidence-gap → UNCERTAIN.
 *
 *  Restricted to the minimum architectural connection needed for a
 *  Phase F knowledge candidate to legitimately influence Phase C
 *  verdicts. Not a general reopening of Phase C for future work. */
function ruleKnowledgePatterns(req: ReviewRequest, knowledge: readonly KnowledgeItem[]): Finding[] {
  const findings: Finding[] = [];
  if (!knowledge || knowledge.length === 0) return findings;

  const requestText = [
    req.requirement ?? "",
    req.implementation.summary ?? "",
    req.implementation.claim ?? "",
    req.tests.summary ?? "",
    (req.tests.known_gaps ?? []).join(" "),
    (req.runtime_evidence ?? []).join(" "),
  ].join(" ").toLowerCase();

  for (const k of knowledge) {
    // Gate 1 · verification status must be VERIFIED (§ Y-W5-1-C safety)
    if (k.verification_status !== "VERIFIED") continue;
    // Gate 2 · confidence threshold — bounded knowledge only
    if (typeof k.confidence !== "number" || k.confidence < 0.7) continue;
    // Gate 3 · domain relevance — knowledge domain root must overlap request text
    const domainRoot = (k.domain ?? "").toLowerCase().split(".")[0].trim();
    if (!domainRoot || domainRoot.length < 3) continue;
    if (!requestText.includes(domainRoot)) continue;

    // Extract required patterns from knowledge statement
    const missing = extractMissingRequiredPatterns(k.statement, requestText);
    if (missing.length === 0) continue;

    findings.push({
      finding_id: nextFindingId("kf"),
      severity: "MATERIAL", // knowledge NEVER produces CRITICAL — only R2 does
      category: "insufficient_evidence",
      message: `Knowledge-derived gap: domain-relevant knowledge indicates ${missing.length} required pattern(s) not evidenced in this request: ${missing.slice(0, 3).join(", ")}`,
      rationale: `Knowledge ${k.knowledge_id} (domain=${k.domain} · tier=${k.provenance?.authority_tier ?? "unknown"} · verified · confidence=${k.confidence.toFixed(2)}) states: "${(k.statement ?? "").slice(0, 200)}${(k.statement ?? "").length > 200 ? "…" : ""}"`,
      evidence_pointer: `knowledge:${k.knowledge_id} vs review:${req.review_id}`,
      affected_behavior: `Behavior in domain ${k.domain}: required pattern(s) [${missing.slice(0, 3).join(", ")}] unaddressed`,
      recommended_correction: `Address the required patterns in the implementation or tests: ${missing.join(", ")}. Document how each is enforced.`,
    });
  }
  return findings;
}

/** Extract patterns a knowledge statement declares as REQUIRED, then
 *  return the subset NOT covered by the request text. Deterministic ·
 *  keyword-matching · not NLP.
 *
 *  Looks for the following mandate patterns in the knowledge statement:
 *    "must have X"     "must include X"    "must handle X"
 *    "must implement X"  "must support X"  "must use X"
 *    "requires X"        "should include X"  "should handle X"
 *  Extracts X (up to 3 words), lowercases, checks whether the request
 *  text contains that phrase or its first meaningful stem. */
const PATTERN_EXTRACTION_STOPWORDS = new Set([
  // Articles / determiners / pronouns that produce over-broad matches
  "the", "a", "an", "any", "some", "each", "every", "all", "no", "this", "that", "these", "those",
  "its", "his", "her", "their", "our", "your", "my",
  // Common verbs / auxiliaries
  "be", "is", "are", "was", "were", "been", "being", "do", "does", "did", "doing",
  "have", "has", "had", "having",
  // Common function words
  "and", "or", "but", "not", "for", "to", "of", "in", "on", "at", "by", "with", "from",
  // Explicit "implementation" / "code" boilerplate that isn't a pattern name
  "implementation", "code", "system", "component", "module",
]);

function extractMissingRequiredPatterns(statement: string, requestText: string): string[] {
  if (!statement) return [];
  const stmt = statement.toLowerCase();
  const patterns = [
    /\bmust\s+(?:have|include|handle|implement|support|use|apply|enforce|contain)\s+([a-z][a-z0-9 \-_]{2,40})/g,
    /\brequires?\s+([a-z][a-z0-9 \-_]{2,40})/g,
    /\bshould\s+(?:have|include|handle|implement|support|use)\s+([a-z][a-z0-9 \-_]{2,40})/g,
  ];
  const required = new Set<string>();
  for (const p of patterns) {
    for (const m of stmt.matchAll(p)) {
      const raw = (m[1] ?? "").trim();
      // Take the first 3 words at most and strip trailing punctuation
      const words = raw.split(/\s+/).slice(0, 3);
      // Drop the pattern entirely if it starts with a stopword — those
      // produce over-broad "the implementation must" style false-positives
      // when the extractor triggers on a natural-language preamble.
      if (PATTERN_EXTRACTION_STOPWORDS.has(words[0] ?? "")) continue;
      const trimmed = words.join(" ").replace(/[^\w\- ]+$/g, "").trim();
      if (trimmed.length >= 3) required.add(trimmed);
    }
  }
  if (required.size === 0) return [];
  const missing: string[] = [];
  for (const req of required) {
    // A required pattern is "missing" when neither the phrase nor its
    // first meaningful word appears in the request text.
    if (requestText.includes(req)) continue;
    const firstWord = req.split(/\s+/)[0];
    if (firstWord.length >= 4 && requestText.includes(firstWord)) continue;
    missing.push(req);
  }
  return missing;
}

/** RULE R9 · Knowledge-derived DESCRIPTIVE-FACT pattern gap (M2 fix · 2026-09-08).
 *
 *  Purpose: R6 only fires on PRESCRIPTIVE statements ("must X" / "requires X" /
 *  "should X"). Many high-value knowledge items are DESCRIPTIVE — e.g. K_c1:
 *  "fs.readFileSync(directoryPath) throws EISDIR". Under R6 alone, K_c1 verifies
 *  but never influences any review verdict — Milestone 2 stayed 🟡 PARTIAL.
 *
 *  R9 closes the gap by translating a small closed set of descriptive-fact
 *  forms into IMPLICIT prescriptive checks:
 *    · "X throws Y"        · "X can throw Y"    · "X may throw Y"
 *    · "X raises Y"        · "X can raise Y"    · "X may raise Y"
 *    · "X returns Y on error" · "X returns Y when failed"
 *  where X is a function/method identifier and Y is an error identifier.
 *
 *  A MATERIAL finding is emitted when BOTH:
 *    (a) the request text mentions the specific function X (implementation
 *        summary / claim / test summary / runtime evidence), AND
 *    (b) the request text mentions NEITHER the specific error Y NOR any
 *        generic error-handling marker (catch · try · handle · .catch(
 *        · on("error"), etc.).
 *
 *  SAFETY DISCIPLINE — mirrors R6 exactly:
 *   · MATERIAL max severity — never CRITICAL. R2 still owns CRITICAL.
 *   · Additive only — accumulates onto same findings array as R6.
 *   · Only VERIFIED knowledge fires. Confidence ≥ 0.7.
 *   · Domain-relevance gate: k.domain root must appear in request text.
 *   · Determinism: pure function of (request, knowledge) inputs.
 *   · Auditability: every finding pins the specific knowledge_id + the
 *     extracted (function, error) pair in the rationale.
 *   · Bounded extraction: only the closed set of descriptive-fact patterns
 *     above · does NOT attempt general NLP. */
function ruleKnowledgeDescriptiveFacts(req: ReviewRequest, knowledge: readonly KnowledgeItem[]): Finding[] {
  const findings: Finding[] = [];
  if (!knowledge || knowledge.length === 0) return findings;

  const requestText = [
    req.requirement ?? "",
    req.implementation.summary ?? "",
    req.implementation.claim ?? "",
    req.tests.summary ?? "",
    (req.tests.known_gaps ?? []).join(" "),
    (req.runtime_evidence ?? []).join(" "),
  ].join(" ");
  const requestTextLower = requestText.toLowerCase();

  for (const k of knowledge) {
    // Gate 1 · VERIFIED only
    if (k.verification_status !== "VERIFIED") continue;
    // Gate 2 · confidence threshold
    if (typeof k.confidence !== "number" || k.confidence < 0.7) continue;
    // Gate 3 · domain relevance
    const domainRoot = (k.domain ?? "").toLowerCase().split(".")[0].trim();
    if (!domainRoot || domainRoot.length < 3) continue;
    if (!requestTextLower.includes(domainRoot)) continue;

    // Extract descriptive-fact (function, error) pairs from statement
    const pairs = extractDescriptiveFactPairs(k.statement ?? "");
    if (pairs.length === 0) continue;

    // For each extracted pair check whether the request needs a finding
    const missing: { fn: string; err: string }[] = [];
    for (const p of pairs) {
      // Function name must appear in request text (case-insensitive, allowing
      // both fully-qualified "fs.readFileSync" and short "readFileSync"):
      const fnLower = p.fn.toLowerCase();
      const fnShort = fnLower.includes(".") ? fnLower.split(".").pop()! : fnLower;
      const fnMentioned = requestTextLower.includes(fnLower) || (fnShort.length >= 4 && requestTextLower.includes(fnShort));
      if (!fnMentioned) continue;
      // Error must be mentioned OR generic error-handling marker nearby
      const errLower = p.err.toLowerCase();
      const errMentioned = requestTextLower.includes(errLower);
      const genericHandling = /\b(catch|try|handl(?:e|es|ed|ing)|\.catch\(|on\(["']error["']\))\b/i.test(requestText);
      if (errMentioned || genericHandling) continue;
      missing.push({ fn: p.fn, err: p.err });
    }

    if (missing.length === 0) continue;

    const shown = missing.slice(0, 3).map((m) => `${m.fn}→${m.err}`).join(", ");
    findings.push({
      finding_id: nextFindingId("kf"),
      severity: "MATERIAL", // never CRITICAL · R2 owns CRITICAL
      category: "insufficient_evidence",
      message: `Knowledge-derived descriptive-fact gap: domain-relevant knowledge indicates ${missing.length} function→error pair(s) not evidenced as handled: ${shown}`,
      rationale: `Knowledge ${k.knowledge_id} (domain=${k.domain} · tier=${k.provenance?.authority_tier ?? "unknown"} · verified · confidence=${k.confidence.toFixed(2)}) states: "${(k.statement ?? "").slice(0, 200)}${(k.statement ?? "").length > 200 ? "…" : ""}"`,
      evidence_pointer: `knowledge:${k.knowledge_id} vs review:${req.review_id}`,
      affected_behavior: `Behavior in domain ${k.domain}: function(s) [${missing.map((m) => m.fn).slice(0, 3).join(", ")}] used without evidenced handling of documented error(s) [${missing.map((m) => m.err).slice(0, 3).join(", ")}]`,
      recommended_correction: `Add explicit handling for the documented error(s), OR add test evidence that the error path is exercised, OR document why the error cannot occur in this context.`,
    });
  }
  return findings;
}

/** Extract (function, error) pairs from descriptive-fact statements.
 *  Closed set of patterns · deterministic · keyword-matching · not NLP.
 *  Returns pairs like { fn: "fs.readFileSync", err: "EISDIR" }. */
function extractDescriptiveFactPairs(statement: string): { fn: string; err: string }[] {
  if (!statement) return [];
  const s = statement;
  const pairs: { fn: string; err: string }[] = [];
  // Common function name shape: an identifier chain (optionally with dots),
  // possibly followed by a call parenthesis with an argument like
  // "fs.readFileSync(directoryPath)" — we capture up to the identifier chain.
  //
  // Error shape: uppercase-heavy identifier (EISDIR · ENOENT · TypeError · SyntaxError)
  // or a quoted string ("EISDIR").
  const FN = "([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)"; // identifier chain
  const FN_CALL = FN + "(?:\\([^)]*\\))?";
  const ERR = "([A-Z][A-Z0-9_]{2,}|[A-Z][A-Za-z]*Error|[A-Z][A-Za-z]*Exception)";
  const patterns: RegExp[] = [
    new RegExp(FN_CALL + "\\s+(?:can\\s+|may\\s+)?throws?\\s+(?:an?\\s+)?" + ERR, "g"),
    new RegExp(FN_CALL + "\\s+(?:can\\s+|may\\s+)?raises?\\s+(?:an?\\s+)?" + ERR, "g"),
    new RegExp(FN_CALL + "\\s+returns?\\s+" + ERR + "\\s+(?:on|when)\\s+(?:error|failed|failure)", "g"),
    // Passive variants: "EISDIR is thrown by fs.readFileSync"
    new RegExp(ERR + "\\s+is\\s+thrown\\s+by\\s+" + FN_CALL, "g"),
    new RegExp(ERR + "\\s+is\\s+raised\\s+by\\s+" + FN_CALL, "g"),
  ];
  for (const p of patterns) {
    for (const m of s.matchAll(p)) {
      // The regex has two capture groups but the order differs for passive.
      // Determine order by inspecting which group is uppercase-error-shaped.
      const g1 = (m[1] ?? "").trim();
      const g2 = (m[2] ?? "").trim();
      if (!g1 || !g2) continue;
      const g1Err = /^[A-Z][A-Z0-9_]{2,}$/.test(g1) || /Error$|Exception$/.test(g1);
      const fn = g1Err ? g2 : g1;
      const err = g1Err ? g1 : g2;
      // De-dupe
      if (pairs.some((x) => x.fn === fn && x.err === err)) continue;
      pairs.push({ fn, err });
    }
  }
  return pairs;
}

/** RULE R7 · Skill-derived pattern gap (Phase 2 · cross-kind extension).
 *
 *  Skills describe abilities NEX has proven it can perform (verification_recipe
 *  documented · promotion_state indicates verification level). When a VERIFIED
 *  skill exists in a domain relevant to the review and its verification recipe
 *  describes a check the request evidence does not cover, R7 emits a MATERIAL
 *  finding.
 *
 *  SAFETY DISCIPLINE (mirrors R6 exactly):
 *   · MATERIAL max severity — never CRITICAL. R2 still owns CRITICAL.
 *   · Additive only — findings only accumulate through deriveVerdict.
 *   · Only VERIFIED promotion_state fires (OBSERVED / PRACTICED are audit only).
 *   · Confidence gate: skill.confidence ≥ 0.7.
 *   · Domain-relevance gate: skill.domain root must appear in request text.
 *   · Deterministic. Auditable via evidence_pointer pinning skill_id. */
function ruleSkillPatterns(req: ReviewRequest, skills: readonly SkillItem[]): Finding[] {
  const findings: Finding[] = [];
  if (!skills || skills.length === 0) return findings;

  const requestText = [
    req.requirement ?? "",
    req.implementation.summary ?? "",
    req.implementation.claim ?? "",
    req.tests.summary ?? "",
    (req.tests.known_gaps ?? []).join(" "),
    (req.runtime_evidence ?? []).join(" "),
  ].join(" ").toLowerCase();

  for (const s of skills) {
    // Gate 1 · promotion state must be VERIFIED
    if (s.promotion_state !== "VERIFIED") continue;
    // Gate 2 · confidence threshold
    if (typeof s.confidence !== "number" || s.confidence < 0.7) continue;
    // Gate 3 · domain relevance
    const domainRoot = (s.domain ?? "").toLowerCase().split(".")[0].trim();
    if (!domainRoot || domainRoot.length < 3) continue;
    if (!requestText.includes(domainRoot)) continue;

    // Extract required checks from verification_recipe (if present) or description
    const recipe = ((s.verification_recipe ?? "") + " " + (s.description ?? "")).trim();
    const missing = extractMissingRequiredPatterns(recipe, requestText);
    if (missing.length === 0) continue;

    findings.push({
      finding_id: nextFindingId("sf"),
      severity: "MATERIAL",
      category: "insufficient_evidence",
      message: `Skill-derived gap: verified skill '${s.name}' (domain=${s.domain}) indicates ${missing.length} required check(s) not evidenced in this request: ${missing.slice(0, 3).join(", ")}`,
      rationale: `Skill ${s.skill_id} (name='${s.name}' · domain=${s.domain} · promotion=VERIFIED · confidence=${s.confidence.toFixed(2)}) verification recipe describes checks the request evidence does not cover.`,
      evidence_pointer: `skill:${s.skill_id} vs review:${req.review_id}`,
      affected_behavior: `Behavior in skill '${s.name}': [${missing.slice(0, 3).join(", ")}] unaddressed`,
      recommended_correction: `Apply the skill's verified check(s) in tests or implementation: ${missing.join(", ")}.`,
    });
  }
  return findings;
}

/** RULE R8 · Experience-derived pattern gap (Phase 2 · cross-kind extension).
 *
 *  Experiences record what NEX actually did on real engineering tasks and what
 *  happened. A SUCCESS-outcome experience represents a proven pattern. If a
 *  request in the same domain lacks evidence of the pattern that the
 *  experience proved, R8 emits a MATERIAL finding pointing at the experience
 *  as prior art.
 *
 *  Additionally, FAILURE-outcome experiences with a root_cause + correction
 *  represent proven anti-patterns — if the current request matches the
 *  failure signature, R8 warns.
 *
 *  SAFETY DISCIPLINE (mirrors R6/R7):
 *   · MATERIAL max severity — never CRITICAL.
 *   · Additive only.
 *   · Only SUCCESS-outcome experiences with root_cause populated fire the
 *     pattern rule. FAILURE experiences fire only when their root_cause
 *     signature matches the current request pattern.
 *   · Confidence proxied via evidence completeness (≥2 evidence pointers).
 *   · Domain relevance via files_involved OR task text overlap with request. */
function ruleExperiencePatterns(req: ReviewRequest, experiences: readonly ExperienceItem[]): Finding[] {
  const findings: Finding[] = [];
  if (!experiences || experiences.length === 0) return findings;

  const requestText = [
    req.requirement ?? "",
    req.implementation.summary ?? "",
    req.implementation.claim ?? "",
    req.tests.summary ?? "",
    (req.tests.known_gaps ?? []).join(" "),
    (req.runtime_evidence ?? []).join(" "),
    (req.implementation.files ?? []).join(" "),
  ].join(" ").toLowerCase();

  for (const e of experiences) {
    // Gate 1 · evidence completeness proxy
    if (!e.evidence || e.evidence.length < 2) continue;
    // Gate 2 · SUCCESS with a lesson OR FAILURE with root_cause
    const isProvenPattern = e.outcome === "success" && (e.lessons?.length ?? 0) > 0;
    const isProvenAntiPattern = e.outcome === "failure" && !!e.root_cause;
    if (!isProvenPattern && !isProvenAntiPattern) continue;

    // Gate 3 · domain relevance via task text overlap
    const taskWords = (e.task ?? "").toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    let relevanceHits = 0;
    for (const w of taskWords) if (requestText.includes(w)) relevanceHits += 1;
    if (relevanceHits < 2) continue;

    if (isProvenPattern) {
      // Look for the lesson's required patterns in the request
      const lessonText = (e.lessons ?? []).join(" ");
      const missing = extractMissingRequiredPatterns(lessonText, requestText);
      if (missing.length === 0) continue;

      findings.push({
        finding_id: nextFindingId("ef"),
        severity: "MATERIAL",
        category: "insufficient_evidence",
        message: `Experience-derived gap: successful experience '${e.task}' indicates ${missing.length} required pattern(s) not evidenced in this request: ${missing.slice(0, 3).join(", ")}`,
        rationale: `Experience ${e.experience_id} (task='${e.task}' · outcome=success · ${e.evidence.length} evidence pointers) established a proven pattern via lessons: ${(e.lessons ?? []).slice(0, 2).join(" · ")}`,
        evidence_pointer: `experience:${e.experience_id} vs review:${req.review_id}`,
        affected_behavior: `Behavior related to '${e.task}': [${missing.slice(0, 3).join(", ")}] unaddressed`,
        recommended_correction: `Apply the pattern proven by experience ${e.experience_id}: ${missing.join(", ")}.`,
      });
    } else if (isProvenAntiPattern) {
      // Look for the root_cause signature in the request (matching means the
      // current request may be repeating the same mistake)
      const rootCauseWords = (e.root_cause ?? "").toLowerCase().split(/\s+/).filter((w) => w.length >= 5);
      let signatureHits = 0;
      for (const w of rootCauseWords) if (requestText.includes(w)) signatureHits += 1;
      if (signatureHits < 2) continue;

      findings.push({
        finding_id: nextFindingId("ef"),
        severity: "MATERIAL",
        category: "insufficient_evidence",
        message: `Experience-derived anti-pattern warning: this request's signature matches root_cause of failed experience '${e.task}'`,
        rationale: `Experience ${e.experience_id} (task='${e.task}' · outcome=failure · root_cause='${(e.root_cause ?? "").slice(0, 200)}' · correction='${(e.correction ?? "").slice(0, 200)}') failed under similar conditions.`,
        evidence_pointer: `experience:${e.experience_id} vs review:${req.review_id}`,
        affected_behavior: `Behavior related to '${e.task}' may repeat the prior failure.`,
        recommended_correction: `Apply the correction proven to resolve this failure: ${e.correction ?? "see experience record"}.`,
      });
    }
  }
  return findings;
}

/** Read skills/experiences from the store · filtered by relevant ids. */
export function consultSkills(relevantIds: string[] | undefined): SkillItem[] {
  if (!relevantIds || relevantIds.length === 0) return [];
  const all = readSkills();
  const idSet = new Set(relevantIds);
  return all.filter((s) => idSet.has(s.skill_id));
}
export function consultExperiences(relevantIds: string[] | undefined): ExperienceItem[] {
  if (!relevantIds || relevantIds.length === 0) return [];
  const all = readExperiences();
  const idSet = new Set(relevantIds);
  return all.filter((e) => idSet.has(e.experience_id));
}

// ─── Verdict derivation (deterministic) ─────────────────────────

/** Derive verdict from findings + evidence completeness. Rules
 *  applied in strict order · first match wins. Reasoning steps are
 *  emitted for the reasoning_trace. */
export function deriveVerdict(findings: Finding[], req: ReviewRequest): {
  verdict: ReviewVerdict;
  confidence: ReviewConfidence;
  reasoning: string[];
} {
  const trace: string[] = [];
  const tally = tallyFindingsBySeverity(findings);
  trace.push(`findings tally: INFO=${tally.INFO} WARNING=${tally.WARNING} MATERIAL=${tally.MATERIAL} CRITICAL=${tally.CRITICAL}`);

  // Rule V1: any CRITICAL → REJECT
  if (tally.CRITICAL > 0) {
    trace.push("CRITICAL finding(s) present → REJECT");
    return { verdict: "REJECT", confidence: "high", reasoning: trace };
  }

  // Rule V2: fatal evidence gap → UNCERTAIN
  // If the reviewer cannot form an opinion because BOTH tests AND
  // runtime evidence are absent, the honest verdict is UNCERTAIN.
  const hasTests = req.tests.passed > 0 || req.tests.failed > 0;
  const hasRuntime = (req.runtime_evidence ?? []).length > 0;
  const hasImplementationDetail = (req.implementation.summary ?? "").trim().length >= 10;
  if (!hasTests && !hasRuntime) {
    trace.push("no tests AND no runtime evidence → UNCERTAIN");
    return { verdict: "UNCERTAIN", confidence: "high", reasoning: trace };
  }
  if (!hasImplementationDetail) {
    trace.push("implementation summary too thin (<10 chars) → UNCERTAIN");
    return { verdict: "UNCERTAIN", confidence: "high", reasoning: trace };
  }

  // Rule V3: MATERIAL finding(s) → NEEDS_CHANGES
  if (tally.MATERIAL > 0) {
    trace.push("MATERIAL finding(s) present → NEEDS_CHANGES");
    const conf: ReviewConfidence = tally.MATERIAL >= 2 ? "high" : "medium";
    return { verdict: "NEEDS_CHANGES", confidence: conf, reasoning: trace };
  }

  // Rule V4: only WARNING(s) → ACCEPT_WITH_WARNINGS
  if (tally.WARNING > 0) {
    trace.push("only WARNING findings → ACCEPT_WITH_WARNINGS");
    return { verdict: "ACCEPT_WITH_WARNINGS", confidence: "medium", reasoning: trace };
  }

  // Rule V5: no findings + tests passed + declared claim supported → ACCEPT
  if (req.tests.passed > 0 && req.tests.failed === 0) {
    trace.push("no findings AND tests passed → ACCEPT");
    return { verdict: "ACCEPT", confidence: "high", reasoning: trace };
  }

  // Rule V6: no findings but tests didn't pass → NEEDS_CHANGES
  if (req.tests.failed > 0) {
    trace.push(`tests.failed=${req.tests.failed} → NEEDS_CHANGES`);
    return { verdict: "NEEDS_CHANGES", confidence: "high", reasoning: trace };
  }

  // Default (no findings, no tests, has runtime): ACCEPT_WITH_WARNINGS
  trace.push("no findings · only runtime evidence · no test coverage → ACCEPT_WITH_WARNINGS");
  return { verdict: "ACCEPT_WITH_WARNINGS", confidence: "medium", reasoning: trace };
}

// ─── Knowledge consultation ─────────────────────────────────────

/** Retrieve Phase B knowledge relevant to the review, if any ids
 *  supplied. Returns the KnowledgeItems that were actually found. */
export function consultKnowledge(relevantIds: string[] | undefined): KnowledgeItem[] {
  if (!relevantIds || relevantIds.length === 0) return [];
  const all = readKnowledge();
  const idSet = new Set(relevantIds);
  return all.filter((k) => idSet.has(k.knowledge_id));
}

// ─── Public entry point ─────────────────────────────────────────

/** Perform an independent review of the given request. Deterministic.
 *  Reviewer is not allowed to modify the store, filesystem, database,
 *  or invoke any provider. Returns a ReviewResponse. */
export function review(req: ReviewRequest): ReviewResponse {
  const reasoning: string[] = [];
  reasoning.push(`review_id=${req.review_id}`);
  reasoning.push(`claimed_by=${req.implementation.claimed_by} · treated as CLAIM not authority (§13)`);

  // Rules applied in fixed order (findings accumulate)
  const findings: Finding[] = [];
  findings.push(...ruleRequirementMismatch(req));
  reasoning.push(`R1 requirement_mismatch → ${findings.length} finding(s) so far`);
  findings.push(...ruleSecurity(req));
  reasoning.push(`R2 security → ${findings.length} finding(s) so far`);
  findings.push(...ruleUnsupportedClaims(req));
  reasoning.push(`R3 unsupported_claim → ${findings.length} finding(s) so far`);
  findings.push(...ruleRuntimeEvidence(req));
  reasoning.push(`R4 runtime_evidence → ${findings.length} finding(s) so far`);
  const testQuality = analyzeTestQuality(req);
  findings.push(...testQuality);
  reasoning.push(`R5 test_quality → +${testQuality.length} finding(s) · total ${findings.length}`);

  const knowledgeUsed = consultKnowledge(req.relevant_knowledge_ids);
  reasoning.push(`knowledge consulted: ${knowledgeUsed.length} item(s)${knowledgeUsed.length > 0 ? " · " + knowledgeUsed.map((k) => k.knowledge_id).join(", ") : ""}`);

  // R6 · Knowledge-derived pattern gap (Y-W5-1-C · additive only · never
  // produces CRITICAL · never overrides R1-R5). Runs AFTER R1-R5 so
  // knowledge findings accumulate onto the same findings array that
  // deriveVerdict processes — safety verdicts remain owned by R1-R5.
  const knowledgeFindings = ruleKnowledgePatterns(req, knowledgeUsed);
  findings.push(...knowledgeFindings);
  reasoning.push(`R6 knowledge_patterns → +${knowledgeFindings.length} finding(s) · total ${findings.length}`);

  // R9 · Knowledge-derived DESCRIPTIVE-FACT pattern gap (M2 fix · 2026-09-08).
  // Fires on "X throws Y" / "X raises Y" style knowledge that R6 (prescriptive-
  // only) cannot see. Same safety discipline as R6: additive-only · never
  // CRITICAL · VERIFIED+confidence≥0.7+domain-relevance gates.
  const knowledgeDescriptiveFindings = ruleKnowledgeDescriptiveFacts(req, knowledgeUsed);
  findings.push(...knowledgeDescriptiveFindings);
  reasoning.push(`R9 knowledge_descriptive_facts → +${knowledgeDescriptiveFindings.length} finding(s) · total ${findings.length}`);

  // R7 · Skill-derived pattern gap (Phase 2 cross-kind · additive only).
  const skillsUsed = consultSkills(req.relevant_skill_ids);
  reasoning.push(`skills consulted: ${skillsUsed.length} item(s)${skillsUsed.length > 0 ? " · " + skillsUsed.map((s) => s.skill_id).join(", ") : ""}`);
  const skillFindings = ruleSkillPatterns(req, skillsUsed);
  findings.push(...skillFindings);
  reasoning.push(`R7 skill_patterns → +${skillFindings.length} finding(s) · total ${findings.length}`);

  // R8 · Experience-derived pattern gap (Phase 2 cross-kind · additive only).
  const experiencesUsed = consultExperiences(req.relevant_experience_ids);
  reasoning.push(`experiences consulted: ${experiencesUsed.length} item(s)${experiencesUsed.length > 0 ? " · " + experiencesUsed.map((e) => e.experience_id).join(", ") : ""}`);
  const experienceFindings = ruleExperiencePatterns(req, experiencesUsed);
  findings.push(...experienceFindings);
  reasoning.push(`R8 experience_patterns → +${experienceFindings.length} finding(s) · total ${findings.length}`);

  const { verdict, confidence, reasoning: derivationTrace } = deriveVerdict(findings, req);
  reasoning.push(...derivationTrace);
  reasoning.push(`FINAL verdict=${verdict} · confidence=${confidence}`);

  const evidenceInspected: string[] = [
    ...(req.implementation.files ?? []).map((f) => `impl:${f}`),
    ...(req.tests.files ?? []).map((f) => `test:${f}`),
    ...(req.runtime_evidence ?? []).map((e) => `runtime:${e}`),
  ];

  return {
    review_id: req.review_id,
    verdict,
    confidence,
    findings,
    evidence_inspected: evidenceInspected,
    knowledge_used: knowledgeUsed.map((k) => k.knowledge_id),
    skills_used: skillsUsed.map((s) => s.skill_id),
    experiences_used: experiencesUsed.map((e) => e.experience_id),
    reasoning_trace: reasoning,
    reviewer_timestamp: req.reviewer_timestamp ?? new Date().toISOString(),
  };
}

// Re-exports for downstream test/proof runners.
export { analyzeTestQuality, tallyFindingsBySeverity, missingEdgeCases } from "./test-quality";
export type { Finding, FindingCategory, FindingSeverity, ReviewRequest, ReviewResponse, ReviewVerdict, ReviewConfidence } from "./types";
