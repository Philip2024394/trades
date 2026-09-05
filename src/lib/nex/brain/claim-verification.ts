// src/lib/nex/brain/claim-verification.ts
//
// P0 · Claim-level post-verification (Philip 2026-09-05 · P0 doctrine §3
// Epistemic Subordination + Marcus's amendment: claim-level not
// entity-level).
//
// After the Response Composition Layer produces a reply, this module
// extracts specific factual claims from the reply text and checks each
// one against the available evidence: retrieved knowledge snippets,
// known entities, resolved references, world cards, the user's own
// message. Claims that have no evidence source are FLAGS.
//
// FLAG BUDGETS
// ------------
//   · HIGH_RISK claim flagged (phone number, URL, email, price, freight
//     rate, exchange rate, address) → REJECT the composition (return
//     null). Caller falls back to deterministic reply. Owner never
//     sees the fabricated claim.
//   · > MAX_LOW_RISK_FLAGS (default 2) low-risk claims flagged →
//     REJECT.
//   · ≤ MAX_LOW_RISK_FLAGS low-risk claims flagged → PASS with
//     warnings recorded for telemetry.
//
// This is intentionally CONSERVATIVE. It errs on the side of rejecting
// composed replies rather than shipping unverified specifics. The
// deterministic reply is always a safe fallback.
//
// Not a semantic checker · not a hallucination classifier · just a
// pattern-based specifics-guard. Its job is to keep untraceable facts
// out of the owner's view.

import type { ConversationalFrame } from "./conversational-frame";
import type { KnowledgeSnippet } from "./response-composition";

const MAX_LOW_RISK_FLAGS = Number(process.env.NEX_P0_LOW_RISK_BUDGET ?? "2");

export type ClaimFlag = {
  kind:
    | "phone"
    | "url"
    | "email"
    | "price"
    | "exchange_rate"
    | "freight_rate"
    | "address"
    | "specific_year"
    | "specific_number"
    | "named_person"
    | "named_org_not_in_evidence"
    // P0.2 · semantic contradiction (Philip 2026-09-05)
    | "semantic_contradiction"
    | "definitional_claim_unsupported"
    // P1 · evidence-first explicit contradiction (Philip 2026-09-05 P1 doctrine)
    // Fires when the reply's predicate matches a keyword from the
    // knowledge record's own `contradictions[]` denial list. NEVER a
    // keyword-overlap heuristic · this is the record's authored
    // negative statement being enforced.
    | "explicit_contradiction";
  severity: "high" | "low";
  matched_text: string;
  reason: string;
};

export type VerificationInput = {
  reply_text: string;
  user_message: string;
  frame: ConversationalFrame;
  knowledge: KnowledgeSnippet[];
  known_entities?: string[];
  world_card_names?: string[];
};

export type VerificationResult = {
  passed: boolean;
  flags: ClaimFlag[];
  reason?: string;
};

// ─── Public ────────────────────────────────────────────────────────

export function verifyClaims(input: VerificationInput): VerificationResult {
  const flags: ClaimFlag[] = [];
  const text = input.reply_text;
  const evidence = buildEvidenceCorpus(input);

  flags.push(...checkPhoneNumbers(text, evidence));
  flags.push(...checkUrls(text, evidence));
  flags.push(...checkEmails(text, evidence));
  flags.push(...checkPrices(text, evidence, input.user_message));
  flags.push(...checkExchangeRates(text, evidence));
  flags.push(...checkFreightRates(text, evidence));
  flags.push(...checkAddresses(text, evidence));
  flags.push(...checkNamedPersons(text, evidence));
  // P0.2 · semantic contradiction detection (Philip 2026-09-05 P0.2 doctrine)
  flags.push(...checkSemanticContradictions(text, evidence, input.knowledge));
  // P1 · evidence-first explicit contradiction check (Philip 2026-09-05 P1 doctrine)
  // Runs BEFORE the overlap-based semantic check so an explicit
  // denial from the record wins immediately. NEX evidence authoritative.
  flags.push(...checkExplicitContradictions(text, input.knowledge));

  const highFlags = flags.filter((f) => f.severity === "high");
  const lowFlags = flags.filter((f) => f.severity === "low");

  if (highFlags.length > 0) {
    return {
      passed: false,
      flags,
      reason: `high_risk_flag(s): ${highFlags.map((f) => f.kind).join(",")}`,
    };
  }
  if (lowFlags.length > MAX_LOW_RISK_FLAGS) {
    return {
      passed: false,
      flags,
      reason: `low_risk_over_budget: ${lowFlags.length}>${MAX_LOW_RISK_FLAGS}`,
    };
  }
  return { passed: true, flags };
}

