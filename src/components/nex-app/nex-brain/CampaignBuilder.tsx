// NEX Campaign Builder · Communications Centre panel
//
// List of campaigns + inline editor with autosave + status transitions.
// Campaigns store REFERENCES to saved segments · never contact lists.
// Send-preview reruns the audience fresh so compliance is current.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmailComposer } from "./EmailComposer";

// ── Shapes (mirror src/lib/nex/campaigns/types.ts) ─────────────────
type CampaignType = "marketing" | "transactional" | "announcement" | "newsletter";
type CampaignStatus =
  | "draft" | "ready_for_review" | "approved" | "scheduled"
  | "sending" | "paused" | "completed" | "cancelled" | "archived";

type Suppression = { unsubscribed: number; never_contact: number; invalid_email: number; no_marketing_consent: number; total_suppressed: number };
type PreviewCache = {
  matching: number; eligible_marketing: number; eligible_transactional: number;
  suppressed: Suppression; segments_used: string[]; warnings: string[];
  estimated_send_seconds: number | null; generated_at: string;
};

// Block union kept opaque here — the Composer owns the shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComposerBlock = any;

type Campaign = {
  campaign_id: string; name: string; description: string | null;
  campaign_type: CampaignType; status: CampaignStatus;
  subject: string | null; preview_text: string | null;
  body_html: string | null; body_text: string | null;
  body_blocks: ComposerBlock[] | null;
  sender_name: string | null; sender_from: string | null; sender_reply_to: string | null;
  scheduled_at: string | null; started_at: string | null; completed_at: string | null;
  last_preview_at: string | null; last_preview: PreviewCache | null;
  send_stats: Record<string, number>; created_by: string | null;
  created_at: string; updated_at: string; archived_at: string | null;
  segment_ids: string[];
};

type Segment = { segment_id: string; name: string; description: string | null };

const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft:            ["ready_for_review", "archived"],
  ready_for_review: ["approved", "draft", "archived"],
  approved:         ["scheduled", "ready_for_review", "archived"],
  scheduled:        ["sending", "paused", "cancelled", "approved"],
  sending:          ["paused", "completed", "cancelled"],
  paused:           ["scheduled", "cancelled"],
  completed:        ["archived"],
  cancelled:        ["archived", "draft"],
  archived:         [],
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft", ready_for_review: "Ready for review", approved: "Approved",
  scheduled: "Scheduled", sending: "Sending", paused: "Paused",
  completed: "Completed", cancelled: "Cancelled", archived: "Archived",
};

