// scripts/session4a-qwen-test.ts
//
// SESSION 4a · Qwen 2.5 3B quality diagnostic.
//
// Purpose (Philip 2026-08-20):
//   Before we choose an integration path (A/B/C/D) that wires local
//   Qwen into Summit's chat, we need to know if Qwen 2.5 3B can
//   RELIABLY produce structured design mutations from natural
//   language via tool-use. This script exercises the staircase agent
//   through six acceptance scenarios against the Ollama-backed brain
//   and reports pass/fail per scenario + raw output for eyeballing.
//
//   MEASUREMENT is structured-mutation correctness. NOT prose
//   quality. If Qwen produces the right (field, canonical slug)
//   pairs — and refuses to mutate on questions / ambiguous input —
//   the model is fit to drive the doctrine. If it hallucinates
//   fields, invents slugs, or fires updateStaircaseDesign on
//   questions, it isn't.
//
// USAGE
//   # Ensure Ollama is running with qwen2.5:3b pulled.
//   #   ollama pull qwen2.5:3b
//   #   ollama serve  (in another shell)
//   NEX_BRAIN_PROVIDER=ollama npx tsx scripts/session4a-qwen-test.ts
//
//   # Override the model to try 7B if 3B underperforms:
//   NEX_BRAIN_PROVIDER=ollama NEX_RESPONSE_MODEL=qwen2.5:7b \
//     npx tsx scripts/session4a-qwen-test.ts
//
// EXIT CODES
//   0 · all six scenarios PASS
//   2 · at least one scenario FAIL (report shows which)
//   1 · runner exception (Ollama unreachable, unexpected error, etc.)
//
// GUARDRAILS
//   · No network beyond localhost:11434 (Ollama's local endpoint).
//     The Ollama adapter asserts the endpoint is local at construction.
//   · No writes to Supabase, no writes to the filesystem, no logs to
//     external systems. Pure stdout report.
//   · Uses NEX-canonical types + runStaircaseAgent — the exact same
//     code path Summit chat will use in Session 4 proper. Any Path
//     A/B/C/D decision is informed by realistic wiring, not a toy
//     harness.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveNexBrain } from "@/lib/nex/brain/resolve";
import {
  runStaircaseAgent,
  STAIRCASE_AGENT_PERSONA,
  type StaircaseAgentEvent,
} from "@/lib/nex/brain/agents/staircase";
import { type StaircaseDesignState } from "@/lib/nex/staircase/design-state";
import type { NexMessage } from "@/lib/nex/brain/provider";
import type { DesignMutation } from "@/lib/nex/tools/handlers/staircase-design";

// ─── Persona loader (bypasses the server-only guard) ─────────────
// persona-loader.ts declares `import "server-only"` for Next.js
// runtime safety, which crashes when tsx executes the module outside
// a Next server. This mirrors persona-loader.ts's logic locally so
// the diagnostic runs against the SAME persona Summit chat will use
// in production.

const DESIGN_PERSONA_SECTIONS = [
  "NEX design conversation · commit acknowledgements",
  "NEX design conversation · multi-field extraction few-shot",
  "NEX design conversation · overwrites (customer changes their mind)",
  "NEX design conversation · unclear intent",
  "NEX design conversation · selective updates",
  "NEX design conversation · teach-not-mutate",
  "NEX price policy · never invent",
  "NEX image policy · never fabricate",
  "NEX anti-chatbot · never say these",
] as const;

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

