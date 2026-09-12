// src/lib/nex/live/media-declaration-store.ts
//
// NEX LIVE · MUSIC/VIDEO slice · media_id ↔ declaration link
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §5 · §20
//
// Persists MediaRightsDeclaration records as JSONL under
// data/nex-live/declarations.jsonl. Keyed by media_id + declaration_id.
// A media may have multiple declaration VERSIONS over its life (initial
// upload · uploader correction · post-review re-declaration) — only ONE
// may be active at a time.
//
// §20 reuses existing nex.media_object schema without mutation. In
// production this becomes a Postgres table with the same row shape.

import fs from "node:fs";
import path from "node:path";
import type { MediaRightsDeclaration } from "./rights-declaration";

function dataRoot(): string {
  const override = process.env.NEX_LIVE_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "nex-live");
}
function declarationsPath(): string {
  return path.join(dataRoot(), "declarations.jsonl");
}

function ensureDir(): void {
  const d = dataRoot();
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function readAll(): MediaRightsDeclaration[] {
  try {
    if (!fs.existsSync(declarationsPath())) return [];
    const raw = fs.readFileSync(declarationsPath(), "utf8");
    if (!raw.trim()) return [];
    return raw.split("\n").filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as MediaRightsDeclaration);
  } catch { return []; }
}

/** Save a new declaration and mark all prior declarations for the same
 *  media as inactive (is_active=false). Atomic rewrite. */
export function saveDeclaration(decl: MediaRightsDeclaration): MediaRightsDeclaration {
  ensureDir();
  const all = readAll();
  for (const d of all) {
    if (d.media_id === decl.media_id && d.is_active) d.is_active = false;
  }
  all.push({ ...decl, is_active: true });
  const tmp = `${declarationsPath()}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, all.map((d) => JSON.stringify(d)).join("\n") + "\n", "utf8");
  fs.renameSync(tmp, declarationsPath());
  return decl;
}

/** Read the currently active declaration for a media (or null if none). */
export function readActiveDeclaration(media_id: string): MediaRightsDeclaration | null {
  const all = readAll();
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].media_id === media_id && all[i].is_active) return all[i];
  }
  return null;
}

/** Read the full declaration history for a media (chronological order). */
export function readDeclarationHistory(media_id: string): MediaRightsDeclaration[] {
  return readAll().filter((d) => d.media_id === media_id);
}

/** Enumerate media_ids that currently have any declaration. Used by
 *  the discovery endpoint to filter which media_object rows count as
 *  NEX-Live-published (as opposed to raw camera captures with no
 *  declaration). */
export function listMediaIdsWithDeclaration(): string[] {
  const all = readAll();
  const seen = new Set<string>();
  for (const d of all) if (d.is_active) seen.add(d.media_id);
  return Array.from(seen);
}
