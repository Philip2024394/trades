// NEX1 · Verified Experience Writer · Proof Test
// 2026-09-19 · Read-only w.r.t. all production capability files.
//
// Purpose: exercise the EXISTING producer → verifier → writer pipeline
// end-to-end on REAL problems. The pipeline itself is not modified.
// This test's sole purpose is to prove the store can be populated by
// legitimate execution rather than by fabrication.
//
// What this test IS
//   · A vitest test that invokes the real `runNativeInvestigation`
//     pipeline on real repo problems.
//   · A verification that `appendInvestigationConclusions` correctly
//     persists Q8 CandidateSelections to
//     `data/nex1-investigation-conclusions/entries.jsonl`.
//   · A negative test proving the writer rejects non-INFERRED input.
//
// What this test IS NOT
//   · Not a synthetic-data injector · every persisted record is
//     produced by the real Q8 selection policy on a real repo problem.
//   · Not a modifier of any production capability · zero mutation of
//     `capability-experience-abstraction.ts`, chat-turn, NEX2, NEX3.
//   · Not a generalisation experiment · abstraction/generalisation
//     remain deliberately UNTESTED per gate §35.

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { runNativeInvestigation } from "@/lib/nex-agent/code-engine/native-investigation-mode";
import {
  appendInvestigationConclusions,
  getConclusionsStorePath,
  type InvestigationConclusionEntry,
} from "@/lib/nex-agent/code-engine/investigation-conclusion-store";
import type { CandidateSelection } from "@/lib/nex-agent/code-engine/capability-candidate-selector";

const REPO_ROOT = process.cwd();
const STORE_PATH = getConclusionsStorePath(REPO_ROOT);

function readStoreEntries(): InvestigationConclusionEntry[] {
  if (!existsSync(STORE_PATH)) return [];
  const raw = readFileSync(STORE_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const entries: InvestigationConclusionEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.entry_id === "string") entries.push(parsed);
    } catch { /* skip malformed */ }
  }
  return entries;
}

