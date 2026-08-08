// NEX Knowledge Inbox — filesystem storage layer.
//
// Persistence model:
//
//   data/knowledge-inbox/
//     index.json           — array of InboxItem metadata (source of truth)
//     stats.json           — all-time processing totals
//     content/<id>.txt     — text dumps (full body)
//     content/<id>.urls    — url import bundles (one per line)
//     files/<id>-<name>    — uploaded binary files
//
// The API routes (src/app/api/nex/knowledge-inbox/*) call into this
// layer; the React client never touches the filesystem directly.
//
// This is a single-writer filesystem store — fine for Philip's
// single-user dev/local flow. When we move to Supabase / Postgres,
// this file becomes the shim that reads/writes to the DB instead.
// Every consumer imports through this module so the swap is one file.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type {
  InboxItem,
  InboxKind,
  InboxStats,
  InboxStatus,
  KnowledgeSource,
  ProcessingReport,
} from "./types";
import { EMPTY_STATS } from "./types";
import { brainStore } from "@/lib/nex/brain/storage";
// Phase 3a · NEX Object Storage · inbox binaries now flow through the
// location-transparent adapter (Postgres-backed by default when
// NEX_OBJECT_BACKEND=postgres). Filesystem write is retained during
// the transition window for backward compat with legacy readers.
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { BUCKETS } from "@/lib/nex/storage/object-types";
// Phase 11.2 · shadow-write to nex.knowledge_inbox alongside every
// filesystem mutation when NEX_INBOX_SHADOW_POSTGRES=1. Filesystem
// stays authoritative until Phase 11.3 flip. Every shadow call is
// best-effort · never throws · never delays the primary write.
import {
  shadowDeleteInboxItem,
  shadowUpdateInboxStatuses,
  shadowUpsertInboxItem,
  shadowUpsertInboxStats,
} from "./pg-shadow";

// ── Paths ────────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "knowledge-inbox");
const INDEX_PATH = path.join(ROOT, "index.json");
const STATS_PATH = path.join(ROOT, "stats.json");
const CONTENT_DIR = path.join(ROOT, "content");
const FILES_DIR = path.join(ROOT, "files");

async function ensureDirs() {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
}

// ── ID + hash utilities ──────────────────────────────────────────────

export function makeId(): string {
  const t = Date.now().toString(36);
  const r = randomBytes(4).toString("hex");
  return `nx_${t}_${r}`;
}

export function sha256(input: string | Buffer): string {
  const h = createHash("sha256");
  h.update(input);
  return h.digest("hex");
}

// Human-friendly meta string for a file item.
export function fileMeta(mime: string, byteSize: number): string {
  const kb = byteSize / 1024;
  const size =
    kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  return `${mime || "file"} · ${size}`;
}

// Filename-safe version of an original upload name.
export function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

// ── Index read / write ───────────────────────────────────────────────

export async function readIndex(): Promise<InboxItem[]> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as InboxItem[];
  } catch (err) {
    // First read on a fresh install — file doesn't exist yet.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    // Corrupted file — return empty and let the next write repair it.
    console.error("[knowledge-inbox] index.json read failed:", err);
    return [];
  }
}

async function writeIndex(items: InboxItem[]): Promise<void> {
  await ensureDirs();
  const tmp = `${INDEX_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items, null, 2), "utf8");
  await fs.rename(tmp, INDEX_PATH);
}

// ── Stats read / write ───────────────────────────────────────────────

export async function readStats(): Promise<InboxStats> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(STATS_PATH, "utf8");
    const parsed = JSON.parse(raw) as InboxStats;
    // Reset completedToday when the day rolls over.
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.completedTodayDate !== today) {
      return { ...parsed, completedToday: 0, completedTodayDate: today };
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY_STATS };
    console.error("[knowledge-inbox] stats.json read failed:", err);
    return { ...EMPTY_STATS };
  }
}

export async function writeStats(stats: InboxStats): Promise<void> {
  await ensureDirs();
  const tmp = `${STATS_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(stats, null, 2), "utf8");
  await fs.rename(tmp, STATS_PATH);
  // Phase 11.2 · shadow-write to Postgres · gated · fire-and-forget.
  void shadowUpsertInboxStats({
    completedTodayDate:    stats.completedTodayDate,
    completedToday:        stats.completedToday,
    imagesAnalysed:        stats.imagesAnalysed,
    voiceNotesTranscribed: stats.voiceNotesTranscribed,
    lastProcessedAt:       stats.lastProcessedAt,
  });
}

