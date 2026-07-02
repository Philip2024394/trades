"use client";

// PageChromeClient — in-iframe edit overlay.
//
// Selection model (Module 1.2):
//   • First click on any [data-tree-id] element selects THAT element —
//     the innermost tree-id at the click point. No auto-promotion to
//     section root.
//   • Re-clicking the SAME tree-id promotes selection to its parent
//     tree-id, walking element → section → page. A promotion past the
//     page root deselects entirely.
//   • Clicking outside any tree-id deselects.
//   • Escape key deselects.
//
// Visual states:
//   • Element selected  → thin solid rim, no arrow chips (Module 2
//                          toolbar owns element actions).
//   • Section selected  → chunky solid rim + soft glow + 4 arrow chips
//                          + remove badge.
//   • data-tree-priority drives cursor: text → text cursor, image →
//                          crosshair, button → pointer.
//
// All chrome is transient — leaving edit mode removes it; no state
// persists between mount cycles.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SerializedRect } from "@/lib/studio/treeTypes";
import { treeIdSelector } from "@/lib/studio/treeIds";
import { iframeEmit } from "@/lib/studio/bus";
import { StudioToolbar } from "./StudioToolbar";

type ChromePriority = "text" | "image" | "button" | "card" | "container";

const YELLOW = "#FFB300";
const YELLOW_SOFT = "rgba(255,179,0,0.16)";
const YELLOW_HOVER = "rgba(255,179,0,0.45)";
const RED = "#DC2626";

const CHROME_STYLE_ID = "studio-chrome-style";

type Props = {
  selected: string | null;
  onSelect: (treeId: string | null) => void;
  onMove: (instanceId: string, direction: "up" | "down" | "left" | "right") => void;
  onRemove: (instanceId: string) => void;
};

