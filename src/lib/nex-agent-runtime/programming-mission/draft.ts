// WO-NEX-RUNTIME-11 · draft phase for the two-phase Send-to-NEX1 button.
//
// Founder-locked 2026-09-14. This is PHASE 1 of the two-phase button:
//   ①  NEX1 reads the target files
//   ②  NEX1 authors the diff deterministically
//   ③  Persist "Draft ready for founder authorization"
//   ④  Return preview to caller — NO EXECUTION HAPPENS HERE
//
// Founder rule (locked): Review ≠ Authorization ≠ Verification.
// The draft is a REVIEW artefact only. The founder must separately sign
// a delegation OFFLINE before /execute will do anything.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { signEvidence } from "@/lib/nex-agent-runtime/process/identity";
import { AGENT_EVIDENCE_COLLECTION } from "@/lib/nex-agent-runtime/process/types";
import { inspectWorkspaceStyle } from "./style-inspector";
import { authorProgrammingChange, authorMultiFileProgrammingChange, type MultiFileSpec } from "./code-authoring";
import { parseTestAssertions } from "./test-assertion-parser";
import { selectAlgorithmFromEvidence, inferProducerAlgorithmFromConsumer, CAPABILITY_REGISTRY, type AlgorithmSelectionEvidence } from "./algorithm-matcher";
import { selectPairFromEvidence, type PairSelectionEvidence } from "./pair-matcher";
import { authorPairwiseComposition } from "./pair-authoring";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FunctionSpec, StyleProfile, AuthoredFile } from "./types";
import { PROGRAMMING_MISSION_INSPECTION_COLLECTION, PROGRAMMING_MISSION_BRIEF_COLLECTION } from "./types";

export const PROGRAMMING_MISSION_DRAFT_COLLECTION = "nex_programming_mission_drafts" as const;

export type DraftVerdict =
  | "DRAFT_READY_FOR_FOUNDER_AUTHORIZATION"       // NEX1 authored · founder must sign offline
  | "REFUSED_INSPECTION_FAILED"
  | "REFUSED_AUTHORING_FAILED"
  | "REFUSED_MISSION_INVALID"
  | "REFUSED_UNSUPPORTED_ALGORITHM";

export interface ProgrammingMissionDraftRecord {
  readonly record_type: "NEX_PROGRAMMING_MISSION_DRAFT";
  readonly draft_id: string;
  readonly mission_id: string;
  readonly title: string;
  readonly requirements_summary: string;
  readonly workspace_root: string;
  readonly target_files_to_inspect: readonly string[];
  readonly proposed_new_files: readonly {
    readonly path: string;
    readonly kind: "implementation" | "test";
    readonly function_spec: FunctionSpec;
  }[];
  readonly nex1_inspection_evidence_id: string | null;
  readonly style_detected: StyleProfile | null;
  /** M-02 · cross-file dependency graph NEX1 detected during inspection.
   *  cross_file_edge_count > 0 means NEX1 identified at least one
   *  cross-file import in the target files. */
  readonly dependency_graph: import("./dependency-graph").DependencyGraph | null;
  /** M-R-B · when algorithm_kind='unguided' was submitted for one or more
   *  files, records the bounded evidence-driven selection decisions.
   *  Each entry is the full "candidates considered → scores → reason"
   *  audit trail so NEX2 / independent verification can inspect the
   *  selection rather than trust it. Null when no unguided files. */
  readonly algorithm_selection_evidence: readonly AlgorithmSelectionEvidence[] | null;
  /** F-C-02 · when single-capability matcher returned null for one or
   *  more files, records the bounded pairwise composition matcher's
   *  audit trail (every pair considered · scores · why each pair
   *  won/lost). Null when the pair fallback did not run. */
  readonly pair_selection_evidence: readonly PairSelectionEvidence[] | null;
  readonly authored_files: readonly {
    readonly path: string;
    readonly extension: AuthoredFile["extension"];
    readonly bytes: number;
    readonly sha256_hex: string;
    readonly content_preview: string;           // first 4 KB · for founder review · full content stored separately
    readonly kind: "implementation" | "test";
  }[];
  /** Full authored content · kept alongside preview so /execute can
   *  reconstruct the exact bytes NEX1 authored. Bounded at 64 KB per
   *  file to keep the draft record readable. */
  readonly authored_files_full: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  readonly test_runner_relative_path: string;
  readonly verdict: DraftVerdict;
  readonly refusal_reason: string | null;
  readonly requester_agent_id: string;
  readonly requester_public_key_der_hex: string;
  readonly drafted_at: string;
  readonly executed_at: string | null;           // populated by /execute · null while awaiting founder
  readonly executed_receipt_id: string | null;   // populated by /execute
}

