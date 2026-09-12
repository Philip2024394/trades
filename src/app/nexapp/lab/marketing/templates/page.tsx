"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FounderShell } from "@/components/nex-app/founder-shell/FounderShell";

type Template = {
  template_id: string; slug: string; display_name: string; subject_line: string;
  from_email: string; from_name: string; language: string; updated_at: string;
};

const DEFAULT_MJML = `<mjml>
  <mj-body background-color="#f7f7f7">
    <mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        <mj-image width="120px" src="https://nex.id/logo.png" alt="NEX" />
        <mj-text font-size="20px" font-weight="600" color="#111">Hi {{business_name}},</mj-text>
        <mj-text color="#333">
          Your business appears in the NEX directory for {{city}}. Would you like to claim your listing (free) and unlock analytics?
        </mj-text>
        <mj-button background-color="#10b981" color="#fff" href="{{cta_url}}">Claim your listing</mj-button>
        <mj-text color="#888" font-size="12px" align="center">You can reply STOP or click unsubscribe to stop receiving these emails.</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState("welcome-listing-invite-2026-09");
  const [displayName, setDisplayName] = useState("Welcome · Listing invite · 2026-09");
  const [subjectLine, setSubjectLine] = useState("Your business is in the NEX directory · claim it (free)");
  const [fromEmail, setFromEmail] = useState("hello@nex.id");
  const [fromName, setFromName] = useState("NEX Directory");
  const [replyTo, setReplyTo] = useState("hello@nex.id");
  const [mjmlSource, setMjmlSource] = useState(DEFAULT_MJML);

  const load = useCallback(async () => {
    const r = await fetch("/api/nex/marketing/templates", { cache: "no-store" }).then((x) => x.json());
    if (Array.isArray(r.templates)) setTemplates(r.templates);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null); setPreviewHtml(null);
    try {
      const r = await fetch("/api/nex/marketing/templates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug, display_name: displayName, subject_line: subjectLine,
          from_email: fromEmail, from_name: fromName, reply_to: replyTo,
          mjml_source: mjmlSource, updated_by: "founder",
        }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error ?? "save_failed");
      setMsg(`Saved · compiler=${r.compiler}${r.note ? " · " + r.note : ""}`);
      await load();
      // Fetch the compiled HTML for preview
      const detail = await fetch(`/api/nex/marketing/templates/${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
      if (detail?.html_compiled) setPreviewHtml(detail.html_compiled);
    } catch (e) { setErr(String(e).slice(0, 200)); }
    finally { setBusy(false); }
  };

  const previewSrcDoc = useMemo(() => previewHtml ?? mjmlSource, [previewHtml, mjmlSource]);

  return (
    <FounderShell title="Templates" subtitle="MJML source · compiled to responsive HTML server-side.">

        {/* Existing templates */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Existing ({templates.length})</h2>
          <div className="rounded-lg border border-neutral-800">
            {templates.length === 0 && <div className="p-6 text-center text-sm text-neutral-500">No templates yet.</div>}
            {templates.map((t) => (
              <div key={t.template_id} className="border-b border-neutral-900 p-3 text-sm last:border-0">
                <div className="font-mono text-neutral-200">{t.slug}</div>
                <div className="text-xs text-neutral-500">{t.subject_line}</div>
                <div className="text-xs text-neutral-600">from {t.from_name} &lt;{t.from_email}&gt; · {t.language} · updated {new Date(t.updated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Editor + preview */}
        <section className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Editor</h2>
            <div className="grid grid-cols-2 gap-3">
              <F label="Slug" value={slug} set={setSlug} />
              <F label="Display name" value={displayName} set={setDisplayName} />
              <F label="Subject line" value={subjectLine} set={setSubjectLine} colSpan={2} />
              <F label="From email" value={fromEmail} set={setFromEmail} />
              <F label="From name" value={fromName} set={setFromName} />
              <F label="Reply-to" value={replyTo} set={setReplyTo} colSpan={2} />
            </div>
            <div className="mt-3">
              <label className="text-xs text-neutral-500">MJML source</label>
              <textarea value={mjmlSource} onChange={(e) => setMjmlSource(e.target.value)}
                className="mt-1 h-[400px] w-full rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-xs text-neutral-200" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-neutral-500">Save compiles server-side via mjml → HTML + text fallback.</div>
              <button onClick={save} disabled={busy}
                className="rounded bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy ? "Saving…" : "Save + compile"}
              </button>
            </div>
            {err && <div className="mt-2 text-xs text-rose-400">Error: {err}</div>}
            {msg && <div className="mt-2 text-xs text-emerald-400">{msg}</div>}
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Preview</h2>
            <iframe srcDoc={previewSrcDoc} className="h-[500px] w-full rounded border border-neutral-800 bg-white" title="preview" />
          </div>
        </section>
    </FounderShell>
  );
}

function F({ label, value, set, colSpan }: { label: string; value: string; set: (v: string) => void; colSpan?: number }) {
  return (
    <div style={colSpan ? { gridColumn: `span ${colSpan}` } : undefined}>
      <label className="text-xs text-neutral-500">{label}</label>
      <input value={value} onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-200" />
    </div>
  );
}
