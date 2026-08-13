// End-to-End Pipeline orchestrator · converse().
//
// Composes classifyIdentity + classifyUniversalIntent + retrieve + assembleResponse
// + captureLearning + updateDashboard into a single narrow API.
//
// Doctrine: docs/brains/nex-end-to-end-pipeline-philip-2026-08-03.md

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { classifyIdentity, registerToAudienceLevel } from "../identity";
import { classifyUniversalIntent } from "../universal-intent";
import { retrieve } from "../knowledge-layer";
import type { KnowledgeYamlDeclaration, MaturityLevel } from "../knowledge-layer";
import { generateRecommendations } from "./recommend";
import type {
  PipelineRequest,
  PipelineResponse,
  PipelineTrace,
  CoverageCheck,
  LayeredConfidence,
  AssembledResponse,
} from "./types";

const PIPELINE_VERSION = "1.0";
const LEARNING_LOG = path.join(process.cwd(), "data", "nex-learning-log.jsonl");
const KNOWLEDGE_ROOT = path.join(process.cwd(), "data", "nex-knowledge");

const COVERAGE_MULTIPLIER: Record<CoverageCheck["maturity_level"], number> = {
  gold: 1.0,
  silver: 1.0,
  bronze: 0.85,
  pending: 0.6,
};

function normaliseDomain(d: string): string {
  return d.toLowerCase().replace(/\s+/g, "_");
}

/** Domain keyword fallback — if the classifier returned "General" or a mismatched domain,
 *  scan for hard domain keywords in the input. Preserves classifier decision when explicit. */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  staircase: ["staircase", "stairs", "handrail", "banister", "balustrade", "spindle", "newel", "tread", "riser", "winder", "stringer", "landing", "step"],
  kitchen: ["kitchen", "cabinet", "worktop", "hob", "cooker", "extractor", "splashback", "shaker", "kickboard", "plinth", "island", "pantry"],
  door: ["door", "doorway", "internal door", "front door"],
  window: ["window", "glazing", "sash"],
  flooring: ["flooring", "floor", "laminate", "lvt", "engineered oak"],
};

function refineDomain(classifiedDomain: string, input: string): string {
  const lower = input.toLowerCase();
  const normalised = normaliseDomain(classifiedDomain);
  // Score every domain by keyword hits in the input · pick the strongest.
  const domainScores: Array<{ domain: string; score: number }> = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) if (lower.includes(kw)) score++;
    if (score > 0) domainScores.push({ domain, score });
  }
  domainScores.sort((a, b) => b.score - a.score);
  const topByKeywords = domainScores[0];

  // If input has a clear keyword signal, prefer it over the classifier's guess.
  if (topByKeywords && topByKeywords.score >= 1) return topByKeywords.domain;
  // If classifier gave a specific domain and no keywords matched, keep it.
  if (normalised && normalised !== "general") return normalised;
  return "general";
}

function checkCoverage(domain: string): CoverageCheck {
  const yamlPath = path.join(KNOWLEDGE_ROOT, domain, "knowledge.yaml");
  if (!fs.existsSync(yamlPath)) {
    return {
      domain,
      maturity_level: "pending",
      coverage_multiplier: COVERAGE_MULTIPLIER.pending,
      overall_coverage_percent: null,
      soft_caveat: `Domain '${domain}' is not yet authored in the Knowledge Layer. Response may be limited.`,
    };
  }
  // Minimal YAML parse for maturity_level + overall_coverage_percent.
  const raw = fs.readFileSync(yamlPath, "utf8");
  const maturityMatch = raw.match(/^maturity_level:\s*(bronze|silver|gold)/m);
  const coverageMatch = raw.match(/^\s*overall_coverage_percent:\s*(\d+(?:\.\d+)?)/m);
  const maturity: MaturityLevel | "pending" = (maturityMatch?.[1] as MaturityLevel) ?? "pending";
  const overallCoverage = coverageMatch ? Number(coverageMatch[1]) : null;
  const soft_caveat = maturity === "bronze"
    ? `The ${domain} domain is early-stage — accuracy improves as we author more.`
    : null;
  return {
    domain,
    maturity_level: maturity,
    coverage_multiplier: COVERAGE_MULTIPLIER[maturity],
    overall_coverage_percent: overallCoverage,
    soft_caveat,
  };
}

