// Platform Command Palette — ⌘K workspace primitive.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The palette is a shell surface open across every
//    route in the workspace. If each App shipped its own palette,
//    muscle memory would fragment (⌘K would do different things per
//    page). Only one palette. Composes discovered commands.
//
// 2. Which future Apps benefit?  Every App that declares `commands`
//    on its manifest. Marketplace, Orders, Projects, Fleet, Insurance,
//    Finance, Recruitment, Training — every command appears here.
//
// 3. Which doc authorises?  ADR-047 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Command Palette (⌘K)" + TRADE_CENTER_PLATFORM_
//    ARCHITECTURE.md §3.4.
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Zero App logic. Reads from platform command discovery. Renders
// through existing UI Kit primitives (Popover, EmptyState, Button).
// ⌘K globally listened via useEffect. Escape closes. Arrow keys
// navigate. Enter dispatches.
//
// This is the Week 1 skeleton — it renders the discovered commands
// grouped, dispatches on select via each command's `handler` module
// path. Recent-command tracking + AI-search integration land in
// Week 2.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Keyboard, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import type { CommandDeclaration } from "@/platform/manifest/types";
import {
  discoverCommandsGrouped,
  discoverCommands
} from "@/platform/commands/discovery";
import type { DiscoveredCommand } from "@/platform/commands/discovery";

const GROUP_LABEL: Record<CommandDeclaration["group"], string> = {
  actions: "Actions",
  products: "Products",
  merchants: "Merchants",
  categories: "Categories",
  recent: "Recent"
};

export type CommandPaletteProps = {
  /** Optional dispatcher — called when a command is selected. Palette
   *  passes the full discovered command so callers can look up the
   *  handler + invoke. When omitted, palette logs to console (dev). */
  onDispatch?: (cmd: DiscoveredCommand) => void;
  /** Called when the user hits the "Ask AI" row — seeds the copilot
   *  with the current query. */
  onAskAI?: (query: string) => void;
};

export function CommandPalette({ onDispatch, onAskAI }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global ⌘K listener. Only wires when the component is mounted so
  // pages that don't want the palette (marketing routes) can opt out
  // by not rendering it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allCommands = useMemo(() => discoverCommands(), [open]);
  const grouped = useMemo(() => discoverCommandsGrouped(), [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { grouped, flat: allCommands };
    const flat = allCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.appName.toLowerCase().includes(q)
    );
    const g: Record<CommandDeclaration["group"], DiscoveredCommand[]> = {
      actions: [],
      products: [],
      merchants: [],
      categories: [],
      recent: []
    };
    for (const c of flat) g[c.group].push(c);
    return { grouped: g, flat };
  }, [query, allCommands, grouped]);

  // Navigation keys within the palette
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered.flat[selectedIndex];
        if (cmd) dispatch(cmd);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selectedIndex]);

  useEffect(() => {
    // Reset selection when the filter changes
    setSelectedIndex(0);
  }, [query]);

  function dispatch(cmd: DiscoveredCommand) {
    if (onDispatch) {
      onDispatch(cmd);
    } else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[command-palette]", cmd.id, "from", cmd.appSlug);
    }
    setOpen(false);
    setQuery("");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <Search size={16} className="text-neutral-400"/>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or run a command…"
            className="flex-1 border-none bg-transparent p-0 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100"
            aria-label="Close"
          >
            <X size={12}/>
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {(Object.keys(GROUP_LABEL) as CommandDeclaration["group"][]).map(
            (groupKey) => {
              const rows = filtered.grouped[groupKey];
              if (rows.length === 0) return null;
              return (
                <div key={groupKey} className="py-1">
                  <div className="px-4 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                    {GROUP_LABEL[groupKey]}
                  </div>
                  <ul>
                    {rows.map((cmd) => {
                      const globalIndex = filtered.flat.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;
                      return (
                        <li key={cmd.id}>
                          <button
                            onClick={() => dispatch(cmd)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition"
                            style={{
                              backgroundColor: isSelected ? "#FEF3C7" : "transparent"
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-bold text-neutral-900">
                                {cmd.label}
                              </div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                {cmd.appName}
                              </div>
                            </div>
                            {cmd.shortcut && (
                              <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono text-neutral-600">
                                {cmd.shortcut}
                              </kbd>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            }
          )}

          {/* Ask AI — always last, always visible when the user has
              typed something. Fires the copilot with the raw query. */}
          {onAskAI && query.trim() && (
            <div className="border-t py-1" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              <div className="px-4 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                Ask AI
              </div>
              <button
                onClick={() => {
                  onAskAI(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-black">
                    Ask AI: "{query.trim().slice(0, 60)}
                    {query.trim().length > 60 ? "…" : ""}"
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: "rgba(255,179,0,0.7)" }}>
                    Copilot — every registered App's tools available
                  </div>
                </div>
                <kbd className="rounded px-1.5 py-0.5 text-[10px] font-mono" style={{ backgroundColor: "rgba(255,179,0,0.15)" }}>
                  ↵
                </kbd>
              </button>
            </div>
          )}

          {filtered.flat.length === 0 && !onAskAI && (
            <div className="px-4 py-8 text-center text-[12px] text-neutral-500">
              No commands match "{query}"
            </div>
          )}
        </div>

        {/* Footer key hints */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <span className="flex items-center gap-1">
            <ArrowUp size={10}/>
            <ArrowDown size={10}/>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={10}/>
            select
          </span>
          <span className="flex items-center gap-1">
            <Keyboard size={10}/>
            esc close
          </span>
        </div>
      </div>
    </div>
  );
}
