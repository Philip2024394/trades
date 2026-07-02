// Visual Tree — type surface.
//
// Every rendered element in a Studio page is addressable via a tree-id.
// The tree extractor walks the DOM and returns a hierarchical snapshot
// the Navigator UI consumes. Selection, scroll-to, AI Explain, and
// Score all reference nodes by tree-id — one addressing model shared
// across every future module.
//
// Tree-id format:
//   • Page root         → "page"
//   • Section root      → "sec:<instanceId>"
//   • Section element   → "sec:<instanceId>.<elementKey>"
//
// The instanceId matches SectionInstance.instanceId from the layout
// JSON (schema.ts). The elementKey matches EditableField.key from the
// section's registration. Every id parses without ambiguity because
// `.` is disallowed inside instanceId (see studioId() in schema.ts).

import type { SelectionPriority } from "./sectionTypes";

/** What kind of node this is. Drives Navigator icon + indentation. */
export type TreeNodeKind = "page" | "section" | "element";

/** Serialized DOMRect — plain object so postMessage can structured-clone
 *  it. All values in CSS pixels, relative to the viewport (matches
 *  getBoundingClientRect). */
export type SerializedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
};

/** One node in the visual tree. Recursive children build the hierarchy
 *  the Navigator UI renders as an indented list. */
export type TreeNode = {
  treeId: string;
  kind: TreeNodeKind;
  /** Human-readable label. For sections = registration.name.
   *  For elements = EditableField.label. For the page = "Page". */
  name: string;
  /** Section-only: which registration rendered this node. Powers the
   *  Navigator's section-type icon. */
  registrationId?: string;
  /** Element-only: which config key this element renders. Matches
   *  EditableField.key so Navigator → toolbar → AI all agree. */
  elementKey?: string;
  /** Element-only: SelectionPriority tag from the field's registration
   *  (text / image / button / card / container). Navigator uses this
   *  for row icons; Module 2 toolbar uses it to decide tool set. */
  priority?: SelectionPriority;
  /** Viewport rect at the moment the snapshot was taken. */
  rect: SerializedRect;
  /** Nested children. Sections contain elements; the page contains
   *  sections. Elements have no children (leaves). */
  children: TreeNode[];
};

/** Everything needed to render the Navigator + reason about position. */
export type TreeSnapshot = {
  /** Always a "page" kind node. */
  root: TreeNode;
  /** Epoch ms when the snapshot was captured. Navigator uses this to
   *  avoid rendering stale trees after a reload. */
  generatedAt: number;
  /** Viewport metrics at capture time. Navigator uses `scrollY` to
   *  compute the "you are here" marker. */
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
  };
};

// ─── Tree-scoped postMessage types ────────────────────────────────
//
// These are the message shapes the iframe and parent exchange for tree
// operations. The full postMessage bus (Module 0.6) will union these
// with select/move/remove/apply-layout messages, but tree messages are
// defined here so anything downstream can import them directly.

/** Every Studio postMessage carries the protocol version. Increment
 *  when a breaking change is required — old iframes should reject
 *  incoming messages with an unknown version. */
export type StudioProtocolVersion = 1;

/** Messages the iframe sends TO the parent window. */
export type TreeOutboundMessage =
  | {
      v: StudioProtocolVersion;
      type: "tree";
      payload: { snapshot: TreeSnapshot };
    }
  | {
      v: StudioProtocolVersion;
      type: "tree-changed";
      payload: { snapshot: TreeSnapshot; reason: TreeChangeReason };
    };

/** Messages the parent sends TO the iframe. */
export type TreeInboundMessage =
  | {
      v: StudioProtocolVersion;
      type: "request-tree";
      payload: Record<string, never>;
    }
  | {
      v: StudioProtocolVersion;
      type: "scroll-to";
      payload: {
        treeId: string;
        behavior?: "smooth" | "auto";
        block?: "start" | "center" | "end" | "nearest";
      };
    };

/** Why the tree changed — helps consumers decide whether to re-render
 *  the Navigator or just update rects. */
export type TreeChangeReason =
  | "mutation" // DOM mutation observer fired
  | "resize" // viewport changed size
  | "scroll" // page scrolled — rects updated, tree structure same
  | "manual"; // programmatic recompute request
