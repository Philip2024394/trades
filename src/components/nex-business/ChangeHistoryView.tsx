// NEX Change Control · Change History view (Philip 2026-08-14 · Phase 16).
//
// Filterable, expandable list of every mutation ever applied to the business.
// Each entry shows the mutation lifecycle: Applied · Undone-by · Undo-of.

"use client";

import { useState, useEffect } from "react";

type AuditEntry = {
  mutationId: string;
  kind: string;
  selector: Record<string, unknown>;
  before: unknown;
  after: unknown;
  at: string;
  ownerAccountId: string;
  blueprintRevisionBefore: number;
  blueprintRevisionAfter: number;
  instructionText?: string;
  proposalId: string;
  undoOfMutationId?: string;
  undoneByMutationId?: string;
};

const TABS: Array<{ id: string; label: string; kinds: string[] | "all" }> = [
  { id: "all",     label: "All changes", kinds: "all" },
  { id: "products", label: "Products",    kinds: ["product.price", "product.description", "product.image", "product.add"] },
  { id: "pages",    label: "Pages",       kinds: ["page.heading"] }
];

export function ChangeHistoryView({ businessSlug, businessDisplayName }: {
  businessSlug: string;
  businessDisplayName: string;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch(`/api/b/${businessSlug}/owner/nex/audit`).then((r) => r.json());
      if (res.ok) setEntries(res.entries.slice().reverse());
    } catch {}
  }

  async function undo(mutationId: string) {
    setBusy(mutationId);
    try {
      const res = await fetch(`/api/b/${businessSlug}/owner/nex/undo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutationId })
      }).then((r) => r.json());
      if (!res.ok) { setFlash(`⚠  ${res.error ?? "Undo failed"}`); return; }
      // Confirm + apply in one step from the History page (proposal was created server-side)
      const confirm = window.confirm(`Restore previous value?\n\n${res.proposal.describe}\n\nApply?`);
      if (!confirm) return;
      const applyRes = await fetch(`/api/b/${businessSlug}/owner/nex/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: res.proposal.proposalId, confirmed: true, undoOfMutationId: res.undoOfMutationId })
      }).then((r) => r.json());
      if (applyRes.ok) {
        setFlash("✓ Undone");
        load();
      } else {
        setFlash(`⚠  ${applyRes.error ?? "Undo apply failed"}`);
      }
    } finally {
      setBusy(null);
      setTimeout(() => setFlash(null), 3000);
    }
  }

  const activeTabSpec = TABS.find((t) => t.id === activeTab)!;
  const filtered = entries.filter((e) => activeTabSpec.kinds === "all" || (activeTabSpec.kinds as string[]).includes(e.kind));

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.55, marginBottom: 6 }}>NEX</div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 4px" }}>Change History</h1>
      <p style={{ margin: "0 0 20px", color: "#4b5563", fontSize: 14 }}>
        Every change ever applied to {businessDisplayName}. Every change is reversible.
      </p>

      {flash && (
        <div style={{ padding: 10, background: "#eef2ff", border: "1px solid #a5b4fc", borderRadius: 8, marginBottom: 14, fontSize: 14, color: "#3730a3" }}>
          {flash}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid #e5e7eb" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "10px 14px", fontSize: 14, background: "transparent", border: "none", borderBottom: activeTab === t.id ? "2px solid #F97316" : "2px solid transparent", color: activeTab === t.id ? "#1a1a1a" : "#6b7280", fontWeight: activeTab === t.id ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
          No changes in this view yet.
        </div>
      )}

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((e) => {
          const isExpanded = expanded.has(e.mutationId);
          const isUndone = !!e.undoneByMutationId;
          const isUndoEntry = !!e.undoOfMutationId;
          const target = String(e.selector.slug ?? e.selector.name ?? e.selector.pageId ?? "");
          return (
            <div key={e.mutationId} data-testid={`history-entry-${e.mutationId}`}
              style={{ background: "#fff", border: `1px solid ${isUndone ? "#e5e7eb" : "#d1fae5"}`, borderRadius: 10, overflow: "hidden" }}>
              <div onClick={() => toggle(e.mutationId, expanded, setExpanded)}
                style={{ padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: isUndone ? 0.65 : 1 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {isUndone ? (
                      <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>UNDONE</span>
                    ) : isUndoEntry ? (
                      <span style={{ fontSize: 11, background: "#eef2ff", color: "#3730a3", padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>↩ UNDO</span>
                    ) : (
                      <span style={{ fontSize: 11, background: "#d1fae5", color: "#166534", padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>✓ APPLIED</span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                      {humaniseKind(e.kind)}{target ? ` · ${target}` : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>
                    {formatValue(e.before)} → {formatValue(e.after)}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                    {new Date(e.at).toLocaleString()} · rev {e.blueprintRevisionBefore} → {e.blueprintRevisionAfter}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {!isUndone && !isUndoEntry && (
                    <button onClick={(ev) => { ev.stopPropagation(); undo(e.mutationId); }}
                      disabled={busy === e.mutationId}
                      style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>
                      {busy === e.mutationId ? "…" : "↩ Undo"}
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: "#9ca3af", padding: "6px 8px" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: "0 16px 14px", borderTop: "1px solid #f3f4f6", fontSize: 13, color: "#374151" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 6, marginTop: 10 }}>
                    <div style={{ color: "#9ca3af" }}>Mutation ID</div><div style={{ fontFamily: "ui-monospace, monospace" }}>{e.mutationId}</div>
                    <div style={{ color: "#9ca3af" }}>Kind</div><div>{e.kind}</div>
                    <div style={{ color: "#9ca3af" }}>Selector</div><div style={{ fontFamily: "ui-monospace, monospace" }}>{JSON.stringify(e.selector)}</div>
                    <div style={{ color: "#9ca3af" }}>Owner</div><div>{e.ownerAccountId}</div>
                    <div style={{ color: "#9ca3af" }}>Source</div><div>{e.instructionText ?? "(structured proposal)"}</div>
                    <div style={{ color: "#9ca3af" }}>Proposal</div><div style={{ fontFamily: "ui-monospace, monospace" }}>{e.proposalId}</div>
                    {isUndone && <><div style={{ color: "#9ca3af" }}>Undone by</div><div style={{ fontFamily: "ui-monospace, monospace" }}>{e.undoneByMutationId}</div></>}
                    {isUndoEntry && <><div style={{ color: "#9ca3af" }}>Undo of</div><div style={{ fontFamily: "ui-monospace, monospace" }}>{e.undoOfMutationId}</div></>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toggle(id: string, set: Set<string>, setSet: (s: Set<string>) => void): void {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  setSet(next);
}

function humaniseKind(kind: string): string {
  const map: Record<string, string> = {
    "product.price": "Product price",
    "product.description": "Product description",
    "product.image": "Product image",
    "product.add": "New product",
    "page.heading": "Page heading"
  };
  return map[kind] ?? kind;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(none)";
  if (typeof v === "object" && v !== null && "amount" in v && typeof (v as { amount: number }).amount === "number") {
    const amount = (v as { amount: number; currency?: string }).amount;
    const cur = (v as { currency?: string }).currency ?? "GBP";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(amount / 100);
  }
  if (typeof v === "string") return v.length > 60 ? `"${v.slice(0, 57)}…"` : `"${v}"`;
  if (typeof v === "number") return String(v);
  const j = JSON.stringify(v);
  return j.length > 60 ? j.slice(0, 57) + "…" : j;
}
