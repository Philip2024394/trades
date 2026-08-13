// Design History Engine · types.
//
// Every change to a Design Document flows through this engine as a recorded
// Operation · never in-place mutation. That enables unlimited undo/redo ·
// branching · comparing alternatives · collaboration · audit history.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

// ─── Operation kinds (extensible union) ──────────────────────────────────

export type OperationKind =
  | "set_property"                       // change a leaf value (e.g. handrail.finish → dark_walnut)
  | "add_layer"                          // add a new layer to a component
  | "remove_layer"                       // remove an existing layer
  | "move_layer"                         // change position/z-index of a layer
  | "replace_material"                   // swap a MaterialObject reference
  | "replace_asset"                      // swap an image / hero asset
  | "replace_theme_pack"                 // swap a theme pack id
  | "change_camera"                      // swap a CameraObject profile
  | "change_lighting"                    // swap a LightingObject profile
  | "resize_container"                   // change a container's box
  | "custom";                            // caller-defined kind (must specify inverse)

// A single Operation describes ONE change · with the inverse for undo.
export type Operation = {
  op_id: string;
  kind: OperationKind;
  target_path: string;                   // JSON-pointer-style path into the document · e.g. "/pages/0/sections/0/containers/0/components/0/layers/0/primitives/2"
  before: unknown;                       // value before the change (for undo)
  after: unknown;                        // value after the change (for redo)
  author: string;                        // named person or agent
  reason?: string;                       // "user asked to darken handrail" · "reality advisor concern"
  at: string;                            // ISO timestamp
};

// ─── History entry (one committed operation per document version) ────────

export type HistoryEntry = {
  version: number;                       // monotonically increasing per branch
  branch_id: string;
  operation: Operation;
  parent_version?: number;
};

// ─── Branch (a divergent line of design exploration) ────────────────────

export type Branch = {
  id: string;
  name: string;
  base_branch_id?: string;               // the branch this was forked from
  base_version?: number;                 // the version at which the fork happened
  head_version: number;                  // current head version on this branch
  created_at: string;
  created_by: string;
};

// ─── Document snapshot at a specific version ────────────────────────────

export type DocumentSnapshot<Doc = unknown> = {
  branch_id: string;
  version: number;
  document: Doc;
  captured_at: string;
};

// ─── History log for a design document ──────────────────────────────────

export type DesignHistory<Doc = unknown> = {
  document_id: string;
  branches: Record<string, Branch>;
  entries: HistoryEntry[];               // append-only · one row per committed op
  head_snapshots: Record<string, DocumentSnapshot<Doc>>;  // latest snapshot per branch
  undo_stack: Record<string, number[]>;  // per-branch versions that can be undone
  redo_stack: Record<string, number[]>;  // per-branch versions that can be redone
};

// ─── Diff result when comparing two versions ────────────────────────────

export type DiffLine = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

export type Diff = {
  from: { branch_id: string; version: number };
  to: { branch_id: string; version: number };
  lines: readonly DiffLine[];
};
