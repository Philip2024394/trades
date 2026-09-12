"use client";

import { useCallback, useEffect, useState } from "react";
import { FounderShell } from "@/components/nex-app/founder-shell/FounderShell";

type Template = { template_id: string; slug: string; display_name: string; subject_line: string };
type Segment = { segment_id: string; slug: string; display_name: string; last_computed_count: number | null; category_group?: string; country?: string };
type Campaign = {
  campaign_id: string; slug: string; display_name: string; status: string;
  target_count: number | null; send_count: number; fail_count: number;
  opened_count: number; clicked_count: number; bounced_count: number; complained_count: number;
  proposed_at: string; started_at: string | null; template_slug: string; segment_slug: string;
};

export default function CampaignsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasPolicy, setHasPolicy] = useState<boolean | null>(null);

  // New segment
  const [segSlug, setSegSlug] = useState("indonesia-accommodation");
  const [segName, setSegName] = useState("Indonesia accommodation");
  const [segCountry, setSegCountry] = useState("ID");
  const [segCategory, setSegCategory] = useState("accommodation");

  // New campaign
  const [camSlug, setCamSlug] = useState("first-invite-2026-09");
  const [camName, setCamName] = useState("First invite · 2026-09");
  const [pickedTemplate, setPickedTemplate] = useState<string>("");
  const [pickedSegment, setPickedSegment] = useState<string>("");

  const load = useCallback(async () => {
    const [t, s, c, p] = await Promise.all([
      fetch("/api/nex/marketing/templates", { cache: "no-store" }).then((x) => x.json()),
      fetch("/api/nex/marketing/segments", { cache: "no-store" }).then((x) => x.json()),
      fetch("/api/nex/marketing/campaigns", { cache: "no-store" }).then((x) => x.json()),
      fetch("/api/nex/marketing/policies?subsystem=marketing_email", { cache: "no-store" }).then((x) => x.json()),
    ]);
    setTemplates(t.templates ?? []);
    setSegments(s.segments ?? []);
    setCampaigns(c.campaigns ?? []);
    setHasPolicy((p.policies ?? []).some((pp: { active: boolean; action_kind: string; revoked_at: string | null }) => pp.active && !pp.revoked_at && pp.action_kind === "send_email"));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const createSegment = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/nex/marketing/segments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: segSlug, display_name: segName, country: segCountry, category_group: segCategory }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error ?? "failed");
      setMsg(`Segment created · ${r.count} contacts match`);
      await load();
    } catch (e) { setErr(String(e).slice(0, 200)); }
    finally { setBusy(false); }
  };

  const createCampaign = async () => {
    if (!pickedTemplate || !pickedSegment) { setErr("Pick a template AND a segment first"); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/nex/marketing/campaigns", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: camSlug, display_name: camName, template_id: pickedTemplate, segment_id: pickedSegment }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error ?? "failed");
      setMsg(`Draft campaign created · ${String(r.campaign_id).slice(0, 8)}`);
      await load();
    } catch (e) { setErr(String(e).slice(0, 200)); }
    finally { setBusy(false); }
  };

  const approveCampaign = async (campaign_id: string) => {
    if (!hasPolicy) { setErr("No active marketing_email policy · authorize one first"); return; }
    if (!confirm("Approve + queue this campaign? Sender daemon will start dispatching under active policy limits.")) return;
    const r = await fetch("/api/nex/marketing/campaigns", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaign_id, approved_by: "founder" }),
    }).then((x) => x.json());
    if (r.ok) { setMsg(`Queued ${r.queued} sends under policy(ies): ${(r.policy_gate_active ?? []).join(", ")}`); await load(); }
    else setErr(r.error ?? "approve_failed");
  };

  return (
    <FounderShell title="Campaigns" subtitle="Combine a template + segment. Approval queues the sends. Sender daemon dispatches under the active policy.">

        {/* Policy status */}
        <div className={`mt-4 rounded-lg border p-3 text-xs ${hasPolicy ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
          {hasPolicy === null ? "Checking policy…" : hasPolicy ? "✓ Active marketing_email policy present · campaigns can be approved" : "⚠ No active policy · go to Policies to authorize one before approving campaigns"}
        </div>

        {/* Existing campaigns */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Campaigns ({campaigns.length})</h2>
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <table className="w-full text-xs">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr><th className="px-3 py-2 text-left font-normal">Slug</th><th className="px-3 py-2 text-left font-normal">Template</th><th className="px-3 py-2 text-left font-normal">Segment</th><th className="px-3 py-2 text-left font-normal">Status</th><th className="px-3 py-2 text-right font-normal">Target</th><th className="px-3 py-2 text-right font-normal">Sent</th><th className="px-3 py-2 text-right font-normal">Open</th><th className="px-3 py-2 text-right font-normal">Bounce</th><th></th></tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-t border-neutral-900">
                    <td className="px-3 py-1.5 font-mono">{c.slug}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{c.template_slug}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{c.segment_slug}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-2 py-0.5 ${c.status === "draft" ? "bg-neutral-800 text-neutral-400" : c.status === "sending" ? "bg-amber-500/20 text-amber-300" : c.status === "sent" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{c.status}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{c.target_count ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{c.send_count}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{c.opened_count}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{c.bounced_count}</td>
                    <td className="px-3 py-1.5 text-right">
                      {c.status === "draft" && (
                        <button onClick={() => approveCampaign(c.campaign_id)}
                          className="rounded border border-emerald-500/40 px-2 py-0.5 text-emerald-300 hover:bg-emerald-500/10">Approve + queue</button>
                      )}
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-500">No campaigns yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Create segment + create campaign side-by-side */}
        <section className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Create segment ({segments.length} saved)</h2>
            <F label="Slug" value={segSlug} set={setSegSlug} />
            <F label="Display name" value={segName} set={setSegName} />
            <div className="grid grid-cols-2 gap-3">
              <F label="Country" value={segCountry} set={setSegCountry} />
              <F label="Category group" value={segCategory} set={setSegCategory} />
            </div>
            <button onClick={createSegment} disabled={busy}
              className="mt-3 w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
              {busy ? "Saving…" : "Save segment"}
            </button>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-neutral-500">Existing segments</summary>
              <div className="mt-2 space-y-1">
                {segments.map((s) => <div key={s.segment_id} className="font-mono text-neutral-400">{s.slug} · {s.last_computed_count ?? "?"} contacts</div>)}
              </div>
            </details>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Create campaign draft</h2>
            <F label="Slug" value={camSlug} set={setCamSlug} />
            <F label="Display name" value={camName} set={setCamName} />
            <div>
              <label className="text-xs text-neutral-500">Template</label>
              <select value={pickedTemplate} onChange={(e) => setPickedTemplate(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-200">
                <option value="">Pick a template…</option>
                {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.slug}</option>)}
              </select>
            </div>
            <div className="mt-2">
              <label className="text-xs text-neutral-500">Segment</label>
              <select value={pickedSegment} onChange={(e) => setPickedSegment(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-200">
                <option value="">Pick a segment…</option>
                {segments.map((s) => <option key={s.segment_id} value={s.segment_id}>{s.slug} ({s.last_computed_count ?? "?"})</option>)}
              </select>
            </div>
            <button onClick={createCampaign} disabled={busy}
              className="mt-3 w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
              {busy ? "Creating…" : "Create draft"}
            </button>
          </div>
        </section>

        {err && <div className="mt-4 text-xs text-rose-400">Error: {err}</div>}
        {msg && <div className="mt-4 text-xs text-emerald-400">{msg}</div>}
    </FounderShell>
  );
}

function F({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <div className="mb-2">
      <label className="text-xs text-neutral-500">{label}</label>
      <input value={value} onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-200" />
    </div>
  );
}
