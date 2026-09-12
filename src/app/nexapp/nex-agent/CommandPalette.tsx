"use client";

// src/app/nexapp/nex-agent/CommandPalette.tsx
//
// ⌘K command palette overlay · fuzzy search across BASE_COMMANDS + tasks +
// preview URLs + phone models. Renders center-screen · keyboard-only nav.

import { useEffect, useMemo, useRef, useState } from "react";
import { BASE_COMMANDS, searchCommands, type Command, type CommandContext } from "@/lib/nex-agent/command-registry";
import { PHONE_MODELS } from "@/lib/nex-agent/phone-models";

interface PaletteTask { readonly task_id: string; readonly prompt: string; readonly status: string; }

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly ctx: CommandContext;
  readonly tasks: readonly PaletteTask[];
}

export function CommandPalette({ open, onClose, ctx, tasks }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Assemble command list · base commands + dynamic tasks + phone models
  const items: readonly Command[] = useMemo(() => {
    const dynamicTasks: Command[] = tasks.slice(0, 20).map((t) => ({
      id: `task:${t.task_id}`,
      label: `Task · ${t.prompt.slice(0, 60)}${t.prompt.length > 60 ? "…" : ""}`,
      description: `#${t.task_id.slice(0, 8)} · status ${t.status}`,
      keywords: [t.task_id.slice(0, 8), t.status, "task", "history"],
      section: "navigation",
      run: (c) => c.openTaskById(t.task_id),
    }));
    const dynamicPhones: Command[] = PHONE_MODELS.map((m) => ({
      id: `phone:${m.id}`,
      label: `Phone · ${m.brand} ${m.name}`,
      description: `${m.width}×${m.height}`,
      keywords: [m.brand.toLowerCase(), m.name.toLowerCase(), "phone", "mobile", "model"],
      section: "phone",
      run: (c) => c.setPhoneModelId(m.id),
    }));
    return [...BASE_COMMANDS, ...dynamicTasks, ...dynamicPhones];
  }, [tasks]);

  const results = useMemo(() => searchCommands(query, items), [query, items]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Delay focus so React commits first
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); e.preventDefault(); return; }
      if (e.key === "ArrowDown") {
        setSelected((s) => Math.min(results.length - 1, s + 1));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setSelected((s) => Math.max(0, s - 1));
        e.preventDefault();
      } else if (e.key === "Enter") {
        const cmd = results[selected];
        if (cmd) { cmd.run(ctx); onClose(); }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selected, ctx, onClose]);

  useEffect(() => {
    // Keep selected item scrolled into view
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 92vw)",
          background: "rgba(11, 18, 32, 0.98)",
          border: "1px solid rgba(34, 211, 238, 0.35)",
          borderRadius: 14,
          boxShadow: "0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(34, 211, 238, 0.08) inset",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
        role="dialog"
        aria-label="Command palette"
      >
        <div style={{ padding: 14, borderBottom: "1px solid rgba(148, 163, 184, 0.14)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--naw-cyan, #22D3EE)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 }}>⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command · task · phone model · viewport…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#F9FAFB",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 15,
            }}
          />
          <kbd style={{
            fontSize: 10, color: "#94A3B8",
            border: "1px solid rgba(148,163,184,0.28)", borderRadius: 4,
            padding: "1px 6px", fontFamily: "'JetBrains Mono', monospace",
          }}>ESC</kbd>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", flex: 1, padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
              No commands match “{query}”.
            </div>
          )}
          {results.slice(0, 60).map((cmd, i) => {
            const active = i === selected;
            return (
              <button
                key={cmd.id}
                type="button"
                data-cmd-idx={i}
                onClick={() => { cmd.run(ctx); onClose(); }}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", textAlign: "left",
                  padding: "8px 12px", margin: "2px 0",
                  background: active ? "rgba(34, 211, 238, 0.12)" : "transparent",
                  border: active ? "1px solid rgba(34, 211, 238, 0.42)" : "1px solid transparent",
                  borderRadius: 8,
                  color: "#F9FAFB",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span style={{
                  minWidth: 62,
                  fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: sectionColor(cmd.section), fontWeight: 700,
                }}>{cmd.section}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#F9FAFB", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cmd.label}</div>
                  {cmd.description && (
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cmd.description}</div>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd style={{
                    fontSize: 10, color: "#94A3B8",
                    border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: 4,
                    padding: "1px 6px", fontFamily: "'JetBrains Mono', monospace",
                  }}>{cmd.shortcut}</kbd>
                )}
              </button>
            );
          })}
        </div>

        <div style={{
          padding: "8px 14px", borderTop: "1px solid rgba(148, 163, 184, 0.14)",
          display: "flex", gap: 12, alignItems: "center", fontSize: 10, color: "#94A3B8",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
          <span style={{ marginLeft: "auto" }}>{results.length} of {items.length}</span>
        </div>
      </div>
    </div>
  );
}

function sectionColor(s: Command["section"]): string {
  switch (s) {
    case "actions":    return "#22D3EE";
    case "navigation": return "#F59E0B";
    case "preview":    return "#A855F7";
    case "phone":      return "#F97316";
    case "founder":    return "#EAB308";
    case "system":     return "#94A3B8";
  }
}