export interface PrepareDraftInput {
  readonly mission_id: string;
  readonly title: string;
  readonly workspace_root: string;
  readonly target_files_to_inspect: readonly string[];
  readonly proposed_new_files: readonly {
    readonly path: string;
    readonly kind: "implementation" | "test";
    readonly function_spec: FunctionSpec;
  }[];
  readonly requirements_summary: string;
  readonly requester_identity: AgentIdentity;
  readonly requester_instance_id: string;
  readonly test_runner_relative_path: string;
}

export interface PrepareDraftResult {
  readonly draft: ProgrammingMissionDraftRecord;
}

export async function prepareProgrammingMissionDraft(
  input: PrepareDraftInput,
): Promise<PrepareDraftResult> {
  const draft_id = `DRAFT-${randomUUID()}`;
  const drafted_at = new Date().toISOString();

  // Refused-path builder · preserves ANY inspection evidence that
  // actually ran. Founder-locked honesty rule: if inspection succeeded
  // and built a dependency graph, we record it EVEN IF authoring later
  // refused. Dropping real data on the failure path is dishonest data
  // flow · not a mission-level protection.
  let preservedInspectionEvidenceId: string | null = null;
  let preservedStyle: StyleProfile | null = null;
  let preservedDependencyGraph: import("./dependency-graph").DependencyGraph | null = null;
  let preservedSelectionEvidence: readonly AlgorithmSelectionEvidence[] | null = null;
  let preservedPairSelectionEvidence: readonly PairSelectionEvidence[] | null = null;

  const persistRefused = async (verdict: Exclude<DraftVerdict, "DRAFT_READY_FOR_FOUNDER_AUTHORIZATION">, reason: string): Promise<PrepareDraftResult> => {
    const rec: ProgrammingMissionDraftRecord = {
      record_type: "NEX_PROGRAMMING_MISSION_DRAFT",
      draft_id,
      mission_id: input.mission_id,
      title: input.title,
      requirements_summary: input.requirements_summary,
      workspace_root: input.workspace_root,
      target_files_to_inspect: Object.freeze([...input.target_files_to_inspect]),
      proposed_new_files: Object.freeze(input.proposed_new_files.map((f) => Object.freeze({ ...f }))) as ProgrammingMissionDraftRecord["proposed_new_files"],
      nex1_inspection_evidence_id: preservedInspectionEvidenceId,
      style_detected: preservedStyle,
      dependency_graph: preservedDependencyGraph,
      algorithm_selection_evidence: preservedSelectionEvidence,
      pair_selection_evidence: preservedPairSelectionEvidence,
      authored_files: [],
      authored_files_full: [],
      test_runner_relative_path: input.test_runner_relative_path,
      verdict,
      refusal_reason: reason,
      requester_agent_id: input.requester_identity.agent_id,
      requester_public_key_der_hex: input.requester_identity.public_key_der_hex,
      drafted_at,
      executed_at: null,
      executed_receipt_id: null,
    };
    await getStorage().save(PROGRAMMING_MISSION_DRAFT_COLLECTION, rec);
    return { draft: rec };
  };

  // Basic validation
  const implFiles = input.proposed_new_files.filter((f) => f.kind === "implementation");
  const testFiles = input.proposed_new_files.filter((f) => f.kind === "test");
  if (implFiles.length === 0 || testFiles.length === 0) return persistRefused("REFUSED_MISSION_INVALID", "brief must specify at least one implementation and one test file");
  if (input.target_files_to_inspect.length === 0) return persistRefused("REFUSED_MISSION_INVALID", "target_files_to_inspect must be non-empty");
  const supportedKinds = new Set(["truncate_words", "short_report", "text_stats", "describe_text", "fibonacci_memoised", "pair_composition", "unguided"]);
  for (const f of implFiles) {
    if (!supportedKinds.has(f.function_spec.algorithm_kind)) {
      return persistRefused("REFUSED_UNSUPPORTED_ALGORITHM", `algorithm_kind ${f.function_spec.algorithm_kind} not supported at ${f.path}`);
    }
  }

  // Persist mission brief (link 1 of the 12-link chain when /execute runs)
  await getStorage().save(PROGRAMMING_MISSION_BRIEF_COLLECTION, {
    record_type: "NEX_PROGRAMMING_MISSION_BRIEF",
    mission_id: input.mission_id,
    title: input.title,
    workspace_root: input.workspace_root,
    target_files_to_inspect: input.target_files_to_inspect,
    proposed_new_files: input.proposed_new_files,
    requirements_summary: input.requirements_summary,
    requester_agent_id: input.requester_identity.agent_id,
    persisted_at: drafted_at,
    draft_id,
  });

  // ① NEX1 inspects workspace style
  const inspection = await inspectWorkspaceStyle({
    workspace_root: input.workspace_root,
    file_paths: input.target_files_to_inspect,
  });
  if (!inspection.ok) return persistRefused("REFUSED_INSPECTION_FAILED", inspection.reason);
  // Preserve inspection results so persistRefused (if called downstream)
  // records what actually happened rather than dropping the evidence.
  preservedStyle = inspection.style;
  preservedDependencyGraph = inspection.dependency_graph;

  // Persist signed inspection evidence (link 2 of the 12-link chain)
  const inspectionEvidence = {
    record_type: "NEX_AGENT_EVIDENCE" as const,
    evidence_id: `NEX1-INSPECT-${randomUUID()}`,
    agent_id: input.requester_identity.agent_id,
    instance_id: input.requester_instance_id,
    mission_id: input.mission_id,
    emitted_at: new Date().toISOString(),
    kind: "programming_mission_inspection" as const,
    payload: {
      draft_id,
      workspace_root: input.workspace_root,
      files_read: inspection.file_contents_read,
      style_detected: inspection.style,
      dependency_graph: inspection.dependency_graph,
    },
  };
  const signedInspection = signEvidence(input.requester_identity, inspectionEvidence);
  await getStorage().save(AGENT_EVIDENCE_COLLECTION, signedInspection);
  await getStorage().save(PROGRAMMING_MISSION_INSPECTION_COLLECTION, signedInspection);
  preservedInspectionEvidenceId = signedInspection.evidence_id;

  // ─── M-R-B · bounded evidence-driven algorithm resolution ─────────
  // If any proposed file specifies algorithm_kind='unguided', run the
  // matcher against parsed test assertions + dependency graph to pick
  // the best-fitting capability from the registry. The decision itself
  // is recorded as evidence (candidates considered, scores, reason).
  const unguidedFiles = input.proposed_new_files.filter((f) => f.function_spec.algorithm_kind === "unguided");
  const resolvedProposedFiles: typeof input.proposed_new_files = await (async () => {
    if (unguidedFiles.length === 0) return input.proposed_new_files;

    // Parse test-file assertions to build the evidence pool
    const parsedByFile = new Map<string, Awaited<ReturnType<typeof parseTestAssertions>>>();
    for (const testSpec of input.proposed_new_files.filter((f) => f.kind === "test")) {
      const testAbs = path.join(input.workspace_root, testSpec.path);
      let src = "";
      try { src = await fs.readFile(testAbs, "utf8"); } catch { /* leave empty */ }
      parsedByFile.set(testSpec.path, parseTestAssertions(src));
    }
    // Aggregate all parsed assertions across test files
    const allAssertions = [...parsedByFile.values()].flatMap((r) => r.assertions);

    const selections: AlgorithmSelectionEvidence[] = [];
    const pairSelections: PairSelectionEvidence[] = [];
    type ProposedFile = { path: string; kind: "implementation" | "test"; function_spec: FunctionSpec };
    const resolved: ProposedFile[] = [];
    // M-R-B.2 reconciliation rule (founder-locked 2026-09-14):
    //   Once NEX1 selects a capability, the selected capability's
    //   interface contract becomes AUTHORITATIVE for generated
    //   producer/consumer wiring. If the mission spec's function_name
    //   conflicts with the capability's canonical exports_symbol, the
    //   capability wins. This is the "no blindly-copied stale symbol"
    //   rule the founder locked after M-R-B attempt 1 exposed the gap.
    const reconcileFunctionName = (spec: typeof input.proposed_new_files[number]["function_spec"], selected: string | null, kind: "implementation" | "test"): typeof spec => {
      if (!selected) return spec;
      const cap = CAPABILITY_REGISTRY.find((c) => c.algorithm_kind === selected);
      if (!cap) return { ...spec, algorithm_kind: selected as never };
      // For test files, the function_name is what the test asserts on. The
      // test target must still refer to whatever the CONSUMER exports.
      // For implementation files, the function_name becomes the capability's
      // canonical exports_symbol · that's the authoritative contract.
      const reconciled_name = cap.exports_symbol;
      return {
        ...spec,
        algorithm_kind: selected as never,
        function_name: reconciled_name,
      };
    };

    // First pass · resolve consumers/tests that have assertions
    for (const f of input.proposed_new_files) {
      if (f.function_spec.algorithm_kind !== "unguided") { resolved.push(f); continue; }
      // Try to match against parsed assertions for this file's function_name
      const evidence = selectAlgorithmFromEvidence({
        target_function_name: f.function_spec.function_name,
        target_file: f.path,
        assertions: allAssertions,
      });
      selections.push(evidence);
      if (evidence.selected) {
        const reconciledSpec = reconcileFunctionName(f.function_spec, evidence.selected, f.kind);
        resolved.push({ ...f, function_spec: reconciledSpec });
      } else {
        // F-C-02 fallback · founder-authorised 2026-09-14. Runs ONLY when
        // the single-capability matcher returned null · every existing
        // verified mission is unaffected because their single matcher
        // succeeds. If pair matcher succeeds, the file's algorithm_kind
        // becomes "pair_composition" with the discovered pair + template
        // travelling on FunctionSpec.pair_composition. If it also refuses,
        // the file stays 'unguided' · authoring will refuse honestly.
        // Test files skip the pair matcher · only implementation files
        // are candidates for composition.
        if (f.kind === "implementation") {
          const pairEvidence = selectPairFromEvidence({
            target_function_name: f.function_spec.function_name,
            target_file: f.path,
            assertions: allAssertions,
          });
          pairSelections.push(pairEvidence);
          if (pairEvidence.selected_pair) {
            resolved.push({
              ...f,
              function_spec: {
                ...f.function_spec,
                algorithm_kind: "pair_composition",
                pair_composition: pairEvidence.selected_pair,
              },
            });
            continue;
          }
        }
        resolved.push(f);   // stays 'unguided' · will fail at authoring for that file · honest surfacing
      }
    }
    // Second pass · producer inference via imports (for files where the
    // first pass didn't pick anything AND the file is imported by an
    // already-resolved consumer)
    if (inspection.dependency_graph) {
      for (let i = 0; i < resolved.length; i++) {
        const f = resolved[i];
        if (f.function_spec.algorithm_kind !== "unguided") continue;
        // Find any consumer edge that imports FROM this file
        const importedBy = inspection.dependency_graph.edges.filter((e) => e.to_file === f.path);
        for (const edge of importedBy) {
          const consumerResolved = resolved.find((r) => r.path === edge.from_file && r.function_spec.algorithm_kind !== "unguided");
          if (!consumerResolved) continue;
          const producerEvidence = inferProducerAlgorithmFromConsumer({
            consumer_selected_algorithm_kind: consumerResolved.function_spec.algorithm_kind,
            producer_file: f.path,
            dependency_graph: inspection.dependency_graph,
          });
          selections.push(producerEvidence);
          if (producerEvidence.selected) {
            const reconciledProducerSpec = reconcileFunctionName(f.function_spec, producerEvidence.selected, f.kind);
            resolved[i] = { ...f, function_spec: reconciledProducerSpec };
            break;
          }
        }
      }
    }
    // Third pass · reconcile imports_needed on consumer files based on
    // producer capabilities selected by the matcher. This is the second
    // half of the reconciliation rule: not just "producer exports what
    // the capability says", but ALSO "consumer imports exactly that
    // symbol from the correct producer file". Without this, an authored
    // consumer emits `text_stats(text)` with no import → runtime "not
    // defined". This closes the M-R-B attempt-1 gap.
    for (let i = 0; i < resolved.length; i++) {
      const f = resolved[i];
      const cap = CAPABILITY_REGISTRY.find((c) => c.algorithm_kind === f.function_spec.algorithm_kind);
      if (!cap || cap.imports_needed.length === 0) continue;
      const filledImports: readonly { readonly symbol: string; readonly from_specifier: string }[] = cap.imports_needed
        .map((need) => {
          // Find the resolved producer file whose selected capability exports the needed symbol
          const producer = resolved.find((other) => {
            if (other.path === f.path) return false;
            const otherCap = CAPABILITY_REGISTRY.find((c) => c.algorithm_kind === other.function_spec.algorithm_kind);
            return otherCap?.exports_symbol === need.symbol;
          });
          if (!producer) return null;
          const fromDir = path.posix.dirname(f.path.replace(/\\/g, "/"));
          const toRel = producer.path.replace(/\\/g, "/");
          const rel = path.posix.relative(fromDir, toRel);
          const specifier = rel.startsWith(".") ? rel : `./${rel}`;
          return { symbol: need.symbol, from_specifier: specifier };
        })
        .filter((x): x is { symbol: string; from_specifier: string } => x !== null);
      if (filledImports.length > 0) {
        resolved[i] = {
          ...f,
          function_spec: {
            ...f.function_spec,
            imports_needed: filledImports,
          },
        };
      }
    }

    preservedSelectionEvidence = Object.freeze(selections);
    preservedPairSelectionEvidence = pairSelections.length > 0 ? Object.freeze(pairSelections) : null;
    return resolved;
  })();

  // Rebuild implFiles/testFiles after resolution
  const resolvedImplFiles = resolvedProposedFiles.filter((f) => f.kind === "implementation");
  const resolvedTestFiles = resolvedProposedFiles.filter((f) => f.kind === "test");

  // ② NEX1 authors the diff deterministically
  // M-01 path: single impl + single test → authorProgrammingChange (unchanged)
  // M-02+ path: multi-file → authorMultiFileProgrammingChange
  const authored: Array<{ file: import("./types").AuthoredFile; kind: "implementation" | "test" }> = [];
  // Category B slice 1 (F-03.2B) framework fix: route 1+1 through the
  // multi-file authoring dispatcher too. The single-file authorProgrammingChange
  // path only supports truncate_words · newer primitives (short_report,
  // text_stats, describe_text, fibonacci_memoised) live in the multi-file
  // dispatcher. Preserving the 1+1 special-case for truncate_words
  // specifically to keep M-01 semantics identical to its landed baseline.
  const isM01LegacyPath = resolvedImplFiles.length === 1
    && resolvedTestFiles.length === 1
    && resolvedImplFiles[0].function_spec.algorithm_kind === "truncate_words";

  // F-C-02 · pairwise composition route (founder-authorised 2026-09-14).
  // Runs when any resolved impl has algorithm_kind='pair_composition'.
  // Bypasses the multi-file dispatcher (which does not know about pair
  // composition · keeps code-authoring.ts untouched). Only reached when
  // the pair-matcher fallback selected a pair for at least one impl.
  const hasPairComposition = resolvedImplFiles.some((f) => f.function_spec.algorithm_kind === "pair_composition");

  if (hasPairComposition) {
    // Single-file pair authoring for now (F-C-02 mission is 1 impl + 1 test)
    // Multi-file pair composition is out of scope for this experiment.
    if (resolvedImplFiles.length !== 1 || resolvedTestFiles.length !== 1) {
      return persistRefused("REFUSED_AUTHORING_FAILED", "F-C-02 pair composition currently supports 1 impl + 1 test only");
    }
    const impl = resolvedImplFiles[0];
    const test = resolvedTestFiles[0];
    const comp = impl.function_spec.pair_composition;
    if (!comp) {
      return persistRefused("REFUSED_AUTHORING_FAILED", "pair_composition kind selected but composition data missing · framework bug");
    }
    const pairAuth = await authorPairwiseComposition({
      impl_path: impl.path,
      test_path: test.path,
      impl_spec: impl.function_spec,
      test_spec: test.function_spec,
      composition: comp,
      style: inspection.style,
    });
    if (!pairAuth.ok) return persistRefused("REFUSED_AUTHORING_FAILED", `${pairAuth.reason_code}: ${pairAuth.reason}`);
    authored.push({ file: pairAuth.implementation, kind: "implementation" });
    authored.push({ file: pairAuth.test, kind: "test" });
  } else if (isM01LegacyPath) {
    const impl = resolvedImplFiles[0];
    const test = resolvedTestFiles[0];
    const authoring = await authorProgrammingChange({
      spec: impl.function_spec,
      style: inspection.style,
      implementation_path: impl.path,
      test_path: test.path,
    });
    if (!authoring.ok) return persistRefused("REFUSED_AUTHORING_FAILED", `${authoring.reason_code}: ${authoring.reason}`);
    authored.push({ file: authoring.implementation, kind: "implementation" });
    authored.push({ file: authoring.test, kind: "test" });
  } else {
    const specs: MultiFileSpec[] = [];
    for (const impl of resolvedImplFiles) {
      specs.push({ path: impl.path, kind: "implementation", function_spec: impl.function_spec });
    }
    for (const test of resolvedTestFiles) {
      const stem = test.path.replace(/\.test\.[^.]+$/, "");
      const matching = resolvedImplFiles.find((i) => i.path.replace(/\.[^.]+$/, "") === stem) ?? resolvedImplFiles[resolvedImplFiles.length - 1];
      specs.push({ path: test.path, kind: "test", function_spec: test.function_spec, test_imports_from_path: matching.path });
    }
    const multi = await authorMultiFileProgrammingChange({ files: specs, style: inspection.style });
    if (!multi.ok) return persistRefused("REFUSED_AUTHORING_FAILED", `${multi.reason_code}: ${multi.reason}${multi.failed_path ? ` at ${multi.failed_path}` : ""}`);
    for (const f of multi.files) {
      const spec = specs.find((s) => s.path === f.path)!;
      authored.push({ file: f, kind: spec.kind });
    }
  }

  const authoredPreview = authored.map(({ file, kind }) => ({
    path: file.path,
    extension: file.extension,
    bytes: file.content_bytes,
    sha256_hex: file.content_sha256_hex,
    content_preview: file.content.slice(0, 4_000),
    kind,
  }));

  const authoredFull = authored.map(({ file }) => ({
    path: file.path,
    content: file.content.slice(0, 64_000),
  }));

  const rec: ProgrammingMissionDraftRecord = {
    record_type: "NEX_PROGRAMMING_MISSION_DRAFT",
    draft_id,
    mission_id: input.mission_id,
    title: input.title,
    requirements_summary: input.requirements_summary,
    workspace_root: input.workspace_root,
    target_files_to_inspect: Object.freeze([...input.target_files_to_inspect]),
    proposed_new_files: Object.freeze(input.proposed_new_files.map((f) => Object.freeze({ ...f }))) as ProgrammingMissionDraftRecord["proposed_new_files"],
    nex1_inspection_evidence_id: signedInspection.evidence_id,
    style_detected: inspection.style,
    dependency_graph: inspection.dependency_graph,
    algorithm_selection_evidence: preservedSelectionEvidence,
    pair_selection_evidence: preservedPairSelectionEvidence,
    authored_files: Object.freeze(authoredPreview) as ProgrammingMissionDraftRecord["authored_files"],
    authored_files_full: Object.freeze(authoredFull),
    test_runner_relative_path: input.test_runner_relative_path,
    verdict: "DRAFT_READY_FOR_FOUNDER_AUTHORIZATION",
    refusal_reason: null,
    requester_agent_id: input.requester_identity.agent_id,
    requester_public_key_der_hex: input.requester_identity.public_key_der_hex,
    drafted_at,
    executed_at: null,
    executed_receipt_id: null,
  };
  await getStorage().save(PROGRAMMING_MISSION_DRAFT_COLLECTION, rec);
  return { draft: rec };
}