function computeConfidence(
  identityConf: number,
  intentConf: number,
  knowledgeConf: number,
  coverageMultiplier: number,
): LayeredConfidence {
  const gated = Math.min(identityConf, intentConf, knowledgeConf) * coverageMultiplier;
  return {
    identity: identityConf,
    intent: intentConf,
    knowledge: knowledgeConf,
    coverage_multiplier: coverageMultiplier,
    overall: Number(gated.toFixed(3)),
    needs_clarification: gated < 0.7,
  };
}

function assembleResponse(
  input: string,
  identityRegister: string,
  intent: { verb: string; domain: string; capability: string },
  knowledge: import("../knowledge-layer").RetrieveResult,
  coverage: CoverageCheck,
  confidence: LayeredConfidence,
): AssembledResponse {
  // Brain 14 (Never-Guess) gate — if confidence <0.7, return a clarifying question.
  if (confidence.needs_clarification) {
    const missing = knowledge.items.length === 0
      ? `your ${intent.layer2_domain} question in more detail`
      : `a bit more about what matters most to you`;
    return {
      text: "",
      next_step_offered: "",
      clarifying_question: `I want to give you the most useful answer — could you tell me ${missing}?`,
      cited_sources: [],
      cited_items: [],
    };
  }

  // Template-based composition (MVP · Phase D.5).
  const topItems = knowledge.items.slice(0, 3);
  const sources = [...new Set(knowledge.sources)];
  const citedIds = topItems.map((i) => i.id);

  const openingByRegister: Record<string, string> = {
    homeowner_novice: "Happy to help with your project.",
    homeowner_informed: "Good question.",
    builder: "Here's what matters for the install.",
    joiner: "From a joinery perspective:",
    architect: "For specification:",
    interior_designer: "For the design brief:",
    developer: "For the programme:",
    manufacturer: "For production:",
    student: "Here's how it works:",
    diy: "Straightforward one for a DIY approach:",
    business_owner: "Here's the practical answer:",
  };
  const opening = openingByRegister[identityRegister] ?? "Here's what I found:";

  const summary = topItems
    .map((item, idx) => {
      const bullet = `${idx + 1}. ${item.summary}`;
      const contentPreview = typeof item.content.answer === "string"
        ? String(item.content.answer).slice(0, 240) + (String(item.content.answer).length > 240 ? "…" : "")
        : "";
      return contentPreview ? `${bullet}\n   ${contentPreview}` : bullet;
    })
    .join("\n\n");

  const caveat = coverage.soft_caveat ? `\n\n*${coverage.soft_caveat}*` : "";

  const nextStep = intent.capability === "Quote"
    ? "Want me to put together a quote for your specific requirements?"
    : intent.capability === "Design"
    ? "Would you like to see reference images of this style?"
    : intent.capability === "Recommend"
    ? "Want me to narrow this down based on your budget and style?"
    : "Want me to go deeper on any of these?";

  const text = `${opening}\n\n${summary}${caveat}`;

  return {
    text,
    next_step_offered: nextStep,
    clarifying_question: null,
    cited_sources: sources,
    cited_items: citedIds,
  };
}

