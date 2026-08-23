// NEX Audience Builder · Communications Centre → Marketing section
//
// Filter widgets (Location · Business · Contact · Activity · Identity)
// + live preview count + eligibility/suppression breakdown + save as
// named segment. Reads Contact Registry directly via segments preview
// API — every campaign starts from a segment.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md
//           project_nex_audience_engine_2026_08_07.md (this feature)

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ── Shared shape (kept local · matches src/lib/nex/segments/types.ts) ──
type ContactSource = "trades" | "newsletter" | "crm" | "form" | "manual" | "csv" | "fs-store" | "api";

type AudienceFilter = {
  countries?: string[];
  regions?: string[];
  trades?: string[];
  consent_marketing?: boolean;
  consent_transactional?: boolean;
  include_never_contact?: boolean;
  include_unsubscribed?: boolean;
  sources?: ContactSource[];
  last_contacted_before?: string;
  last_contacted_after?: string;
  first_seen_after?: string;
  first_seen_before?: string;
  has_crm_linkage?: boolean;
  search?: string;
};

type SuppressionBreakdown = {
  unsubscribed: number;
  never_contact: number;
  invalid_email: number;
  no_marketing_consent: number;
  total_suppressed: number;
};

type AudiencePreview = {
  matching: number;
  eligible_marketing: number;
  eligible_transactional: number;
  suppressed: SuppressionBreakdown;
  sample: Array<{
    contact_id: string;
    name: string | null;
    email: string | null;
    country: string | null;
    lifecycle_stage: string | null;
    consent_marketing: boolean | null;
    never_contact: boolean;
    unsubscribe_at: string | null;
  }>;
  filter_used: AudienceFilter;
  generated_at: string;
};

type Segment = {
  segment_id: string;
  name: string;
  description: string | null;
  filter: AudienceFilter;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  used_count: number;
  last_used_at: string | null;
};

// ── Theme (matches the Communications Centre panel) ────────────────
const T = {
  panel:    "#12161c",
  panelHi:  "#1a2028",
  border:   "#232b36",
  text:     "#e5e9ef",
  textDim:  "#8892a0",
  textFade: "#5c6572",
  accent:   "#4dd0a0",
  warning:  "#f0b45a",
  danger:   "#f0665a",
  info:     "#5aa6f0",
  purple:   "#b48cf0",
};

const SOURCE_OPTIONS: ContactSource[] = ["trades", "newsletter", "crm", "form", "manual", "csv", "fs-store", "api"];

const inputStyle: React.CSSProperties = {
  background: T.panel, borderColor: T.border, color: T.text,
};

// Toggle a value inside an array-typed filter key.
function toggleInArray<T extends string>(arr: T[] | undefined, val: T): T[] | undefined {
  const set = new Set(arr ?? []);
  if (set.has(val)) set.delete(val); else set.add(val);
  const next = Array.from(set);
  return next.length > 0 ? next : undefined;
}

function nonEmpty<T>(v: T[] | undefined): T[] | undefined {
  return v && v.length > 0 ? v : undefined;
}