function loadDesignPersonaBlockLocal(): string {
  const path = join(process.cwd(), "data/nex-voice-profile.md");
  if (!existsSync(path)) return "";
  const raw = readFileSync(path, "utf8");
  const body = stripFrontmatter(raw);
  const lines = body.split("\n");
  const sections: Record<string, string> = {};
  let currentTitle: string | null = null;
  let currentBody: string[] = [];
  const commit = () => {
    if (currentTitle) sections[currentTitle] = currentBody.join("\n").trim();
  };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      commit();
      currentTitle = h2[1]!.trim();
      currentBody = [];
      continue;
    }
    if (/^#\s+/.test(line) || /^---\s*$/.test(line)) {
      commit();
      currentTitle = null;
      currentBody = [];
      continue;
    }
    if (currentTitle !== null) currentBody.push(line);
  }
  commit();

  const parts: string[] = [];
  for (const title of DESIGN_PERSONA_SECTIONS) {
    const b = sections[title];
    if (b) parts.push(`### ${title}\n\n${b}`);
  }
  if (parts.length === 0) return "";
  return [
    "",
    "## PERSONA CONCRETE EXAMPLES",
    "",
    "The following few-shot examples show HOW NEX speaks and behaves in specific",
    "design-conversation situations. Match this voice exactly.",
    "",
    parts.join("\n\n"),
  ].join("\n");
}

const COMPOSED_PERSONA = STAIRCASE_AGENT_PERSONA + loadDesignPersonaBlockLocal();

// ─── Scenario contract ────────────────────────────────────────────

type Expectation =
  | { kind: "must_write"; field: keyof StaircaseDesignState; value: string }
  | { kind: "must_not_write"; field: keyof StaircaseDesignState }
  | { kind: "zero_mutations" }
  | { kind: "at_most_n_mutations"; n: number };

type Scenario = {
  id: string;
  title: string;
  /** State the customer has already built up. Fed to runStaircaseAgent
   *  as currentDesign so the model can readStaircaseDesign and see
   *  what "it" refers to. */
  priorDesign: StaircaseDesignState;
  /** Conversation turns before the test message. Assistant turns may
   *  be short to keep the transcript readable. */
  priorMessages: NexMessage[];
  /** The customer's message that we're testing against. */
  testMessage: string;
  expectations: Expectation[];
  notes?: string;
};

// ─── The six scenarios (Philip 2026-08-20) ────────────────────────

const SCENARIOS: readonly Scenario[] = [
  {
    id: "S1_multi_field_extraction",
    title: "\"I want a modern straight-flight staircase in oak.\" → extract straight-flight + oak in ONE turn",
    priorDesign: {},
    priorMessages: [],
    testMessage: "I want a modern straight-flight staircase in oak.",
    expectations: [
      { kind: "must_write", field: "geometry", value: "straight" },
      { kind: "must_write", field: "wood", value: "oak" },
      // materialFamily=timber is a valid inference but not required;
      // "modern" has no dedicated slug and the model should NOT invent one.
      { kind: "at_most_n_mutations", n: 3 },
    ],
    notes: "\"modern\" has no canonical slug · the agent should NOT invent one. materialFamily=timber is an acceptable inference but not required.",
  },

  {
    id: "S2_overwrite_preserves_others",
    title: "\"Actually, make that walnut.\" → update wood ONLY, preserve geometry",
    priorDesign: { geometry: "straight", wood: "oak", materialFamily: "timber" },
    priorMessages: [
      { role: "user", content: "I want a modern straight-flight staircase in oak." },
      { role: "assistant", content: "Done — straight-flight in oak." },
    ],
    testMessage: "Actually, make that walnut.",
    expectations: [
      { kind: "must_write", field: "wood", value: "walnut" },
      { kind: "must_not_write", field: "geometry" },
      { kind: "at_most_n_mutations", n: 2 },
    ],
  },

  {
    id: "S3_add_balustrade_no_unrelated",
    title: "\"Add glass.\" → balustrade mutation ONLY, no unrelated fields",
    priorDesign: { geometry: "straight", wood: "walnut", materialFamily: "timber" },
    priorMessages: [
      { role: "user", content: "I want a straight-flight staircase in walnut." },
      { role: "assistant", content: "Done — straight-flight in walnut." },
    ],
    testMessage: "Add glass.",
    expectations: [
      // balustrade is free-form (not enum-constrained) · any glass slug is fine.
      { kind: "must_write", field: "balustrade", value: "*" },
      { kind: "must_not_write", field: "wood" },
      { kind: "must_not_write", field: "geometry" },
      { kind: "at_most_n_mutations", n: 2 },
    ],
    notes: "balustrade accepts any string · 'glass', 'glass_framed', 'glass_frameless' all count. Rejection = zero balustrade mutation.",
  },

  {
    id: "S4_question_no_mutation",
    title: "\"What width should the staircase be?\" → answer, ZERO mutations",
    priorDesign: { geometry: "straight", wood: "oak", materialFamily: "timber" },
    priorMessages: [
      { role: "user", content: "Straight oak staircase." },
      { role: "assistant", content: "Done — straight-flight in oak." },
    ],
    testMessage: "What width should the staircase be?",
    expectations: [{ kind: "zero_mutations" }],
    notes: "Pure question · updateStaircaseDesign call = doctrine violation.",
  },

  {
    id: "S5_ambiguous_no_silent_mutation",
    title: "\"Make it better.\" (ambiguous) → clarifying response, ZERO silent mutations",
    priorDesign: { geometry: "straight", wood: "oak", materialFamily: "timber" },
    priorMessages: [
      { role: "user", content: "Straight oak staircase." },
      { role: "assistant", content: "Done — straight-flight in oak." },
    ],
    testMessage: "Make it better.",
    expectations: [{ kind: "zero_mutations" }],
    notes: "Ambiguous · agent must ask what 'better' means or offer options · MUST NOT silently mutate.",
  },

  {
    id: "S6_natural_multi_field",
    title: "\"Give me an open-riser oak staircase, please.\" → multi-field extraction from natural wording",
    priorDesign: {},
    priorMessages: [],
    testMessage: "Give me an open-riser oak staircase, please.",
    expectations: [
      { kind: "must_write", field: "wood", value: "oak" },
      { kind: "must_write", field: "riser", value: "open" },
      { kind: "at_most_n_mutations", n: 4 },
    ],
    notes: "Natural wording ≠ acceptance-test wording. Tests robustness to phrasing.",
  },
];

