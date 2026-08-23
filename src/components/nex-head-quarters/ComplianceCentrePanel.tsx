// NEX Compliance Centre · admin surface for suppressed contacts
//
// Search · view reason/source/timestamp/provider · full audit trail ·
// reinstate (policy-gated). Composes the Phase 4f.3 APIs.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ── Types (mirror src/lib/nex/compliance/types.ts) ──────────────────
type ComplianceState = "allowed" | "suppressed_soft" | "suppressed_hard" | "unsubscribed" | "complaint" | "manual_block";
type ContactCompliance = {
  contact_id: string; email: string | null; name: string | null;
  compliance_state: ComplianceState;
  compliance_reason: string | null;
  compliance_source: string | null;
  compliance_updated_at: string | null;
  soft_bounce_count: number;
  soft_bounce_last_at: string | null;
  never_contact: boolean;
  unsubscribe_at: string | null;
  last_provider_message_id: string | null;
};
type AuditEvent = {
  event_id: string; event_type: string;
  old_state: ComplianceState | null; new_state: ComplianceState | null;
  reason: string | null; source: string; provider: string | null;
  campaign_id: string | null; actor: string | null;
  created_at: string;
};
type Metrics = {
  ok: boolean;
  totals: Record<ComplianceState, number>;
  total_suppressed: number;
  audit_last_24h: number;
  by_source_last_24h: Record<string, number>;
  by_event_type_last_24h: Record<string, number>;
  policy: { softBounceThreshold: number; resetSoftOnDelivered: boolean };
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const STATE_TONE: Record<ComplianceState, string> = {
  allowed:          T.accent,
  suppressed_soft:  T.warning,
  suppressed_hard:  T.danger,
  unsubscribed:     T.info,
  complaint:        T.danger,
  manual_block:     T.purple,
};

const STATES: ComplianceState[] = ["allowed","suppressed_soft","suppressed_hard","unsubscribed","complaint","manual_block"];

const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

// Which states allow single-click reinstate vs need explicit admin confirmation.
const NEEDS_CONFIRM = new Set<ComplianceState>(["complaint","manual_block","unsubscribed"]);

export function ComplianceCentrePanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [contacts, setContacts] = useState<ContactCompliance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [filterState, setFilterState] = useState<ComplianceState | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMetrics = useCallback(async () => {
    const r = await fetch("/api/nex/compliance/metrics", { cache: "no-store" });
    const d = await r.json() as Metrics;
    if (d.ok) setMetrics(d);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterState) qs.set("state", filterState);
      if (search)      qs.set("search", search);
      qs.set("limit", "200");
      const r = await fetch(`/api/nex/compliance/contacts?${qs}`, { cache: "no-store" });
      const d = await r.json() as { ok: boolean; contacts: ContactCompliance[] };
      if (d.ok) setContacts(d.contacts);
    } finally { setLoading(false); }
  }, [filterState, search]);

  useEffect(() => { void loadMetrics(); const t = setInterval(loadMetrics, 15_000); return () => clearInterval(t); }, [loadMetrics]);
  useEffect(() => { void loadList(); }, [loadList]);

  useEffect(() => {
    if (!selectedId) { setAudit([]); return; }
    void fetch(`/api/nex/compliance/contacts/${selectedId}`).then((r) => r.json()).then((d: { ok: boolean; audit: AuditEvent[] }) => { if (d.ok) setAudit(d.audit); });
  }, [selectedId]);

  const selected = useMemo(() => contacts.find((c) => c.contact_id === selectedId) ?? null, [contacts, selectedId]);

  const reinstate = async (contact: ContactCompliance) => {
    const needsConfirm = NEEDS_CONFIRM.has(contact.compliance_state);
    const reason = prompt(needsConfirm
      ? `⚠ ${contact.compliance_state.toUpperCase()} reinstate needs an explicit reason (audit trail). Enter reason:`
      : `Reinstate this contact? Optional reason:`);
    if (reason === null) return;
    const trimmed = reason.trim();
    if (needsConfirm && trimmed.length < 3) { alert("Reason required (min 3 chars)"); return; }
    const r = await fetch(`/api/nex/compliance/contacts/${contact.contact_id}/reinstate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: trimmed || "reinstated by admin", actor: "admin", confirmed: needsConfirm ? true : undefined }),
    });
    const data = await r.json() as { ok: boolean; error?: string };
    if (!data.ok) { alert(`Failed: ${data.error}`); return; }
    await Promise.all([loadList(), loadMetrics()]);
    if (selectedId === contact.contact_id) void fetch(`/api/nex/compliance/contacts/${selectedId}`).then((r0) => r0.json()).then((d: { audit: AuditEvent[] }) => setAudit(d.audit));
  };

  const suppress = async (contact: ContactCompliance) => {
    const reason = prompt("Manual block reason (audit trail · required):");
    if (!reason || reason.trim().length < 3) { if (reason !== null) alert("Reason must be at least 3 chars"); return; }
    const r = await fetch(`/api/nex/compliance/contacts/${contact.contact_id}/suppress`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reason.trim(), actor: "admin" }),
    });
    const data = await r.json() as { ok: boolean; error?: string };
    if (!data.ok) { alert(`Failed: ${data.error}`); return; }
    await Promise.all([loadList(), loadMetrics()]);
  };

  return (
    <div className="space-y-3">
      {/* Metrics row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {STATES.map((s) => (
          <div key={s} className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{s.replace(/_/g, " ")}</div>
            <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color: STATE_TONE[s] }}>
              {metrics?.totals[s] ?? 0}
            </div>
          </div>
        ))}
        <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Suppressed total</div>
          <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color: metrics && metrics.total_suppressed > 0 ? T.warning : T.text }}>{metrics?.total_suppressed ?? 0}</div>
        </div>
        <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Audit · 24h</div>
          <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color: T.text }}>{metrics?.audit_last_24h ?? 0}</div>
          <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>
            {metrics && Object.keys(metrics.by_source_last_24h).length > 0
              ? Object.entries(metrics.by_source_last_24h).map(([s, n]) => `${s}(${n})`).join(" · ")
              : "no activity"}
          </div>
        </div>
      </div>

      {/* Policy chip */}
      {metrics ? (
        <div className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
          Policy · soft-bounce threshold <span style={{ color: T.text }}>{metrics.policy.softBounceThreshold}</span> · reset on delivered <span style={{ color: T.text }}>{String(metrics.policy.resetSoftOnDelivered)}</span> · override via NEX_COMPLIANCE_SOFT_BOUNCE_THRESHOLD + NEX_COMPLIANCE_RESET_SOFT_ON_DELIVERED
        </div>
      ) : null}

      {/* Filters + split-pane */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Left: list */}
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
            <select value={filterState} onChange={(e) => setFilterState(e.target.value as ComplianceState | "")}
              className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}>
              <option value="">All non-allowed</option>
              {STATES.filter((s) => s !== "allowed").map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="email / name"
              className="flex-1 rounded-md border px-2 py-1 text-[11px]" style={inputStyle} />
            <button type="button" onClick={loadList} className="rounded-md border px-2 py-1 text-[10px]"
              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
              {loading ? "…" : "Refresh"}
            </button>
          </div>
          <div className="max-h-[440px] overflow-auto">
            {contacts.length === 0 ? (
              <div className="p-3 text-[11px]" style={{ color: T.textFade }}>{filterState || search ? "No matches for filter." : "No suppressed contacts."}</div>
            ) : contacts.map((c) => {
              const on = c.contact_id === selectedId;
              return (
                <button key={c.contact_id} type="button" onClick={() => setSelectedId(c.contact_id)}
                  className="grid w-full items-baseline gap-1 border-b px-2 py-2 text-left text-[11px]"
                  style={{
                    borderColor: T.border,
                    background: on ? T.panel : "transparent",
                    borderLeft: on ? `3px solid ${STATE_TONE[c.compliance_state]}` : "3px solid transparent",
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold" style={{ color: T.text }}>{c.email ?? c.contact_id}</span>
                    <span className="ml-2 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
                      style={{ background: `${STATE_TONE[c.compliance_state]}20`, color: STATE_TONE[c.compliance_state] }}>
                      {c.compliance_state.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9.5px]" style={{ color: T.textFade }}>
                    <span className="truncate" title={c.compliance_reason ?? ""}>{c.compliance_reason ?? "—"}</span>
                    <span className="font-mono">{c.compliance_source ?? "—"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail + audit */}
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          {!selected ? (
            <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Select a contact on the left to view compliance detail + audit trail.</div>
          ) : (
            <div className="p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <div className="font-semibold" style={{ color: T.text }}>{selected.email ?? selected.contact_id}</div>
                  <div className="text-[9.5px]" style={{ color: T.textFade }}>{selected.name ?? ""}</div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                  style={{ background: `${STATE_TONE[selected.compliance_state]}20`, color: STATE_TONE[selected.compliance_state] }}>
                  {selected.compliance_state.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mb-2 space-y-0.5 text-[10.5px]">
                <div><span style={{ color: T.textFade }}>reason · </span><span style={{ color: T.text }}>{selected.compliance_reason ?? "—"}</span></div>
                <div><span style={{ color: T.textFade }}>source · </span><span className="font-mono" style={{ color: T.text }}>{selected.compliance_source ?? "—"}</span></div>
                <div><span style={{ color: T.textFade }}>updated · </span><span className="font-mono" style={{ color: T.text }}>{selected.compliance_updated_at ? new Date(selected.compliance_updated_at).toLocaleString() : "—"}</span></div>
                <div><span style={{ color: T.textFade }}>soft bounce · </span><span className="font-mono" style={{ color: T.text }}>{selected.soft_bounce_count}{selected.soft_bounce_last_at ? ` (last ${new Date(selected.soft_bounce_last_at).toLocaleString()})` : ""}</span></div>
                <div><span style={{ color: T.textFade }}>last message id · </span><span className="font-mono truncate inline-block max-w-[240px] align-bottom" style={{ color: T.textDim }}>{selected.last_provider_message_id ?? "—"}</span></div>
              </div>

              <div className="mb-2 flex gap-1">
                <button type="button" onClick={() => reinstate(selected)} disabled={selected.compliance_state === "allowed"}
                  className="rounded-md border px-2 py-1 text-[10px] font-semibold"
                  style={{ background: selected.compliance_state === "allowed" ? T.panelHi : T.accent, borderColor: selected.compliance_state === "allowed" ? T.border : T.accent, color: selected.compliance_state === "allowed" ? T.textFade : T.panel, opacity: selected.compliance_state === "allowed" ? 0.5 : 1 }}>
                  Reinstate{NEEDS_CONFIRM.has(selected.compliance_state) ? " (confirm)" : ""}
                </button>
                <button type="button" onClick={() => suppress(selected)} disabled={selected.compliance_state === "manual_block"}
                  className="rounded-md border px-2 py-1 text-[10px]"
                  style={{ background: T.panel, borderColor: T.border, color: selected.compliance_state === "manual_block" ? T.textFade : T.danger, opacity: selected.compliance_state === "manual_block" ? 0.5 : 1 }}>
                  Manual block
                </button>
              </div>

              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Audit trail · {audit.length} events</div>
              <div className="mt-1 max-h-[280px] overflow-auto">
                {audit.length === 0 ? (
                  <div className="text-[10.5px]" style={{ color: T.textFade }}>No audit rows.</div>
                ) : audit.map((a) => (
                  <div key={a.event_id} className="mb-1 rounded-md border p-2 text-[10.5px]" style={{ background: T.panel, borderColor: T.border }}>
                    <div className="flex justify-between">
                      <span className="font-semibold" style={{ color: T.text }}>{a.event_type.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[9px]" style={{ color: T.textFade }}>{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-[9.5px]" style={{ color: T.textFade }}>
                      {a.old_state ?? "—"} → <span style={{ color: a.new_state ? STATE_TONE[a.new_state] : T.text }}>{a.new_state ?? "—"}</span>
                      {" · "}source <span style={{ color: T.text }}>{a.source}</span>
                      {a.provider ? <> · provider <span style={{ color: T.text }}>{a.provider}</span></> : null}
                      {a.actor ? <> · actor <span style={{ color: T.text }}>{a.actor}</span></> : null}
                    </div>
                    {a.reason ? <div className="mt-0.5 text-[10px]" style={{ color: T.textDim }}>{a.reason}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Compliance state is written only by the Compliance Engine · provider webhooks and analytics don&apos;t touch contacts directly. Defense in depth: the send loop re-checks state immediately before every provider.send() call.
      </div>
    </div>
  );
}
