// Visual Tree — DOM walker + scroll helper.
//
// buildTreeSnapshot() reads the live DOM and returns the addressable
// hierarchy as plain JSON (postMessage-safe). scrollToTreeNode() moves
// the viewport to any node by id.
//
// Runs in the iframe context. Pure browser APIs — no React, no
// framework. Whichever host mounts these functions is responsible for
// MutationObserver / ResizeObserver wiring (that's Module 0.5).

import {
  PAGE_TREE_ID,
  parseTreeId,
  treeIdSelector
} from "./treeIds";
import type {
  SerializedRect,
  TreeChangeReason,
  TreeNode,
  TreeSnapshot
} from "./treeTypes";

// ─── Extractor ────────────────────────────────────────────────────

/** Walk the DOM starting from the page root (or a specified element)
 *  and return the tree snapshot. If no [data-tree-id="page"] element is
 *  found, falls back to document.body as the root — useful for early
 *  boot before the preview shell has painted. */
export function buildTreeSnapshot(root?: Element): TreeSnapshot {
  const doc = typeof document === "undefined" ? null : document;
  const pageEl =
    root ??
    doc?.querySelector(treeIdSelector(PAGE_TREE_ID)) ??
    doc?.body ??
    null;

  if (!pageEl) return emptySnapshot();

  const pageNode: TreeNode = {
    treeId: PAGE_TREE_ID,
    kind: "page",
    name: pageEl.getAttribute("data-tree-name") ?? "Page",
    rect: serializeRect(pageEl.getBoundingClientRect()),
    children: []
  };

  // Every element with [data-tree-id] that is NOT itself a page node.
  // Sorting by document position guarantees the tree order matches the
  // visual reading order without extra work.
  const all = Array.from(
    pageEl.querySelectorAll<HTMLElement>("[data-tree-id]")
  ).filter((el) => el.getAttribute("data-tree-id") !== PAGE_TREE_ID);

  const byId = new Map<string, TreeNode>();
  byId.set(PAGE_TREE_ID, pageNode);

  // First pass: create every node (no parent linking yet).
  for (const el of all) {
    const treeId = el.getAttribute("data-tree-id");
    if (!treeId) continue;
    const parsed = parseTreeId(treeId);
    if (!parsed) continue;

    const name = el.getAttribute("data-tree-name") ?? treeId;
    const rect = serializeRect(el.getBoundingClientRect());

    if (parsed.kind === "section") {
      byId.set(treeId, {
        treeId,
        kind: "section",
        name,
        registrationId:
          el.getAttribute("data-studio-section") ?? undefined,
        rect,
        children: []
      });
    } else if (parsed.kind === "element") {
      const priorityAttr = el.getAttribute("data-tree-priority");
      const priority =
        priorityAttr === "text" ||
        priorityAttr === "image" ||
        priorityAttr === "button" ||
        priorityAttr === "card" ||
        priorityAttr === "container"
          ? priorityAttr
          : undefined;
      byId.set(treeId, {
        treeId,
        kind: "element",
        name,
        elementKey: parsed.elementKey,
        priority,
        rect,
        children: []
      });
    }
  }

  // Second pass: link elements to their section, sections to the page.
  for (const el of all) {
    const treeId = el.getAttribute("data-tree-id");
    if (!treeId) continue;
    const parsed = parseTreeId(treeId);
    const node = byId.get(treeId);
    if (!parsed || !node) continue;

    if (parsed.kind === "section") {
      pageNode.children.push(node);
    } else if (parsed.kind === "element") {
      const parent = byId.get(`sec:${parsed.instanceId}`);
      // Orphan elements (no matching section) get dropped silently —
      // this can happen mid-mount before all attrs are in place. The
      // next MutationObserver tick will catch them.
      if (parent) parent.children.push(node);
    }
  }

  return {
    root: pageNode,
    generatedAt: Date.now(),
    viewport: {
      width: typeof window === "undefined" ? 0 : window.innerWidth,
      height: typeof window === "undefined" ? 0 : window.innerHeight,
      scrollX: typeof window === "undefined" ? 0 : window.scrollX,
      scrollY: typeof window === "undefined" ? 0 : window.scrollY,
      devicePixelRatio:
        typeof window === "undefined" ? 1 : window.devicePixelRatio
    }
  };
}

// ─── Scroll ───────────────────────────────────────────────────────

export function scrollToTreeNode(
  treeId: string,
  behavior: ScrollBehavior = "smooth",
  block: ScrollLogicalPosition = "start"
): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector(treeIdSelector(treeId));
  if (!el) return false;
  el.scrollIntoView({ behavior, block });
  return true;
}

// ─── Flatten / find helpers ───────────────────────────────────────

/** Depth-first walk of a snapshot. Callback gets each node + its depth
 *  (0 = page). Handy for Navigator rendering, id-based lookups, and
 *  test-time assertions. */
export function walkTree(
  node: TreeNode,
  visit: (n: TreeNode, depth: number) => void,
  depth = 0
): void {
  visit(node, depth);
  for (const child of node.children) walkTree(child, visit, depth + 1);
}

export function findNode(
  root: TreeNode,
  predicate: (n: TreeNode) => boolean
): TreeNode | null {
  let found: TreeNode | null = null;
  walkTree(root, (n) => {
    if (!found && predicate(n)) found = n;
  });
  return found;
}

export function findById(root: TreeNode, treeId: string): TreeNode | null {
  return findNode(root, (n) => n.treeId === treeId);
}

// ─── Internals ────────────────────────────────────────────────────

function serializeRect(rect: DOMRectReadOnly): SerializedRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right
  };
}

function emptySnapshot(): TreeSnapshot {
  return {
    root: {
      treeId: PAGE_TREE_ID,
      kind: "page",
      name: "Page",
      rect: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      },
      children: []
    },
    generatedAt: Date.now(),
    viewport: {
      width: 0,
      height: 0,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1
    }
  };
}

// Re-export the reason enum so consumers can build tree-changed
// messages without importing from two files.
export type { TreeChangeReason };
