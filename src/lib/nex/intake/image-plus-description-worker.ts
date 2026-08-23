// NEX Image + Description Intelligence Worker.
//
// Batch orchestrator · accepts (image URL/file + optional description) items ·
// runs each through the intake pipeline · one failure never stops the batch ·
// idempotent by content hash · returns per-item results.
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22 (NEX-owned · provider-pluggable)
//   · project_nex_conversation_learning_engine_2026_08_21 (8-step controlled learning)
//   · project_nex_worker_reliability_2026_08_21 (heartbeat + cycle_run)
//   · ADR-0033 (draft-tier · human promotion required)
//
// The pipeline (per image · isolated):
//   FETCH → hash → dedup-check → VISION (pluggable · MVP null) → OCR (pluggable · MVP null)
//   → EXTRACT CONCEPT → CLASSIFY → STORE candidate at knowledge_inbox
//     with extraction_result jsonb
//
// Never auto-promotes. Never touches AUTHORITATIVE knowledge_records.
// Candidates flow into the existing controlled-learning gates for admin review.

import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { selectVisionProvider, selectOcrProvider, selectPerceptualHashProvider } from "./select-providers";
import { extractConcept, type ConceptKnowledge } from "./concept-extractor";
// Task #75 Bundle A (2026-08-22): canonical heartbeat + cycle_run · this
// worker previously ran heartbeat-blind (manual invocation only) · HQ
// six-criteria can now see it register as `intake:image`.
import { emitHeartbeat, startCycleRun, finishCycleRun } from "@/lib/nex/reliability";

const CANONICAL_INTAKE_WORKER_ID = "intake:image";

export interface IntakeItem {
  /** Either imageUrl or imageBytes must be supplied. */
  imageUrl?: string;
  imageBytes?: Buffer;
  mimeType?: string;
  /** Description supplied alongside the image · first-class input. */
  description?: string;
  /** User declared AI-generated? · preserved as provenance · never assumed. */
  aiGenerated?: boolean;
  /** User declared rights status · preserved · never assumed. */
  rightsStatus?: "declared_by_user" | "unknown" | "restricted";
  /** Filename if uploaded · used as extraction hint. */
  filename?: string;
  /** Batch id · captured on the item for tracing. */
  batchId?: string;
}

export interface IntakeItemResult {
  ok: boolean;
  itemIndex: number;
  contentHash: string;
  duplicateOfExisting?: boolean;
  extraction?: ConceptKnowledge;
  knowledgeInboxId?: string;
  error?: string;
  errorPhase?: "fetch" | "hash" | "dedup" | "vision" | "ocr" | "extract" | "store" | "unknown";
}

