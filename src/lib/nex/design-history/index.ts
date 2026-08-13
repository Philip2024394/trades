// Design History Engine · public exports.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export { createHistory, apply, undo, redo, branch, compare, versionSnapshot, auditLog } from "./history";
export type {
  DesignHistory, HistoryEntry, Operation, OperationKind, Branch, DocumentSnapshot, Diff, DiffLine,
} from "./types";
