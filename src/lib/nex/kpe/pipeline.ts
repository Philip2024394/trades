// KPE · Pipeline Orchestrator
//
// Runs every stage in order for a single document. Every stage lookup goes
// through the plugin registry — pipeline code never imports concrete stage
// implementations. This is what enables the plugin-swap design.
//
// Persistence happens at well-defined checkpoints so a crash midway leaves
// consistent partial state (Document + Chunks always survive together).
//
// Emits Intelligence Events at start / finish / errors so the Ops Centre
// observes the pipeline without any tight coupling.

import { randomUUID } from "node:crypto";
import { ensureDefaultsLoaded, getPlugin } from "./registry";
import { store } from "./storage/fs-store";
import { emitEventSafe } from "../events/fs-store";
import type {
  IntakeInput, IntakeOutput,
  CleaningInput, CleaningOutput,
  NormalisationInput, NormalisationOutput,
  ClassifierInput, ClassifierOutput,
  MetadataInput, MetadataOutput,
  DuplicateInput, DuplicateOutput,
  ChunkingInput, ChunkingOutput,
  RelationshipsInput, RelationshipsOutput,
  ValidationInput, ValidationOutput,
  DecisionInput, DecisionOutput,
  AIGatewayInput, AIGatewayOutput,
  BrainWriterInput, BrainWriterOutput,
  ProcessingRun, StageName,
} from "./types";

export type RunPipelineInput = IntakeInput & { target_brains?: string[] };

export type RunPipelineOutput = {
  run: ProcessingRun;
  chunks_created: number;
  decisions_made: number;
  brain_writes: number;
  brains_written: string[];
  decision_distribution: Record<string, number>;
  ai_calls_made: number;
  ai_calls_succeeded: number;
  skipped_duplicate: boolean;
};

const makeLogger = (run_id: string) => ({
  info:  (m: string, meta?: Record<string, unknown>) => console.log(`[kpe:${run_id}] ${m}`, meta ?? ""),
  warn:  (m: string, meta?: Record<string, unknown>) => console.warn(`[kpe:${run_id}] ${m}`, meta ?? ""),
  error: (m: string, meta?: Record<string, unknown>) => console.error(`[kpe:${run_id}] ${m}`, meta ?? ""),
});