export function AudienceBuilder() {
  const [filter, setFilter] = useState<AudienceFilter>({});
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [savedSegments, setSavedSegments] = useState<Segment[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const setKey = <K extends keyof AudienceFilter>(k: K, v: AudienceFilter[K]) => {
    setFilter((prev) => {
      const next = { ...prev };
      if (v === undefined || v === "" || v === null) delete next[k];
      else next[k] = v;
      return next;
    });
  };

  const runPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/nex/segments/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filter }),
      });
      const data = await r.json() as { ok: boolean; error?: string } & AudiencePreview;
      if (!data.ok) throw new Error(data.error ?? "preview_failed");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview_failed");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const r = await fetch("/api/nex/segments");
      const data = await r.json() as { ok: boolean; segments: Segment[] };
      if (data.ok) setSavedSegments(data.segments);
    } finally { setSavedLoading(false); }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);
  useEffect(() => { void runPreview(); /* initial + on-filter-change */ }, [runPreview]);

  const canSave = useMemo(() => saveName.trim().length > 0 && Object.keys(filter).length > 0, [saveName, filter]);

  const saveSegment = async () => {
    setSaveMsg(null);
    try {
      const r = await fetch("/api/nex/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), description: saveDesc.trim() || null, filter }),
      });
      const data = await r.json() as { ok: boolean; error?: string; segment?: Segment };
      if (!data.ok || !data.segment) throw new Error(data.error ?? "save_failed");
      setSaveMsg(`saved · ${data.segment.name}`);
      setSaveName(""); setSaveDesc("");
      void loadSaved();
    } catch (e) {
      setSaveMsg(`FAILED · ${e instanceof Error ? e.message : "save_failed"}`);
    }
  };

  const loadSegment = (s: Segment) => {
    setFilter(s.filter);
    setSaveName(s.name);
    setSaveDesc(s.description ?? "");
  };

  const archiveSegment = async (id: string) => {
    if (!confirm("Archive this segment?")) return;
    await fetch(`/api/nex/segments/${id}`, { method: "DELETE" });
    void loadSaved();
  };

  return (
    <div className="space-y-4">
      {/* ── Filter builder ── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {/* LOCATION */}
        <FilterCard title="Location">
          <Label>Countries (comma sep · ISO or name)</Label>
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            placeholder="GB, US, Australia"
            value={(filter.countries ?? []).join(", ")}
            onChange={(e) => setKey("countries", nonEmpty(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
          />
          <Label>Regions / cities</Label>
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            placeholder="London, Sydney"
            value={(filter.regions ?? []).join(", ")}
            onChange={(e) => setKey("regions", nonEmpty(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
          />
        </FilterCard>

        {/* BUSINESS */}
        <FilterCard title="Business">
          <Label>Trades (comma sep)</Label>
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            placeholder="staircase, kitchen, roofing"
            value={(filter.trades ?? []).join(", ")}
            onChange={(e) => setKey("trades", nonEmpty(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
          />
          <div className="mt-1 text-[9.5px] italic" style={{ color: T.textFade }}>
            Company size / business type · planned (needs enrichment source)
          </div>
        </FilterCard>

        {/* CONTACT · COMPLIANCE */}
        <FilterCard title="Contact · Consent">
          <TriState label="Marketing consent" value={filter.consent_marketing} onChange={(v) => setKey("consent_marketing", v)} />
          <TriState label="Transactional consent" value={filter.consent_transactional} onChange={(v) => setKey("consent_transactional", v)} />
          <Checkbox label="Include never-contact" checked={filter.include_never_contact === true} onChange={(v) => setKey("include_never_contact", v || undefined)} />
          <Checkbox label="Include unsubscribed" checked={filter.include_unsubscribed === true} onChange={(v) => setKey("include_unsubscribed", v || undefined)} />
        </FilterCard>

        {/* SOURCE */}
        <FilterCard title="Contact · Source">
          <div className="flex flex-wrap gap-1">
            {SOURCE_OPTIONS.map((s) => {
              const on = (filter.sources ?? []).includes(s);
              return (
                <button
                  key={s} type="button"
                  onClick={() => setKey("sources", toggleInArray<ContactSource>(filter.sources, s))}
                  className="rounded-md border px-2 py-1 text-[10px]"
                  style={{
                    background: on ? T.accent : T.panel,
                    borderColor: on ? T.accent : T.border,
                    color: on ? T.panel : T.textDim,
                  }}
                >{s}</button>
              );
            })}
          </div>
          <div className="mt-2">
            <Checkbox label="Has CRM linkage" checked={filter.has_crm_linkage === true} onChange={(v) => setKey("has_crm_linkage", v || undefined)} />
          </div>
        </FilterCard>

        {/* ACTIVITY · DATES */}
        <FilterCard title="Activity">
          <Label>Registered after</Label>
          <input type="date" className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={filter.first_seen_after ? filter.first_seen_after.slice(0, 10) : ""}
            onChange={(e) => setKey("first_seen_after", e.target.value ? `${e.target.value}T00:00:00Z` : undefined)} />
          <Label>Last contacted before (inactive since)</Label>
          <input type="date" className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={filter.last_contacted_before ? filter.last_contacted_before.slice(0, 10) : ""}
            onChange={(e) => setKey("last_contacted_before", e.target.value ? `${e.target.value}T00:00:00Z` : undefined)} />
          <div className="mt-1 text-[9.5px] italic" style={{ color: T.textFade }}>
            Opens / clicks / purchases · planned (Phase 7 delivery tracking)
          </div>
        </FilterCard>

        {/* FREE TEXT */}
        <FilterCard title="Free text">
          <Label>Name / email / company contains</Label>
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            placeholder="oak, ltd, gmail"
            value={filter.search ?? ""}
            onChange={(e) => setKey("search", e.target.value || undefined)}
          />
        </FilterCard>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button" onClick={runPreview} disabled={loading}
          className="rounded-md border px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: loading ? 0.6 : 1 }}
        >{loading ? "Previewing…" : "Refresh preview"}</button>
        <button
          type="button" onClick={() => setFilter({})}
          className="rounded-md border px-3 py-1.5 text-[11px]"
          style={{ background: T.panelHi, borderColor: T.border, color: T.textDim }}
        >Clear</button>
        <span className="text-[10px] font-mono" style={{ color: T.textFade }}>
          {Object.keys(filter).length} filter{Object.keys(filter).length === 1 ? "" : "s"} active
        </span>
        {error ? <span className="text-[10px]" style={{ color: T.danger }}>{error}</span> : null}
      </div>

      {/* ── LIVE PREVIEW · counts + breakdown ── */}
      {preview ? (
        <div className="rounded-lg border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <BigStat label="Matching contacts" value={preview.matching.toLocaleString()} tone="info" />
            <BigStat label="Eligible · marketing" value={preview.eligible_marketing.toLocaleString()} tone="good" />
            <BigStat label="Eligible · transactional" value={preview.eligible_transactional.toLocaleString()} tone="accent" />
            <BigStat label="Suppressed" value={preview.suppressed.total_suppressed.toLocaleString()} tone={preview.suppressed.total_suppressed > 0 ? "warn" : "neutral"} />
          </div>
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Why some contacts won&apos;t receive</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <SmallStat label="Unsubscribed" value={preview.suppressed.unsubscribed} tone="warn" />
            <SmallStat label="Never-contact" value={preview.suppressed.never_contact} tone="warn" />
            <SmallStat label="No marketing consent" value={preview.suppressed.no_marketing_consent} tone="warn" />
            <SmallStat label="Invalid / missing email" value={preview.suppressed.invalid_email} tone="warn" />
          </div>

          {preview.sample.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Sample · first {preview.sample.length}</div>
              <div className="max-h-64 overflow-auto rounded-md border" style={{ borderColor: T.border }}>
                <table className="w-full text-[10.5px]">
                  <thead style={{ background: T.panel }}>
                    <tr>
                      <Th>Name</Th><Th>Email</Th><Th>Country</Th><Th>Stage</Th><Th>Consent</Th><Th>Flags</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((s) => {
                      const flags: string[] = [];
                      if (s.never_contact) flags.push("never");
                      if (s.unsubscribe_at) flags.push("unsub");
                      return (
                        <tr key={s.contact_id} style={{ borderTop: `1px solid ${T.border}` }}>
                          <Td>{s.name ?? "—"}</Td>
                          <Td className="font-mono">{s.email ?? "—"}</Td>
                          <Td>{s.country ?? "—"}</Td>
                          <Td>{s.lifecycle_stage ?? "—"}</Td>
                          <Td style={{ color: s.consent_marketing === true ? T.accent : s.consent_marketing === false ? T.danger : T.textFade }}>
                            {s.consent_marketing === true ? "yes" : s.consent_marketing === false ? "no" : "?"}
                          </Td>
                          <Td style={{ color: flags.length > 0 ? T.warning : T.textFade }}>{flags.join(" · ") || "—"}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-[10.5px] italic" style={{ color: T.textFade }}>
              No matching contacts. Try broader filters — Contact Registry has {preview.matching === 0 ? "no rows" : "rows"} that satisfy this definition.
            </div>
          )}

          <div className="mt-2 text-[9px] font-mono" style={{ color: T.textFade }}>generated at {preview.generated_at}</div>
        </div>
      ) : (
        <div className="rounded-lg border p-3 text-[11px]" style={{ background: T.panelHi, borderColor: T.border, color: T.textFade }}>
          Loading preview…
        </div>
      )}

      {/* ── SAVE AS SEGMENT ── */}
      <div className="rounded-lg border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Save this audience</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 2fr auto" }}>
          <input
            className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            placeholder="Segment name · e.g. UK Staircase Companies"
            value={saveName} onChange={(e) => setSaveName(e.target.value)}
          />
          <input
            className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            placeholder="Description (optional)"
            value={saveDesc} onChange={(e) => setSaveDesc(e.target.value)}
          />
          <button
            type="button" onClick={saveSegment} disabled={!canSave}
            className="rounded-md border px-3 py-1 text-[11px] font-semibold"
            style={{ background: canSave ? T.info : T.panelHi, borderColor: canSave ? T.info : T.border, color: canSave ? T.panel : T.textFade }}
          >Save segment</button>
        </div>
        {saveMsg ? <div className="mt-1 text-[10px]" style={{ color: saveMsg.startsWith("FAILED") ? T.danger : T.accent }}>{saveMsg}</div> : null}
      </div>

      {/* ── SAVED SEGMENTS LIST ── */}
      <div className="rounded-lg border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Saved segments · {savedSegments.length}</div>
          <button type="button" onClick={loadSaved} className="text-[9.5px] underline" style={{ color: T.info }}>
            {savedLoading ? "reloading…" : "reload"}
          </button>
        </div>
        {savedSegments.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>
            No saved segments yet · define a filter above and click Save segment.
          </div>
        ) : (
          <div className="space-y-1">
            {savedSegments.map((s) => (
              <div key={s.segment_id}
                className="grid items-center gap-2 rounded-md border p-2 text-[11px]"
                style={{ background: T.panel, borderColor: T.border, gridTemplateColumns: "1fr 100px 100px auto" }}
              >
                <div>
                  <div className="font-semibold" style={{ color: T.text }}>{s.name}</div>
                  {s.description ? <div className="text-[9.5px]" style={{ color: T.textFade }}>{s.description}</div> : null}
                </div>
                <div className="font-mono text-[10px]" style={{ color: T.textFade }}>used {s.used_count}×</div>
                <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>
                  {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString() : "never used"}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button" onClick={() => loadSegment(s)}
                    className="rounded-md border px-2 py-1 text-[10px]"
                    style={{ background: T.panelHi, borderColor: T.border, color: T.info }}
                  >Load</button>
                  <button
                    type="button" onClick={() => archiveSegment(s.segment_id)}
                    className="rounded-md border px-2 py-1 text-[10px]"
                    style={{ background: T.panelHi, borderColor: T.border, color: T.danger }}
                  >Archive</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────
function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>{children}</div>;
}
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px]" style={{ color: T.text }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}
    </label>
  );
}
function TriState({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: T.text }}>
      <span className="min-w-[130px]">{label}</span>
      {(["any", "yes", "no"] as const).map((opt) => {
        const on =
          (opt === "any" && value === undefined) ||
          (opt === "yes" && value === true) ||
          (opt === "no"  && value === false);
        return (
          <button
            key={opt} type="button"
            onClick={() => onChange(opt === "any" ? undefined : opt === "yes")}
            className="rounded-md border px-2 py-0.5 text-[10px]"
            style={{ background: on ? T.info : T.panel, borderColor: on ? T.info : T.border, color: on ? T.panel : T.textDim }}
          >{opt}</button>
        );
      })}
    </div>
  );
}
function BigStat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "info" | "accent" | "neutral" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "info" ? T.info : tone === "accent" ? T.purple : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[22px] font-black leading-none" style={{ color }}>{value}</div>
    </div>
  );
}
function SmallStat({ label, value, tone }: { label: string; value: number; tone: "warn" | "good" | "neutral" }) {
  const color = tone === "warn" ? T.warning : tone === "good" ? T.accent : T.text;
  return (
    <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-0.5 font-mono text-[13px]" style={{ color }}>{value.toLocaleString()}</div>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1 text-left text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{children}</th>;
}
function Td({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`px-2 py-1 ${className}`} style={{ color: T.text, ...(style ?? {}) }}>{children}</td>;
}
