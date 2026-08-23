// NEX Email Composer · block-based visual editor
//
// Left: block palette + variable picker + template picker + AI assist.
// Center: block canvas (reorder / edit / delete each block).
// Right: live preview (Desktop / Mobile / Dark / Plain-text).
// Bottom: quality-check panel.
//
// This component is CONTROLLED · parent passes blocks/subject/preview
// + onChange callbacks. Autosave lives on the parent (CampaignEditor).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ── Types mirror src/lib/nex/composer/types.ts ─────────────────────
type BlockAlign = "left" | "center" | "right";
type Block =
  | { id: string; type: "heading";       text: string; level: 1 | 2 | 3; align?: BlockAlign }
  | { id: string; type: "paragraph";     text: string; align?: BlockAlign }
  | { id: string; type: "image";         src: string; alt: string; width_pct?: number; align?: BlockAlign; href?: string }
  | { id: string; type: "button";        text: string; href: string; align?: BlockAlign; color?: string; bg?: string }
  | { id: string; type: "divider";       color?: string }
  | { id: string; type: "spacer";        height: number }
  | { id: string; type: "columns";       columns: Block[][] }
  | { id: string; type: "hero";          src?: string; heading: string; subheading?: string; cta_text?: string; cta_href?: string; bg?: string }
  | { id: string; type: "feature_grid";  features: Array<{ icon?: string; title: string; body: string }> }
  | { id: string; type: "cta";           heading: string; body?: string; cta_text: string; cta_href: string; align?: BlockAlign; bg?: string }
  | { id: string; type: "gallery";       items: Array<{ src: string; alt: string; href?: string }> }
  | { id: string; type: "signature";     name: string; role?: string; company?: string; email?: string; phone?: string; photo_src?: string }
  | { id: string; type: "footer";        company: string; address?: string; unsubscribe_text?: string }
  | { id: string; type: "social_links";  links: Array<{ platform: "twitter" | "linkedin" | "instagram" | "facebook" | "youtube" | "website"; href: string; label?: string }> };

type BlockType = Block["type"];

type EmailTemplate = { template_id: string; name: string; category: string; description: string | null; subject: string | null; preview_text: string | null; blocks: Block[]; is_seed: boolean; used_count: number };
type QualityCheck = { id: string; severity: "error" | "warning" | "info"; category: string; message: string; detail?: string };
type VariableDef = { name: string; description: string; sample_value: string; source: string };

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading", paragraph: "Paragraph", image: "Image", button: "Button",
  divider: "Divider", spacer: "Spacer", columns: "Columns", hero: "Hero Banner",
  feature_grid: "Feature Grid", cta: "Call to Action", gallery: "Gallery",
  signature: "Signature", footer: "Footer", social_links: "Social Links",
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};
const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

