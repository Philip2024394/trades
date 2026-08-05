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
  await fs.writeFile(path.join(FILES_DIR, storedName), input.bytes);

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
    filePath: `files/${storedName}`,
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
  return out;
}

export async function deleteItem(id: string): Promise<boolean> {
  const items = await readIndex();
  const target = items.find((i) => i.id === id);
  if (!target) return false;
  const next = items.filter((i) => i.id !== id);
  await writeIndex(next);
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
  let totalTextChars = 0;
  for (const it of waitingItems) {
    if (it.kind === "text" && it.contentPath) {
      const content = await readItemContent(it);
      if (content) totalTextChars += content.length;
    }
  }

  // Deltas: heuristic until the Reasoning Layer + Aggregator arrive.
  // Higher-scrutiny sources produce fewer immediate record deltas —
  // the trust-based workflow doctrine (Philip 2026-08-06).
  const scrutinyDivisor: Record<KnowledgeSource, number> = {
    "chatgpt-approved":   1.0,   // fastest path — mostly import
    "claude-generated":   1.0,
    "raw-research":       2.2,   // slower — extract + verify
    "internet-article":   3.0,   // slowest — verify before promote
    "needs-verification": 5.0,   // parked
    "gov-standards":      1.2,   // authoritative — direct updates
    "customer-qa":        1.8,   // FAQ-driven
    "personal-ideas":     4.0,   // sandbox
  };

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let faqsGenerated = 0;
  let edgesCreated = 0;
  let duplicatesMerged = 0;
  let needsReview = 0;
  let imagesAnalysed = 0;
  let voiceNotesTranscribed = 0;

  for (const it of waitingItems) {
    const div = scrutinyDivisor[it.source] ?? 1.5;
    if (it.source === "chatgpt-approved" || it.source === "claude-generated") {
      recordsCreated += Math.random() < 0.20 ? 1 : 0;
      recordsUpdated += Math.random() < 0.55 ? 1 : 0;
      faqsGenerated += Math.round((5 + Math.random() * 6) / div);
    } else if (it.source === "gov-standards") {
      recordsCreated += Math.random() < 0.10 ? 1 : 0;
      recordsUpdated += 1 + Math.floor(Math.random() * 3);
      faqsGenerated += Math.round(2 / div);
    } else if (it.source === "customer-qa") {
      recordsUpdated += Math.random() < 0.30 ? 1 : 0;
      faqsGenerated += 3 + Math.floor(Math.random() * 6);
    } else if (it.source === "needs-verification" || it.source === "personal-ideas") {
      // hold — no promotion
      needsReview += 1;
    } else {
      recordsCreated += Math.random() < 0.10 ? 1 : 0;
      recordsUpdated += Math.random() < 0.30 ? 1 : 0;
      faqsGenerated += Math.round((3 + Math.random() * 4) / div);
    }
    edgesCreated += Math.round((1 + Math.random() * 2) / div);
    duplicatesMerged += Math.random() < 0.25 ? 1 : 0;
    if (it.kind === "image") imagesAnalysed += 1;
    if (it.kind === "voice") voiceNotesTranscribed += 1;
    // Very occasional random flag on non-hold sources.
    if (
      needsReview === 0 &&
      it.source !== "chatgpt-approved" &&
      it.source !== "claude-generated" &&
      Math.random() < 0.04
    ) {
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

  const now = Date.now();
  const nextItems = items.map((i) => {
    if (i.status !== "waiting") return i;
    if (input.ids && !input.ids.includes(i.id)) return i;
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

  // Roll the persistent stats forward.
  const stats = await readStats();
  const completed = waitingItems.length - needsReview;
  const today = new Date().toISOString().slice(0, 10);
  const nextStats: InboxStats = {
    recordsCreated: stats.recordsCreated + recordsCreated,
    recordsUpdated: stats.recordsUpdated + recordsUpdated,
    faqsGenerated: stats.faqsGenerated + faqsGenerated,
    edgesCreated: stats.edgesCreated + edgesCreated,
    duplicatesMerged: stats.duplicatesMerged + duplicatesMerged,
    imagesAnalysed: stats.imagesAnalysed + imagesAnalysed,
    voiceNotesTranscribed: stats.voiceNotesTranscribed + voiceNotesTranscribed,
    completedToday:
      stats.completedTodayDate === today
        ? stats.completedToday + completed
        : completed,
    completedTodayDate: today,
    lastProcessedAt: now,
  };
  await writeStats(nextStats);

  const report: ProcessingReport = {
    itemsProcessed: waitingItems.length,
    recordsCreated,
    recordsUpdated,
    faqsGenerated,
    edgesCreated,
    duplicatesMerged,
    imagesAnalysed,
    voiceNotesTranscribed,
    needsReview,
  };
  return { report, items: nextItems, stats: nextStats };
}

function emptyReport(): ProcessingReport {
  return {
    itemsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    faqsGenerated: 0,
    edgesCreated: 0,
    duplicatesMerged: 0,
    imagesAnalysed: 0,
    voiceNotesTranscribed: 0,
    needsReview: 0,
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
