"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  brain_slug: string;
  computed_at: string;
  questions_learned: number;
  knowledge_nodes: number;
  expert_observations: number;
  vision_rules: number;
  estimation_rules: number;
  regulations_captured: number;
  materials_captured: number;
  workflow_playbooks: number;
  defects_captured: number;
  craft_facts_in_draft: number;
  author_approved_total: number;
  admin_approved_total: number;
  admin_pending_review: number;
  admin_rejected_total: number;
  admin_sent_back_total: number;
  admin_changes_requested: number;
  admin_merged_total: number;
  confidence_pct: number | null;
  brain_coverage_pct: number;
  faqs: number | null;
  knowledge_graph_links: number | null;
};

export function BrainStatsPanel({ slug, authorId }: { slug: string; authorId: string }) {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/authors/brains/${slug}/stats`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setStatus("error");
          setError(json.detail ?? json.error ?? `HTTP ${res.status}`);
          return;
        }
        setStats(json.stats);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [slug]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Brain Growth · {slug}</h1>
          <p className="text-xs text-[#0A0A0A]/60">Author: {authorId}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/authors/brains/${slug}/extract`} className="text-xs underline">Teach Nex</Link>
          <Link href={`/authors/brains/${slug}/edit`} className="text-xs underline">Refine in editor</Link>
          <Link href="/authors/dashboard" className="text-xs underline">Dashboard</Link>
        </div>
      </div>

      {status === "loading" && <p className="text-sm text-[#0A0A0A]/60">Loading...</p>}
      {status === "error" && <p className="text-xs text-red-700">{error}</p>}
      {stats && (
        <>
          <p className="text-xs text-[#0A0A0A]/60">
            Snapshot as of {stats.computed_at.slice(0, 16)}. Numbers grow as you Teach Nex and as the Administrator approves candidates.
          </p>

          <Section title="Volume">
            <StatTile label="Questions Learned" value={stats.questions_learned} note="extraction runs" />
            <StatTile label="Knowledge Nodes"   value={stats.knowledge_nodes}   note="Author accepted" />
            <StatTile label="Expert Observations" value={stats.expert_observations} note="craft facts accepted" />
            <StatTile label="Vision Rules"      value={stats.vision_rules}      note="defects with vision hints" />
            <StatTile label="Estimation Rules"  value={stats.estimation_rules}  note="pricing rules in draft" />
          </Section>

          <Section title="Module coverage">
            <StatTile label="Craft facts (draft)" value={stats.craft_facts_in_draft} />
            <StatTile label="Regulations"         value={stats.regulations_captured} />
            <StatTile label="Materials"           value={stats.materials_captured} />
            <StatTile label="Workflow playbooks"  value={stats.workflow_playbooks} />
            <StatTile label="Defects"             value={stats.defects_captured} />
          </Section>

          <Section title="Governance">
            <StatTile label="Author approved"    value={stats.author_approved_total} accent="green" />
            <StatTile label="Admin approved"     value={stats.admin_approved_total}  accent="green" />
            <StatTile label="Pending Admin review" value={stats.admin_pending_review} accent="amber" />
            <StatTile label="Admin rejected"     value={stats.admin_rejected_total}  accent="red" />
            <StatTile label="Changes requested"  value={stats.admin_changes_requested} accent="amber" />
            <StatTile label="Sent back to Author" value={stats.admin_sent_back_total} accent="amber" />
            <StatTile label="Merged with existing" value={stats.admin_merged_total} />
          </Section>

          <Section title="Quality">
            <StatTile
              label="Confidence"
              value={stats.confidence_pct == null ? "—" : `${stats.confidence_pct}%`}
              note={stats.confidence_pct == null ? "no items rated yet" : "weighted average across draft items"}
            />
            <StatTile
              label="Brain Coverage"
              value={`${stats.brain_coverage_pct}%`}
              note="V1 modules present in manifest"
            />
          </Section>

          <Section title="Not yet tracked (surfaced honestly)">
            <StatTile label="FAQs" value="—" note="FAQ is not yet a first-class Brain schema type" />
            <StatTile label="Knowledge Graph Links" value="—" note="per-node graph edges not yet tracked" />
          </Section>

          <p className="pt-4 text-xs text-[#0A0A0A]/50">
            All numbers are computed live from your draft state + extraction history. Nothing is fabricated — placeholders show as em dashes.
          </p>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#0A0A0A]/60">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>
    </section>
  );
}

type Accent = "green" | "amber" | "red" | undefined;
function StatTile({ label, value, note, accent }: { label: string; value: number | string; note?: string; accent?: Accent }) {
  const bg =
    accent === "green" ? "bg-green-50 border-green-200"
    : accent === "amber" ? "bg-amber-50 border-amber-200"
    : accent === "red"   ? "bg-red-50 border-red-200"
    : "bg-white border-[#0A0A0A]/10";
  return (
    <div className={`rounded border ${bg} p-3`}>
      <div className="text-[10px] font-medium uppercase text-[#0A0A0A]/60">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{value}</div>
      {note && <div className="mt-1 text-[10px] text-[#0A0A0A]/50">{note}</div>}
    </div>
  );
}