// ── Helpers ────────────────────────────────────────────────────────
const uid = () => `b_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

function defaultBlock(type: BlockType): Block {
  switch (type) {
    case "heading":      return { id: uid(), type: "heading",      text: "New heading",       level: 2 };
    case "paragraph":    return { id: uid(), type: "paragraph",    text: "Write your paragraph here." };
    case "image":        return { id: uid(), type: "image",        src: "", alt: "" };
    case "button":       return { id: uid(), type: "button",       text: "Click me", href: "https://" };
    case "divider":      return { id: uid(), type: "divider" };
    case "spacer":       return { id: uid(), type: "spacer",       height: 24 };
    case "columns":      return { id: uid(), type: "columns",      columns: [[], []] };
    case "hero":         return { id: uid(), type: "hero",         heading: "Welcome", subheading: "Subheading" };
    case "feature_grid": return { id: uid(), type: "feature_grid", features: [{ title: "Fast", body: "Description" }, { title: "Focused", body: "Description" }, { title: "Yours", body: "Description" }] };
    case "cta":          return { id: uid(), type: "cta",          heading: "Ready?", cta_text: "Get started", cta_href: "https://" };
    case "gallery":      return { id: uid(), type: "gallery",      items: [{ src: "", alt: "" }] };
    case "signature":    return { id: uid(), type: "signature",    name: "Your name" };
    case "footer":       return { id: uid(), type: "footer",       company: "Your company" };
    case "social_links": return { id: uid(), type: "social_links", links: [{ platform: "website", href: "https://" }] };
  }
}

// ── Props ──────────────────────────────────────────────────────────
export type EmailComposerProps = {
  blocks: Block[];
  subject: string;
  previewText: string;
  campaignType: "marketing" | "transactional" | "announcement" | "newsletter";
  onBlocksChange: (blocks: Block[]) => void;
  onSubjectChange: (subject: string) => void;
  onPreviewTextChange: (text: string) => void;
  onRenderedChange?: (html: string, plainText: string) => void;
};

export function EmailComposer(p: EmailComposerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [renderedText, setRenderedText] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | "dark" | "text">("desktop");
  const [quality, setQuality] = useState<QualityCheck[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/nex/composer/templates").then((r) => r.json()).then((d) => { if (d.ok) setTemplates(d.templates); });
    void fetch("/api/nex/composer/variables").then((r) => r.json()).then((d) => { if (d.ok) setVariables(d.variables); });
  }, []);

  // Debounced render + quality · 300ms after last edit
  useEffect(() => {
    const t = setTimeout(async () => {
      const [r, q] = await Promise.all([
        fetch("/api/nex/composer/render", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ blocks: p.blocks, subject: p.subject, preview_text: p.previewText, resolve_unsubscribe: true }),
        }).then((x) => x.json() as Promise<{ ok: boolean; html: string; plain_text: string }>),
        fetch("/api/nex/composer/quality", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ blocks: p.blocks, subject: p.subject, preview_text: p.previewText, campaign_type: p.campaignType }),
        }).then((x) => x.json() as Promise<{ ok: boolean; checks: QualityCheck[] }>),
      ]);
      if (r.ok) {
        setRenderedHtml(r.html); setRenderedText(r.plain_text);
        p.onRenderedChange?.(r.html, r.plain_text);
      }
      if (q.ok) setQuality(q.checks);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(p.blocks), p.subject, p.previewText, p.campaignType]);

  // ── Block ops ────────────────────────────────────────────────────
  const addBlock = (type: BlockType, index?: number) => {
    const b = defaultBlock(type);
    const idx = typeof index === "number" ? index : p.blocks.length;
    const next = [...p.blocks.slice(0, idx), b, ...p.blocks.slice(idx)];
    p.onBlocksChange(next);
    setSelectedBlockId(b.id);
  };
  const updateBlock = (id: string, patch: Partial<Block>) => {
    p.onBlocksChange(p.blocks.map((b) => b.id === id ? ({ ...b, ...patch } as Block) : b));
  };
  const deleteBlock = (id: string) => {
    p.onBlocksChange(p.blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };
  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = p.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const to = idx + dir;
    if (to < 0 || to >= p.blocks.length) return;
    const next = [...p.blocks];
    [next[idx], next[to]] = [next[to], next[idx]];
    p.onBlocksChange(next);
  };
  const duplicateBlock = (id: string) => {
    const b = p.blocks.find((x) => x.id === id);
    if (!b) return;
    const copy = JSON.parse(JSON.stringify(b)) as Block; (copy as { id: string }).id = uid();
    const idx = p.blocks.findIndex((x) => x.id === id) + 1;
    p.onBlocksChange([...p.blocks.slice(0, idx), copy, ...p.blocks.slice(idx)]);
  };

  const applyTemplate = (t: EmailTemplate) => {
    if (p.blocks.length > 0 && !confirm(`Replace the current ${p.blocks.length} block(s) with template "${t.name}"?`)) return;
    // Give template blocks fresh ids so they don't collide with existing state
    const fresh = t.blocks.map((b) => ({ ...b, id: uid() })) as Block[];
    p.onBlocksChange(fresh);
    if (t.subject && !p.subject) p.onSubjectChange(t.subject);
    if (t.preview_text && !p.previewText) p.onPreviewTextChange(t.preview_text);
    setShowTemplates(false);
  };

  const errorCount = useMemo(() => quality.filter((q) => q.severity === "error").length, [quality]);
  const warnCount  = useMemo(() => quality.filter((q) => q.severity === "warning").length, [quality]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="rounded-md border" style={{ background: T.panel, borderColor: T.border }}>
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Composer</div>
        <button type="button" onClick={() => setShowTemplates((s) => !s)}
          className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panelHi, borderColor: T.border, color: T.info }}>
          Templates ({templates.length})
        </button>
        <button type="button" onClick={() => setAiOpen((s) => !s)}
          className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panelHi, borderColor: T.border, color: T.purple }}>
          AI assist
        </button>
        <div className="ml-auto flex items-center gap-1">
          {(["desktop", "mobile", "dark", "text"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setPreviewMode(m)}
              className="rounded-md border px-2 py-1 text-[10px]"
              style={{
                background: previewMode === m ? T.info : T.panelHi,
                borderColor: previewMode === m ? T.info : T.border,
                color: previewMode === m ? T.panel : T.textDim,
              }}>{m}</button>
          ))}
        </div>
      </div>

      {showTemplates ? (
        <TemplateStrip templates={templates} onPick={applyTemplate} onClose={() => setShowTemplates(false)} />
      ) : null}

      {aiOpen ? <AiPanel variables={variables} onClose={() => setAiOpen(false)} /> : null}

      <div className="grid" style={{ gridTemplateColumns: "220px 1fr 380px", minHeight: 560 }}>
        {/* ── LEFT · palette + variables ── */}
        <div className="border-r p-2" style={{ borderColor: T.border, background: T.panelHi }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Add block</div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
              <button key={t} type="button" onClick={() => addBlock(t)}
                className="rounded-md border px-1 py-1 text-[9.5px]"
                style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
                {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="mt-3 mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Insert variable</div>
          <div className="space-y-0.5">
            {variables.map((v) => (
              <button key={v.name} type="button"
                onClick={() => insertVariableIntoSelected(v.name, selectedBlockId, p.blocks, p.onBlocksChange)}
                className="w-full rounded-md border px-1.5 py-1 text-left text-[9.5px]"
                style={{ background: T.panel, borderColor: T.border, color: T.text }}
                title={v.description}>
                <div className="font-mono" style={{ color: T.accent }}>{"{{"}{v.name}{"}}"}</div>
                <div className="text-[9px]" style={{ color: T.textFade }}>{v.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── CENTER · canvas ── */}
        <div className="p-3">
          {/* Header fields */}
          <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="block">
              <div className="mb-0.5 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Subject</div>
              <input className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
                value={p.subject} onChange={(e) => p.onSubjectChange(e.target.value)} />
            </label>
            <label className="block">
              <div className="mb-0.5 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Preview text (inbox snippet)</div>
              <input className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
                value={p.previewText} onChange={(e) => p.onPreviewTextChange(e.target.value)} />
            </label>
          </div>

          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Canvas · {p.blocks.length} block{p.blocks.length === 1 ? "" : "s"}</div>

          {p.blocks.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-[11px]" style={{ background: T.panelHi, borderColor: T.border, color: T.textFade }}>
              Empty canvas · pick a template or drop blocks in from the left.
            </div>
          ) : (
            <div className="space-y-2">
              {p.blocks.map((b, idx) => (
                <BlockCard
                  key={b.id} block={b} index={idx} total={p.blocks.length}
                  selected={selectedBlockId === b.id}
                  onSelect={() => setSelectedBlockId(b.id)}
                  onMove={(dir) => moveBlock(b.id, dir)}
                  onDelete={() => deleteBlock(b.id)}
                  onDuplicate={() => duplicateBlock(b.id)}
                  onChange={(patch) => updateBlock(b.id, patch)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT · preview ── */}
        <div className="border-l p-2" style={{ borderColor: T.border, background: previewMode === "dark" ? "#0a0a0a" : previewMode === "text" ? T.panel : "#e5e7eb" }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: previewMode === "dark" || previewMode === "text" ? T.textFade : "#4b5563" }}>
            Preview · {previewMode}
          </div>
          {previewMode === "text" ? (
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border p-2 font-mono text-[11px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}>{renderedText || "(empty)"}</pre>
          ) : (
            <div className={previewMode === "dark" ? "invert-preview" : ""}>
              <iframe
                title="composer-preview"
                sandbox=""
                srcDoc={previewMode === "dark" ? wrapDark(renderedHtml) : renderedHtml}
                style={{
                  width: previewMode === "mobile" ? 375 : "100%",
                  height: 540, border: "1px solid " + T.border, background: "#fff", borderRadius: 6, display: "block", margin: "0 auto",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM · quality panel ── */}
      <div className="border-t p-3" style={{ borderColor: T.border }}>
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
            Quality checks · <span style={{ color: errorCount > 0 ? T.danger : T.accent }}>{errorCount} error{errorCount === 1 ? "" : "s"}</span> · <span style={{ color: warnCount > 0 ? T.warning : T.textFade }}>{warnCount} warning{warnCount === 1 ? "" : "s"}</span>
          </div>
          {errorCount === 0 ? <span className="text-[10px]" style={{ color: T.accent }}>Ready for review</span> : <span className="text-[10px]" style={{ color: T.danger }}>Fix errors before scheduling</span>}
        </div>
        {quality.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>No issues.</div>
        ) : (
          <div className="space-y-0.5">
            {quality.map((q) => (
              <div key={q.id} className="flex items-baseline gap-2 text-[10.5px]">
                <span className="min-w-[52px] rounded px-1.5 text-[9px] font-black uppercase tracking-widest"
                  style={{ background: q.severity === "error" ? `${T.danger}20` : q.severity === "warning" ? `${T.warning}20` : `${T.info}20`, color: q.severity === "error" ? T.danger : q.severity === "warning" ? T.warning : T.info }}>
                  {q.severity}
                </span>
                <div>
                  <span style={{ color: T.text }}>{q.message}</span>
                  {q.detail ? <span className="ml-2 text-[9.5px]" style={{ color: T.textFade }}>{q.detail}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Template picker strip ──────────────────────────────────────────
function TemplateStrip({ templates, onPick, onClose }: { templates: EmailTemplate[]; onPick: (t: EmailTemplate) => void; onClose: () => void }) {
  return (
    <div className="border-b p-2" style={{ borderColor: T.border, background: T.panelHi }}>
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Template library · {templates.length}</div>
        <button type="button" onClick={onClose} className="text-[10px] underline" style={{ color: T.textFade }}>close</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {templates.map((t) => (
          <button key={t.template_id} type="button" onClick={() => onPick(t)}
            className="rounded-md border p-1.5 text-left"
            style={{ background: T.panel, borderColor: T.border, minWidth: 180, maxWidth: 220 }}
            title={t.description ?? ""}>
            <div className="text-[11px] font-semibold" style={{ color: T.text }}>{t.name}</div>
            <div className="text-[9.5px]" style={{ color: T.textFade }}>{t.category}{t.is_seed ? " · seed" : ""} · {t.blocks.length} blocks</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── AI assist panel ────────────────────────────────────────────────
function AiPanel({ variables, onClose }: { variables: VariableDef[]; onClose: () => void }) {
  const [command, setCommand] = useState<"write_newsletter" | "improve_subject" | "shorten" | "rewrite_tone" | "generate_ctas">("improve_subject");
  const [context, setContext] = useState("");
  const [output, setOutput] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true); setOutput(""); setNote("");
    try {
      const r = await fetch("/api/nex/composer/assist", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ command, context }),
      });
      const data = await r.json() as { ok: boolean; output: string; provider_note?: string };
      if (data.ok) { setOutput(data.output); setNote(data.provider_note ?? ""); }
    } finally { setLoading(false); }
  };

  return (
    <div className="border-b p-3" style={{ borderColor: T.border, background: T.panelHi }}>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.purple }}>AI assist</div>
        <button type="button" onClick={onClose} className="text-[10px] underline" style={{ color: T.textFade }}>close</button>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "180px 1fr auto" }}>
        <select value={command} onChange={(e) => setCommand(e.target.value as typeof command)}
          className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}>
          <option value="write_newsletter">Write a newsletter</option>
          <option value="improve_subject">Improve subject line</option>
          <option value="shorten">Shorten paragraph</option>
          <option value="rewrite_tone">Rewrite in another tone</option>
          <option value="generate_ctas">Generate 3 CTAs</option>
        </select>
        <input placeholder="context (paste subject / paragraph / prompt)"
          className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
          value={context} onChange={(e) => setContext(e.target.value)} />
        <button type="button" onClick={run} disabled={loading}
          className="rounded-md border px-3 py-1 text-[10px] font-semibold"
          style={{ background: T.purple, borderColor: T.purple, color: T.panel, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Thinking…" : "Run"}
        </button>
      </div>
      {output ? (
        <div className="mt-2 rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
          <pre className="whitespace-pre-wrap font-mono text-[10.5px]" style={{ color: T.text }}>{output}</pre>
        </div>
      ) : null}
      {note ? <div className="mt-1 text-[9.5px] italic" style={{ color: T.warning }}>{note}</div> : null}
      <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>Variables available: {variables.map((v) => `{{${v.name}}}`).join(" · ")}</div>
    </div>
  );
}

// ── One block card in the canvas ───────────────────────────────────
function BlockCard({
  block, index, total, selected, onSelect, onMove, onDelete, onDuplicate, onChange,
}: {
  block: Block; index: number; total: number; selected: boolean;
  onSelect: () => void; onMove: (dir: -1 | 1) => void; onDelete: () => void;
  onDuplicate: () => void; onChange: (patch: Partial<Block>) => void;
}) {
  return (
    <div onClick={onSelect}
      className="rounded-md border p-2"
      style={{ background: selected ? T.panel : T.panelHi, borderColor: selected ? T.accent : T.border }}>
      <div className="mb-1 flex items-center gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
          style={{ background: `${T.info}20`, color: T.info }}>
          {BLOCK_LABELS[block.type]} · {index + 1}/{total}
        </span>
        <div className="ml-auto flex gap-1">
          <IconBtn label="↑" onClick={(e) => { e.stopPropagation(); onMove(-1); }} disabled={index === 0} />
          <IconBtn label="↓" onClick={(e) => { e.stopPropagation(); onMove(1); }} disabled={index === total - 1} />
          <IconBtn label="⧉" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} />
          <IconBtn label="✕" onClick={(e) => { e.stopPropagation(); onDelete(); }} tone="danger" />
        </div>
      </div>
      <BlockEditor block={block} onChange={onChange} />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, tone }: { label: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="rounded-md border px-1.5 py-0.5 text-[10px]"
      style={{ background: T.panel, borderColor: T.border, color: tone === "danger" ? T.danger : T.textDim, opacity: disabled ? 0.3 : 1 }}>
      {label}
    </button>
  );
}

// ── Per-type editor ────────────────────────────────────────────────
function BlockEditor({ block, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch = onChange as (p: any) => void;
  const inp = (val: string, on: (v: string) => void, placeholder = "") =>
    <input className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
      value={val} onChange={(e) => on(e.target.value)} placeholder={placeholder} />;
  const ta = (val: string, on: (v: string) => void, rows = 3) =>
    <textarea className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle} rows={rows}
      value={val} onChange={(e) => on(e.target.value)} />;

  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 80px 80px" }}>
          {inp(block.text, (v) => patch({ text: v }))}
          <select className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={block.level} onChange={(e) => patch({ level: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
          </select>
          <AlignSelect value={block.align} onChange={(v) => patch({ align: v })} />
        </div>
      );
    case "paragraph":
      return (
        <>
          {ta(block.text, (v) => patch({ text: v }))}
          <div className="mt-1"><AlignSelect value={block.align} onChange={(v) => patch({ align: v })} /></div>
        </>
      );
    case "image":
      return (
        <div className="space-y-1">
          {inp(block.src, (v) => patch({ src: v }), "https://…")}
          {inp(block.alt, (v) => patch({ alt: v }), "Alt text (accessibility)")}
          <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 80px 80px" }}>
            {inp(block.href ?? "", (v) => patch({ href: v || undefined }), "link URL (optional)")}
            <input type="number" className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
              value={block.width_pct ?? 100} onChange={(e) => patch({ width_pct: Number(e.target.value) })} />
            <AlignSelect value={block.align} onChange={(v) => patch({ align: v })} />
          </div>
        </div>
      );
    case "button":
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {inp(block.text, (v) => patch({ text: v }), "Button label")}
          {inp(block.href, (v) => patch({ href: v }), "https://…")}
          <div className="col-span-2 grid gap-1" style={{ gridTemplateColumns: "80px 100px 100px" }}>
            <AlignSelect value={block.align} onChange={(v) => patch({ align: v })} />
            {inp(block.bg ?? "", (v) => patch({ bg: v || undefined }), "bg #1a73e8")}
            {inp(block.color ?? "", (v) => patch({ color: v || undefined }), "text #fff")}
          </div>
        </div>
      );
    case "divider":
      return <div className="max-w-[160px]">{inp(block.color ?? "", (v) => patch({ color: v || undefined }), "colour #e5e7eb")}</div>;
    case "spacer":
      return (
        <div className="max-w-[160px]">
          <input type="number" className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={block.height} onChange={(e) => patch({ height: Number(e.target.value) })} />
        </div>
      );
    case "hero":
      return (
        <div className="space-y-1">
          {inp(block.heading, (v) => patch({ heading: v }), "Heading")}
          {inp(block.subheading ?? "", (v) => patch({ subheading: v || undefined }), "Subheading (optional)")}
          {inp(block.src ?? "", (v) => patch({ src: v || undefined }), "hero image URL (optional)")}
          <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr 120px" }}>
            {inp(block.cta_text ?? "", (v) => patch({ cta_text: v || undefined }), "CTA text")}
            {inp(block.cta_href ?? "", (v) => patch({ cta_href: v || undefined }), "CTA href")}
            {inp(block.bg ?? "", (v) => patch({ bg: v || undefined }), "bg #0f172a")}
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="space-y-1">
          {inp(block.heading, (v) => patch({ heading: v }), "Heading")}
          {ta(block.body ?? "", (v) => patch({ body: v || undefined }), 2)}
          <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {inp(block.cta_text, (v) => patch({ cta_text: v }), "CTA text")}
            {inp(block.cta_href, (v) => patch({ cta_href: v }), "CTA href")}
          </div>
        </div>
      );
    case "feature_grid":
      return (
        <div className="space-y-1">
          {block.features.map((f, i) => (
            <div key={i} className="grid gap-1" style={{ gridTemplateColumns: "40px 150px 1fr auto" }}>
              {inp(f.icon ?? "", (v) => patch({ features: block.features.map((x, j) => j === i ? { ...x, icon: v || undefined } : x) }), "icon")}
              {inp(f.title, (v) => patch({ features: block.features.map((x, j) => j === i ? { ...x, title: v } : x) }), "title")}
              {inp(f.body, (v) => patch({ features: block.features.map((x, j) => j === i ? { ...x, body: v } : x) }), "body")}
              <button type="button" onClick={() => patch({ features: block.features.filter((_, j) => j !== i) })}
                className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => patch({ features: [...block.features, { title: "New feature", body: "Description" }] })}
            className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panelHi, borderColor: T.border, color: T.info }}>+ feature</button>
        </div>
      );
    case "gallery":
      return (
        <div className="space-y-1">
          {block.items.map((it, i) => (
            <div key={i} className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
              {inp(it.src, (v) => patch({ items: block.items.map((x, j) => j === i ? { ...x, src: v } : x) }), "image URL")}
              {inp(it.alt, (v) => patch({ items: block.items.map((x, j) => j === i ? { ...x, alt: v } : x) }), "alt")}
              {inp(it.href ?? "", (v) => patch({ items: block.items.map((x, j) => j === i ? { ...x, href: v || undefined } : x) }), "link (optional)")}
              <button type="button" onClick={() => patch({ items: block.items.filter((_, j) => j !== i) })}
                className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => patch({ items: [...block.items, { src: "", alt: "" }] })}
            className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panelHi, borderColor: T.border, color: T.info }}>+ image</button>
        </div>
      );
    case "signature":
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {inp(block.name, (v) => patch({ name: v }), "Name")}
          {inp(block.role ?? "", (v) => patch({ role: v || undefined }), "Role")}
          {inp(block.company ?? "", (v) => patch({ company: v || undefined }), "Company")}
          {inp(block.email ?? "", (v) => patch({ email: v || undefined }), "Email")}
          {inp(block.phone ?? "", (v) => patch({ phone: v || undefined }), "Phone")}
          {inp(block.photo_src ?? "", (v) => patch({ photo_src: v || undefined }), "Photo URL")}
        </div>
      );
    case "footer":
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {inp(block.company, (v) => patch({ company: v }), "Company")}
          {inp(block.address ?? "", (v) => patch({ address: v || undefined }), "Address (optional)")}
          {inp(block.unsubscribe_text ?? "", (v) => patch({ unsubscribe_text: v || undefined }), "Unsubscribe text")}
        </div>
      );
    case "social_links":
      return (
        <div className="space-y-1">
          {block.links.map((l, i) => (
            <div key={i} className="grid gap-1" style={{ gridTemplateColumns: "120px 1fr 1fr auto" }}>
              <select className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
                value={l.platform} onChange={(e) => patch({ links: block.links.map((x, j) => j === i ? { ...x, platform: e.target.value as typeof l.platform } : x) })}>
                {(["twitter","linkedin","instagram","facebook","youtube","website"] as const).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {inp(l.href, (v) => patch({ links: block.links.map((x, j) => j === i ? { ...x, href: v } : x) }), "https://…")}
              {inp(l.label ?? "", (v) => patch({ links: block.links.map((x, j) => j === i ? { ...x, label: v || undefined } : x) }), "label (optional)")}
              <button type="button" onClick={() => patch({ links: block.links.filter((_, j) => j !== i) })}
                className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => patch({ links: [...block.links, { platform: "website", href: "https://" }] })}
            className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panelHi, borderColor: T.border, color: T.info }}>+ link</button>
        </div>
      );
    case "columns":
      return <div className="text-[10.5px] italic" style={{ color: T.textFade }}>Columns · nested-block editor arrives in Phase 4c.2 · today shows a placeholder in preview.</div>;
  }
}

function AlignSelect({ value, onChange }: { value?: BlockAlign; onChange: (v: BlockAlign) => void }) {
  return (
    <select className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
      value={value ?? "left"} onChange={(e) => onChange(e.target.value as BlockAlign)}>
      <option value="left">left</option><option value="center">center</option><option value="right">right</option>
    </select>
  );
}

// Wrap rendered HTML with a body-level dark-mode inversion for preview
function wrapDark(html: string): string {
  return html.replace("</head>", `<style>body{background:#0a0a0a !important;} table{background:#0a0a0a !important;} table[width="600"]{background:#12161c !important;color:#e5e9ef !important;} div{color:inherit !important;}</style></head>`);
}

// Insert {{var}} into the selected block's first text-like field
function insertVariableIntoSelected(varName: string, selectedBlockId: string | null, blocks: Block[], onChange: (bs: Block[]) => void) {
  const token = `{{${varName}}}`;
  if (!selectedBlockId) {
    void navigator.clipboard.writeText(token).catch(() => { /* clipboard unavailable */ });
    return;
  }
  const next = blocks.map((b) => {
    if (b.id !== selectedBlockId) return b;
    switch (b.type) {
      case "heading":
      case "paragraph":    return { ...b, text: (b.text ?? "") + " " + token } as Block;
      case "button":       return { ...b, text: (b.text ?? "") + " " + token } as Block;
      case "hero":         return { ...b, heading: (b.heading ?? "") + " " + token } as Block;
      case "cta":          return { ...b, heading: (b.heading ?? "") + " " + token } as Block;
      case "signature":    return { ...b, name: (b.name ?? "") + " " + token } as Block;
      case "footer":       return { ...b, company: (b.company ?? "") + " " + token } as Block;
      default:             return b;
    }
  });
  onChange(next);
}
