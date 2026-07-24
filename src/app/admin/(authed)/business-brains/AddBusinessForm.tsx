"use client";

// Small form on the Business Brains dashboard for registering a new
// business + brain. Everything except name + domain is optional.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_OPTIONS = [
  { value: "",                   label: "— category —" },
  { value: "staircase_maker",    label: "Staircase maker" },
  { value: "parts_supplier",     label: "Parts supplier" },
  { value: "builders_merchant",  label: "Builders' merchant" },
  { value: "diy_retailer",       label: "DIY retailer" },
  { value: "wood_supplier",      label: "Wood supplier" },
  { value: "timber_importer",    label: "Timber importer" },
  { value: "trade_association",  label: "Trade association" },
  { value: "other",              label: "Other" }
];

const FREQUENCY_OPTIONS = [
  { value: "manual",  label: "Manual only" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" }
];

export default function AddBusinessForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [crawlRoot, setCrawlRoot] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/business-brains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:            name.trim(),
        primary_domain:  domain.trim(),
        category_slug:   category || null,
        sync_frequency:  frequency,
        crawl_root_url:  crawlRoot.trim() || null
      })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMsg({ ok: false, text: json.error ?? res.statusText });
      return;
    }
    setMsg({ ok: true, text: "Business + brain created" });
    setName(""); setDomain(""); setCategory(""); setFrequency("weekly"); setCrawlRoot("");
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
      >
        + Add business
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Add business</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setMsg(null); }}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Business name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pear Stairs"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Primary domain">
          <input
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="pearstairs.co.uk"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Sync frequency">
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Crawl root URL (optional)" hint="Defaults to https://<domain>/. Override if you want to seed at a subpath.">
          <input
            value={crawlRoot}
            onChange={(e) => setCrawlRoot(e.target.value)}
            placeholder="https://pearstairs.co.uk/"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create business + brain"}
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</span>
        )}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
}
