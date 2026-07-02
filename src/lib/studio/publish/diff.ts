// Publish diff — compare two layouts and describe what changed.
//
// Used by:
//   • Publish dashboard — "3 sections changed since last publish"
//   • Publish detail page — per-section diff before hitting Publish
//   • Version history modal — show the delta between adjacent snapshots
//
// Pure functions. No I/O. Client-safe.

import type { StudioLayoutJson } from "../schema";

export type SectionChange =
  | { kind: "added"; instanceId: string; sectionKey: string }
  | { kind: "removed"; instanceId: string; sectionKey: string }
  | {
      kind: "modified";
      instanceId: string;
      sectionKey: string;
      /** Config keys whose value differs between draft and live. Nested
       *  object mutations register as a single key at the top level to
       *  keep the summary readable. */
      changedKeys: string[];
    }
  | {
      kind: "swapped";
      instanceId: string;
      fromSectionKey: string;
      toSectionKey: string;
    };

export type LayoutDiff = {
  changes: SectionChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    swapped: number;
    total: number;
  };
  /** Row structure differs between the two layouts. Cheap boolean
   *  because visualising row-reflow diffs is a Module 22+ concern. */
  rowsChanged: boolean;
};

export function diffLayouts(
  live: StudioLayoutJson | null,
  draft: StudioLayoutJson
): LayoutDiff {
  const liveSections = live?.sections ?? [];
  const draftSections = draft.sections ?? [];

  const liveById = new Map(liveSections.map((s) => [s.instanceId, s]));
  const draftById = new Map(draftSections.map((s) => [s.instanceId, s]));

  const changes: SectionChange[] = [];

  for (const draftSec of draftSections) {
    const liveSec = liveById.get(draftSec.instanceId);
    if (!liveSec) {
      changes.push({
        kind: "added",
        instanceId: draftSec.instanceId,
        sectionKey: draftSec.key
      });
      continue;
    }
    if (liveSec.key !== draftSec.key) {
      changes.push({
        kind: "swapped",
        instanceId: draftSec.instanceId,
        fromSectionKey: liveSec.key,
        toSectionKey: draftSec.key
      });
      continue;
    }
    const changedKeys = shallowConfigDiff(liveSec.config, draftSec.config);
    if (changedKeys.length > 0) {
      changes.push({
        kind: "modified",
        instanceId: draftSec.instanceId,
        sectionKey: draftSec.key,
        changedKeys
      });
    }
  }

  for (const liveSec of liveSections) {
    if (!draftById.has(liveSec.instanceId)) {
      changes.push({
        kind: "removed",
        instanceId: liveSec.instanceId,
        sectionKey: liveSec.key
      });
    }
  }

  const summary = {
    added: changes.filter((c) => c.kind === "added").length,
    removed: changes.filter((c) => c.kind === "removed").length,
    modified: changes.filter((c) => c.kind === "modified").length,
    swapped: changes.filter((c) => c.kind === "swapped").length,
    total: changes.length
  };

  const rowsChanged = !rowsShallowEqual(live?.rows, draft.rows);

  return { changes, summary, rowsChanged };
}

function shallowConfigDiff(
  live: Record<string, unknown> | undefined,
  draft: Record<string, unknown> | undefined
): string[] {
  const a = live ?? {};
  const b = draft ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!deepEqual(a[k], b[k])) out.push(k);
  }
  return out.sort();
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!deepEqual(ao[k], bo[k])) return false;
    return true;
  }
  return false;
}

function rowsShallowEqual(
  a: StudioLayoutJson["rows"] | undefined,
  b: StudioLayoutJson["rows"] | undefined
): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    const ra = aa[i];
    const rb = bb[i];
    if (ra.id !== rb.id) return false;
    if (ra.columns.length !== rb.columns.length) return false;
    for (let j = 0; j < ra.columns.length; j++) {
      if (ra.columns[j] !== rb.columns[j]) return false;
    }
  }
  return true;
}