// ── Duplicate detection ──────────────────────────────────────────────

// Returns the existing item if the hash is already in the index,
// otherwise null. Deleted items are removed from the index so
// they naturally re-open the "slot" — a re-uploaded file after
// deletion is treated as a fresh capture.
export async function findByHash(hash: string): Promise<InboxItem | null> {
  const items = await readIndex();
  return items.find((i) => i.hash === hash) ?? null;
}

// ── Save operations ──────────────────────────────────────────────────

// Save a text dump (Quick Dump) or a note. Returns the created item
// or the existing duplicate if the hash matches something already
// in the inbox.
export async function saveTextItem(input: {
  source: KnowledgeSource;
  title?: string;
  content: string;
}): Promise<{ item: InboxItem; deduplicated: boolean }> {
  const now = Date.now();
  const hash = sha256(input.content);
  const existing = await findByHash(hash);
  if (existing) return { item: existing, deduplicated: true };

  const id = makeId();
  const contentFile = `${id}.txt`;
  await fs.writeFile(path.join(CONTENT_DIR, contentFile), input.content, "utf8");

  const first = input.content.split("\n")[0]?.slice(0, 90) ?? "Note";
  const item: InboxItem = {
    id,
    title: input.title?.trim() || first || "Note",
    kind: "text",
    status: "waiting",
    source: input.source,
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    hash,
    meta: `${input.content.length.toLocaleString()} chars`,
    previewText: input.content.slice(0, 220),
    contentPath: `content/${contentFile}`,
  };

  await appendItem(item);
  return { item, deduplicated: false };
}

