"use client";

// Cream-themed batch submission form for NEX HQ Image Intake.
// POSTs to /api/nex-intake/batch. Up to 200 URLs per batch. Isolated failure.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface BatchResult {
  ok: boolean;
  batchId?: string;
  received?: number;
  processed?: number;
  failed?: number;
  duplicate?: number;
  bandCounts?: Record<string, number>;
  durationMs?: number;
  perItem?: Array<{
    ok: boolean;
    itemIndex: number;
    duplicateOfExisting?: boolean;
    extraction?: {
      concept?: string;
      category?: string | null;
      classification_band?: string;
    };
    knowledgeInboxId?: string;
    error?: string;
  }>;
  error?: string;
}

const MAX_ITEMS = 200;

export function ImageIntakeFormCream() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [rightsDeclared, setRightsDeclared] = useState(false);
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<BatchResult | null>(null);

  const items = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes("|") ? "|" : line.includes("\t") ? "\t" : null;
      if (sep) {
        const [url, ...rest] = line.split(sep);
        return { imageUrl: url!.trim(), description: rest.join(sep).trim() };
      }
      return { imageUrl: line, description: undefined };
    })
    .filter((it) => /^https?:\/\//.test(it.imageUrl));

  const canSubmit = items.length > 0 && items.length <= MAX_ITEMS && state !== "submitting";

  async function onSubmit() {
    if (!canSubmit) return;
    setState("submitting");
    setResult(null);
    try {
      const resp = await fetch("/api/nex-intake/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            imageUrl: it.imageUrl,
            description: it.description,
            aiGenerated,
            rightsStatus: rightsDeclared ? "declared_by_user" : "unknown",
          })),
        }),
      });
      const data: BatchResult = await resp.json();
      setResult(data);
      setState(data.ok ? "done" : "error");
      if (data.ok) startTransition(() => router.refresh());
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setState("error");
    }
  }

  return (
    <div>
      <div style={panelStyle}>
        <div style={hintStyle}>
          Paste up to <strong>{MAX_ITEMS}</strong> URLs · one per line. Optionally add
          a description with <code>URL | description</code>. Descriptions strongly
          improve extraction (vision is stubbed today).
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`https://example.com/banana.jpg | This is a ripe yellow banana, a common fruit in Southeast Asia.\nhttps://example.com/staircase.jpg | Traditional oak staircase with glass balustrade\nhttps://example.com/menu.jpg | Menu at Warung Padang Ratu\n...`}
          rows={10}
          disabled={state === "submitting"}
          style={textareaStyle}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", marginTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--nex-neutral-700)" }}>
            Parsed: <strong style={{ color: items.length > MAX_ITEMS ? "#b91c1c" : items.length > 0 ? "#047857" : "var(--nex-neutral-500)" }}>{items.length}</strong> URL{items.length === 1 ? "" : "s"}
            {items.length > MAX_ITEMS && <span style={{ color: "#b91c1c", marginLeft: 8 }}>· exceeds max {MAX_ITEMS}</span>}
          </div>
          <label style={cboxLabel}>
            <input type="checkbox" checked={aiGenerated} onChange={(e) => setAiGenerated(e.target.checked)} disabled={state === "submitting"} />
            Mark as AI-generated
          </label>
          <label style={cboxLabel}>
            <input type="checkbox" checked={rightsDeclared} onChange={(e) => setRightsDeclared(e.target.checked)} disabled={state === "submitting"} />
            Rights declared by me
          </label>
        </div>
        <button onClick={onSubmit} disabled={!canSubmit} style={buttonStyle(!canSubmit)}>
          {state === "submitting" ? `Processing ${items.length}…` : `Process ${items.length} image${items.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {result && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          {result.ok ? (
            <>
              <div style={{ fontSize: 13, color: "var(--nex-neutral-900)", marginBottom: 8 }}>
                <strong style={{ color: "#047857" }}>✓ Batch complete</strong> · {result.processed} processed · {result.failed} failed · {result.duplicate} duplicate ·{" "}
                {result.durationMs && `${(result.durationMs / 1000).toFixed(2)}s`}
              </div>
              {result.bandCounts && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  {Object.entries(result.bandCounts).map(([band, n]) => (
                    <div key={band} style={bandPillStyle(band)}>{band}: <strong>{n}</strong></div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.30)", color: "#b91c1c", fontSize: 12.5 }}>
              Error: {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "16px 18px" };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-700)", lineHeight: 1.55, marginBottom: 12 };
const textareaStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: 200, fontFamily: "monospace", fontSize: 12, background: "var(--nex-neutral-50, var(--nex-neutral-0))", color: "var(--nex-neutral-900)", border: "1px solid var(--nex-neutral-200)", borderRadius: 8, padding: "10px 12px", resize: "vertical" };
const cboxLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--nex-neutral-700)", cursor: "pointer" };
function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 700,
    background: disabled ? "var(--nex-neutral-200)" : "var(--nex-accent-500)",
    color: disabled ? "var(--nex-neutral-500)" : "var(--nex-neutral-0)",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
function bandPillStyle(band: string): React.CSSProperties {
  const map: Record<string, { bg: string; text: string }> = {
    HIGH: { bg: "rgba(16, 185, 129, 0.12)", text: "#047857" },
    MEDIUM: { bg: "rgba(250, 204, 21, 0.15)", text: "#a16207" },
    LOW: { bg: "var(--nex-neutral-100)", text: "var(--nex-neutral-500)" },
    DUPLICATE: { bg: "rgba(59, 130, 246, 0.12)", text: "#1d4ed8" },
    UNREADABLE: { bg: "rgba(239, 68, 68, 0.10)", text: "#b91c1c" },
    REVIEW: { bg: "rgba(249, 115, 22, 0.12)", text: "#c2410c" },
  };
  const s = map[band] ?? map.LOW;
  return { display: "inline-block", padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.text, fontSize: 10.5, fontWeight: 700 };
}