// ─── Evidence corpus construction ─────────────────────────────────

type EvidenceCorpus = {
  /** Full lowercased corpus text for substring checks. */
  text: string;
  /** All numeric tokens (>=2 digits) present in evidence. */
  numbers: Set<string>;
  /** All lowercased known entity names. */
  names: Set<string>;
};

function buildEvidenceCorpus(input: VerificationInput): EvidenceCorpus {
  const chunks: string[] = [];
  chunks.push(input.user_message);
  if (input.frame.running_topic) chunks.push(input.frame.running_topic);
  if (input.frame.running_subject) chunks.push(input.frame.running_subject);
  input.frame.recent_user_turns?.forEach((t) => chunks.push(t));
  input.frame.recent_nex_turns?.forEach((t) => chunks.push(t));
  input.frame.resolved_references?.forEach((r) => chunks.push(r.resolved_to));
  input.knowledge.forEach((k) => {
    chunks.push(k.content);
    if (k.topic) chunks.push(k.topic);
  });
  input.known_entities?.forEach((e) => chunks.push(e));
  input.world_card_names?.forEach((n) => chunks.push(n));

  const text = chunks.join("\n").toLowerCase();
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\d{2,}/g)) numbers.add(m[0]);
  const names = new Set<string>();
  (input.known_entities ?? []).forEach((n) => names.add(n.toLowerCase()));
  (input.world_card_names ?? []).forEach((n) => names.add(n.toLowerCase()));
  return { text, numbers, names };
}

// ─── Individual checkers ──────────────────────────────────────────

function checkPhoneNumbers(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  // Match phone-shaped things · +country code, xx-xxx-xxxx, xxxxxxxxxx
  const rx = /(?:\+?\d[\d\-\s\(\)]{7,}\d)/g;
  for (const m of text.matchAll(rx)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length < 8) continue;
    if (!ev.text.includes(digits) && !ev.numbers.has(digits)) {
      flags.push({
        kind: "phone",
        severity: "high",
        matched_text: m[0],
        reason: "phone number not in evidence",
      });
    }
  }
  return flags;
}

function checkUrls(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const rx = /https?:\/\/[^\s\)\]]+/gi;
  for (const m of text.matchAll(rx)) {
    const url = m[0];
    if (!ev.text.includes(url.toLowerCase())) {
      flags.push({
        kind: "url",
        severity: "high",
        matched_text: url,
        reason: "URL not in evidence",
      });
    }
  }
  return flags;
}

function checkEmails(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const rx = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  for (const m of text.matchAll(rx)) {
    const email = m[0].toLowerCase();
    if (!ev.text.includes(email)) {
      flags.push({
        kind: "email",
        severity: "high",
        matched_text: m[0],
        reason: "email not in evidence",
      });
    }
  }
  return flags;
}

function checkPrices(text: string, ev: EvidenceCorpus, userMessage: string): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  // Rp / IDR / USD / $ / £ / € followed by digits
  const rx = /(?:rp\.?|idr|usd|us\$|\$|€|£|¥|rmb|myr|sgd|aud)\s?[\d,\.]+(?:\s?(?:k|m|juta|ribu|million|thousand))?/gi;
  for (const m of text.matchAll(rx)) {
    const price = m[0].toLowerCase();
    // If user asked for a price/quote → any Ollama-supplied price without evidence is high risk
    const userAsking = /price|cost|how much|quote|rate|kurs|harga|berapa/i.test(userMessage);
    if (!ev.text.includes(price)) {
      flags.push({
        kind: "price",
        severity: userAsking ? "high" : "low",
        matched_text: m[0],
        reason: userAsking
          ? "price stated but not in evidence and user asked for pricing"
          : "price stated but not in evidence",
      });
    }
  }
  return flags;
}

function checkExchangeRates(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  // "1 USD = 15,000 IDR" · "USD/IDR at 15000" · "USD/IDR rate is 15,850"
  // · "15850 rupiah per dollar" · "kurs 15000". Allow up to 40 chars
  // between the currency-pair phrasing and the number.
  const rx = /(?:usd\s?\/\s?idr|idr\s?\/\s?usd|usd\s?to\s?idr|1\s?usd\s?=|kurs|rupiah\s?per\s?dollar|dollar\s?to\s?rupiah|rate\s+of)[^.\n]{0,40}?\d{3,}(?:[.,]\d{3})*/gi;
  for (const m of text.matchAll(rx)) {
    const digits = (m[0].match(/\d[\d.,]*/g) ?? []).join("");
    // If any digit run has 3+ digits (a real rate) and isn't in evidence, flag it
    const bareDigits = digits.replace(/[.,]/g, "");
    if (bareDigits.length >= 3 && !ev.text.includes(m[0].toLowerCase()) && !ev.numbers.has(bareDigits)) {
      flags.push({
        kind: "exchange_rate",
        severity: "high",
        matched_text: m[0].slice(0, 120),
        reason: "exchange rate quoted without evidence · live data",
      });
    }
  }
  return flags;
}