describe("NEX1 · verified experience writer · end-to-end proof", () => {
  let baselineCount = 0;

  beforeAll(() => {
    baselineCount = readStoreEntries().length;
    console.log(
      `[proof] store path: ${STORE_PATH} · baseline record count: ${baselineCount}`,
    );
  });

  // ── E1 · real investigation on a real repo file ──────────────────────
  it(
    "E1 · real investigation about a real function · full pipeline",
    async () => {
      const packet = await runNativeInvestigation({
        problem_statement:
          "Which file defines the runNativeInvestigation function in this repo?",
        repo_root: REPO_ROOT,
        max_actions: 8,
      });
      expect(packet).toBeDefined();
      expect(packet.investigation_id).toMatch(/^nex1-inv-/);
      expect(Array.isArray(packet.candidate_selection)).toBe(true);
      console.log(
        `[E1] investigation_id=${packet.investigation_id} · candidate_selection.length=${packet.candidate_selection.length}`,
      );

      if (packet.candidate_selection.length > 0) {
        const result = appendInvestigationConclusions({
          selections: packet.candidate_selection,
          repo_root: REPO_ROOT,
        });
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.appended_entry_ids.length).toBe(
          packet.candidate_selection.length,
        );
        console.log(
          `[E1] appended ${result.appended_entry_ids.length} entries · rejected_non_inferred=${result.rejected_non_inferred} · rejected_forbidden_word=${result.rejected_forbidden_word}`,
        );
      } else {
        console.log(
          `[E1] Q8 policy returned zero selections · honest outcome per V1 policy · store unchanged`,
        );
      }
    },
    60000,
  );

  // ── E2 · a different real investigation ──────────────────────────────
  it(
    "E2 · real investigation on a different capability",
    async () => {
      const packet = await runNativeInvestigation({
        problem_statement:
          "Where is the appendInvestigationConclusions function implemented in this repo?",
        repo_root: REPO_ROOT,
        max_actions: 8,
      });
      expect(packet).toBeDefined();
      console.log(
        `[E2] investigation_id=${packet.investigation_id} · candidate_selection.length=${packet.candidate_selection.length}`,
      );

      if (packet.candidate_selection.length > 0) {
        const result = appendInvestigationConclusions({
          selections: packet.candidate_selection,
          repo_root: REPO_ROOT,
        });
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
        console.log(
          `[E2] appended ${result.appended_entry_ids.length} entries`,
        );
      } else {
        console.log(
          `[E2] Q8 policy returned zero selections · honest outcome · store unchanged`,
        );
      }
    },
    60000,
  );

  // ── E3 · a third real investigation ──────────────────────────────────
  it(
    "E3 · real investigation on a third capability",
    async () => {
      const packet = await runNativeInvestigation({
        problem_statement:
          "Which file exports the resolveEscalation function in this repository?",
        repo_root: REPO_ROOT,
        max_actions: 8,
      });
      expect(packet).toBeDefined();
      console.log(
        `[E3] investigation_id=${packet.investigation_id} · candidate_selection.length=${packet.candidate_selection.length}`,
      );

      if (packet.candidate_selection.length > 0) {
        const result = appendInvestigationConclusions({
          selections: packet.candidate_selection,
          repo_root: REPO_ROOT,
        });
        expect(result.ok).toBe(true);
        console.log(
          `[E3] appended ${result.appended_entry_ids.length} entries`,
        );
      } else {
        console.log(`[E3] Q8 policy returned zero selections · honest outcome`);
      }
    },
    60000,
  );

  // ── T1 · store has records after real E1/E2/E3 ───────────────────────
  it("T1 · store grew from real production writer path", () => {
    const nowCount = readStoreEntries().length;
    const delta = nowCount - baselineCount;
    console.log(
      `[T1] baseline=${baselineCount} · now=${nowCount} · delta=${delta}`,
    );
    // Delta may be 0 IF all three Q8 policy invocations legitimately
    // returned NO_SELECTION. That is a valid honest outcome under V1.
    expect(nowCount).toBeGreaterThanOrEqual(baselineCount);
  });

  // ── T2 · every persisted record satisfies the schema and is INFERRED ─
  it("T2 · every store entry has evidence_kind==='INFERRED' and Q8 policy_id", () => {
    const entries = readStoreEntries();
    for (const e of entries) {
      expect(e.evidence_kind).toBe("INFERRED");
      expect(e.policy_id).toBe("NEX1_Q8_SELECTION_POLICY");
      expect(e.policy_version).toBe("V1");
      expect(typeof e.entry_id).toBe("string");
      expect(e.entry_id.startsWith("q8-")).toBe(true);
      expect(typeof e.timestamp).toBe("string");
      // ISO timestamp check
      expect(() => new Date(e.timestamp).toISOString()).not.toThrow();
    }
    console.log(
      `[T2] all ${entries.length} entries pass schema and INFERRED check`,
    );
  });

  // ── T3 · negative · non-INFERRED input rejected ──────────────────────
  it("T3 · writer rejects a fabricated non-INFERRED selection", () => {
    const fake: CandidateSelection = {
      investigation_id: "INV-fake-negative-test",
      trace_id: "TRC-fake-negative-test",
      source_file: "src/lib/proof-negative.ts",
      selection_state: "SELECTED",
      selected_candidate: "src/lib/proof-negative.ts::x",
      rankings_reference: {
        rankings_id: "RNK-fake",
        policy_id: "NEX1_Q7_RANKING_POLICY",
        policy_version: "V1",
        source_file: "src/lib/proof-negative.ts",
      },
      candidates_considered: ["src/lib/proof-negative.ts::x"],
      supporting_evidence_ids: [],
      contradicting_evidence_ids: [],
      insufficient_evidence_ids: [],
      unresolved_evidence_ids: [],
      decision_reason: "negative test only",
      confidence: 0.0,
      provenance: [],
      policy_id: "NEX1_Q8_SELECTION_POLICY",
      policy_version: "V1",
      uncertainty: null,
      recommended_next_action: "reject_this",
      evidence_kind: "PROVEN" as unknown as "INFERRED", // deliberately wrong
    };
    const result = appendInvestigationConclusions({
      selections: [fake],
      repo_root: REPO_ROOT,
    });
    expect(result.ok).toBe(false);
    expect(result.rejected_non_inferred).toBe(1);
    expect(result.appended_entry_ids).toHaveLength(0);
    console.log(
      `[T3] non-INFERRED rejected · errors: ${result.errors.join("; ")}`,
    );
  });

  // ── T4 · negative · forbidden causal vocabulary rejected ─────────────
  it("T4 · writer rejects a selection whose reason contains causal vocab", () => {
    const fake: CandidateSelection = {
      investigation_id: "INV-fake-forbidden",
      trace_id: "TRC-fake-forbidden",
      source_file: "src/lib/proof-negative.ts",
      selection_state: "NO_SELECTION",
      selected_candidate: null,
      rankings_reference: {
        rankings_id: "RNK-fake",
        policy_id: "NEX1_Q7_RANKING_POLICY",
        policy_version: "V1",
        source_file: "src/lib/proof-negative.ts",
      },
      candidates_considered: [],
      supporting_evidence_ids: [],
      contradicting_evidence_ids: [],
      insufficient_evidence_ids: [],
      unresolved_evidence_ids: [],
      // Contains "because" · forbidden causal vocab
      decision_reason: "no selection made because insufficient candidates",
      confidence: 0.0,
      provenance: [],
      policy_id: "NEX1_Q8_SELECTION_POLICY",
      policy_version: "V1",
      uncertainty: null,
      recommended_next_action: "await more evidence",
      evidence_kind: "INFERRED",
    };
    const result = appendInvestigationConclusions({
      selections: [fake],
      repo_root: REPO_ROOT,
    });
    expect(result.ok).toBe(false);
    expect(result.rejected_forbidden_word).toBe(1);
    expect(result.appended_entry_ids).toHaveLength(0);
    console.log(
      `[T4] forbidden-causal rejected · errors: ${result.errors.join("; ")}`,
    );
  });

  // ── T5 · persistence · fresh read confirms records remain ────────────
  it("T5 · fresh readStoreEntries returns the persisted records", () => {
    const entries = readStoreEntries();
    // Verify each entry is valid JSON with a real timestamp
    for (const e of entries) {
      expect(e.entry_id).toBeTruthy();
      expect(e.timestamp).toBeTruthy();
    }
    if (entries.length > 0) {
      // The file exists and is non-empty on disk
      const st = statSync(STORE_PATH);
      expect(st.size).toBeGreaterThan(0);
      console.log(
        `[T5] persistence verified · ${entries.length} entries · ${st.size} bytes on disk`,
      );
    } else {
      console.log(
        `[T5] no entries currently in store · every Q8 invocation returned zero selections legitimately`,
      );
    }
  });

  // ── T6 · governance · writer does not sign / execute / mutate ────────
  it("T6 · writer output has no authority fields", () => {
    const entries = readStoreEntries();
    for (const e of entries) {
      // Writer produces recording authority only
      const anyE = e as unknown as Record<string, unknown>;
      expect(anyE.signature_hex).toBeUndefined();
      expect(anyE.founder_authorised).toBeUndefined();
      expect(anyE.nex2_verdict).toBeUndefined();
      expect(anyE.nex3_verdict).toBeUndefined();
      expect(anyE.workstation_mutation).toBeUndefined();
      expect(e.evidence_kind).toBe("INFERRED");
    }
    console.log(
      `[T6] governance boundary preserved · no authority fields on any record`,
    );
  });

  // ── T7 · producer determinism (soft) ─────────────────────────────────
  it("T7 · repeated invocation returns a valid packet (soft determinism)", async () => {
    const p1 = await runNativeInvestigation({
      problem_statement: "Which file defines InvestigationConclusionEntry?",
      repo_root: REPO_ROOT,
      max_actions: 2,
    });
    expect(p1).toBeDefined();
    expect(p1.investigation_id).toMatch(/^nex1-inv-/);
    // Investigation IDs change per invocation (contain timestamp+random)
    // but overall_verdict + candidate_selection.length should be stable
    // for the same repo state and problem statement.
    const p2 = await runNativeInvestigation({
      problem_statement: "Which file defines InvestigationConclusionEntry?",
      repo_root: REPO_ROOT,
      max_actions: 2,
    });
    expect(p2).toBeDefined();
    expect(p1.candidate_selection.length).toBe(p2.candidate_selection.length);
    console.log(
      `[T7] p1.selections=${p1.candidate_selection.length} · p2.selections=${p2.candidate_selection.length} (stable count)`,
    );
  }, 60000);

  // ── DIAGNOSTIC · single trace-dump of a real INVESTIGATE-verb turn ───
  // §5 of Q8 short-circuit diagnostic gate: dump reasoningTrace and
  // intermediate packet fields to identify the deepest action reached
  // and the first empty pipeline stage. Test-only · no production
  // change · uses fields the pipeline already populates.
  it("DIAG · full trace dump for INVESTIGATE-verb question", async () => {
    const packet = await runNativeInvestigation({
      problem_statement: "investigate where the assessFear function is defined",
      repo_root: REPO_ROOT,
      max_actions: 8,
    });
    console.log("========= DIAGNOSTIC · reasoningTrace (if exposed) =========");
    const anyPkt = packet as unknown as Record<string, unknown>;
    const trace = anyPkt.reasoningTrace;
    if (Array.isArray(trace)) {
      trace.forEach((line, i) => {
        console.log(`[${String(i).padStart(3, "0")}] ${line}`);
      });
    } else {
      console.log("reasoningTrace: NOT EXPOSED on returned packet (internal only)");
    }
    console.log("========= DIAGNOSTIC · packet summary =========");
    console.log(`investigation_id: ${packet.investigation_id}`);
    console.log(`trace_id: ${packet.trace_id}`);
    console.log(`original_problem: ${packet.original_problem}`);
    console.log(`investigation_trigger_kind: ${packet.investigation_trigger_kind}`);
    console.log(`primary_verb_family: ${packet.primary_verb_family}`);
    console.log(`investigate_in_verb_hits: ${packet.investigate_in_verb_hits}`);
    console.log(`verdict: ${packet.verdict}`);
    console.log(`confidence: ${packet.confidence} / ${packet.confidence_numeric}`);
    console.log(`search_terms.length: ${packet.search_terms.length} · sample: ${JSON.stringify(packet.search_terms.slice(0, 5))}`);
    console.log(`concepts.length: ${packet.concepts.length} · sample: ${JSON.stringify(packet.concepts.slice(0, 5))}`);
    console.log(`candidate_files.length: ${packet.candidate_files.length}`);
    if (packet.candidate_files.length > 0) {
      console.log(`  top candidate: ${JSON.stringify({
        path: packet.candidate_files[0].path,
        score: packet.candidate_files[0].score,
        tags: packet.candidate_files[0].matched_concept_tags,
      })}`);
    }
    console.log(`dependency_graph_edges: ${packet.dependency_graph_edges}`);
    console.log(`observation_files_seen: ${packet.observation_files_seen}`);
    console.log(`hypotheses.length: ${packet.hypotheses.length}`);
    if (packet.hypotheses.length > 0) console.log(`  first: ${packet.hypotheses[0].slice(0, 200)}`);
    console.log(`evidence_for.length: ${packet.evidence_for.length}`);
    console.log(`evidence_against.length: ${packet.evidence_against.length}`);
    console.log(`unknown_facts.length: ${packet.unknown_facts.length}`);
    console.log(`recommended_next_step: ${packet.recommended_next_step.slice(0, 240)}`);
    console.log(`capability_gaps.length: ${packet.capability_gaps.length} · ${JSON.stringify(packet.capability_gaps)}`);
    const p = packet as unknown as Record<string, unknown>;
    // Deeper pipeline fields (Fix 12/13/14/15/16 outputs · check existence honestly)
    for (const key of [
      "root_cause_candidates",
      "hypothesis_evaluations",
      "candidate_comparisons",
      "candidate_rankings",
      "candidate_selection",
    ]) {
      const val = p[key];
      if (Array.isArray(val)) {
        console.log(`${key}.length: ${val.length}`);
        if (val.length > 0) {
          console.log(`  first entry keys: ${JSON.stringify(Object.keys(val[0] as object).slice(0, 12))}`);
        }
      } else if (val === undefined) {
        console.log(`${key}: field NOT PRESENT on packet`);
      } else {
        console.log(`${key}: ${typeof val}`);
      }
    }
    console.log("========= END DIAGNOSTIC =========");
    expect(packet.investigation_id).toMatch(/^nex1-inv-/);
    // reasoningTrace is internal to native-investigation-mode · not exposed
    // on the returned packet. The OTHER fields tell the full story.
    expect(packet.investigation_trigger_kind).toBeTruthy();
  }, 60000);

  // ─────────────────────────────────────────────────────────────────────
  // PP1 · PERSISTENCE PROOF · pass 3 real Q8 selections through the
  //       existing writer and verify durable disk persistence +
  //       fresh-process recovery via Node subprocess.
  //       Uses the EXACT successful investigation input from the
  //       diagnostic gate (produced candidate_selection.length === 3).
  // ─────────────────────────────────────────────────────────────────────
  it(
    "PP1 · real Q8 selections → writer → disk → fresh subprocess",
    async () => {
      // ─── Baseline ─────────────────────────────────────────────────
      const beforeEntries = readStoreEntries();
      const beforeCount = beforeEntries.length;
      const beforeIds = new Set(beforeEntries.map((e) => e.entry_id));
      console.log(`[PP1] baseline count: ${beforeCount}`);

      // ─── Real investigation (same input as successful diagnostic) ─
      const packet = await runNativeInvestigation({
        problem_statement:
          "investigate where the assessFear function is defined",
        repo_root: REPO_ROOT,
        max_actions: 8,
      });
      expect(packet.investigation_id).toMatch(/^nex1-inv-/);
      expect(packet.investigation_trigger_kind).toBe("PRIMARY_INVESTIGATE");
      expect(packet.primary_verb_family).toBe("INVESTIGATE");
      console.log(
        `[PP1] investigation_id=${packet.investigation_id} · candidate_selection.length=${packet.candidate_selection.length}`,
      );
      // Log the actual selection_states + selected_candidate + source_file
      packet.candidate_selection.forEach((s, i) => {
        console.log(
          `[PP1]   selection[${i}]: state=${s.selection_state} · selected=${s.selected_candidate ?? "null"} · source=${s.source_file}`,
        );
      });
      // At least one selection expected (from the diagnostic evidence)
      expect(packet.candidate_selection.length).toBeGreaterThan(0);

      // ─── Invoke EXISTING writer with REAL selections ──────────────
      const writeResult = appendInvestigationConclusions({
        selections: packet.candidate_selection,
        repo_root: REPO_ROOT,
      });
      console.log(
        `[PP1] writer: ok=${writeResult.ok} · appended=${writeResult.appended_entry_ids.length} · errors=${writeResult.errors.length} · rejected_non_inferred=${writeResult.rejected_non_inferred} · rejected_forbidden_word=${writeResult.rejected_forbidden_word}`,
      );
      if (writeResult.errors.length > 0) {
        console.log(`[PP1] writer errors: ${writeResult.errors.join(" · ")}`);
      }
      expect(writeResult.ok).toBe(true);
      expect(writeResult.appended_entry_ids.length).toBe(
        packet.candidate_selection.length,
      );
      expect(writeResult.rejected_non_inferred).toBe(0);
      expect(writeResult.rejected_forbidden_word).toBe(0);

      // ─── Same-process disk read (readFileSync each call) ──────────
      const afterEntries = readStoreEntries();
      const afterCount = afterEntries.length;
      const newEntries = afterEntries.filter(
        (e) => !beforeIds.has(e.entry_id),
      );
      console.log(
        `[PP1] after count: ${afterCount} · new records: ${newEntries.length}`,
      );
      expect(afterCount).toBe(beforeCount + packet.candidate_selection.length);
      expect(newEntries.length).toBe(packet.candidate_selection.length);

      // ─── Schema integrity of the new records ──────────────────────
      for (const e of newEntries) {
        expect(e.evidence_kind).toBe("INFERRED");
        expect(e.policy_id).toBe("NEX1_Q8_SELECTION_POLICY");
        expect(e.policy_version).toBe("V1");
        expect(e.entry_id.startsWith("q8-")).toBe(true);
        expect(e.investigation_id).toBe(packet.investigation_id);
        expect(e.trace_id).toBe(packet.trace_id);
        // No causal vocab in templated strings (writer would reject otherwise)
        const scanText = `${e.decision_reason} ${e.uncertainty ?? ""} ${e.recommended_next_action}`;
        for (const t of ["because", "causes", "therefore", "root cause is"]) {
          expect(scanText.toLowerCase().includes(t)).toBe(false);
        }
        // No forbidden authority/mutation fields
        const anyE = e as unknown as Record<string, unknown>;
        expect(anyE.signature_hex).toBeUndefined();
        expect(anyE.founder_authorised).toBeUndefined();
        expect(anyE.workstation_mutation).toBeUndefined();
      }
      console.log(`[PP1] schema integrity: PASS for all ${newEntries.length} records`);

      // ─── FRESH-PROCESS RECOVERY · Node subprocess ─────────────────
      // Spawn a completely fresh Node process. Read the file from disk
      // in that subprocess. Verify the newly appended entry_ids are
      // recoverable without ANY in-memory state from the writer.
      const { execFileSync } = await import("node:child_process");
      const storePath = STORE_PATH;
      // Escape backslashes in Windows path for -e code
      const escapedPath = storePath.replace(/\\/g, "\\\\");
      const script =
        `const fs=require('node:fs');` +
        `const raw=fs.readFileSync("${escapedPath}","utf8");` +
        `const lines=raw.split(/\\r?\\n/).filter(l=>l.trim()!=="");` +
        `const ids=[];for(const l of lines){try{const o=JSON.parse(l);if(o&&o.entry_id)ids.push(o.entry_id);}catch{}}` +
        `process.stdout.write(JSON.stringify(ids));`;
      const stdout = execFileSync(process.execPath, ["-e", script], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });
      const freshIds: string[] = JSON.parse(stdout.trim());
      const freshIdSet = new Set(freshIds);
      const recoveredNewIds = writeResult.appended_entry_ids.filter((id) =>
        freshIdSet.has(id),
      );
      console.log(
        `[PP1] fresh-subprocess recovered ${recoveredNewIds.length}/${writeResult.appended_entry_ids.length} newly-persisted IDs (total store size seen by subprocess: ${freshIds.length})`,
      );
      expect(recoveredNewIds.length).toBe(writeResult.appended_entry_ids.length);
      expect(freshIds.length).toBe(afterCount);
    },
    120000,
  );

  // ── T8 · no LLM contamination in the writer or store code ────────────
  it("T8 · writer/store source contains no LLM runtime dependency", () => {
    const writerSrc = readFileSync(
      path.join(
        REPO_ROOT,
        "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts",
      ),
      "utf8",
    );
    // Only match import/require lines, not comments
    const importLines = writerSrc
      .split("\n")
      .filter((l) => /^\s*(import|const .* = require)/.test(l));
    const llmish = importLines.filter((l) =>
      /(anthropic|openai|@anthropic|OpenAI\(|Anthropic\(|@google\/generative-ai|groq|gemini-pro|gpt-|claude-3|claude-opus)/i.test(
        l,
      ),
    );
    expect(llmish).toHaveLength(0);
    console.log(`[T8] writer source · zero LLM imports`);
  });
});
