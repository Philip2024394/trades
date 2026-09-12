// src/lib/nex/l4-bakeoff/filesystem-transcript-sink.ts
//
// V.5.4.2+ · Durable filesystem-backed TranscriptSink
// Founder BEGIN V.5.4 · 2026-09-08
//
// Unblocks V.5.4.3 (first real controlled-instrument invocation)
// which per doctrine §11 R10 requires "full transcript preserved".
// The V.5.4.2 InMemoryTranscriptSink was interface-only · this is the
// durable substrate.
//
// Discipline:
//   · Append-only (Op-Truth §OP.5) · same request_id re-written with
//     IDENTICAL content is idempotent · re-written with DIFFERENT
//     content is REFUSED (throws · loud drift alarm)
//   · Path-traversal-safe: request_id must match [A-Za-z0-9_-]+ ·
//     any other characters REFUSED · sink_id constrained similarly
//   · Base directory MUST already exist · sink NEVER creates the base
//     (avoids silently scattering transcripts across the filesystem)
//   · The sink_id subdirectory IS created on first write (that's
//     legitimate namespacing · not silent base creation)
//   · Pointer format: file://<absolute_path>
//   · Content-addressable idempotency via SHA-256 of the canonical
//     JSON serialization · not string-equality of arbitrary formatting
//   · Every write is O_WRONLY|O_CREAT · we detect existing file and
//     verify content before overwrite

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { TranscriptRecord, TranscriptSink } from "./controlled-instrument";

// ═══════════════════════════════════════════════════════════════════
// § A · ERRORS
// ═══════════════════════════════════════════════════════════════════

export class FilesystemTranscriptSinkError extends Error {
  constructor(reason: string) { super(`filesystem_transcript_sink: ${reason}`); }
}

// ═══════════════════════════════════════════════════════════════════
// § B · VALIDATION
// ═══════════════════════════════════════════════════════════════════

const SAFE_ID_RE = /^[A-Za-z0-9_.-]+$/;

function assertSafeId(kind: "sink_id" | "request_id", value: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new FilesystemTranscriptSinkError(`${kind} required · empty REFUSED`);
  }
  if (value.length > 200) {
    throw new FilesystemTranscriptSinkError(`${kind} too long (${value.length} > 200)`);
  }
  if (!SAFE_ID_RE.test(value)) {
    throw new FilesystemTranscriptSinkError(
      `${kind}='${value}' REFUSED · only [A-Za-z0-9_.-] characters permitted (path-traversal defense)`,
    );
  }
  if (value === "." || value === "..") {
    throw new FilesystemTranscriptSinkError(`${kind}='${value}' REFUSED · path-traversal literal`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// § C · CANONICAL JSON SERIALIZATION (deterministic for idempotency)
// ═══════════════════════════════════════════════════════════════════

/** Canonical JSON: keys sorted at every object level · stable output.
 *  Matches JSON.stringify semantics for undefined (skipped in objects ·
 *  becomes null in arrays) so file-round-tripped records hash-equal to
 *  in-memory ones. */
function canonicalStringify(value: unknown): string {
  if (value === undefined) return "null"; // only reached from array-element branch
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => v === undefined ? "null" : canonicalStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort().filter((k) => obj[k] !== undefined);
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
}

function contentHash(record: TranscriptRecord): string {
  return createHash("sha256").update(canonicalStringify(record), "utf8").digest("hex");
}

// ═══════════════════════════════════════════════════════════════════
// § D · SINK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export type FilesystemTranscriptSinkOptions = {
  /** Base directory MUST already exist. Sink refuses to create it (avoids
   *  scattering transcripts across the filesystem when the operator gave
   *  a wrong path). */
  base_dir: string;
  /** Sink identifier · becomes a subdirectory under base_dir. Constrained
   *  to [A-Za-z0-9_.-]+ · path-traversal defense. */
  sink_id: string;
};

export class FilesystemTranscriptSink implements TranscriptSink {
  readonly sink_id: string;
  private readonly base_dir: string;
  private readonly sink_dir: string;

  constructor(opts: FilesystemTranscriptSinkOptions) {
    assertSafeId("sink_id", opts.sink_id);
    if (typeof opts.base_dir !== "string" || opts.base_dir.length === 0) {
      throw new FilesystemTranscriptSinkError("base_dir required · empty REFUSED");
    }
    if (!existsSync(opts.base_dir)) {
      throw new FilesystemTranscriptSinkError(
        `base_dir='${opts.base_dir}' does not exist · sink refuses to create it (operator must pre-provision)`,
      );
    }
    this.sink_id = opts.sink_id;
    this.base_dir = path.resolve(opts.base_dir);
    this.sink_dir = path.join(this.base_dir, opts.sink_id);
    // Create sink subdirectory on construction (namespacing · not silent base creation)
    if (!existsSync(this.sink_dir)) {
      mkdirSync(this.sink_dir, { recursive: false });
    }
  }

  private pathFor(request_id: string): string {
    assertSafeId("request_id", request_id);
    return path.join(this.sink_dir, `${request_id}.json`);
  }

  write(record: TranscriptRecord): void {
    assertSafeId("request_id", record.request_id);
    const filePath = this.pathFor(record.request_id);
    const canonical = canonicalStringify(record);
    const hash = createHash("sha256").update(canonical, "utf8").digest("hex");

    if (existsSync(filePath)) {
      // Idempotency check · same content re-write is OK · drift REFUSED
      const existing = readFileSync(filePath, "utf8");
      let existingCanonical: string;
      try {
        existingCanonical = canonicalStringify(JSON.parse(existing));
      } catch {
        throw new FilesystemTranscriptSinkError(
          `existing file for request_id='${record.request_id}' is not valid JSON · sink refuses to overwrite`,
        );
      }
      const existingHash = createHash("sha256").update(existingCanonical, "utf8").digest("hex");
      if (existingHash !== hash) {
        throw new FilesystemTranscriptSinkError(
          `content-drift for request_id='${record.request_id}' · existing_hash=${existingHash.slice(0, 16)} new_hash=${hash.slice(0, 16)} · Op-Truth §OP.5 append-only violated · REFUSED`,
        );
      }
      // identical content · idempotent no-op
      return;
    }

    // Fresh write · pretty-print for human readability, but idempotency
    // is enforced against canonical form (so formatting drift doesn't
    // trigger false content-drift alarms)
    writeFileSync(filePath, JSON.stringify(record, null, 2), { encoding: "utf8" });
  }

  pointer(request_id: string): string {
    // Deliberately does NOT check that the file exists · pointer is
    // a stable identity function · sink users can generate pointers
    // for scheduled writes without a chicken-and-egg check
    assertSafeId("request_id", request_id);
    return pathToFileURL(path.join(this.sink_dir, `${request_id}.json`)).href;
  }

  /** Read back a transcript by request_id. Returns undefined when absent.
   *  Not part of the TranscriptSink interface · sink-specific helper. */
  read(request_id: string): TranscriptRecord | undefined {
    const p = this.pathFor(request_id);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as TranscriptRecord;
  }

  /** Count records under this sink. Sink-specific helper. */
  size(): number {
    if (!existsSync(this.sink_dir)) return 0;
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    return readdirSync(this.sink_dir).filter((f) => f.endsWith(".json")).length;
  }

  /** Absolute filesystem path this sink writes into. Debug helper only. */
  debugSinkDir(): string {
    return this.sink_dir;
  }
}
