// Design History Engine · apply · undo · redo · branch · compare.
//
// Deterministic operational log. Every function is pure (returns a new
// DesignHistory · never mutates its input).
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import type { DesignHistory, Operation, HistoryEntry, Branch, DocumentSnapshot, Diff, DiffLine } from "./types";

// ─── Path helpers · minimal JSON-pointer style ──────────────────────────

function splitPath(path: string): (string | number)[] {
  if (!path.startsWith("/")) throw new Error(`Path must start with '/': ${path}`);
  if (path === "/") return [];
  return path.slice(1).split("/").map((seg) => {
    const asNum = Number(seg);
    return Number.isInteger(asNum) && String(asNum) === seg ? asNum : seg;
  });
}

function cloneDeep<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function getAt(doc: unknown, path: string): unknown {
  const segs = splitPath(path);
  let cur: unknown = doc;
  for (const s of segs) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[s as string];
  }
  return cur;
}

function setAt<T>(doc: T, path: string, value: unknown): T {
  const segs = splitPath(path);
  if (segs.length === 0) return value as T;
  const next = cloneDeep(doc) as unknown;
  let cur: Record<string | number, unknown> = next as Record<string | number, unknown>;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (cur[seg] == null) cur[seg] = typeof segs[i + 1] === "number" ? [] : {};
    cur = cur[seg] as Record<string | number, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
  return next as T;
}

// ─── Constructor ─────────────────────────────────────────────────────────

export function createHistory<Doc>(document_id: string, initial: Doc, author: string): DesignHistory<Doc> {
  const branch_id = "main";
  const at = new Date().toISOString();
  return {
    document_id,
    branches: {
      [branch_id]: { id: branch_id, name: "main", head_version: 0, created_at: at, created_by: author },
    },
    entries: [],
    head_snapshots: {
      [branch_id]: { branch_id, version: 0, document: initial, captured_at: at },
    },
    undo_stack: { [branch_id]: [] },
    redo_stack: { [branch_id]: [] },
  };
}

// ─── Apply an operation ─────────────────────────────────────────────────

export function apply<Doc>(hist: DesignHistory<Doc>, branch_id: string, op: Omit<Operation, "op_id" | "at">): { history: DesignHistory<Doc>; snapshot: DocumentSnapshot<Doc> } {
  const branch = hist.branches[branch_id];
  if (!branch) throw new Error(`Unknown branch: ${branch_id}`);
  const parentSnapshot = hist.head_snapshots[branch_id];
  if (!parentSnapshot) throw new Error(`No head snapshot for branch: ${branch_id}`);

  const at = new Date().toISOString();
  const op_id = `op_${branch.head_version + 1}_${at}`;
  const opFull: Operation = { ...op, op_id, at };

  const nextDoc = setAt(parentSnapshot.document, op.target_path, op.after);
  const nextVersion = branch.head_version + 1;
  const entry: HistoryEntry = { version: nextVersion, branch_id, operation: opFull, parent_version: branch.head_version };
  const snapshot: DocumentSnapshot<Doc> = { branch_id, version: nextVersion, document: nextDoc, captured_at: at };

  const nextBranch: Branch = { ...branch, head_version: nextVersion };
  const undoStack = [...(hist.undo_stack[branch_id] ?? []), nextVersion];
  const redoStack: number[] = [];                                          // applying a new op clears redo history

  const nextHistory: DesignHistory<Doc> = {
    ...hist,
    branches: { ...hist.branches, [branch_id]: nextBranch },
    entries: [...hist.entries, entry],
    head_snapshots: { ...hist.head_snapshots, [branch_id]: snapshot },
    undo_stack: { ...hist.undo_stack, [branch_id]: undoStack },
    redo_stack: { ...hist.redo_stack, [branch_id]: redoStack },
  };
  return { history: nextHistory, snapshot };
}

// ─── Undo (pop the last op · restore the pre-op value) ─────────────────