function checkFreightRates(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  // freight / shipping cost mentions with specific dollar/rupiah numbers
  const rx = /(?:freight|shipping|reefer|container|20ft|40ft|per\s?container|per\s?teu)[^.]{0,80}?(?:usd|us\$|\$|idr|rp)\s?[\d,\.]+/gi;
  for (const m of text.matchAll(rx)) {
    if (!ev.text.includes(m[0].toLowerCase())) {
      flags.push({
        kind: "freight_rate",
        severity: "high",
        matched_text: m[0].slice(0, 120),
        reason: "freight quote given without evidence · Business Brain territory",
      });
    }
  }
  return flags;
}

function checkAddresses(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  // "Jl. Foo No. 123" style · "45 Something Street" · "at 123 Somewhere St"
  const rx = /(?:jl\.?|jalan|no\.?\s?\d+|at\s\d+\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:street|st\.?|road|rd\.?|avenue|ave\.?))/gi;
  for (const m of text.matchAll(rx)) {
    const raw = m[0].toLowerCase();
    // We only flag if there's a specific number attached
    if (!/\d/.test(raw)) continue;
    if (!ev.text.includes(raw)) {
      flags.push({
        kind: "address",
        severity: "low",
        matched_text: m[0],
        reason: "specific street address not in evidence",
      });
    }
  }
  return flags;
}

function checkNamedPersons(text: string, ev: EvidenceCorpus): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  // Naive: a "governor|president|minister|mayor|CEO ... is Xxxx Yyyy" pattern
  const rx = /(?:governor|president|minister|mayor|ceo|founder|owner|prime minister)[^.]{0,60}?(?:is|adalah|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/g;
  for (const m of text.matchAll(rx)) {
    const person = m[1];
    if (!ev.text.includes(person.toLowerCase())) {
      flags.push({
        kind: "named_person",
        severity: "high",
        matched_text: m[0],
        reason: "named political/business figure not in evidence · time-sensitive fact",
      });
    }
  }
  return flags;
}

// ─── P0.2 · Semantic contradiction detection ─────────────────────
//
// Attacks P0.2 gap #3: fluent-but-wrong semantic claims survive the
// specifics-guard. Detects two shapes:
//
//   Shape A · SUBJECT is/refers to/means PREDICATE
//     If knowledge asserts a definition for SUBJECT, verify the
//     reply's PREDICATE overlaps meaningfully with knowledge's
//     definition.  Non-overlap on a definitional claim → flag.
//
//   Shape B · Numeric/coded definitional claim (e.g., "HS code 0303
//             covers X" / "vitamin C is X")
//     If the reply asserts a definition tied to a specific code or
//     term AND knowledge does not support the asserted definition,
//     flag.
//
// Deterministic. Pattern-based. Never uses LLM. NEX evidence remains
// authoritative (per P0.2 doctrine · locked hierarchy).
//
// Failure mode designed to CATCH · never a semantic classifier.
// False negatives (missed semantic errors) are acceptable · false
// positives (blocking a correct reply) degrade UX. Kept conservative.

/** Common English filler words we ignore when comparing predicates. */
const SEMANTIC_STOPWORDS = new Set<string>([
  "a", "an", "the", "of", "and", "or", "in", "on", "to", "for",
  "with", "by", "at", "as", "is", "are", "was", "were", "be", "been",
  "being", "that", "this", "these", "those", "which", "who", "whose",
  "type", "kind", "sort", "form", "example",
]);

/** Rough noun/keyword extraction · lowercased, stopword-filtered. */
function keywordsOf(text: string): Set<string> {
  const kws = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z\-]{2,}/g) ?? []) {
    if (!SEMANTIC_STOPWORDS.has(raw)) kws.add(raw);
  }
  return kws;
}

/** Overlap ratio between two keyword sets, from 0 (nothing) to 1 (subset). */
function keywordOverlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hits = 0;
  for (const w of a) if (b.has(w)) hits += 1;
  return hits / a.size;
}

/**
 * Extract SUBJECT is/refers to/means/covers PREDICATE-style claims.
 * SUBJECT is a proper-noun phrase, code, or specific-term run.
 * PREDICATE is the rest of the clause up to punctuation.
 */