export interface IntakeBatchResult {
  batchId: string;
  received: number;
  processed: number;
  failed: number;
  duplicate: number;
  perItem: IntakeItemResult[];
  bandCounts: Record<string, number>;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

// Compute sha256 content hash. Fetches URL if needed. Isolated failure per item.
async function fetchAndHash(item: IntakeItem): Promise<{ bytes: Buffer; hash: string; mimeType?: string }> {
  let bytes: Buffer;
  let mimeType = item.mimeType;
  if (item.imageBytes) {
    bytes = item.imageBytes;
  } else if (item.imageUrl) {
    const resp = await fetch(item.imageUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${item.imageUrl}`);
    const arr = new Uint8Array(await resp.arrayBuffer());
    bytes = Buffer.from(arr);
    mimeType = mimeType ?? resp.headers.get("content-type") ?? undefined;
  } else {
    throw new Error("neither imageUrl nor imageBytes supplied");
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  return { bytes, hash, mimeType };
}

async function existingByHash(pool: Pool, hash: string): Promise<{ id: string } | null> {
  const r = await pool.query(`SELECT id FROM nex.knowledge_inbox WHERE hash = $1 LIMIT 1`, [hash]);
  return r.rowCount && r.rowCount > 0 ? { id: r.rows[0].id } : null;
}

function nexInboxId(): string {
  // Match existing scheme: nx_<base36ts>_<hex>
  const ts = Date.now().toString(36);
  const hex = createHash("sha1").update(String(Math.random()) + String(process.hrtime.bigint())).digest("hex").slice(0, 8);
  return `nx_${ts}_${hex}`;
}

export async function runIntakeBatch(pool: Pool, items: IntakeItem[]): Promise<IntakeBatchResult> {
  const startedAt = new Date();
  const batchId = `intake-${startedAt.toISOString().replace(/[:.]/g, "-")}`;

  // Task #75 Bundle A: canonical cycle_run + heartbeat around every batch.
  // records_processed = items successfully stored · records_new = same minus dups.
  const cycleRunId = await startCycleRun(pool, {
    workerId:      CANONICAL_INTAKE_WORKER_ID,
    workerType:    "intake",
    workerConfig:  "image",
    jobIdExternal: batchId,
  });
  await emitHeartbeat(pool, {
    workerId:     CANONICAL_INTAKE_WORKER_ID,
    workerType:   "intake",
    workerConfig: "image",
    status:       "running",
    cycleRunId,
    metadata:     { batchId, item_count: items.length },
  });

  const vision = selectVisionProvider();
  const ocr = selectOcrProvider();
  const phash = selectPerceptualHashProvider();

  const perItem: IntakeItemResult[] = [];
  let processed = 0, failed = 0, duplicate = 0;
  const bandCounts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, DUPLICATE: 0, UNREADABLE: 0, REVIEW: 0 };

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    try {
      // 1. Fetch + hash
      let bytes: Buffer, hash: string, mimeType: string | undefined;
      try {
        const fetched = await fetchAndHash(item);
        bytes = fetched.bytes; hash = fetched.hash; mimeType = fetched.mimeType;
      } catch (err) {
        perItem.push({ ok: false, itemIndex: i, contentHash: "", error: err instanceof Error ? err.message : String(err), errorPhase: "fetch" });
        failed++;
        continue;
      }

      // 2. Dedup check by exact content hash
      const existing = await existingByHash(pool, hash);
      if (existing) {
        perItem.push({ ok: true, itemIndex: i, contentHash: hash, duplicateOfExisting: true, knowledgeInboxId: existing.id });
        duplicate++;
        bandCounts.DUPLICATE++;
        continue;
      }

      // 3. Vision + OCR + PerceptualHash (all pluggable · MVP all return null)
      const [vRes, oRes, pRes] = await Promise.all([
        vision.analyse({ imageBytes: bytes, imageUrl: item.imageUrl, mimeType, hint: "any" }).catch(() => null),
        ocr.extract({ imageBytes: bytes, imageUrl: item.imageUrl, mimeType, languages: ["eng","ind"] }).catch(() => null),
        phash.compute({ imageBytes: bytes, imageUrl: item.imageUrl, mimeType }).catch(() => null),
      ]);

      // 4. Concept extraction (NEX-owned · deterministic · rule-based · MVP)
      const extraction = extractConcept({
        description: item.description,
        ocr: oRes,
        vision: vRes,
        imageUrlOrRef: item.imageUrl ?? item.filename ?? `bytes:${hash.slice(0,12)}`,
        sourceType: item.imageUrl ? "image_url" : "uploaded_file",
        rightsStatus: item.rightsStatus ?? "unknown",
        aiGenerated: Boolean(item.aiGenerated),
        visionProviderName: vision.name,
        ocrProviderName: ocr.name,
        perceptualHash: pRes?.hash ?? null,
        filenameHint: item.filename,
      });

      // 5. Store as knowledge_inbox row · never AUTHORITATIVE · never auto-promotes
      //    status='review' surfaces it in the admin promotion queue
      const inboxId = nexInboxId();
      await pool.query(
        `INSERT INTO nex.knowledge_inbox
           (id, title, kind, status, source, hash, created_at_ms, created_at_iso,
            url, mime_type, byte_size, description, extraction_result)
         VALUES ($1, $2, 'image', 'review', $3, $4, $5, now(),
                 $6, $7, $8, $9, $10::jsonb)`,
        [
          inboxId,
          extraction.concept + (extraction.category ? ` (${extraction.category})` : ""),
          extraction.ai_generated ? "claude-generated" : "raw-research",
          hash,
          Date.now(),
          item.imageUrl ?? null,
          mimeType ?? null,
          bytes.length,
          item.description ?? null,
          JSON.stringify(extraction),
        ]
      );

      perItem.push({ ok: true, itemIndex: i, contentHash: hash, extraction, knowledgeInboxId: inboxId });
      processed++;
      bandCounts[extraction.classification_band]++;
    } catch (err) {
      perItem.push({ ok: false, itemIndex: i, contentHash: "", error: err instanceof Error ? err.message : String(err), errorPhase: "unknown" });
      failed++;
    }
  }

  const finishedAt = new Date();

  // Task #75 Bundle A: finalise cycle_run + emit terminal heartbeat.
  // records_processed = new inserts + duplicates recognised (real DB touches).
  // records_new = only new inserts (duplicates aren't new output).
  // errorsCount = per-item failures.
  const cycleStatus = failed === items.length && items.length > 0 ? "failed" : "completed";
  await finishCycleRun(pool, cycleRunId, {
    status:           cycleStatus,
    recordsProcessed: processed + duplicate,
    recordsNew:       processed,
    errorsCount:      failed,
    summary:          { batchId, received: items.length, bandCounts, duplicate, failed },
  });
  await emitHeartbeat(pool, {
    workerId:     CANONICAL_INTAKE_WORKER_ID,
    workerType:   "intake",
    workerConfig: "image",
    status:       cycleStatus === "failed" ? "failed" : "standby",
    cycleRunId,
    metadata:     { batchId, item_count: items.length, processed, failed, duplicate },
  });

  return {
    batchId,
    received: items.length,
    processed,
    failed,
    duplicate,
    perItem,
    bandCounts,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}