export function undo<Doc>(hist: DesignHistory<Doc>, branch_id: string): { history: DesignHistory<Doc>; snapshot: DocumentSnapshot<Doc> } {
  const undoStack = hist.undo_stack[branch_id] ?? [];
  if (undoStack.length === 0) throw new Error(`Nothing to undo on branch: ${branch_id}`);
  const version = undoStack[undoStack.length - 1];
  const entry = hist.entries.find((e) => e.branch_id === branch_id && e.version === version);
  if (!entry) throw new Error(`Entry not found for undo: version=${version}`);

  const parentSnapshot = hist.head_snapshots[branch_id];
  const restoredDoc = setAt(parentSnapshot.document, entry.operation.target_path, entry.operation.before);
  const prevVersion = entry.parent_version ?? 0;
  const snapshot: DocumentSnapshot<Doc> = { branch_id, version: prevVersion, document: restoredDoc, captured_at: new Date().toISOString() };

  const nextBranch: Branch = { ...hist.branches[branch_id], head_version: prevVersion };
  const nextUndo = undoStack.slice(0, -1);
  const nextRedo = [...(hist.redo_stack[branch_id] ?? []), version];

  return {
    history: {
      ...hist,
      branches: { ...hist.branches, [branch_id]: nextBranch },
      head_snapshots: { ...hist.head_snapshots, [branch_id]: snapshot },
      undo_stack: { ...hist.undo_stack, [branch_id]: nextUndo },
      redo_stack: { ...hist.redo_stack, [branch_id]: nextRedo },
    },
    snapshot,
  };
}

// ─── Redo (re-apply the most recently undone op) ───────────────────────

export function redo<Doc>(hist: DesignHistory<Doc>, branch_id: string): { history: DesignHistory<Doc>; snapshot: DocumentSnapshot<Doc> } {
  const redoStack = hist.redo_stack[branch_id] ?? [];
  if (redoStack.length === 0) throw new Error(`Nothing to redo on branch: ${branch_id}`);
  const version = redoStack[redoStack.length - 1];
  const entry = hist.entries.find((e) => e.branch_id === branch_id && e.version === version);
  if (!entry) throw new Error(`Entry not found for redo: version=${version}`);

  const parentSnapshot = hist.head_snapshots[branch_id];
  const restoredDoc = setAt(parentSnapshot.document, entry.operation.target_path, entry.operation.after);
  const snapshot: DocumentSnapshot<Doc> = { branch_id, version, document: restoredDoc, captured_at: new Date().toISOString() };

  const nextBranch: Branch = { ...hist.branches[branch_id], head_version: version };
  const nextRedo = redoStack.slice(0, -1);
  const nextUndo = [...(hist.undo_stack[branch_id] ?? []), version];

  return {
    history: {
      ...hist,
      branches: { ...hist.branches, [branch_id]: nextBranch },
      head_snapshots: { ...hist.head_snapshots, [branch_id]: snapshot },
      undo_stack: { ...hist.undo_stack, [branch_id]: nextUndo },
      redo_stack: { ...hist.redo_stack, [branch_id]: nextRedo },
    },
    snapshot,
  };
}

// ─── Branch (fork from a version to explore an alternative) ─────────────

export function branch<Doc>(hist: DesignHistory<Doc>, from_branch_id: string, new_branch_id: string, name: string, author: string): DesignHistory<Doc> {
  if (hist.branches[new_branch_id]) throw new Error(`Branch already exists: ${new_branch_id}`);
  const from = hist.branches[from_branch_id];
  if (!from) throw new Error(`Source branch not found: ${from_branch_id}`);
  const fromSnapshot = hist.head_snapshots[from_branch_id];
  const at = new Date().toISOString();
  const newBranch: Branch = { id: new_branch_id, name, base_branch_id: from_branch_id, base_version: from.head_version, head_version: from.head_version, created_at: at, created_by: author };
  const newSnapshot: DocumentSnapshot<Doc> = { branch_id: new_branch_id, version: from.head_version, document: cloneDeep(fromSnapshot.document), captured_at: at };
  return {
    ...hist,
    branches: { ...hist.branches, [new_branch_id]: newBranch },
    head_snapshots: { ...hist.head_snapshots, [new_branch_id]: newSnapshot },
    undo_stack: { ...hist.undo_stack, [new_branch_id]: [] },
    redo_stack: { ...hist.redo_stack, [new_branch_id]: [] },
  };
}

