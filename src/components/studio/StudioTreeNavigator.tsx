"use client";

// StudioTreeNavigator — left-column visual page tree.
//
// Renders a hierarchical outline of every addressable element on the
// live page: page → sections → element leaves. Merchant clicks any
// row to jump the iframe there (smooth scroll) and select the element
// — muscle-memory replacement for endless scrolling on long pages.
//
// This is one of the differentiators the master brief called out:
// "Not Layers. A Visual Tree."
//
// Pure presentational. Consumers pass:
//   • snapshot — the current TreeSnapshot (null until iframe reports)
//   • selected — treeId of the currently selected node, if any
//   • onNavigate(treeId) — called when a row is clicked

import type { TreeNode, TreeSnapshot } from "@/lib/studio/treeTypes";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

type Props = {
  snapshot: TreeSnapshot | null;
  selected: string | null;
  onNavigate: (treeId: string) => void;
};

export function StudioTreeNavigator({ snapshot, selected, onNavigate }: Props) {
  if (!snapshot) return <NavigatorEmpty />;

  const counts = countKinds(snapshot.root);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-neutral-200 px-4 py-3">
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          Page tree
        </p>
        <p className="mt-0.5 text-[11px] font-bold text-neutral-500">
          {counts.section} section{counts.section === 1 ? "" : "s"} ·{" "}
          {counts.element} element{counts.element === 1 ? "" : "s"}
        </p>
      </header>

      <ul
        role="tree"
        aria-label="Page structure"
        className="flex-1 overflow-y-auto py-1"
      >
        <TreeRow
          node={snapshot.root}
          depth={0}
          selected={selected}
          onNavigate={onNavigate}
        />
      </ul>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────

function TreeRow({
  node,
  depth,
  selected,
  onNavigate
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onNavigate: (treeId: string) => void;
}) {
  const isSelected = selected === node.treeId;

  return (
    <li role="treeitem" aria-selected={isSelected}>
      <button
        type="button"
        onClick={() => onNavigate(node.treeId)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] transition"
        style={{
          paddingLeft: 8 + depth * 14,
          background: isSelected ? YELLOW : "transparent",
          color: isSelected ? BLACK : "#404040",
          fontWeight: isSelected ? 800 : 500
        }}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center">
          <NodeIcon
            kind={node.kind}
            priority={node.priority}
            selected={isSelected}
          />
        </span>
        <span className="flex-1 truncate">{node.name}</span>
        {node.kind === "element" && node.priority && (
          <PriorityBadge priority={node.priority} selected={isSelected} />
        )}
      </button>

      {node.children.length > 0 && (
        <ul role="group" className="m-0 list-none p-0">
          {node.children.map((child) => (
            <TreeRow
              key={child.treeId}
              node={child}
              depth={depth + 1}
              selected={selected}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Icons + badges ────────────────────────────────────────────

function NodeIcon({
  kind,
  priority,
  selected
}: {
  kind: TreeNode["kind"];
  priority: TreeNode["priority"];
  selected: boolean;
}) {
  const stroke = selected ? "#0A0A0A" : "#737373";
  const strokeWidth = 2;

  if (kind === "page") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }

  if (kind === "section") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
      </svg>
    );
  }

  // element — glyph by priority
  const glyph =
    priority === "text"
      ? "T"
      : priority === "image"
        ? "🖼"
        : priority === "button"
          ? "◉"
          : priority === "card"
            ? "▤"
            : priority === "container"
              ? "▢"
              : "•";
  return (
    <span
      className="text-[11px] font-extrabold"
      style={{ color: selected ? "#0A0A0A" : "#737373" }}
    >
      {glyph}
    </span>
  );
}

function PriorityBadge({
  priority,
  selected
}: {
  priority: NonNullable<TreeNode["priority"]>;
  selected: boolean;
}) {
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest"
      style={{
        background: selected ? "rgba(0,0,0,0.12)" : "#F5F5F5",
        color: selected ? "#0A0A0A" : "#737373"
      }}
    >
      {priority}
    </span>
  );
}

// ─── Empty state ───────────────────────────────────────────────

function NavigatorEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
        Page tree
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
        Waiting for the live preview to load…
      </p>
    </div>
  );
}

// ─── Counting helper ───────────────────────────────────────────

function countKinds(root: TreeNode): { section: number; element: number } {
  let section = 0;
  let element = 0;
  walk(root, (n) => {
    if (n.kind === "section") section++;
    else if (n.kind === "element") element++;
  });
  return { section, element };
}

function walk(n: TreeNode, cb: (n: TreeNode) => void): void {
  cb(n);
  for (const c of n.children) walk(c, cb);
}
