"use client";

// StaircaseConfiguratorChat — inline chat input for the 3D preview footer area.
// User types a natural-language change ("make the balusters cream", "add LED
// lights", "make it walnut"), submit calls POST /api/nex/staircase-configure
// which returns config changes + a friendly reply. Parent applies the changes
// to the 3D preview state; this component shows Nex's reply as an ephemeral
// banner above the input.
//
// Positioned at the bottom of the 3D canvas (replaces the "DRAG to orbit …"
// hint that only serves power users). Full-width on all breakpoints.

import { useState, type FormEvent } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import type { ComponentCategory } from "./StaircaseConfiguratorDrawer";

type ConfigChange = { categoryId: string; optionId: string };
type ApiResponse =
  | { ok: true; reply: string; configChanges: ConfigChange[]; source?: string }
  | { ok: false; error: string; fallbackReply?: string };

export function StaircaseConfiguratorChat({
  categories,
  currentConfig,
  onApplyChanges,
  placeholder = "Ask Nex to change something (e.g. \"make the balusters cream\")",
}: {
  categories: ComponentCategory[];
  currentConfig: Record<string, string>;
  onApplyChanges: (changes: ConfigChange[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = value.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch("/api/nex/staircase-configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: message,
          currentConfig,
          categories: categories.map((c) => ({
            id: c.id,
            label: c.label,
            options: c.options.map((o) => ({
              id: o.id,
              label: o.label,
              description: o.description,
            })),
          })),
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) {
        setError(data.fallbackReply ?? "Sorry, I couldn't process that. Try being more specific.");
      } else {
        if (data.configChanges.length > 0) onApplyChanges(data.configChanges);
        setReply(data.reply);
        setValue("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {(reply || error) && (
        <div
          role="status"
          className={[
            "mb-2 flex items-start gap-2 px-3 py-2 rounded-md text-body-sm",
            error
              ? "bg-destructive/10 text-destructive"
              : "bg-accent/15 text-foreground",
          ].join(" ")}
        >
          {!error && <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-accent-foreground" />}
          <span className="flex-1">{error ?? reply}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setReply(null);
              setError(null);
            }}
            className="text-muted-foreground hover:text-foreground text-body-sm shrink-0 leading-none"
          >
            ×
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-card border border-border rounded-full pl-2 pr-1 py-1 shadow-sm focus-within:border-primary transition-colors"
      >
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-body-sm font-heading font-semibold shrink-0"
          title="Nex"
        >
          N
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          placeholder={placeholder}
          aria-label="Message Nex about the staircase"
          className="flex-1 bg-transparent border-0 outline-none text-body-sm text-foreground placeholder:text-muted-foreground min-w-0"
        />
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          aria-label={busy ? "Sending" : "Send message"}
          className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
