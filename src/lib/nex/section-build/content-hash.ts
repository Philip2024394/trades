// src/lib/nex/section-build/content-hash.ts
//
// Deterministic content-hashing for build artifacts. sha256 is used for
// reproducibility across environments. Files are sorted by path before
// hashing so ordering cannot change the hash.

import { createHash } from "node:crypto";
import type { ArtifactFile } from "./types";

/**
 * Compute sha256 hash of a single file's content. Content is treated as
 * bytes (UTF-8 encoding for strings). Whitespace-insensitive: no normalization
 * is applied · byte-identical content produces byte-identical hash.
 */
export function hashFileContent(content: string | Buffer): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

/**
 * Compute the composite hash of an entire artifact from its file list.
 * Sort by path · concatenate `path:hash` lines · hash the composite.
 *
 * Two artifacts with identical file lists (same paths + same content hashes)
 * produce identical composite hashes regardless of insertion order.
 */
export function hashArtifact(files: readonly ArtifactFile[]): string {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const composite = sorted.map((f) => `${f.path}:${f.content_hash}`).join("\n");
  return hashFileContent(composite);
}

/**
 * Build an ArtifactFile from raw content.
 */
export function toArtifactFile(path: string, content: string | Buffer): ArtifactFile {
  const bytes = typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.length;
  return {
    path,
    content_hash: hashFileContent(content),
    size: bytes,
  };
}
