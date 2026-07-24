"use client";

// Knowledge Studio — list + create + edit for the internal team.
// Every save routes through the review queue.

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type EntryRow = {
  id: string; trade: string; topic: string; title: string; summary: string;
  category: string | null; subcategory: string | null; difficulty: string | null;
  confidence: number; version: number; status: string; sources: unknown[]; updated_at: string;
};

export function KnowledgeStudio({ entries, trades, filters }: { entries: EntryRow[]; trades: string[]; filters: { trade: string; status: string; q: string } }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/nex/knowledge">
        <input name="q" defaultValue={filters.q} placeholder="Search knowledge…" className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[13px]"/>
        <select name="trade" defaultValue={filters.trade} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px]">
          <option value="">All trades</option>
          {trades.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="status" defaultValue={filters.status} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px]">
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
          <option value="superseded">Superseded</option>
        </select>
        <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-black text-white">Filter</button>
        <button type="button" onClick={() => setShowCreate(!showCreate)} className="rounded-lg border border-neutral-900 bg-white px-3 py-1.5 text-[12px] font-black text-neutral-900">
          {showCreate ? "Close" : "+ New knowledge"}
        </button>
      </form>

      {showCreate && <CreateForm onDone={() => setShowCreate(false)}/>}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-[12px]">
          <thead className="bg-neutral-50 text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Trade</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Conf.</th>
              <th className="px-3 py-2">v</th>
              <th className="px-3 py-2">Sources</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-neutral-500">No entries match.</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <p className="font-black">{e.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-neutral-500">{e.summary}</p>
                </td>
                <td className="px-3 py-2">{e.trade}</td>
                <td className="px-3 py-2 text-neutral-600">{e.category ?? "—"} · {e.subcategory ?? "—"}</td>
                <td className="px-3 py-2"><ConfBadge n={e.confidence}/></td>
                <td className="px-3 py-2 font-mono">v{e.version}</td>
                <td className="px-3 py-2 text-neutral-600">{(e.sources as unknown[]).length}</td>
                <td className="px-3 py-2 text-[10px] text-neutral-500">{new Date(e.updated_at).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/nex/timeline/${e.id}`} className="text-[11px] font-black text-neutral-900 hover:underline">Timeline →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ConfBadge({ n }: { n: number }) {
  const cls = n >= 90 ? "bg-green-100 text-green-800" : n >= 70 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-black ${cls}`}>{n}%</span>;
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const draft = {
      trade:       String(fd.get("trade") ?? "").trim(),
      topic:       String(fd.get("topic") ?? "").trim(),
      title:       String(fd.get("title") ?? "").trim(),
      summary:     String(fd.get("summary") ?? "").trim(),
      category:    String(fd.get("category") ?? "").trim() || undefined,
      subcategory: String(fd.get("subcategory") ?? "").trim() || undefined,
      difficulty:  (fd.get("difficulty") as string) || "basic",
      keywords:    String(fd.get("keywords") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      sources:     [{ title: String(fd.get("source_title") ?? "").trim() || "Unnamed source", url: String(fd.get("source_url") ?? "").trim() || undefined, kind: "other" as const }],
      evidence:    [],
      confidence:  Number(fd.get("confidence") ?? 90)
    };
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/nex/knowledge/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "create", draft })
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ ok: true, text: `Sent to Review. It goes live once approved.` });
        (e.target as HTMLFormElement).reset();
      } else {
        setMsg({ ok: false, text: json.error ?? "propose_failed" });
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "network_error" });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-neutral-900 bg-white p-4">
      <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">+ New knowledge · not live until approved in Review</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="trade"       label="Trade"        required placeholder="carpentry" />
        <Field name="topic"       label="Topic"        required placeholder="second-fix" />
        <Field name="category"    label="Category"     placeholder="Staircases" />
        <Field name="subcategory" label="Sub-category" placeholder="Rise & Going" />
        <Field name="title"       label="Title"        required placeholder="UK domestic staircase max rise" />
        <FieldSelect name="difficulty" label="Difficulty" options={["basic","intermediate","advanced","expert"]}/>
        <Field className="sm:col-span-2" name="summary" label="Summary (1-3 sentences)" required textarea/>
        <Field className="sm:col-span-2" name="keywords" label="Keywords (comma separated)" placeholder="stairs, riser, going"/>
        <Field name="source_title" label="Primary source title" required placeholder="Approved Doc K (Building Regs)" />
        <Field name="source_url"   label="Source URL"           placeholder="https://" />
        <Field name="confidence"   label="Confidence (0-100)"   placeholder="90" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-black text-white disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin"/> : null} Send to Review
        </button>
        <button type="button" onClick={onDone} className="text-[11px] font-black text-neutral-500">Cancel</button>
        {msg && (
          <span className={"ml-auto inline-flex items-center gap-1 text-[11px] font-black " + (msg.ok ? "text-green-700" : "text-red-700")}>
            {msg.ok ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

function Field({ name, label, placeholder, required, textarea, className }: { name: string; label: string; placeholder?: string; required?: boolean; textarea?: boolean; className?: string }) {
  return (
    <label className={"block " + (className ?? "")}>
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}{required && " *"}</span>
      {textarea
        ? <textarea name={name} required={required} placeholder={placeholder} rows={3} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-[13px]"/>
        : <input   name={name} required={required} placeholder={placeholder}          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"/>}
    </label>
  );
}

function FieldSelect({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</span>
      <select name={name} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[13px]">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