export async function runPipeline(input: RunPipelineInput): Promise<RunPipelineOutput> {
  await ensureDefaultsLoaded();

  const run_id = randomUUID();
  const started_at = new Date().toISOString();
  const stages_completed: StageName[] = [];
  const errors: ProcessingRun["errors"] = [];
  const logger = makeLogger(run_id);

  // ── 1 · Intake ──
  const intakeStage = getPlugin<IntakeInput, IntakeOutput>("intake");
  const intake = await intakeStage.run(input, { run_id, document_id: "pending", now: () => new Date(), logger });
  stages_completed.push("intake");
  const document_id = intake.document.document_id;
  const ctx = { run_id, document_id, now: () => new Date(), logger };

  emitEventSafe({
    event_type: "kpe_run_started",
    source: "system",
    actor_id: "kpe",
    related_job: document_id,
    related_department: "knowledge",
    outcome: "informational",
    payload: { run_id, source: input.source, title: input.title, bytes: intake.document.byte_length },
  });

  // ── 2 · Cleaning ──
  const cleaning = await getPlugin<CleaningInput, CleaningOutput>("cleaning").run(
    { raw_content: intake.raw_content }, ctx,
  );
  stages_completed.push("cleaning");

  // ── 3 · Normalisation ──
  const normalised = await getPlugin<NormalisationInput, NormalisationOutput>("normalisation").run(
    { cleaned_content: cleaning.cleaned_content }, ctx,
  );
  stages_completed.push("normalisation");

  // ── 4 · Classifier ──
  const classifier = await getPlugin<ClassifierInput, ClassifierOutput>("classifier").run(
    { normalised_content: normalised.normalised_content, title: intake.document.title }, ctx,
  );
  intake.document.classifier_label = classifier.label;
  intake.document.classifier_confidence = classifier.confidence;
  stages_completed.push("classifier");

  // ── 5 · Metadata ──
  const meta = await getPlugin<MetadataInput, MetadataOutput>("metadata").run(
    { normalised_content: normalised.normalised_content, document: intake.document }, ctx,
  );
  stages_completed.push("metadata");

  // ── 6 · Duplicate detection ──
  const dupe = await getPlugin<DuplicateInput, DuplicateOutput>("duplicate").run(
    { document: intake.document, normalised_content: normalised.normalised_content }, ctx,
  );
  stages_completed.push("duplicate");

  // Persist document + duplicate finding regardless of outcome
  intake.document.target_brains = input.target_brains ?? [];
  await store.saveDocument(intake.document);
  if (dupe.document_level) await store.saveDuplicates([dupe.document_level]);

  // Short-circuit if the whole document is a duplicate
  if (dupe.is_duplicate) {
    const run: ProcessingRun = {
      run_id,
      document_id,
      source: input.source,
      started_at,
      finished_at: new Date().toISOString(),
      stages_completed,
      errors,
      final_outcome: "success",
      chunks_created: 0,
      decisions_made: 0,
      brain_writes: 0,
    };
    await store.saveRun(run);
    emitEventSafe({
      event_type: "kpe_run_skipped_duplicate",
      source: "system",
      actor_id: "kpe",
      related_job: document_id,
      related_department: "knowledge",
      outcome: "informational",
      payload: { run_id, matched: dupe.document_level?.matched_chunk_id, similarity: dupe.document_level?.similarity },
    });
    return {
      run, chunks_created: 0, decisions_made: 0, brain_writes: 0, brains_written: [],
      decision_distribution: { skip: 1 }, ai_calls_made: 0, ai_calls_succeeded: 0,
      skipped_duplicate: true,
    };
  }

  // ── 7 · Chunking ──
  const chunking = await getPlugin<ChunkingInput, ChunkingOutput>("chunking").run(
    { document: intake.document, normalised_content: normalised.normalised_content }, ctx,
  );
  await store.saveChunks(chunking.chunks);
  stages_completed.push("chunking");

  // ── 8 · Relationships ──
  const rels = await getPlugin<RelationshipsInput, RelationshipsOutput>("relationships").run(
    { document: intake.document, chunks: chunking.chunks, metadata: meta.metadata }, ctx,
  );
  await store.saveEdges(rels.edges);
  stages_completed.push("relationships");

  // Persist metadata rows (one per chunk · same metadata cloned for now,
  // future stage may derive per-chunk metadata)
  for (const c of chunking.chunks) {
    await store.saveMetadata({ chunk_id: c.chunk_id, ...meta.metadata });
  }

  // ── 9 · Validation ──
  const validation = await getPlugin<ValidationInput, ValidationOutput>("validation").run(
    { document: intake.document, chunks: chunking.chunks, metadata: meta.metadata }, ctx,
  );
  stages_completed.push("validation");
  for (const e of validation.errors) errors.push({ stage: "validation", error: e.message });

  // ── 10 · Decision ──
  const decision = await getPlugin<DecisionInput, DecisionOutput>("decision").run(
    {
      document: intake.document,
      chunks: chunking.chunks,
      chunk_confidence: validation.chunk_confidence,
      classifier,
    }, ctx,
  );
  stages_completed.push("decision");

  // ── 11 · AI Gateway (invoked only for decisions that call for it) ──
  const aiGateway = getPlugin<AIGatewayInput, AIGatewayOutput>("ai_gateway");
  let aiCallsMade = 0;
  let aiCallsSucceeded = 0;
  const distribution: Record<string, number> = {};

  for (const d of decision.decisions) {
    distribution[d.route.tier] = (distribution[d.route.tier] ?? 0) + 1;
    if (d.route.tier !== "local_llm" && d.route.tier !== "frontier_llm") continue;
    aiCallsMade += 1;
    const result = await aiGateway.run({
      capability: d.route.capability,
      prompt_slice: d.route.prompt_slice,
      preferred_tier: d.route.tier,
    }, ctx);
    d.provider_used = result.provider;
    d.latency_ms = result.latency_ms;
    d.cost_estimate_gbp = result.cost_gbp;
    if (result.ok) aiCallsSucceeded += 1;
    else errors.push({ stage: "ai_gateway", error: `${d.chunk_id}: ${result.error ?? "unknown"}` });
  }
  await store.saveDecisions(decision.decisions);
  stages_completed.push("ai_gateway");

  // ── 12 · Brain Writer ──
  const writer = await getPlugin<BrainWriterInput, BrainWriterOutput>("brain_writer").run(
    { document: intake.document, chunks: chunking.chunks, decisions: decision.decisions }, ctx,
  );
  stages_completed.push("brain_writer");

  const finished_at = new Date().toISOString();
  const run: ProcessingRun = {
    run_id,
    document_id,
    source: input.source,
    started_at,
    finished_at,
    stages_completed,
    errors,
    final_outcome: errors.length === 0 ? "success" : "partial",
    chunks_created: chunking.chunks.length,
    decisions_made: decision.decisions.length,
    brain_writes: writer.memories_created,
  };
  await store.saveRun(run);

  emitEventSafe({
    event_type: "kpe_run_completed",
    source: "system",
    actor_id: "kpe",
    related_job: document_id,
    related_department: "knowledge",
    outcome: errors.length === 0 ? "success" : "failure",
    payload: {
      run_id,
      chunks: chunking.chunks.length,
      decisions: decision.decisions.length,
      distribution,
      ai_calls_made: aiCallsMade,
      ai_calls_succeeded: aiCallsSucceeded,
      brains_written: writer.brains_written,
      errors: errors.length,
    },
  });

  return {
    run,
    chunks_created: chunking.chunks.length,
    decisions_made: decision.decisions.length,
    brain_writes: writer.memories_created,
    brains_written: writer.brains_written,
    decision_distribution: distribution,
    ai_calls_made: aiCallsMade,
    ai_calls_succeeded: aiCallsSucceeded,
    skipped_duplicate: false,
  };
}
