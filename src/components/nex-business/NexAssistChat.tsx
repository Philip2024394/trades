// NEX Assist · owner-facing mutation chat (Philip 2026-08-14).
//
// The in-browser interface to the Phase 14 mutation engine.
// Owner types instruction → NEX proposes with before/after card →
// owner clicks Apply → NEX confirms + adds to recent-changes list.
//
// Rules preserved from Phase 14:
//   - Never applies without explicit [Apply] click
//   - Never fabricates (proposals + validation errors surface honestly)
//   - Audit history is queryable + shown as recent-changes strip

"use client";

import { useState, useRef, useEffect } from "react";

type ProposalCard = {
  proposalId: string;
  kind: string;
  describe: string;
  before: unknown;
  after: unknown;
  selector: Record<string, unknown>;
  expiresAt: string;
};

type BatchCard = {
  batchId: string;
  proposals: ProposalCard[];
  planDescription: string;
  expiresAt: string;
};

type ChatEntry =
  | { kind: "owner"; text: string; at: string }
  | { kind: "nex"; text: string; at: string }
  | { kind: "proposal"; proposal: ProposalCard; at: string; state: "pending" | "applied" | "cancelled"; undoOfMutationId?: string }
  | { kind: "batch"; batch: BatchCard; at: string; state: "pending" | "applied" | "cancelled" }
  | { kind: "applied"; text: string; kindApplied: string; newRevision: number; at: string; mutationId: string; undoOffered: boolean }
  | { kind: "clarify"; text: string; unclearFragments: string[]; at: string }
  | { kind: "error"; text: string; resolution?: string; at: string };

type AuditEntry = {
  mutationId: string;
  kind: string;
  at: string;
  before: unknown;
  after: unknown;
  selector: Record<string, unknown>;
};