export async function loadDraft(draft_id: string): Promise<ProgrammingMissionDraftRecord | null> {
  const rows = await getStorage()
    .query<ProgrammingMissionDraftRecord>(PROGRAMMING_MISSION_DRAFT_COLLECTION, {
      where: { draft_id }, limit: 20, order_by: "drafted_at", order_dir: "desc",
    })
    .catch(() => [] as ProgrammingMissionDraftRecord[]);
  if (rows.length === 0) return null;
  // Prefer a record where /execute has already marked it executed · this
  // is the idempotency invariant: any subsequent /execute must see the
  // "already executed" state, not the initial "ready" state, regardless
  // of JSONL append order for tied drafted_at timestamps.
  const executed = rows.find((r) => r.executed_at !== null);
  return executed ?? rows[0];
}

/** Update a draft to record that it has been executed. Only the executed
 *  fields are updated · the rest of the draft is immutable evidence. */
export async function markDraftExecuted(
  draft: ProgrammingMissionDraftRecord,
  input: { readonly executed_at: string; readonly executed_receipt_id: string | null },
): Promise<void> {
  await getStorage().save(PROGRAMMING_MISSION_DRAFT_COLLECTION, {
    ...draft,
    executed_at: input.executed_at,
    executed_receipt_id: input.executed_receipt_id,
  });
}