const STATUS_TONE: Record<CampaignStatus, string> = {
  draft:            "#8892a0",
  ready_for_review: "#f0b45a",
  approved:         "#5aa6f0",
  scheduled:        "#b48cf0",
  sending:          "#b48cf0",
  paused:           "#f0b45a",
  completed:        "#4dd0a0",
  cancelled:        "#f0665a",
  archived:         "#5c6572",
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

export function CampaignBuilder() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/nex/campaigns?include_archived=true").then((r) => r.json() as Promise<{ ok: boolean; campaigns: Campaign[] }>),
        fetch("/api/nex/segments").then((r) => r.json() as Promise<{ ok: boolean; segments: Segment[] }>),
      ]);
      if (cRes.ok) setCampaigns(cRes.campaigns);
      if (sRes.ok) setSegments(sRes.segments);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const selected = useMemo(() => campaigns.find((c) => c.campaign_id === selectedId) ?? null, [campaigns, selectedId]);

  const createCampaign = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/nex/campaigns", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), campaign_type: "marketing" }),
      });
      const data = await r.json() as { ok: boolean; campaign?: Campaign };
      if (data.ok && data.campaign) {
        setNewName("");
        await loadAll();
        setSelectedId(data.campaign.campaign_id);
      }
    } finally { setCreating(false); }
  };

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "320px 1fr" }}>
      {/* ── LEFT · list + new ── */}
      <div className="space-y-2">
        <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>New campaign</div>
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
              placeholder="Campaign name"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void createCampaign(); }}
            />
            <button
              type="button" onClick={createCampaign} disabled={creating || !newName.trim()}
              className="rounded-md border px-2 py-1 text-[10px] font-semibold"
              style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: creating ? 0.6 : 1 }}
            >Create</button>
          </div>
        </div>

        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="border-b px-2 py-1.5 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
            All campaigns · {campaigns.length}
            {loading ? <span className="ml-2 italic" style={{ color: T.textFade }}>loading…</span> : null}
          </div>
          <div className="max-h-[560px] overflow-auto">
            {campaigns.length === 0 ? (
              <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>
                No campaigns yet. Create one above to begin.
              </div>
            ) : campaigns.map((c) => {
              const on = c.campaign_id === selectedId;
              return (
                <button
                  key={c.campaign_id} type="button" onClick={() => setSelectedId(c.campaign_id)}
                  className="grid w-full items-baseline gap-1 border-b px-2 py-2 text-left text-[11px]"
                  style={{
                    borderColor: T.border,
                    background: on ? T.panel : "transparent",
                    borderLeft: on ? `3px solid ${STATUS_TONE[c.status]}` : "3px solid transparent",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold" style={{ color: T.text }}>{c.name}</span>
                    <span className="ml-2 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${STATUS_TONE[c.status]}20`, color: STATUS_TONE[c.status] }}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9.5px]" style={{ color: T.textFade }}>
                    <span>{c.campaign_type}</span>
                    <span>{c.segment_ids.length} seg · {new Date(c.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT · editor ── */}
      <div>
        {selected ? (
          <CampaignEditor
            key={selected.campaign_id}
            campaign={selected}
            segments={segments}
            onSaved={loadAll}
            onDeleted={() => { setSelectedId(null); void loadAll(); }}
          />
        ) : (
          <div className="rounded-md border p-6 text-center text-[11px]" style={{ background: T.panelHi, borderColor: T.border, color: T.textFade }}>
            Select a campaign to edit · or create a new one on the left.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Editor with autosave + transitions + preview ──────────────────
function CampaignEditor({
  campaign, segments, onSaved, onDeleted,
}: {
  campaign: Campaign; segments: Segment[];
  onSaved: () => void | Promise<void>;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<Campaign>(campaign);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewCache | null>(campaign.last_preview);
  const [previewing, setPreviewing] = useState(false);
  const dirtyRef = useRef(false);

  // Reset draft when the campaign prop changes (user picked another)
  useEffect(() => { setDraft(campaign); setPreview(campaign.last_preview); dirtyRef.current = false; }, [campaign]);

  const patch = <K extends keyof Campaign>(k: K, v: Campaign[K]) => {
    setDraft((prev) => ({ ...prev, [k]: v }));
    dirtyRef.current = true;
  };

  // Debounced autosave · 900ms after last edit
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/nex/campaigns/${campaign.campaign_id}`, {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: draft.name, description: draft.description, campaign_type: draft.campaign_type,
            subject: draft.subject, preview_text: draft.preview_text,
            body_html: draft.body_html, body_text: draft.body_text, body_blocks: draft.body_blocks,
            sender_name: draft.sender_name, sender_from: draft.sender_from, sender_reply_to: draft.sender_reply_to,
            scheduled_at: draft.scheduled_at, segment_ids: draft.segment_ids,
          }),
        });
        const data = await r.json() as { ok: boolean; error?: string };
        if (data.ok) { setSaveMsg("saved"); dirtyRef.current = false; await onSaved(); }
        else setSaveMsg(`FAILED · ${data.error}`);
      } catch (e) { setSaveMsg(`FAILED · ${e instanceof Error ? e.message : "save_failed"}`); }
      setTimeout(() => setSaveMsg(null), 1800);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.name, draft.description, draft.campaign_type, draft.subject, draft.preview_text,
      draft.body_html, draft.body_text, draft.sender_name, draft.sender_from, draft.sender_reply_to,
      draft.scheduled_at, draft.segment_ids.join(",")]);

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const r = await fetch(`/api/nex/campaigns/${campaign.campaign_id}/preview`);
      const data = await r.json() as { ok: boolean } & PreviewCache;
      if (data.ok) setPreview(data);
    } finally { setPreviewing(false); }
  };

  const transition = async (to: CampaignStatus) => {
    const r = await fetch(`/api/nex/campaigns/${campaign.campaign_id}/status`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const data = await r.json() as { ok: boolean; error?: string };
    if (data.ok) await onSaved();
    else alert(`Transition failed: ${data.error}`);
  };

  const duplicate = async () => {
    const r = await fetch(`/api/nex/campaigns/${campaign.campaign_id}/duplicate`, { method: "POST" });
    const data = await r.json() as { ok: boolean };
    if (data.ok) await onSaved();
  };

  const archive = async () => {
    if (!confirm("Archive this campaign?")) return;
    const r = await fetch(`/api/nex/campaigns/${campaign.campaign_id}`, { method: "DELETE" });
    const data = await r.json() as { ok: boolean };
    if (data.ok) onDeleted();
  };

  const toggleSegment = (segmentId: string) => {
    const set = new Set(draft.segment_ids);
    if (set.has(segmentId)) set.delete(segmentId); else set.add(segmentId);
    patch("segment_ids", Array.from(set));
  };

  const allowed = TRANSITIONS[draft.status] ?? [];

  return (
    <div className="space-y-3 rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      {/* Header · name + status + actions */}
      <div className="flex items-center justify-between gap-2">
        <input
          className="flex-1 rounded-md border px-2 py-1 text-[13px] font-semibold" style={inputStyle}
          value={draft.name} onChange={(e) => patch("name", e.target.value)}
        />
        <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
          style={{ background: `${STATUS_TONE[draft.status]}20`, color: STATUS_TONE[draft.status] }}>
          {STATUS_LABEL[draft.status]}
        </span>
        {saveMsg ? <span className="text-[9px] font-mono" style={{ color: saveMsg.startsWith("FAILED") ? T.danger : T.accent }}>{saveMsg}</span> : null}
      </div>

      {/* Transition buttons */}
      <div className="flex flex-wrap gap-1">
        {allowed.map((to) => (
          <button
            key={to} type="button" onClick={() => transition(to)}
            className="rounded-md border px-2 py-1 text-[10px] font-semibold"
            style={{ background: STATUS_TONE[to], borderColor: STATUS_TONE[to], color: T.panel }}
          >→ {STATUS_LABEL[to]}</button>
        ))}
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={duplicate}
            className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.info }}>
            Duplicate
          </button>
          <button type="button" onClick={archive}
            className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>
            Archive
          </button>
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Description">
          <textarea
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle} rows={2}
            value={draft.description ?? ""} onChange={(e) => patch("description", e.target.value || null)}
          />
        </Field>
        <Field label="Type">
          <select
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.campaign_type} onChange={(e) => patch("campaign_type", e.target.value as CampaignType)}
          >
            <option value="marketing">marketing</option>
            <option value="transactional">transactional</option>
            <option value="announcement">announcement</option>
            <option value="newsletter">newsletter</option>
          </select>
        </Field>

        <Field label="Subject">
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.subject ?? ""} onChange={(e) => patch("subject", e.target.value || null)}
          />
        </Field>
        <Field label="Preview text (inbox snippet)">
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.preview_text ?? ""} onChange={(e) => patch("preview_text", e.target.value || null)}
          />
        </Field>

        <Field label="Sender name">
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.sender_name ?? ""} onChange={(e) => patch("sender_name", e.target.value || null)}
          />
        </Field>
        <Field label="Sender · from address">
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.sender_from ?? ""} onChange={(e) => patch("sender_from", e.target.value || null)}
            placeholder="e.g. news@thenetworkers.app"
          />
        </Field>
        <Field label="Reply-to">
          <input
            className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.sender_reply_to ?? ""} onChange={(e) => patch("sender_reply_to", e.target.value || null)}
          />
        </Field>
        <Field label="Scheduled for">
          <input
            type="datetime-local" className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={draft.scheduled_at ? toLocalInputValue(draft.scheduled_at) : ""}
            onChange={(e) => patch("scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>
      </div>

      {/* Audience picker */}
      <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
            Audience · {draft.segment_ids.length} segment{draft.segment_ids.length === 1 ? "" : "s"} attached
          </div>
          <a href="#audience-engine" className="text-[9px] underline" style={{ color: T.info }}>Manage segments →</a>
        </div>
        {segments.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>
            No saved segments yet · build one in the Audience Engine above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {segments.map((s) => {
              const on = draft.segment_ids.includes(s.segment_id);
              return (
                <button
                  key={s.segment_id} type="button" onClick={() => toggleSegment(s.segment_id)}
                  className="rounded-md border px-2 py-1 text-[10.5px]"
                  style={{
                    background: on ? T.accent : T.panelHi,
                    borderColor: on ? T.accent : T.border,
                    color: on ? T.panel : T.textDim,
                  }}
                  title={s.description ?? ""}
                >{s.name}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* Body · NEX Composer (Phase 4c) */}
      <div>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
          Body · NEX Composer
        </div>
        <EmailComposer
          blocks={(draft.body_blocks ?? []) as ComposerBlock[]}
          subject={draft.subject ?? ""}
          previewText={draft.preview_text ?? ""}
          campaignType={draft.campaign_type}
          onBlocksChange={(b) => patch("body_blocks", b)}
          onSubjectChange={(s) => patch("subject", s || null)}
          onPreviewTextChange={(s) => patch("preview_text", s || null)}
          onRenderedChange={(html, plain) => {
            // Cache rendered output on the draft so the Email Runtime has
            // ready-to-send bodies · autosave persists via the PUT below.
            if (html !== draft.body_html || plain !== draft.body_text) {
              setDraft((prev) => ({ ...prev, body_html: html, body_text: plain }));
              dirtyRef.current = true;
            }
          }}
        />
      </div>

      {/* Send preview */}
      <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
            Send preview · fresh audience query
          </div>
          <button type="button" onClick={runPreview} disabled={previewing}
            className="rounded-md border px-2 py-1 text-[10px] font-semibold"
            style={{ background: T.info, borderColor: T.info, color: T.panel, opacity: previewing ? 0.6 : 1 }}
          >{previewing ? "Previewing…" : "Refresh preview"}</button>
        </div>
        {preview ? (
          <>
            <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <Stat label="Matching" value={preview.matching} tone="info" />
              <Stat label="Eligible · marketing" value={preview.eligible_marketing} tone="good" />
              <Stat label="Eligible · transactional" value={preview.eligible_transactional} tone="accent" />
              <Stat label="Suppressed" value={preview.suppressed.total_suppressed} tone={preview.suppressed.total_suppressed > 0 ? "warn" : "neutral"} />
              <Stat label="Est. send" value={preview.estimated_send_seconds !== null ? `~${prettyDuration(preview.estimated_send_seconds)}` : "—"} tone="neutral" />
            </div>
            <div className="grid gap-2 text-[10px]" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <SubStat label="Unsubscribed" value={preview.suppressed.unsubscribed} />
              <SubStat label="Never-contact" value={preview.suppressed.never_contact} />
              <SubStat label="No mkt consent" value={preview.suppressed.no_marketing_consent} />
              <SubStat label="Invalid email" value={preview.suppressed.invalid_email} />
            </div>
            {preview.warnings.length > 0 ? (
              <div className="mt-2 space-y-0.5">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="text-[10px]" style={{ color: T.warning }}>⚠ {w}</div>
                ))}
              </div>
            ) : null}
            <div className="mt-1 text-[9px] font-mono" style={{ color: T.textFade }}>generated {preview.generated_at}</div>
          </>
        ) : (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>No preview yet · click Refresh to compute.</div>
        )}
      </div>

      <div className="text-[9px] italic" style={{ color: T.textFade }}>
        Autosave is on · edits persist ~1 s after you stop typing. Send-time compliance is re-checked by the Email Runtime · the preview above is a fresh sample, not a promise.
      </div>
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-0.5 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      {children}
    </label>
  );
}
function Stat({ label, value, tone }: { label: string; value: number | string; tone: "good" | "warn" | "info" | "accent" | "neutral" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "info" ? T.info : tone === "accent" ? T.purple : T.text;
  return (
    <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-0.5 font-mono text-[16px] font-black leading-none" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}
function SubStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-1.5" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[8.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="font-mono text-[11.5px]" style={{ color: value > 0 ? T.warning : T.textDim }}>{value.toLocaleString()}</div>
    </div>
  );
}
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function prettyDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}