export function NexAssistChat({ businessSlug, businessDisplayName }: {
  businessSlug: string;
  businessDisplayName: string;
}) {
  const [history, setHistory] = useState<ChatEntry[]>([
    {
      kind: "nex",
      text: `Hi. I can change ${businessDisplayName}'s live data — prices, descriptions, images, the homepage heading, or add a new product. Tell me what you'd like to change.`,
      at: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, busy]);

  useEffect(() => { loadAudit(); }, []);

  async function loadAudit() {
    try {
      const res = await fetch(`/api/b/${businessSlug}/owner/nex/audit`).then((r) => r.json());
      if (res.ok) setAudit(res.entries.slice().reverse().slice(0, 5));
    } catch {}
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setHistory((h) => [...h, { kind: "owner", text, at: new Date().toISOString() }]);

    // Compound-instruction heuristic · matches server-side splitInstruction.
    const compound = /[\n;]|(?:,\s*|(?:\s+and\s+))(?=(?:change|update|add|set|replace|make|feature|unfeature)\b)/i.test(text);

    try {
      if (compound) {
        const res = await fetch(`/api/b/${businessSlug}/owner/nex/propose-batch`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction: text })
        }).then((r) => r.json());

        if (res.ok && res.batch) {
          setHistory((h) => [...h, { kind: "batch", batch: res.batch, at: new Date().toISOString(), state: "pending" }]);
        } else if (res.needsClarification) {
          setHistory((h) => [...h, {
            kind: "clarify",
            text: res.say ?? res.error ?? "I need a bit more clarity on part of that.",
            unclearFragments: res.unclearFragments ?? [],
            at: new Date().toISOString()
          }]);
        } else {
          setHistory((h) => [...h, { kind: "error", text: res.error ?? "Batch failed.", resolution: res.resolution, at: new Date().toISOString() }]);
        }
      } else {
        const res = await fetch(`/api/b/${businessSlug}/owner/nex/propose`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction: text })
        }).then((r) => r.json());

        if (res.ok && res.proposal) {
          setHistory((h) => [...h, {
            kind: "proposal",
            proposal: res.proposal,
            at: new Date().toISOString(),
            state: "pending"
          }]);
        } else {
          setHistory((h) => [...h, {
            kind: "error",
            text: res.error ?? "Something went wrong.",
            resolution: res.resolution,
            at: new Date().toISOString()
          }]);
        }
      }
    } catch (e) {
      setHistory((h) => [...h, {
        kind: "error",
        text: "Network error. Check the API is reachable.",
        at: new Date().toISOString()
      }]);
    } finally {
      setBusy(false);
    }
  }

  async function applyBatch(entryIdx: number, batchId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/b/${businessSlug}/owner/nex/apply-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId, confirmed: true })
      }).then((r) => r.json());
      if (res.ok) {
        setHistory((h) => h.map((e, i) => i === entryIdx && e.kind === "batch" ? { ...e, state: "applied" as const } : e));
        setHistory((h) => [...h, {
          kind: "nex",
          text: `Done. ${res.audits.length} changes applied together · Blueprint rev ${res.newRevision}.`,
          at: new Date().toISOString()
        }]);
        loadAudit();
      } else {
        setHistory((h) => [...h, { kind: "error", text: res.error ?? "Apply-all failed.", at: new Date().toISOString() }]);
      }
    } finally {
      setBusy(false);
    }
  }

  function cancelBatch(entryIdx: number) {
    setHistory((h) => h.map((e, i) => i === entryIdx && e.kind === "batch" ? { ...e, state: "cancelled" as const } : e));
    setHistory((h) => [...h, { kind: "nex", text: "Cancelled — no changes made.", at: new Date().toISOString() }]);
  }

  async function apply(entryIdx: number, proposalId: string, kindApplied: string, undoOfMutationId?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/b/${businessSlug}/owner/nex/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId, confirmed: true, undoOfMutationId })
      }).then((r) => r.json());
      if (res.ok) {
        setHistory((h) => h.map((e, i) => i === entryIdx && e.kind === "proposal" ? { ...e, state: "applied" as const } : e));
        setHistory((h) => [...h, {
          kind: "applied",
          text: undoOfMutationId
            ? `Undone · Blueprint rev ${res.newRevision}`
            : `Done · ${kindApplied} applied · Blueprint rev ${res.newRevision}`,
          kindApplied,
          newRevision: res.newRevision,
          at: new Date().toISOString(),
          mutationId: res.audit?.mutationId ?? "",
          undoOffered: !undoOfMutationId    // don't offer undo-of-undo (would be a no-op cycle)
        }]);
        loadAudit();
      } else {
        setHistory((h) => [...h, { kind: "error", text: res.error ?? "Apply failed.", at: new Date().toISOString() }]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function requestUndo(mutationId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/b/${businessSlug}/owner/nex/undo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutationId })
      }).then((r) => r.json());
      if (res.ok && res.proposal) {
        setHistory((h) => [...h, {
          kind: "proposal",
          proposal: res.proposal,
          at: new Date().toISOString(),
          state: "pending",
          undoOfMutationId: res.undoOfMutationId
        }]);
      } else {
        setHistory((h) => [...h, {
          kind: "error",
          text: res.error ?? "Couldn't propose undo.",
          resolution: res.resolution,
          at: new Date().toISOString()
        }]);
      }
    } finally {
      setBusy(false);
    }
  }

  function cancel(entryIdx: number) {
    setHistory((h) => h.map((e, i) => i === entryIdx && e.kind === "proposal" ? { ...e, state: "cancelled" as const } : e));
    setHistory((h) => [...h, { kind: "nex", text: "Cancelled — no changes made.", at: new Date().toISOString() }]);
  }

  const suggestions = [
    "Change the Helix staircase price to £22,995",
    "Change our homepage heading to \"Handcrafted staircases built to last\"",
    "Add a new staircase called \"Alpine\" at £18,500",
    "Change the description of Meridian to something warmer"
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
      {/* Main chat */}
      <div style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", minHeight: "72vh" }}>
        <header style={{ padding: "14px 18px", borderBottom: "1px solid #f1f2f4", background: "#fafafa", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F97316", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>N</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>NEX Assist</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Talk to NEX about {businessDisplayName}</div>
          </div>
        </header>

        <div ref={scrollRef} style={{ flex: 1, padding: 18, overflowY: "auto", background: "#fff" }}>
          {history.map((e, i) => <ChatBubble key={i} entry={e} index={i} onApply={apply} onCancel={cancel} onUndo={requestUndo} onApplyBatch={applyBatch} onCancelBatch={cancelBatch} />)}
          {busy && <div style={{ padding: "6px 12px", fontSize: 13, color: "#9ca3af" }}>NEX is thinking…</div>}
        </div>

        <div style={{ padding: 14, borderTop: "1px solid #f1f2f4", background: "#fafafa" }}>
          {history.length <= 1 && (
            <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  style={{ padding: "6px 10px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999, fontSize: 12, color: "#4b5563", cursor: "pointer" }}>
                  {s.slice(0, 50)}{s.length > 50 ? "…" : ""}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="What would you like to change?"
              disabled={busy}
              style={{ flex: 1, padding: "12px 14px", fontSize: 15, border: "1px solid #d4d4d4", borderRadius: 10, outline: "none" }}
            />
            <button onClick={send} disabled={busy || !input.trim()}
              style={{ padding: "12px 22px", fontSize: 15, fontWeight: 600, background: "#F97316", color: "#fff", border: "none", borderRadius: 10, cursor: busy ? "wait" : "pointer" }}>
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>

      {/* Recent changes side rail */}
      <aside style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, minHeight: "72vh", overflowY: "auto" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", marginBottom: 10 }}>Recent changes</div>
        {audit.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>No changes yet.</div>}
        {audit.map((a) => (
          <div key={a.mutationId} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>{new Date(a.at).toLocaleString()}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{a.kind}</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 3 }}>{describeAuditEntry(a)}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}

function ChatBubble({ entry, index, onApply, onCancel, onUndo, onApplyBatch, onCancelBatch }: {
  entry: ChatEntry;
  index: number;
  onApply: (i: number, id: string, kind: string, undoOfMutationId?: string) => void;
  onCancel: (i: number) => void;
  onUndo: (mutationId: string) => void;
  onApplyBatch: (i: number, batchId: string) => void;
  onCancelBatch: (i: number) => void;
}) {
  if (entry.kind === "owner") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ background: "#F97316", color: "#fff", padding: "10px 14px", borderRadius: 12, maxWidth: "72%", fontSize: 15 }}>{entry.text}</div>
      </div>
    );
  }
  if (entry.kind === "nex") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
        <div style={{ background: "#f4f4f5", color: "#1a1a1a", padding: "10px 14px", borderRadius: 12, maxWidth: "72%", fontSize: 15, whiteSpace: "pre-wrap" }}>{entry.text}</div>
      </div>
    );
  }
  if (entry.kind === "error") {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", padding: "12px 14px", borderRadius: 10, fontSize: 14, color: "#991b1b" }}>
          {entry.text}
          {entry.resolution && <div style={{ marginTop: 6, fontSize: 12, color: "#7f1d1d" }}>💡 {entry.resolution}</div>}
        </div>
      </div>
    );
  }
  if (entry.kind === "clarify") {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", padding: "12px 14px", borderRadius: 10, fontSize: 14, color: "#78350f", whiteSpace: "pre-wrap" }}>
          {entry.text}
        </div>
      </div>
    );
  }
  if (entry.kind === "batch") {
    const b = entry.batch;
    const applied = entry.state === "applied";
    const cancelled = entry.state === "cancelled";
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#92400e", marginBottom: 8, fontWeight: 600 }}>
            {b.proposals.length} change{b.proposals.length === 1 ? "" : "s"} proposed · one approval
          </div>
          <ol style={{ margin: "0 0 14px", paddingLeft: 20 }}>
            {b.proposals.map((p) => (
              <li key={p.proposalId} style={{ fontSize: 14, marginBottom: 8, color: "#1a1a1a" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "#92400e", marginRight: 6 }}>{p.kind}</span>
                <span style={{ whiteSpace: "pre-wrap" }}>{p.describe.split("\n")[0]}</span>
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontFamily: "ui-monospace, monospace" }}>
                  {formatValue(p.before)} → {formatValue(p.after)}
                </div>
              </li>
            ))}
          </ol>
          {!applied && !cancelled && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onApplyBatch(index, b.batchId)}
                style={{ padding: "10px 18px", background: "#166534", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Apply all {b.proposals.length}
              </button>
              <button onClick={() => onCancelBatch(index)}
                style={{ padding: "10px 18px", background: "transparent", color: "#4b5563", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
          {applied && <div style={{ fontSize: 13, color: "#166534", fontWeight: 500 }}>✓ All applied</div>}
          {cancelled && <div style={{ fontSize: 13, color: "#6b7280" }}>Cancelled</div>}
        </div>
      </div>
    );
  }
  if (entry.kind === "applied") {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", padding: "10px 14px", borderRadius: 10, fontSize: 14, color: "#166534", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>✓</span> {entry.text}
          </div>
          {entry.undoOffered && entry.mutationId && (
            <button onClick={() => onUndo(entry.mutationId)}
              title="Undo creates a new governed proposal · nothing changes until you approve"
              style={{ padding: "6px 12px", fontSize: 13, background: "transparent", color: "#166534", border: "1px solid #86efac", borderRadius: 6, cursor: "pointer" }}>
              ↩ Undo this change
            </button>
          )}
        </div>
      </div>
    );
  }
  // proposal card
  const p = entry.proposal;
  const applied = entry.state === "applied";
  const cancelled = entry.state === "cancelled";
  const isUndo = !!entry.undoOfMutationId;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ background: isUndo ? "#eef2ff" : "#fffbeb", border: `1px solid ${isUndo ? "#a5b4fc" : "#fbbf24"}`, padding: 16, borderRadius: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: isUndo ? "#3730a3" : "#92400e", marginBottom: 8, fontWeight: 600 }}>
          {isUndo ? "↩ Undo proposed" : "Proposed change"} · {p.kind}
        </div>
        <div style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "#1a1a1a", marginBottom: 12 }}>
          {p.describe}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #fef3c7" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Before</div>
            <div style={{ fontSize: 14, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{formatValue(p.before)}</div>
          </div>
          <div style={{ padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #fbbf24" }}>
            <div style={{ fontSize: 10, color: "#92400e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>After</div>
            <div style={{ fontSize: 14, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{formatValue(p.after)}</div>
          </div>
        </div>
        {!applied && !cancelled && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onApply(index, p.proposalId, p.kind, entry.undoOfMutationId)}
              style={{ padding: "10px 18px", background: isUndo ? "#4338ca" : "#166534", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {isUndo ? "Restore previous value" : "Apply change"}
            </button>
            <button onClick={() => onCancel(index)}
              style={{ padding: "10px 18px", background: "transparent", color: "#4b5563", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
        {applied && (
          <div style={{ fontSize: 13, color: "#166534", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <span>✓</span> Applied
          </div>
        )}
        {cancelled && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>Cancelled</div>
        )}
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(none)";
  if (typeof v === "object" && v !== null && "amount" in v && typeof (v as { amount: number }).amount === "number") {
    const amount = (v as { amount: number; currency?: string }).amount;
    const cur = (v as { currency?: string }).currency ?? "GBP";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(amount / 100);
  }
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  if (typeof v === "number") return String(v);
  const json = JSON.stringify(v);
  return json.length > 80 ? json.slice(0, 77) + "…" : json;
}

function describeAuditEntry(a: AuditEntry): string {
  const target = String(a.selector.slug ?? a.selector.name ?? a.selector.pageId ?? "");
  if (a.kind === "product.price") return `${target} · ${formatValue(a.before)} → ${formatValue(a.after)}`;
  if (a.kind === "product.description") return `${target} · description updated`;
  if (a.kind === "product.image") return `${target} · image swapped`;
  if (a.kind === "page.heading") return `${target} page · heading updated`;
  if (a.kind === "product.add") {
    const p = a.after as Record<string, unknown> | null;
    return `Added · ${p?.name ?? p?.slug ?? "product"}`;
  }
  return a.kind;
}