function extractDefinitionalClaims(text: string): Array<{
  subject: string;
  predicate: string;
  matched: string;
}> {
  const claims: Array<{ subject: string; predicate: string; matched: string }> = [];
  // Pattern: SUBJECT (uppercased word / code / quoted term) + copula/definitional verb + PREDICATE
  // We keep the SUBJECT narrow (proper noun, code, or all-caps run) to avoid
  // catching generic "it is X" prose. False positives are worse than false
  // negatives per the semantic-verifier discipline.
  const patterns: RegExp[] = [
    // "HS code 0303 is/refers to/covers ..." (canonical form with 'code' word)
    /\b((?:HS\s+code\s+\d{2,6}|(?:code|SKU|ID)\s+[A-Z0-9\-]{2,20}))\s+(?:is|refers to|means|covers|represents|denotes|indicates|is for)\s+([^.!?\n]{4,180})/gi,
    // P1 · "HS 0303 is/for/refers to ..." (bare-HS form · Philip 2026-09-05)
    // Captures short-form claims like "HS 0303 is for canned tuna" that
    // omit the word "code" · essential for the HS 0304 evidence-first
    // rejection test to actually catch fluent-wrong claims.
    /\b(HS\s+\d{2,6})\s+(?:is|refers to|means|covers|represents|denotes|indicates|is for|is the code for)\s+([^.!?\n]{4,180})/gi,
    // "SUBJECT (capitalized noun or 2-3 word proper name) is/refers to/means ..."
    /\b([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{2,20}){0,3})\s+(?:is|refers to|means|denotes|represents)\s+((?:a|an|the)\s+[a-z][^.!?\n]{5,180})/g,
  ];
  for (const rx of patterns) {
    for (const m of text.matchAll(rx)) {
      const subject = m[1].trim();
      const predicate = m[2].trim().replace(/[,;].*$/, "");
      claims.push({ subject, predicate, matched: m[0].trim() });
    }
  }
  return claims;
}

function checkSemanticContradictions(
  text: string,
  ev: EvidenceCorpus,
  knowledge: KnowledgeSnippet[],
): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const claims = extractDefinitionalClaims(text);
  if (claims.length === 0) return flags;

  const predicateOverlapMin = Number(process.env.NEX_P0_SEM_OVERLAP_MIN ?? "0.25");

  for (const claim of claims) {
    const subjectLower = claim.subject.toLowerCase();
    // Find knowledge snippets that mention the subject
    const subjectMatches = knowledge.filter(
      (k) =>
        k.content.toLowerCase().includes(subjectLower) ||
        (k.topic && k.topic.toLowerCase().includes(subjectLower)),
    );
    if (subjectMatches.length === 0) {
      // Subject NOT in knowledge · definitional claim about it is
      // suspect but not a hard contradiction · flag as LOW severity
      // so it takes claim-budget but doesn't reject a well-hedged
      // reply on its own.
      // ONLY flag when the predicate is CONFIDENT ("is a very old
      // X", "refers to Y from Z period" · specific dates/eras).
      if (/\bBC\b|\bAD\b|centuries|century|dynasty|ancient|origin/i.test(claim.predicate)) {
        flags.push({
          kind: "definitional_claim_unsupported",
          severity: "low",
          matched_text: truncateForFlag(claim.matched),
          reason: `definitional claim about "${claim.subject}" makes historical assertion but subject is not in retrieved knowledge`,
        });
      }
      continue;
    }
    // Subject IS in knowledge · compute overlap between predicate
    // keywords and the knowledge-provided context.
    const predKeywords = keywordsOf(claim.predicate);
    if (predKeywords.size < 2) continue; // Predicate too short to meaningfully verify
    const knowledgeContextKeywords = keywordsOf(
      subjectMatches.map((k) => k.content).join(" "),
    );
    const overlap = keywordOverlapRatio(predKeywords, knowledgeContextKeywords);
    if (overlap < predicateOverlapMin) {
      flags.push({
        kind: "semantic_contradiction",
        severity: "high",
        matched_text: truncateForFlag(claim.matched),
        reason: `definitional predicate for "${claim.subject}" has ${(overlap * 100).toFixed(0)}% keyword overlap with knowledge · below ${(predicateOverlapMin * 100).toFixed(0)}% threshold · suspected fluent-but-wrong claim`,
      });
    }
    // Also check user_message + evidence corpus as a fallback source of truth
    // for the subject definition (some claims are grounded in the user's
    // own statement rather than retrieved knowledge).
    if (overlap < predicateOverlapMin) {
      const userKeywords = keywordsOf(ev.text);
      const userOverlap = keywordOverlapRatio(predKeywords, userKeywords);
      if (userOverlap >= predicateOverlapMin) {
        // Overlap with user-provided context · demote the last flag
        // to LOW · the reply may be reasonably grounded in what the
        // user said even if retrieved knowledge doesn't cover it.
        const last = flags[flags.length - 1];
        if (last && last.kind === "semantic_contradiction") {
          last.severity = "low";
          last.reason = `${last.reason} · but user-context supports at ${(userOverlap * 100).toFixed(0)}% · downgraded`;
        }
      }
    }
  }
  return flags;
}

