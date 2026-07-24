"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CraftEditor } from "./editors/CraftEditor";
import { RegulationsEditor } from "./editors/RegulationsEditor";
import { MaterialsEditor } from "./editors/MaterialsEditor";
import { WorkflowEditor } from "./editors/WorkflowEditor";
import { DefectsEditor } from "./editors/DefectsEditor";
import { PricingModelEditor } from "./editors/PricingModelEditor";
import { ManifestEditor } from "./editors/ManifestEditor";

const MODULE_TABS = [
  { id: "manifest",      label: "Manifest"       },
  { id: "craft",         label: "Craft"          },
  { id: "regulations",   label: "Regulations"    },
  { id: "materials",     label: "Materials"      },
  { id: "workflow",      label: "Workflow"       },
  { id: "defects",       label: "Defects"        },
  { id: "pricing_model", label: "Pricing Model"  }
] as const;

type ModuleId = typeof MODULE_TABS[number]["id"];

type Props = { slug: string; authorId: string };

export function BrainEditor({ slug, authorId }: Props) {
  const [active, setActive]         = useState<ModuleId>("manifest");
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  async function preview() {
    setPreviewMsg("Building preview...");
    const res = await fetch(`/api/authors/brains/${slug}/preview`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) { setPreviewMsg(`Preview failed: ${json.detail ?? json.error}`); return; }
    setPreviewMsg(`Preview OK — ${JSON.stringify(json.counts)}`);
  }

  async function submitForReview() {
    setPublishMsg("Submitting for Panel review...");
    const res  = await fetch(`/api/authors/brains/${slug}/publish`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) { setPublishMsg(`Submission failed: ${json.detail ?? json.error}`); return; }
    setPublishMsg(json.note ?? "Submitted.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Brain editor · {slug}</h1>
          <p className="text-xs text-[#0A0A0A]/60">Author: {authorId}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/authors/brains/${slug}/extract`}
            className="rounded bg-[#166534] px-3 py-1.5 text-xs font-medium text-white"
          >
            Teach Nex
          </Link>
          <Link href={`/authors/brains/${slug}/stats`} className="text-xs underline">Growth</Link>
          <Link href="/authors/dashboard" className="text-xs underline">Back to dashboard</Link>
        </div>
      </div>

      <div className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3 text-xs text-[#0A0A0A]/70">
        This editor is for <strong>refinement</strong>. The primary workflow is{" "}
        <Link href={`/authors/brains/${slug}/extract`} className="underline font-medium">Teach Nex</Link>
        {" "}— paste your raw knowledge and review the candidates Nex proposes. Come back here to polish wording, add missing citations, or add facts that didn&apos;t emerge from extraction.
      </div>

      <nav className="flex flex-wrap gap-1">
        {MODULE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={
              "rounded px-3 py-1.5 text-xs font-medium " +
              (active === tab.id ? "bg-[#0A0A0A] text-white" : "bg-white text-[#0A0A0A] border border-[#0A0A0A]/10")
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="rounded border border-[#0A0A0A]/10 bg-white p-4">
        {active === "manifest"      && <ManifestEditor      slug={slug} authorId={authorId} />}
        {active === "craft"         && <CraftEditor         slug={slug} />}
        {active === "regulations"   && <RegulationsEditor   slug={slug} />}
        {active === "materials"     && <MaterialsEditor     slug={slug} />}
        {active === "workflow"      && <WorkflowEditor      slug={slug} />}
        {active === "defects"       && <DefectsEditor       slug={slug} />}
        {active === "pricing_model" && <PricingModelEditor  slug={slug} />}
      </section>

      <section className="flex flex-wrap items-center gap-2 pt-2">
        <button onClick={preview} className="rounded bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-white">
          Run boot-audit preview
        </button>
        <button onClick={submitForReview} className="rounded bg-[#166534] px-4 py-2 text-xs font-medium text-white">
          Submit for Panel review
        </button>
        {previewMsg && <span className="text-xs text-[#0A0A0A]/70">{previewMsg}</span>}
        {publishMsg && <span className="text-xs text-[#0A0A0A]/70">{publishMsg}</span>}
      </section>

      <p className="pt-4 text-xs text-[#0A0A0A]/50">
        Studio never displays JSON to you. Every field is validated in the background. Boot-audit preview confirms your Brain passes the substrate loader.
      </p>
    </div>
  );
}