// ─── Scoring ──────────────────────────────────────────────────────

type ScenarioResult = {
  scenario: Scenario;
  mutations: DesignMutation[];
  toolCalls: Array<{ name: string; id: string }>;
  finalText: string;
  passed: boolean;
  failures: string[];
  error?: string;
};

function scoreScenario(
  scenario: Scenario,
  mutations: DesignMutation[],
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const exp of scenario.expectations) {
    if (exp.kind === "must_write") {
      const hit = mutations.find((m) => m.field === exp.field);
      if (!hit) {
        failures.push(`missing write · expected ${String(exp.field)}=${exp.value}`);
        continue;
      }
      if (exp.value !== "*" && hit.value !== exp.value) {
        failures.push(
          `wrong value · expected ${String(exp.field)}=${exp.value} · got ${String(exp.field)}=${String(hit.value)}`,
        );
      }
    } else if (exp.kind === "must_not_write") {
      const hit = mutations.find((m) => m.field === exp.field);
      if (hit) {
        failures.push(
          `unexpected write · ${String(exp.field)} should have been preserved · got ${String(exp.field)}=${String(hit.value)}`,
        );
      }
    } else if (exp.kind === "zero_mutations") {
      if (mutations.length > 0) {
        failures.push(
          `expected zero mutations · got ${mutations.length}: ${mutations
            .map((m) => `${String(m.field)}=${String(m.value)}`)
            .join(", ")}`,
        );
      }
    } else if (exp.kind === "at_most_n_mutations") {
      if (mutations.length > exp.n) {
        failures.push(
          `expected at most ${exp.n} mutations · got ${mutations.length}: ${mutations
            .map((m) => `${String(m.field)}=${String(m.value)}`)
            .join(", ")}`,
        );
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

// ─── Runner ───────────────────────────────────────────────────────

async function runOneScenario(scenario: Scenario): Promise<ScenarioResult> {
  const { provider } = resolveNexBrain({ forceOllama: true });

  const messages: NexMessage[] = [
    ...scenario.priorMessages,
    { role: "user", content: scenario.testMessage },
  ];

  const mutations: DesignMutation[] = [];
  const toolCalls: Array<{ name: string; id: string }> = [];
  let finalText = "";
  let error: string | undefined;

  try {
    for await (const evt of runStaircaseAgent({
      messages,
      currentDesign: scenario.priorDesign,
      provider,
      sourceMessageId: `session4a-${scenario.id}`,
      maxIterations: 3,
      personaOverride: COMPOSED_PERSONA,
    }) as AsyncGenerator<StaircaseAgentEvent>) {
      switch (evt.type) {
        case "text_delta":
          finalText += evt.text;
          break;
        case "tool_call_start":
          toolCalls.push({ name: evt.toolName, id: evt.toolId });
          break;
        case "design_mutation":
          mutations.push(evt.mutation);
          break;
        case "done":
          break;
        case "error":
          error = evt.error;
          break;
      }
      if (error) break;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const { passed, failures } = error
    ? { passed: false, failures: [`runner_error: ${error}`] }
    : scoreScenario(scenario, mutations);

  return { scenario, mutations, toolCalls, finalText, passed, failures, error };
}

function printResult(res: ScenarioResult, index: number): void {
  const status = res.passed ? "PASS" : "FAIL";
  const marker = res.passed ? "✓" : "✗";
  console.log("");
  console.log(`─── ${index + 1}. ${res.scenario.id} · ${status} ${marker} ───`);
  console.log(res.scenario.title);
  if (res.scenario.notes) console.log(`  note: ${res.scenario.notes}`);
  console.log(`  test message: "${res.scenario.testMessage}"`);
  console.log(`  prior design: ${JSON.stringify(res.scenario.priorDesign)}`);
  console.log(`  tool calls (${res.toolCalls.length}): ${res.toolCalls.map((c) => c.name).join(", ") || "(none)"}`);
  console.log(
    `  mutations (${res.mutations.length}): ${
      res.mutations.length === 0
        ? "(none)"
        : res.mutations.map((m) => `${String(m.field)}=${String(m.value)}`).join(", ")
    }`,
  );
  console.log(`  final text: ${JSON.stringify(res.finalText.slice(0, 240))}`);
  if (res.error) console.log(`  error: ${res.error}`);
  if (!res.passed) {
    for (const f of res.failures) console.log(`  ✗ ${f}`);
  }
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SESSION 4a · Qwen 2.5 3B quality diagnostic");
  console.log("═══════════════════════════════════════════════════════════");

  // Resolve once up-front to fail fast if Ollama is unreachable + to
  // print the provider identity so the report is self-describing.
  let providerId = "(unresolved)";
  try {
    const { provider, reason } = resolveNexBrain({ forceOllama: true });
    providerId = provider.id;
    console.log(`provider  : ${providerId}`);
    console.log(`reason    : ${reason}`);
    console.log(`endpoint  : ${process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434"}`);
  } catch (e) {
    console.error("FATAL · could not resolve Ollama provider:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  console.log(`scenarios : ${SCENARIOS.length}`);

  const results: ScenarioResult[] = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i]!;
    process.stdout.write(`\nrunning ${scenario.id} ...`);
    const started = Date.now();
    const res = await runOneScenario(scenario);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(` ${res.passed ? "PASS" : "FAIL"} (${elapsed}s)`);
    results.push(res);
  }

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("DETAILED RESULTS");
  console.log("═══════════════════════════════════════════════════════════");
  results.forEach(printResult);

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`passed: ${passed}/${results.length}`);
  console.log(`failed: ${failed}/${results.length}`);
  for (const r of results) {
    console.log(`  ${r.passed ? "✓" : "✗"} ${r.scenario.id}`);
  }
  console.log("");
  console.log("Philip's decision rubric:");
  console.log("  6/6 · Qwen is fit · keep local architecture · pick Path A/B/C");
  console.log("  5/6 · Qwen is workable · investigate the miss · then decide");
  console.log("  ≤4/6 · Qwen is unreliable · reconsider Path D (Claude for");
  console.log("         structured mutations, Qwen for retrieval only)");
  console.log("");

  process.exit(failed === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error("UNHANDLED · runner threw:", e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