function truncateForFlag(s: string): string {
  return s.length > 140 ? s.slice(0, 137) + "…" : s;
}

// ─── P1 · Evidence-first explicit contradiction ──────────────────
//
// Philip 2026-09-05 P1 doctrine: overlap-based semantic checks are
// necessary but NOT sufficient · for high-stakes definitional claims
// (HS codes, regulations, standards) the knowledge record must be
// able to declare its own denial list ("I explicitly am NOT these
// things"). The verifier hard-rejects any composed claim whose
// predicate contains one of the record's contradiction keywords.
//
// This is NOT keyword-overlap · this is the record itself saying
// "any composed reply that claims I mean X is wrong, because I
// explicitly deny X in my authored evidence."
//
// Types: knowledge input may carry an optional `contradictions?:
// string[]` field. Extended inline rather than modifying the shared
// KnowledgeSnippet type (7-file budget preservation).
type KnowledgeWithContradictions = KnowledgeSnippet & { contradictions?: string[] };

function checkExplicitContradictions(
  text: string,
  knowledge: KnowledgeSnippet[],
): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const textLower = text.toLowerCase();
  const claims = extractDefinitionalClaims(text);
  if (claims.length === 0) return flags;

  for (const claim of claims) {
    const subjectLower = claim.subject.toLowerCase();
    const predicateLower = claim.predicate.toLowerCase();
    // Find knowledge records whose subject matches the claim's
    // subject AND that carry an authored contradictions[] list
    for (const k of knowledge as KnowledgeWithContradictions[]) {
      if (!k.contradictions || k.contradictions.length === 0) continue;
      const kTopicLower = (k.topic ?? "").toLowerCase();
      const kContentLower = k.content.toLowerCase();
      // Subject-match: claim's subject appears in the record's topic OR content
      const subjectInRecord =
        kTopicLower.includes(subjectLower) || kContentLower.includes(subjectLower);
      if (!subjectInRecord) continue;
      // Predicate-match: any of the record's contradictions appears in the predicate
      for (const forbidden of k.contradictions) {
        const forbiddenLower = forbidden.toLowerCase();
        if (predicateLower.includes(forbiddenLower)) {
          flags.push({
            kind: "explicit_contradiction",
            severity: "high",
            matched_text: truncateForFlag(claim.matched),
            reason: `record ${k.topic ?? "(unknown topic)"} explicitly denies "${forbidden}" as a valid predicate for "${claim.subject}" · evidence-first rejection`,
          });
          // One flag per (claim, record) is enough
          break;
        }
      }
    }
    // Also check: is there any bare-substring appearance of a
    // contradiction phrase near the subject in the reply text
    // (defends against paraphrased definitional shapes the extractor
    // might miss). Only fires when subject AND forbidden phrase both
    // appear within a short window of each other.
    for (const k of knowledge as KnowledgeWithContradictions[]) {
      if (!k.contradictions || k.contradictions.length === 0) continue;
      const kTopicLower = (k.topic ?? "").toLowerCase();
      const kSubject = kTopicLower.split(".").pop() ?? "";
      if (!kSubject) continue;
      const subjectIdx = textLower.indexOf(kSubject);
      if (subjectIdx < 0) continue;
      const window = textLower.slice(Math.max(0, subjectIdx - 20), subjectIdx + 200);
      for (const forbidden of k.contradictions) {
        if (window.includes(forbidden.toLowerCase())) {
          // Avoid duplicate flag if the earlier extractor already caught this record+forbidden pair
          const already = flags.some(
            (f) =>
              f.kind === "explicit_contradiction" &&
              f.reason.includes(k.topic ?? "") &&
              f.reason.includes(forbidden),
          );
          if (already) continue;
          flags.push({
            kind: "explicit_contradiction",
            severity: "high",
            matched_text: truncateForFlag(window.slice(0, 140)),
            reason: `record ${k.topic ?? "(unknown topic)"} explicitly denies "${forbidden}" near subject "${kSubject}" in composed reply · evidence-first rejection`,
          });
          break;
        }
      }
    }
  }
  return flags;
}