// ─── Compare (diff two versions) ────────────────────────────────────────

function walk(doc: unknown, prefix: string, out: Map<string, unknown>): void {
  if (doc == null || typeof doc !== "object") {
    out.set(prefix || "/", doc);
    return;
  }
  const entries = Array.isArray(doc)
    ? doc.map((v, i) => [String(i), v] as const)
    : Object.entries(doc as Record<string, unknown>);
  if (entries.length === 0) out.set(prefix || "/", doc);
  for (const [k, v] of entries) {
    walk(v, `${prefix}/${k}`, out);
  }
}

export function compare<Doc>(hist: DesignHistory<Doc>, from: { branch_id: string; version?: number }, to: { branch_id: string; version?: number }): Diff {
  const fromSnap = versionSnapshot(hist, from.branch_id, from.version);
  const toSnap = versionSnapshot(hist, to.branch_id, to.version);
  const fromLeaves = new Map<string, unknown>();
  const toLeaves = new Map<string, unknown>();
  walk(fromSnap.document, "", fromLeaves);
  walk(toSnap.document, "", toLeaves);
  const lines: DiffLine[] = [];
  const allPaths = new Set([...fromLeaves.keys(), ...toLeaves.keys()]);
  for (const p of Array.from(allPaths).sort()) {
    const a = fromLeaves.get(p);
    const b = toLeaves.get(p);
    if (a === undefined && b !== undefined) lines.push({ path: p, kind: "added", after: b });
    else if (a !== undefined && b === undefined) lines.push({ path: p, kind: "removed", before: a });
    else if (JSON.stringify(a) !== JSON.stringify(b)) lines.push({ path: p, kind: "changed", before: a, after: b });
  }
  return { from: { branch_id: fromSnap.branch_id, version: fromSnap.version }, to: { branch_id: toSnap.branch_id, version: toSnap.version }, lines };
}

/** Reconstruct the document at a specific version by replaying operations from the
 *  branch's initial snapshot. If no version is given · returns the current head. */
export function versionSnapshot<Doc>(hist: DesignHistory<Doc>, branch_id: string, version?: number): DocumentSnapshot<Doc> {
  const headSnap = hist.head_snapshots[branch_id];
  if (!headSnap) throw new Error(`No head snapshot for branch: ${branch_id}`);
  const targetVersion = version ?? headSnap.version;
  if (targetVersion === headSnap.version) return headSnap;

  // Reconstruct by walking backward from head using inverse operations.
  let doc = cloneDeep(headSnap.document);
  let cur = headSnap.version;
  while (cur > targetVersion) {
    const entry = hist.entries.find((e) => e.branch_id === branch_id && e.version === cur);
    if (!entry) throw new Error(`Cannot reconstruct version ${targetVersion}: missing entry at ${cur}`);
    doc = setAt(doc, entry.operation.target_path, entry.operation.before);
    cur = entry.parent_version ?? 0;
  }
  return { branch_id, version: targetVersion, document: doc, captured_at: new Date().toISOString() };
}

// ─── Audit + Voice Explanation helpers ──────────────────────────────────

/** Ordered operations for a branch · newest last. Useful for Voice ("why did the design evolve?"). */
export function auditLog<Doc>(hist: DesignHistory<Doc>, branch_id: string): readonly HistoryEntry[] {
  return hist.entries.filter((e) => e.branch_id === branch_id).sort((a, b) => a.version - b.version);
}