export function PageChromeClient({ selected, onSelect, onMove, onRemove }: Props) {
  const [rect, setRect] = useState<SerializedRect | null>(null);
  const [selectedKind, setSelectedKind] = useState<"section" | "element" | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<ChromePriority | null>(null);
  const [instanceIdOfSelected, setInstanceIdOfSelected] = useState<string | null>(null);

  // Ref mirror of `selected` so the persistent click listener (which
  // subscribes once, not per-render) can read the current selection at
  // event time.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Inline text edit — { treeId, original } while in edit mode, null
  // otherwise. Original text lets Escape restore the pre-edit state.
  const editingRef = useRef<{ treeId: string; original: string } | null>(null);

  // ─── Inject global chrome CSS once per mount ────────────────
  useEffect(() => {
    if (document.getElementById(CHROME_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = CHROME_STYLE_ID;
    style.textContent = `
      /* ── Section rim + name chip ─────────────────────────── */
      [data-tree-kind="section"] {
        position: relative !important;
        outline: 2px dashed ${YELLOW};
        outline-offset: -2px;
        transition: outline-color 120ms ease;
        cursor: pointer;
      }
      [data-tree-kind="section"][data-studio-selected="true"] {
        outline: 3px solid ${YELLOW};
        outline-offset: -3px;
        box-shadow: 0 0 0 4px ${YELLOW_SOFT};
      }
      [data-tree-kind="section"]::before {
        content: attr(data-tree-name);
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 40;
        background: ${YELLOW};
        color: #0A0A0A;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        line-height: 1;
        pointer-events: none;
        white-space: nowrap;
        max-width: calc(100% - 16px);
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }

      /* ── Element rim (selected only — no idle rim, less noise) ─── */
      [data-tree-kind="element"] {
        transition: outline 100ms ease;
      }
      [data-tree-kind="element"][data-studio-selected="true"] {
        outline: 2px solid ${YELLOW};
        outline-offset: 2px;
        box-shadow: 0 0 0 3px ${YELLOW_SOFT};
        border-radius: 4px;
      }

      /* ── Priority-specific cursors so the merchant feels the tool
             they're about to use before they click. ───────────────── */
      [data-tree-priority="text"] { cursor: text; }
      [data-tree-priority="image"] { cursor: crosshair; }
      [data-tree-priority="button"] { cursor: pointer; }
      [data-tree-priority="card"],
      [data-tree-priority="container"] { cursor: pointer; }

      /* ── Hover ring — soft yellow outline on any addressable node
             the cursor is over. Suppressed on the page root (too big
             to be useful) and already-selected elements (their own rim
             wins). Purely CSS: driven by :hover, zero JS render cost.
             Emit hover bus messages separately (see the JS below). ── */
      [data-tree-id]:hover:not([data-tree-kind="page"]):not([data-studio-selected]):not([data-studio-editing]) {
        outline: 1.5px solid ${YELLOW_HOVER};
        outline-offset: 2px;
      }

      /* ── Inline text edit — a text element being edited swaps its
             rim for a solid ring + a soft yellow tint so the merchant
             sees clearly "I'm typing right now." ─────────────────── */
      [data-studio-editing="true"] {
        outline: 2px solid ${YELLOW} !important;
        outline-offset: 3px;
        background: rgba(255, 179, 0, 0.06);
        border-radius: 4px;
        caret-color: ${YELLOW};
      }

      /* ── Nav suppression: block clicks on anchors/buttons WITHOUT
             their own tree-id (real nav-links). Elements WITH tree-id
             stay clickable so priority routing can select them. ───── */
      [data-tree-id] a:not([data-tree-id]),
      [data-tree-id] button:not([data-studio-chrome]):not([data-tree-id]) {
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(CHROME_STYLE_ID);
      if (el) el.remove();
    };
  }, []);

  // ─── Global click handler: priority-routed selection ───────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      // Chrome's own arrow / remove chips handle their own clicks.
      if (target.closest("[data-studio-chrome]")) return;

      const treeEl = target.closest<HTMLElement>("[data-tree-id]");
      if (!treeEl) {
        // Click outside every addressable element — deselect.
        if (selectedRef.current !== null) onSelect(null);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const treeId = treeEl.getAttribute("data-tree-id");
      if (!treeId) return;

      if (treeId === selectedRef.current) {
        // Same tree-id re-clicked → promote to the nearest ancestor
        // tree-id, walking element → section → page. Past the page,
        // deselect entirely.
        const parent = treeEl.parentElement?.closest<HTMLElement>("[data-tree-id]");
        onSelect(parent?.getAttribute("data-tree-id") ?? null);
        return;
      }
      onSelect(treeId);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [onSelect]);

  // ─── Inline text edit ────────────────────────────────────────
  //
  //   • Enter on a selected `text` priority → element becomes
  //     contentEditable, cursor lands at end, `data-studio-editing`
  //     attribute lights up the yellow rim.
  //   • Enter (no Shift) during edit → commit via text-edit bus.
  //   • Escape during edit → restore original text, exit edit.
  //   • Blur while editing → commit (so click-away saves).
  const enterEditMode = useCallback((treeId: string) => {
    const el = document.querySelector<HTMLElement>(treeIdSelector(treeId));
    if (!el) return;
    const original = el.innerText;
    editingRef.current = { treeId, original };
    el.setAttribute("contenteditable", "true");
    el.setAttribute("data-studio-editing", "true");
    el.focus();
    // Place cursor at end of current text.
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  const commitEdit = useCallback(() => {
    const state = editingRef.current;
    if (!state) return;
    const el = document.querySelector<HTMLElement>(treeIdSelector(state.treeId));
    if (!el) {
      editingRef.current = null;
      return;
    }
    const value = el.innerText;
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-studio-editing");
    editingRef.current = null;
    if (value === state.original) return;
    const instanceId = instanceIdFromTreeId(state.treeId);
    const elementKey = elementKeyFromTreeId(state.treeId);
    if (instanceId && elementKey) {
      iframeEmit.textEdit(instanceId, elementKey, value);
    }
  }, []);

  const cancelEdit = useCallback(() => {
    const state = editingRef.current;
    if (!state) return;
    const el = document.querySelector<HTMLElement>(treeIdSelector(state.treeId));
    if (el) {
      el.innerText = state.original;
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-studio-editing");
    }
    editingRef.current = null;
  }, []);

  // Blur listener commits when merchant clicks away from the editing
  // element. Focus capture so we catch blur before the click handler
  // tries to select a new element.
  useEffect(() => {
    function onBlur(e: FocusEvent) {
      if (!editingRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.getAttribute("data-studio-editing") === "true") {
        commitEdit();
      }
    }
    document.addEventListener("blur", onBlur, true);
    return () => document.removeEventListener("blur", onBlur, true);
  }, [commitEdit]);

  // ─── Keyboard navigation ─────────────────────────────────────
  //
  //   Escape          → cancel edit / deselect entirely
  //   Tab / Shift+Tab → DFS forward / backward across every tree node
  //   ↓  / ↑          → next / prev sibling (wraps within depth)
  //   →  / ←          → drill into first child / promote to parent
  //   Enter           → enter edit mode (text) / request toolbar (else)
  //
  // Skip when focus is on a text input, textarea — those own their own
  // key semantics. Skip on modifier chords (Cmd/Ctrl/Alt) so browser
  // + dev-tools + Module 3 undo shortcuts stay reachable — EXCEPT
  // during inline edit, where Enter / Escape override modifier logic.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Inline-edit takes precedence — during edit, only Enter (commit)
      // and Escape (cancel) are our concern; typing keys fall through
      // to the browser's contentEditable handling.
      if (editingRef.current) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commitEdit();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
          return;
        }
        return;
      }

      if (isTypingContext(document.activeElement)) return;

      // Undo / Redo — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y. Consumed
      // BEFORE the modifier-passthrough gate so the bus fires even
      // when the user's editing focus is inside the iframe.
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (isMod && !e.altKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) iframeEmit.redo();
          else iframeEmit.undo();
          return;
        }
        if (key === "y" && !e.shiftKey) {
          // Windows redo convention.
          e.preventDefault();
          iframeEmit.redo();
          return;
        }
      }

      // Skip any other modifier chord — browser, dev-tools, future
      // Module 13 command-palette shortcuts stay reachable.
      if (isMod || e.altKey) return;

      const current = selectedRef.current;

      switch (e.key) {
        case "Escape":
          if (current !== null) onSelect(null);
          return;

        case "Tab":
          e.preventDefault();
          onSelect(dfsMove(current, e.shiftKey ? "backward" : "forward"));
          return;

        case "ArrowDown":
          e.preventDefault();
          onSelect(siblingMove(current, "next"));
          return;

        case "ArrowUp":
          e.preventDefault();
          onSelect(siblingMove(current, "prev"));
          return;

        case "ArrowLeft":
          e.preventDefault();
          onSelect(parentMove(current));
          return;

        case "ArrowRight":
          e.preventDefault();
          onSelect(firstChildMove(current) ?? current);
          return;

        case "Enter":
          if (!current) return;
          e.preventDefault();
          // Text OR button priority elements with Enter → inline edit
          // the visible label. Button inline-edit is Module 8's extension
          // of Module 6's text pipeline — same commit path via textEdit.
          const el = document.querySelector<HTMLElement>(treeIdSelector(current));
          const p = el?.getAttribute("data-tree-priority");
          if (p === "text" || p === "button") {
            enterEditMode(current);
          } else {
            iframeEmit.requestToolbar(current, "keyboard");
          }
          return;

        default:
          return;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSelect]);

  // ─── Hover bus: emit `hover` events when the hovered tree-id
  //     changes. Visual state is CSS-driven (see :hover rule above);
  //     this listener exists ONLY to feed downstream consumers like
  //     Module 5's Live Component Intelligence panel. Deduped so we
  //     don't fire every mousemove — only on cross-boundary. ─────────
  useEffect(() => {
    let lastEmitted: string | null = null;

    function normalize(el: Element | null): string | null {
      if (!el) return null;
      const kind = el.getAttribute("data-tree-kind");
      if (kind === "page") return null; // page-root hover reads as "no target"
      return el.getAttribute("data-tree-id");
    }

    function onMove(e: MouseEvent) {
      const target = e.target as Element | null;
      const treeEl = target?.closest<HTMLElement>("[data-tree-id]") ?? null;
      const treeId = normalize(treeEl);
      if (treeId === lastEmitted) return;
      lastEmitted = treeId;
      iframeEmit.hover(treeId);
    }

    function onLeave() {
      if (lastEmitted === null) return;
      lastEmitted = null;
      iframeEmit.hover(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  // ─── Sync data-studio-selected + rect + kind on selection change ─
  const recomputeRect = useCallback((el: Element | null) => {
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right
    });
  }, []);

  useEffect(() => {
    // Clear any stale marker first.
    document.querySelectorAll("[data-studio-selected]").forEach((el) => {
      el.removeAttribute("data-studio-selected");
    });

    if (!selected) {
      setSelectedKind(null);
      setSelectedPriority(null);
      setInstanceIdOfSelected(null);
      setRect(null);
      return;
    }

    const el = document.querySelector<HTMLElement>(treeIdSelector(selected));
    if (!el) {
      setSelectedKind(null);
      setSelectedPriority(null);
      setInstanceIdOfSelected(null);
      setRect(null);
      return;
    }

    el.setAttribute("data-studio-selected", "true");
    const kind = (el.getAttribute("data-tree-kind") as "section" | "element" | null) ?? null;
    const priorityAttr = el.getAttribute("data-tree-priority");
    const priority: ChromePriority | null =
      priorityAttr === "text" ||
      priorityAttr === "image" ||
      priorityAttr === "button" ||
      priorityAttr === "card" ||
      priorityAttr === "container"
        ? priorityAttr
        : null;
    setSelectedKind(kind);
    setSelectedPriority(priority);
    setInstanceIdOfSelected(instanceIdFromTreeId(selected));
    recomputeRect(el);

    // Reposition chips + rim tracking on scroll / resize / DOM changes.
    const update = () => recomputeRect(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [selected, recomputeRect]);

  // ─── Chrome layers ─────────────────────────────────────────────
  // Nothing selected → nothing to render. Toolbar + arrow chips share
  // the same rect state, so guards are unified here.
  if (!selected || !rect || !selectedKind) return null;

  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;
  const isSection = selectedKind === "section";
  const canShowToolbar =
    isSection || (selectedKind === "element" && selectedPriority !== null);

  return (
    <>
      {/* Contextual toolbar — floats above (or below) the selected
          element. Priority-driven tool set. */}
      {canShowToolbar && (
        <StudioToolbar
          treeId={selected}
          kind={isSection ? "section" : "element"}
          priority={selectedPriority}
          rect={rect}
          onTool={(tool) => {
            // Text tool on text or button priority → enter inline edit
            // right here, no bus round-trip.
            if (
              tool === "edit" &&
              (selectedPriority === "text" || selectedPriority === "button")
            ) {
              enterEditMode(selected);
              return true;
            }
            return false;
          }}
        />
      )}

      {/* Section-only: arrow chips + remove for direct
          move-me / remove-me actions. Element move/remove is a
          Module 15 constraint concern. */}
      {isSection && instanceIdOfSelected && (
        <>
          <Chip
            aria-label="Move up"
            style={{ top: rect.top - 20, left: midX - 20 }}
            onClick={() => onMove(instanceIdOfSelected, "up")}
          >
            ▲
          </Chip>
          <Chip
            aria-label="Move down"
            style={{ top: rect.bottom, left: midX - 20 }}
            onClick={() => onMove(instanceIdOfSelected, "down")}
          >
            ▼
          </Chip>
          <Chip
            aria-label="Move left"
            style={{ top: midY - 20, left: rect.left - 20 }}
            onClick={() => onMove(instanceIdOfSelected, "left")}
          >
            ◀
          </Chip>
          <Chip
            aria-label="Move right"
            style={{ top: midY - 20, left: rect.right }}
            onClick={() => onMove(instanceIdOfSelected, "right")}
          >
            ▶
          </Chip>
          <Chip
            aria-label="Remove"
            style={{
              top: rect.top - 20,
              left: rect.right - 20,
              background: RED,
              color: "#FFFFFF"
            }}
            onClick={() => onRemove(instanceIdOfSelected)}
          >
            ✕
          </Chip>
        </>
      )}
    </>
  );
}

function Chip({
  children,
  style,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      data-studio-chrome="true"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-extrabold shadow-lg transition hover:brightness-95"
      style={{
        position: "fixed",
        background: YELLOW,
        color: "#0A0A0A",
        zIndex: 100,
        cursor: "pointer",
        border: "2px solid #0A0A0A",
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Tree-ids for sections are shaped `sec:<instanceId>`. Extract the
 *  instanceId so the parent editor knows which layout entry to mutate. */
function instanceIdFromTreeId(treeId: string): string | null {
  if (!treeId.startsWith("sec:")) return null;
  const rest = treeId.slice(4);
  const dot = rest.indexOf(".");
  return dot === -1 ? rest : rest.slice(0, dot);
}

/** Element tree-ids: `sec:<instanceId>.<elementKey>` — extract the
 *  elementKey portion. Returns null for section-root ids. */
function elementKeyFromTreeId(treeId: string): string | null {
  if (!treeId.startsWith("sec:")) return null;
  const rest = treeId.slice(4);
  const dot = rest.indexOf(".");
  if (dot === -1) return null;
  return rest.slice(dot + 1);
}

// ─── Tree navigation helpers ───────────────────────────────────
// DOM-driven — no snapshot required, so keyboard nav works even before
// the first tree snapshot has been captured. All helpers return null
// (or fall back to the first tree node) when the current selection has
// no valid neighbour in that direction.

function isTypingContext(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function allTreeElements(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const root =
    document.querySelector<HTMLElement>('[data-tree-id="page"]') ??
    document.body;
  // querySelectorAll returns nodes in document order → DFS order.
  return Array.from(root.querySelectorAll<HTMLElement>("[data-tree-id]"));
}

function findEl(treeId: string | null): HTMLElement | null {
  if (!treeId || typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(
    `[data-tree-id="${treeId.replace(/"/g, '\\"')}"]`
  );
}

/** Direct tree-children of a container — the tree-id descendants whose
 *  closest tree-id ancestor is `parent`. Skips deeper nesting so we
 *  navigate one level at a time. */
function directTreeChildren(parent: Element): HTMLElement[] {
  return Array.from(
    parent.querySelectorAll<HTMLElement>("[data-tree-id]")
  ).filter((el) => el.parentElement?.closest("[data-tree-id]") === parent);
}

function dfsMove(current: string | null, dir: "forward" | "backward"): string | null {
  const all = allTreeElements();
  if (all.length === 0) return null;
  const el = findEl(current);
  if (!el) return all[0].getAttribute("data-tree-id");
  const idx = all.indexOf(el);
  if (idx === -1) return all[0].getAttribute("data-tree-id");
  const nextIdx =
    dir === "forward"
      ? (idx + 1) % all.length
      : (idx - 1 + all.length) % all.length;
  return all[nextIdx].getAttribute("data-tree-id");
}

function siblingMove(current: string | null, dir: "next" | "prev"): string | null {
  if (!current) return dfsMove(null, "forward");
  const el = findEl(current);
  if (!el) return null;
  const parent =
    el.parentElement?.closest<HTMLElement>("[data-tree-id]") ??
    document.querySelector<HTMLElement>('[data-tree-id="page"]');
  if (!parent) return null;
  const siblings = directTreeChildren(parent);
  const idx = siblings.indexOf(el);
  if (idx === -1) return null;
  const nextIdx =
    dir === "next"
      ? (idx + 1) % siblings.length
      : (idx - 1 + siblings.length) % siblings.length;
  return siblings[nextIdx]?.getAttribute("data-tree-id") ?? null;
}

function parentMove(current: string | null): string | null {
  if (!current) return null;
  const el = findEl(current);
  const parent = el?.parentElement?.closest<HTMLElement>("[data-tree-id]");
  return parent?.getAttribute("data-tree-id") ?? null;
}

function firstChildMove(current: string | null): string | null {
  if (!current) return dfsMove(null, "forward");
  const el = findEl(current);
  if (!el) return null;
  const children = directTreeChildren(el);
  return children[0]?.getAttribute("data-tree-id") ?? null;
}
