"use client";

// TemplateAuthoringShell — Phase 3.
//
// Upload a reference image → Opus 4.7 vision extracts signals →
// review the signals + auto-selected closest matching blueprint →
// save the pairing as a new template (persistence lands next turn;
// for now the tool shows the proposal and lets you download the JSON).

import { useState } from "react";
import Link from "next/link";
import {
  Upload, Loader2, Sparkles, ArrowLeft, Download, Wand2, Check
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER } from "@/lib/brand/tokens";

type VisionSignals = {
  tone: string;
  length: "short" | "medium" | "long";
  heroType: string;
  palette: { primary: string; secondary: string; accent: string };
  sections: string[];
  vibe: string;
  confidence: number;
};

type Match = {
  templateId: string;
  score: number;
  reasons: string[];
  template: {
    id: string;
    name: string;
    tagline: string;
    tone: string;
    length: string;
    thumbnailUrl: string | null;
    palette: { primary: string; secondary: string; accent: string } | null;
  };
};

export function TemplateAuthoringShell(): JSX.Element {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<VisionSignals | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateTagline, setNewTemplateTagline] = useState("");

  const onUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    setSignals(null);
    setMatches([]);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setImage(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mimeType = dataUrl.split(":")[1].split(";")[0];
      try {
        const res = await fetch("/api/studio/ai/match-reference", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType })
        });
        const json = (await res.json()) as {
          ok: boolean;
          signals?: VisionSignals;
          matches?: Match[];
          error?: string;
        };
        if (!json.ok) {
          setError(json.error ?? "Extraction failed");
        } else {
          setSignals(json.signals ?? null);
          setMatches(json.matches ?? []);
        }
      } catch (e) {
        setError(`Network: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const exportProposal = () => {
    const proposal = {
      name: newTemplateName || "New Template",
      tagline: newTemplateTagline || signals?.vibe || "",
      referenceSignals: signals,
      basedOn: matches[0]?.templateId ?? null,
      matches,
      createdAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(proposal, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-proposal-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="flex h-14 items-center gap-3 px-4"
        style={{ backgroundColor: BRAND_BLACK, color: "white" }}
      >
        <Link
          href="/studio/build"
          className="flex h-9 items-center gap-1 rounded-md px-2 hover:bg-white/10"
        >
          <ArrowLeft size={14} />
          <span className="text-[13px]">Back to builder</span>
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles size={16} color={BRAND_YELLOW} />
          <div className="text-[14px] font-bold">Template Author</div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            Beta
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-slate-900">
            Turn a reference image into a template
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            Upload any landing page — screenshot, Pinterest pin, competitor site.
            Opus 4.7 vision extracts the structural signals and proposes the closest
            template from your gallery as a seed. Review, name, and save.
          </p>
        </div>

        {/* Upload */}
        {!image && (
          <label className="mb-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 hover:border-slate-900">
            <Upload size={28} className="text-slate-500" />
            <div className="text-[14px] font-semibold text-slate-900">
              Upload a reference image
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>
        )}

        {image && (
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Your reference
              </div>
              <div
                className="aspect-video w-full rounded-md border border-slate-200 bg-slate-100"
                style={{
                  backgroundImage: `url('${image}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              />
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-slate-700 hover:underline">
                <Upload size={12} />
                Replace image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                  }}
                />
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Wand2 size={12} />
                Extracted signals
              </div>
              {busy && (
                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                  <Loader2 size={14} className="animate-spin" />
                  Analysing with Opus 4.7 vision…
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {error}
                </div>
              )}
              {signals && (
                <div className="flex flex-col gap-2 text-[13px]">
                  <SignalRow label="Tone" value={signals.tone} />
                  <SignalRow label="Length" value={signals.length} />
                  <SignalRow label="Hero" value={signals.heroType} />
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Palette
                    </div>
                    <div className="flex gap-2">
                      {[
                        { name: "Primary", value: signals.palette.primary },
                        { name: "Secondary", value: signals.palette.secondary },
                        { name: "Accent", value: signals.palette.accent }
                      ].map((c) => (
                        <div key={c.value} className="flex items-center gap-1.5">
                          <div
                            className="h-6 w-6 rounded border border-slate-300"
                            style={{ backgroundColor: c.value }}
                          />
                          <code className="text-[11px] text-slate-700">{c.value}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Sections
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {signals.sections.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-[12px] italic text-slate-600">"{signals.vibe}"</div>
                  <div className="text-[11px] text-slate-500">
                    Confidence {Math.round(signals.confidence * 100)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Matches */}
        {matches.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Check size={14} color="#10B981" />
              <div className="text-[14px] font-bold text-slate-900">
                Closest existing templates ({matches.length})
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <div key={m.templateId} className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div
                    className="aspect-video w-full"
                    style={{
                      backgroundImage: m.template.thumbnailUrl
                        ? `url('${m.template.thumbnailUrl}')`
                        : m.template.palette
                          ? `linear-gradient(135deg, ${m.template.palette.primary}, ${m.template.palette.secondary})`
                          : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundColor: "#E2E8F0"
                    }}
                  />
                  <div className="p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-[13px] font-bold text-slate-900">{m.template.name}</div>
                      <span
                        className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                      >
                        {m.score}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">{m.template.tagline}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.reasons.slice(0, 2).map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save as new template */}
        {signals && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 text-[14px] font-bold text-slate-900">
              Save this as a new template
            </div>
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Name
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. Craft Portfolio · Editorial"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Tagline
                </label>
                <input
                  type="text"
                  value={newTemplateTagline}
                  onChange={(e) => setNewTemplateTagline(e.target.value)}
                  placeholder="Full-bleed hero, magazine layout, warm palette."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={exportProposal}
                className="flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                <Download size={14} />
                Export proposal JSON
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Persistence to a template registry lands next turn — for now the
              JSON export captures the reference signals + closest blueprint pairing
              so you can review and hand it off for scripted registration.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
