"use client";

// StudioCommandPalette — the Cmd+K overlay.
//
// Centred card with search input + scrollable command list. Substring
// fuzzy match across title + description + keywords. ↑ / ↓ moves the
// highlight; Enter runs; Escape closes.
//
// Disabled commands (requires-selection when nothing selected) are
// dimmed and skipped by ↑ / ↓ navigation.

import { useEffect, useMemo, useRef, useState } from "react";
import { shortcutLabel, type Command, type CommandCategory } from "@/lib/studio/commandTypes";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

const CATEGORY_LABEL: Record<CommandCategory, string> = {
  action: "Actions",
  navigate: "Navigate",
  device: "Device",
  system: "System"
};

type Props = {
  commands: Command[];
  onClose: () => void;
};

export function StudioCommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Auto-focus the search input; palette open should feel like Cmd+K
  // in VS Code / Linear.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = [
        c.title,
        c.description ?? "",
        ...(c.keywords ?? []),
        c.id
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [commands, query]);

  // Reset cursor whenever the filter list changes so the highlight
  // stays on an existing row.
  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Scroll the highlighted row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-idx="${cursor}"]`
    );
    if (el && "scrollIntoView" in el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [cursor]);

  function moveCursor(delta: number) {
    if (filtered.length === 0) return;
    // Skip disabled rows in the direction of travel.
    let next = cursor;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next].disabled) {
        setCursor(next);
        return;
      }
    }
  }

  function runCursor() {
    const cmd = filtered[cursor];
    if (!cmd || cmd.disabled) return;
    cmd.run();
    onClose();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCursor(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCursor(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runCursor();
      return;
    }
  }

  // Group filtered commands by category.
  const grouped: Partial<Record<CommandCategory, Command[]>> = {};
  for (const cmd of filtered) {
    (grouped[cmd.category] ??= []).push(cmd);
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 p-3">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center text-[15px] font-extrabold text-neutral-400"
          >
            ⌘
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search for an action…"
            aria-label="Command search"
            className="h-10 flex-1 border-0 bg-transparent px-2 text-[14px] font-medium text-neutral-900 focus:outline-none"
          />
          <span
            aria-hidden="true"
            className="shrink-0 rounded-md border border-neutral-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
          >
            Esc
          </span>
        </div>

        <ul
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13px] text-neutral-500">
              No commands match &ldquo;{query}&rdquo;.
            </li>
          ) : (
            (["action", "navigate", "device", "system"] as CommandCategory[]).map(
              (cat) => {
                const rows = grouped[cat];
                if (!rows || rows.length === 0) return null;
                return (
                  <li key={cat} className="mb-2 last:mb-0">
                    <p className="px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                      {CATEGORY_LABEL[cat]}
                    </p>
                    {rows.map((cmd) => {
                      const idx = filtered.indexOf(cmd);
                      const active = idx === cursor;
                      const disabled = cmd.disabled;
                      return (
                        <button
                          key={cmd.id}
                          data-cmd-idx={idx}
                          type="button"
                          onMouseEnter={() => !disabled && setCursor(idx)}
                          onClick={() => {
                            if (disabled) return;
                            cmd.run();
                            onClose();
                          }}
                          disabled={disabled}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition disabled:cursor-not-allowed"
                          style={{
                            background: active && !disabled ? YELLOW : "transparent",
                            color: disabled ? "#A3A3A3" : active ? BLACK : "#0A0A0A"
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="grid h-6 w-6 shrink-0 place-items-center text-[13px]"
                          >
                            {cmd.icon ?? "•"}
                          </span>
                          <span className="flex-1">
                            <span
                              className="block truncate text-[13px] font-extrabold"
                            >
                              {cmd.title}
                            </span>
                            {cmd.description && (
                              <span
                                className="block truncate text-[11px]"
                                style={{ color: active && !disabled ? "#404040" : "#737373" }}
                              >
                                {cmd.description}
                              </span>
                            )}
                          </span>
                          {cmd.shortcut && (
                            <span
                              className="shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-widest"
                              style={{
                                borderColor: active && !disabled ? BLACK : "#E5E5E5",
                                color: active && !disabled ? BLACK : "#737373"
                              }}
                            >
                              {shortcutLabel(cmd.shortcut)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </li>
                );
              }
            )
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          <span>↑ ↓ navigate · ⏎ run</span>
          <span>{filtered.length} of {commands.length} shown</span>
        </div>
      </div>
    </div>
  );
}