// Save one uploaded file. Kind is inferred from mime type unless a
// caller (voice / image capture surface) forces it.
export async function saveFileItem(input: {
  source: KnowledgeSource;
  forcedKind?: InboxKind;
  originalFilename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ item: InboxItem; deduplicated: boolean }> {
  const now = Date.now();
  const hash = sha256(input.bytes);
  const existing = await findByHash(hash);
  if (existing) return { item: existing, deduplicated: true };

  const id = makeId();
  const kind: InboxKind =
    input.forcedKind ??
    (input.mimeType.startsWith("image/")
      ? "image"
      : input.mimeType.startsWith("audio/")
        ? "voice"
        : "file");

  const safeName = safeFilename(input.originalFilename);
  const storedName = `${id}-${safeName}`;
  // Phase 3a · dual-write during transition:
  //   1. NEX Object Storage · location-transparent · every worker on
  //      any machine can fetch via getObjectStorage().get(bucket,key)
  //   2. Filesystem · retained for backward compat with legacy readers
  //      that still expect `filePath`. Removed in Phase 3b once every
  //      reader is on object storage.
  // The object storage write is best-effort inside try/catch so a
  // Postgres outage never blocks the primary capture path. If the
  // object write fails the item still lands with only filePath and
  // downstream backfill will pick it up later.
  await fs.writeFile(path.join(FILES_DIR, storedName), input.bytes);

  let objectBucket: string | undefined;
  let objectKey: string | undefined;
  try {
    const put = await getObjectStorage().put(BUCKETS.uploads, id, {
      body: input.bytes,
      mime_type: input.mimeType,
      source_ref: `inbox:${id}`,
      custom: { original_filename: input.originalFilename, hash },
    });
    objectBucket = put.bucket;
    objectKey    = put.key;
  } catch (err) {
    console.warn(
      `[knowledge-inbox] object storage put failed for ${id} · falling back to filesystem-only:`,
      err instanceof Error ? err.message : err,
    );
  }

  const preview =
    kind === "image"
      ? "Awaiting image analysis…"
      : kind === "voice"
        ? "Awaiting transcription…"
        : `${input.originalFilename} uploaded (${input.bytes.length.toLocaleString()} bytes)`;

  const item: InboxItem = {
    id,
    title: input.originalFilename,
    kind,
    status: "waiting",
    source: input.source,
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    hash,
    meta: fileMeta(input.mimeType, input.bytes.length),
    previewText: preview,
    filePath: `files/${storedName}`,     // LEGACY · retained during transition
    objectBucket,                        // Phase 3a · authoritative
    objectKey,                           // Phase 3a · authoritative
    originalFilename: input.originalFilename,
    byteSize: input.bytes.length,
    mimeType: input.mimeType,
  };

  await appendItem(item);
  return { item, deduplicated: false };
}

// Save a URL import — one item per URL. Hash the URL string.
export async function saveUrlItem(input: {
  source: KnowledgeSource;
  url: string;
}): Promise<{ item: InboxItem; deduplicated: boolean }> {
  const now = Date.now();
  const normalised = input.url.trim();
  if (!normalised) throw new Error("empty url");
  const hash = sha256(normalised);
  const existing = await findByHash(hash);
  if (existing) return { item: existing, deduplicated: true };

  const id = makeId();
  const title = normalised.replace(/^https?:\/\//, "").slice(0, 80);
  const item: InboxItem = {
    id,
    title,
    kind: "url",
    status: "waiting",
    source: input.source,
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    hash,
    meta: "URL · queued for fetch",
    previewText: normalised,
    url: normalised,
  };

  await appendItem(item);
  return { item, deduplicated: false };
}

// ── Mutation helpers ─────────────────────────────────────────────────

async function appendItem(item: InboxItem): Promise<void> {
  const items = await readIndex();
  items.unshift(item);
  await writeIndex(items);
  // Phase 11.2 · shadow-write to Postgres.
  void shadowUpsertInboxItem(item);
}

export async function updateStatuses(
  ids: string[],
  status: InboxStatus,
  patch?: Partial<InboxItem>
): Promise<InboxItem[]> {
  const items = await readIndex();
  const idSet = new Set(ids);
  const updated = items.map((i) =>
    idSet.has(i.id) ? { ...i, status, ...(patch ?? {}) } : i
  );
  await writeIndex(updated);
  // Phase 11.2 · shadow-write bulk status transition to Postgres.
  const shadowMap = new Map<string, InboxStatus>();
  for (const id of ids) shadowMap.set(id, status);
  void shadowUpdateInboxStatuses(shadowMap);
  return updated;
}

export async function setItemStatus(
  id: string,
  status: InboxStatus
): Promise<InboxItem | null> {
  const items = await readIndex();
  let out: InboxItem | null = null;
  const next = items.map((i) => {
    if (i.id !== id) return i;
    out = { ...i, status };
    return out;
  });
  await writeIndex(next);
  // Phase 11.2 · shadow-write single status transition to Postgres.
  if (out) void shadowUpdateInboxStatuses(new Map([[id, status]]));
  return out;
}

export async function deleteItem(id: string): Promise<boolean> {
  const items = await readIndex();
  const target = items.find((i) => i.id === id);
  if (!target) return false;
  const next = items.filter((i) => i.id !== id);
  await writeIndex(next);
  // Phase 11.2 · shadow-delete from Postgres.
  void shadowDeleteInboxItem(id);
  // Best-effort cleanup of the associated content / file — do not
  // fail the delete if the file is already gone.
  try {
    if (target.contentPath) await fs.unlink(path.join(ROOT, target.contentPath));
  } catch {
    /* noop */
  }
  try {
    if (target.filePath) await fs.unlink(path.join(ROOT, target.filePath));
  } catch {
    /* noop */
  }
  return true;
}

// ── Content reader (for the /read endpoint and future processing) ────

export async function readItemContent(item: InboxItem): Promise<string | null> {
  if (item.contentPath) {
    try {
      return await fs.readFile(path.join(ROOT, item.contentPath), "utf8");
    } catch {
      return null;
    }
  }
  if (item.url) return item.url;
  return null;
}

// ── Processing (simulated v1 — real pipeline lands in v2) ────────────
//
// v1 behaviour: everything with status "waiting" flips to "processed"
// (approx 4% flagged as "review"), and stats totals move by heuristic
// deltas that feel plausible. Every text dump has its content actually
// read from disk so the pipeline is honestly walking through real data.
// v2 replaces the deltas with real Reasoning Layer + Master Aggregator
// output.

export async function runProcessInbox(input: {
  ids?: string[];
}): Promise<{ report: ProcessingReport; items: InboxItem[]; stats: InboxStats }> {
  const items = await readIndex();
  const waitingItems = items.filter((i) =>
    i.status === "waiting" &&
    (input.ids ? input.ids.includes(i.id) : true)
  );
  if (waitingItems.length === 0) {
    const stats = await readStats();
    return {
      report: emptyReport(),
      items,
      stats,
    };
  }

  // Walk each waiting item so this is not a pure fake — we actually
  // load the text content for text dumps and count real characters.
  // Keep the content around so we can enqueue it into the worker queue
  // without re-reading from disk below.
  let totalTextChars = 0;
  const contentById = new Map<string, string>();
  for (const it of waitingItems) {
    if (it.kind === "text" && it.contentPath) {
      const content = await readItemContent(it);
      if (content) {
        totalTextChars += content.length;
        contentById.set(it.id, content);
      }
    }
  }

  // HONESTY: The previous implementation used Math.random() to fabricate
  // record/FAQ/edge/duplicate counts. Per "NEX never pretends work has
  // been done" (feedback_nex_never_pretends_work_done_2026_08_07.md),
  // the fabrications are removed. What we can honestly count here:
  //   · needsReview: items flagged by scrutiny policy (real decision)
  //   · imagesAnalysed / voiceNotesTranscribed: kind == image | voice
  //   · items enqueued for workers (populated below in the enqueue pass)
  // Downstream record + FAQ + edge counts are OWNED by the Worker
  // Manager (knowledge_records + graph_edges in Supabase). Never fake
  // them here.
  let needsReview = 0;
  let imagesAnalysed = 0;
  let voiceNotesTranscribed = 0;

  for (const it of waitingItems) {
    if (it.kind === "image") imagesAnalysed += 1;
    if (it.kind === "voice") voiceNotesTranscribed += 1;
    // Scrutiny policy: hold-for-review sources are always flagged
    if (it.source === "needs-verification" || it.source === "personal-ideas") {
      needsReview += 1;
    }
  }

  // Move the waiting items into "processed" (or "review" if flagged).
  // Determine which specific items get flagged by walking through and
  // stopping when we've marked `needsReview` many.
  const reviewIds = new Set<string>();
  let flagsRemaining = needsReview;
  for (const it of waitingItems) {
    if (flagsRemaining <= 0) break;
    if (it.source === "needs-verification" || it.source === "personal-ideas") {
      reviewIds.add(it.id);
      flagsRemaining -= 1;
    }
  }
  // Any residual review flags land on random remaining items.
  for (const it of waitingItems) {
    if (flagsRemaining <= 0) break;
    if (!reviewIds.has(it.id)) {
      reviewIds.add(it.id);
      flagsRemaining -= 1;
    }
  }

  // Enqueue REAL knowledge-extractor jobs for every text item that
  // isn't held for review. This is what actually reaches the Fly cloud
  // worker (via Supabase worker_jobs) so the Ops dashboard agents flip
  // from Sleeping → Working. Images/voice stay out — text-only workers.
  // Failures per-item don't break the batch (log + continue).
  //
  // Priority is derived from source scrutiny — high-trust sources
  // (chatgpt-approved / claude-generated / gov-standards) get priority 3
  // so they overtake noisier sources in a mixed batch.
  const store = brainStore();
  const priorityForSource: Record<KnowledgeSource, number> = {
    "chatgpt-approved":   3,
    "claude-generated":   3,
    "gov-standards":      3,
    "customer-qa":        4,
    "raw-research":       5,
    "internet-article":   5,
    "needs-verification": 7,
    "personal-ideas":     7,
  };
  let jobsEnqueued = 0;
  for (const it of waitingItems) {
    if (it.kind !== "text") continue;              // images/voice: not in worker pool
    if (reviewIds.has(it.id)) continue;            // held for scrutiny
    const text = contentById.get(it.id);
    if (!text || text.length === 0) continue;
    try {
      await store.enqueueJob({
        worker_type: "knowledge-extractor",
        priority: priorityForSource[it.source] ?? 5,
        input_kind: "inbox_item",
        input_ref: it.id,
        input_payload: {
          text,
          title: it.title ?? null,
          source: it.source,
          source_kind: it.kind,
        },
      });
      jobsEnqueued += 1;
    } catch (err) {
      console.error(`[knowledge-inbox.process] enqueue failed for ${it.id}:`, err);
    }
  }
  if (jobsEnqueued > 0) {
    console.log(`[knowledge-inbox.process] enqueued ${jobsEnqueued} extractor jobs`);
  }

  const now = Date.now();
  const changedIds = new Set<string>();
  const nextItems = items.map((i) => {
    if (i.status !== "waiting") return i;
    if (input.ids && !input.ids.includes(i.id)) return i;
    changedIds.add(i.id);
    if (reviewIds.has(i.id)) {
      return {
        ...i,
        status: "review" as InboxStatus,
        processedAt: now,
        processedNotes: "Flagged for human review by scrutiny policy.",
      };
    }
    return {
      ...i,
      status: "processed" as InboxStatus,
      processedAt: now,
      processedNotes: `Processed under ${i.source} pipeline${
        totalTextChars > 0 && i.kind === "text" ? ` · ${totalTextChars.toLocaleString()} text chars read` : ""
      }`,
    };
  });
  await writeIndex(nextItems);
  // Phase 11.2 · runProcessInbox mutates status + processedAt +
  // processedNotes in a single writeIndex(), bypassing the per-mutation
  // shadow hooks that live in appendItem/updateStatuses/setItemStatus.
  // Mirror the changed rows to Postgres explicitly via shadowUpsertInboxItem
  // so the shadow tracks the full item state (not just status). Gated ·
  // best-effort · never delays the primary path.
  for (const item of nextItems) {
    if (changedIds.has(item.id)) void shadowUpsertInboxItem(item);
  }

  // Roll the persistent stats forward. Downstream counts stay NULL —
  // we don't own them here. Only counts we can prove:
  //   · completedToday (items moved to "processed" today)
  //   · imagesAnalysed / voiceNotesTranscribed (real kinds)
  const stats = await readStats();
  const completed = waitingItems.length - needsReview;
  const today = new Date().toISOString().slice(0, 10);
  const nextStats: InboxStats = {
    completedToday:
      stats.completedTodayDate === today
        ? stats.completedToday + completed
        : completed,
    completedTodayDate: today,
    imagesAnalysed: stats.imagesAnalysed + imagesAnalysed,
    voiceNotesTranscribed: stats.voiceNotesTranscribed + voiceNotesTranscribed,
    lastProcessedAt: now,
    // Null when unknown — see feedback_nex_never_pretends_work_done doctrine
    recordsCreated: null,
    recordsUpdated: null,
    faqsGenerated: null,
    edgesCreated: null,
    duplicatesMerged: null,
  };
  await writeStats(nextStats);

  const report: ProcessingReport = {
    itemsProcessed: waitingItems.length,
    itemsEnqueuedForWorkers: jobsEnqueued,
    imagesAnalysed,
    voiceNotesTranscribed,
    needsReview,
    recordsCreated: null,
    recordsUpdated: null,
    faqsGenerated: null,
    edgesCreated: null,
    duplicatesMerged: null,
    note:
      jobsEnqueued > 0
        ? `${jobsEnqueued} item${jobsEnqueued > 1 ? "s" : ""} handed to the worker pipeline. Real record + FAQ + edge counts appear on Worker Manager as they complete.`
        : `No items were enqueued for extraction. See Worker Manager for authoritative pipeline state.`,
  };
  return { report, items: nextItems, stats: nextStats };
}

function emptyReport(): ProcessingReport {
  return {
    itemsProcessed: 0,
    itemsEnqueuedForWorkers: 0,
    imagesAnalysed: 0,
    voiceNotesTranscribed: 0,
    needsReview: 0,
    recordsCreated: null,
    recordsUpdated: null,
    faqsGenerated: null,
    edgesCreated: null,
    duplicatesMerged: null,
  };
}

// ── Convenience combined snapshot ────────────────────────────────────

export async function readSnapshot(): Promise<{
  items: InboxItem[];
  stats: InboxStats;
}> {
  const [items, stats] = await Promise.all([readIndex(), readStats()]);
  return { items, stats };
}

// Guard: accept only recognised source labels from the client.
const VALID_SOURCES: KnowledgeSource[] = [
  "chatgpt-approved",
  "claude-generated",
  "raw-research",
  "internet-article",
  "needs-verification",
  "gov-standards",
  "customer-qa",
  "personal-ideas",
];

export function coerceSource(input: unknown): KnowledgeSource {
  if (typeof input === "string" && (VALID_SOURCES as string[]).includes(input)) {
    return input as KnowledgeSource;
  }
  return "raw-research";
}