function captureLearning(trace: PipelineTrace): boolean {
  try {
    fs.mkdirSync(path.dirname(LEARNING_LOG), { recursive: true });
    const row = {
      timestamp: trace.timestamp,
      session_id: trace.session_id,
      trace_hash: crypto
        .createHash("sha256")
        .update(JSON.stringify({
          input: trace.input,
          identity: trace.identity.register,
          intent: trace.intent.layer1_verb + "/" + trace.intent.layer2_domain,
        }))
        .digest("hex")
        .slice(0, 16),
      input: trace.input,
      identity_register: trace.identity.register,
      identity_confidence: trace.identity.confidence,
      intent_verb: trace.intent.layer1_verb,
      intent_domain: trace.intent.layer2_domain,
      intent_capability: trace.intent.layer3_capability,
      intent_confidence: trace.intent.confidence,
      knowledge_items_retrieved: trace.knowledge.items.length,
      knowledge_sources: trace.knowledge.sources,
      knowledge_confidence: trace.knowledge.overall_confidence,
      coverage_maturity: trace.coverage.maturity_level,
      overall_confidence: trace.confidence.overall,
      needs_clarification: trace.confidence.needs_clarification,
      response_length_chars: trace.response.text.length,
      user_success_signal: null,
      was_useful_feedback: null,
    };
    fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

export function converse(req: PipelineRequest): PipelineResponse {
  const input = req.input.trim();
  const session_id = req.session_id ?? crypto.randomBytes(8).toString("hex");
  const timestamp = new Date().toISOString();

  if (!input) {
    return {
      response_text: "",
      needs_clarification: true,
      clarifying_question: "What can I help you with today?",
      next_step: "Tell me about your project.",
      sources: [],
      confidence: 0,
      recommendations: { categories: {}, total_count: 0, register_adapted_for: "homeowner_novice", trace_reason: "empty input" },
    };
  }

  // Stage 2 · Identity.
  const identity = classifyIdentity(input);

  // Stage 3 · Goal (either pre-selected or inferred from intent later).
  const goal = { id: req.goal_id ?? null, inferred_from_intent: !req.goal_id };

  // Stage 4 · Intent.
  const intent = classifyUniversalIntent(input);

  // Stage 5 · Knowledge retrieval.
  const domain = refineDomain(intent.layer2_domain, input);
  const knowledge = retrieve({
    domain,
    query: input,
    filters: {
      audience_level: registerToAudienceLevel(identity.register),
    },
    limit: 5,
    min_relevance: 0.05,
    min_confidence: 0.7,
  });

  // Stage 6 · Coverage.
  const coverage = checkCoverage(domain);

  // Stage 7 · Confidence.
  const confidence = computeConfidence(
    identity.confidence,
    intent.confidence,
    knowledge.overall_confidence,
    coverage.coverage_multiplier,
  );

  // Stage 8-9 · Response + sources.
  const response = assembleResponse(input, identity.register, intent, knowledge, coverage, confidence);

  // Stage 8b · Recommendation Engine (Phase D.6 · Q → A → Recommendations).
  const recommendations = confidence.needs_clarification
    ? { categories: {}, total_count: 0, register_adapted_for: identity.register, trace_reason: "suppressed · needs_clarification true" }
    : generateRecommendations(domain, intent, identity.register);

  // Full trace.
  const trace: PipelineTrace = {
    pipeline_version: PIPELINE_VERSION,
    timestamp,
    session_id,
    input,
    identity,
    goal,
    intent,
    knowledge,
    coverage,
    confidence,
    response,
    recommendations,
    learning_captured: false,
    dashboard_signal_recorded: false,
    trace_reason: `Pipeline v${PIPELINE_VERSION} · identity=${identity.register}(${identity.confidence.toFixed(2)}) · intent=${intent.layer1_verb}/${intent.layer2_domain}(${intent.confidence.toFixed(2)}) · knowledge=${knowledge.items.length}items(${knowledge.overall_confidence.toFixed(2)}) · coverage=${coverage.maturity_level} · overall=${confidence.overall} · recommendations=${recommendations.total_count} · needs_clarification=${confidence.needs_clarification}`,
  };

  // Stage 10 · Learning capture.
  trace.learning_captured = captureLearning(trace);

  // Stage 11 · Dashboard signal recorded (MVP: same log; dashboard reads on demand).
  trace.dashboard_signal_recorded = trace.learning_captured;

  return {
    response_text: response.text,
    needs_clarification: confidence.needs_clarification,
    clarifying_question: response.clarifying_question,
    next_step: response.next_step_offered,
    sources: response.cited_sources,
    confidence: confidence.overall,
    recommendations,
    trace,
  };
}
