// Visual Tree — id helpers + DOM-attribute factories.
//
// Section renderers use `sectionRootAttrs()` and `treeAttrs()` instead
// of hand-writing `data-tree-id="sec:foo.bar"`. That way the id format
// is enforced in ONE place — future changes (protocol v2, escape rules,
// namespacing) don't need touching every section file.

// ─── Id builders ──────────────────────────────────────────────────

export const PAGE_TREE_ID = "page";

/** Compose a tree-id for a section root or one of its elements. */
export function treeIdFor(instanceId: string, elementKey?: string): string {
  return elementKey ? `sec:${instanceId}.${elementKey}` : `sec:${instanceId}`;
}

/** Parse a tree-id back into its parts. Returns null if malformed —
 *  callers decide how to handle (log, ignore, throw). */
export function parseTreeId(treeId: string):
  | { kind: "page" }
  | { kind: "section"; instanceId: string }
  | { kind: "element"; instanceId: string; elementKey: string }
  | null {
  if (treeId === PAGE_TREE_ID) return { kind: "page" };
  if (!treeId.startsWith("sec:")) return null;
  const rest = treeId.slice(4);
  const dot = rest.indexOf(".");
  if (dot === -1) {
    return rest ? { kind: "section", instanceId: rest } : null;
  }
  const instanceId = rest.slice(0, dot);
  const elementKey = rest.slice(dot + 1);
  if (!instanceId || !elementKey) return null;
  return { kind: "element", instanceId, elementKey };
}

// ─── DOM attribute factories ──────────────────────────────────────
//
// Spread these onto section root elements + element leaves in every
// section renderer. Uniform, forgetting-proof.

/** Attributes for the top-level page container (the studio preview
 *  route mounts one of these). */
export function pageRootAttrs(): Record<string, string> {
  return {
    "data-tree-id": PAGE_TREE_ID,
    "data-tree-name": "Page",
    "data-tree-kind": "page"
  };
}

/** Attributes for a section's outer element. `registrationId` links
 *  the DOM node back to the Section Registry entry that rendered it. */
export function sectionRootAttrs(
  instanceId: string,
  registrationId: string,
  name?: string
): Record<string, string> {
  return {
    "data-tree-id": treeIdFor(instanceId),
    "data-tree-name": name ?? "Section",
    "data-tree-kind": "section",
    "data-studio-section": registrationId
  };
}

/** Attributes for an editable element inside a section — a heading,
 *  button, image, badge, etc. `elementKey` MUST match one of the
 *  registration's editableFields[].key values.
 *
 *  `priority` is the SelectionPriority tag from the registration —
 *  emitted as `data-tree-priority` so the chrome's click router can
 *  read it directly from DOM without a registry lookup on every tap.
 *  Undefined priority means the element has no visible role
 *  (uncommon — most tree-emitting elements should carry one). */
export function treeAttrs(
  instanceId: string,
  elementKey: string,
  name?: string,
  priority?: "text" | "image" | "button" | "card" | "container"
): Record<string, string> {
  const attrs: Record<string, string> = {
    "data-tree-id": treeIdFor(instanceId, elementKey),
    "data-tree-name": name ?? elementKey,
    "data-tree-kind": "element",
    "data-tree-element-key": elementKey
  };
  if (priority) attrs["data-tree-priority"] = priority;
  return attrs;
}

// ─── CSS-selector helper ──────────────────────────────────────────
//
// tree-ids may contain colons and dots. Colons and dots are valid
// INSIDE a double-quoted attribute selector, so plain-string queries
// like `[data-tree-id="sec:x.y"]` work. The escape helper only handles
// the (currently impossible but future-proof) case of embedded quotes
// or backslashes.

export function treeIdSelector(treeId: string): string {
  const escaped = treeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[data-tree-id="${escaped}"]`;
}
