"use client";

// TemplatePickerModal — Step 2 of the App Builder flow.
//
// Two paths, one modal:
//   1. Browse — grid of templates filtered by trade / tone / length.
//   2. Match a reference — upload a screenshot; Opus 4.7 vision extracts
//      signals; top 5 gallery matches come back with reasons.
//
// Result: user clicks "Use this template" → the templateId gets returned
// to the shell which seeds the pipeline. Skip returns null.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  X, Upload, Search, Filter, Sparkles, Loader2, Wand2, ImagePlus, Check
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER } from "@/lib/brand/tokens";

type Template = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bestForTrades: readonly string[];
  outcomes: readonly string[];
  tone: string;
  length: string;
  homeSectionCount: number;
  thumbnailUrl: string | null;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
};

type Match = {
  templateId: string;
  template: Template;
  score: number;
  reasons: string[];
};

type Props = {
  open: boolean;
  tradeSlug: string;
  onSelect: (templateId: string | null) => void;
  onSkip: () => void;
};

const TONES = [
  "trades-native", "professional", "premium", "editorial",
  "bold", "friendly", "urgent", "documentary"
] as const;

const LENGTHS = ["short", "medium", "long"] as const;

export function TemplatePickerModal({
  open,
  tradeSlug,
  onSelect,
  onSkip
}: Props): JSX.Element | null {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"browse" | "match">("browse");
  const [query, setQuery] = useState("");
  const [toneFilter, setToneFilter] = useState<string>("");
  const [lengthFilter, setLengthFilter] = useState<string>("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/studio/templates?trade=${encodeURIComponent(tradeSlug)}`)
      .then((r) => r.json())
      .then((json: { ok: boolean; templates: Template[] }) => {
        if (json.ok) setTemplates(json.templates);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [open, tradeSlug]);

  const filtered = useMemo(() => {
    return templates
      .filter((t) => !toneFilter || t.tone === toneFilter)
      .filter((t) => !lengthFilter || t.length === lengthFilter)
      .filter((t) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.tagline.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      });
  }, [templates, toneFilter, lengthFilter, query]);

  const onReferenceUpload = async (file: File) => {
    setMatchLoading(true);
    setMatchError(null);
    setMatches([]);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setReferenceImage(dataUrl);
      // Extract base64 from data URL
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
          matches?: Match[];
          error?: string;
        };
        if (!json.ok) {
          setMatchError(json.error ?? "Matcher failed");
        } else {
          setMatches(json.matches ?? []);
        }
      } catch (e) {
        setMatchError(`Network: ${(e as Error).message}`);
      } finally {
        setMatchLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <header
          className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-slate-200 px-5"
          style={{ backgroundColor: BRAND_BLACK, color: "white" }}
        >
          <Sparkles size={18} color={BRAND_YELLOW} />
          <div className="text-[16px] font-bold">Pick a template</div>
          <div className="text-[12px] text-slate-400">
            {templates.length} in gallery{tradeSlug ? ` for ${tradeSlug}` : ""}
          </div>

          {/* Mode toggle */}
          <div className="ml-6 flex overflow-hidden rounded-md">
            <button
              onClick={() => setMode("browse")}
              className="flex h-8 items-center gap-1 px-3 text-[12px] font-semibold"
              style={
                mode === "browse"
                  ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }
                  : { backgroundColor: "rgba(255,255,255,0.1)", color: "white" }
              }
            >
              <Filter size={12} />
              Browse
            </button>
            <button
              onClick={() => setMode("match")}
              className="flex h-8 items-center gap-1 border-l border-white/20 px-3 text-[12px] font-semibold"
              style={
                mode === "match"
                  ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }
                  : { backgroundColor: "rgba(255,255,255,0.1)", color: "white" }
              }
            >
              <Wand2 size={12} />
              Match a reference
            </button>
          </div>

          <button
            onClick={onSkip}
            className="ml-auto flex h-8 items-center gap-1 rounded-md border border-white/30 px-3 text-[12px] font-semibold text-white hover:bg-white/10"
          >
            Skip — no template
          </button>
          <button
            onClick={onSkip}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
            aria-label="Close"
          >
            <X size={16} color="white" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {mode === "browse" && (
            <BrowseMode
              loading={loading}
              filtered={filtered}
              query={query}
              onQuery={setQuery}
              toneFilter={toneFilter}
              onTone={setToneFilter}
              lengthFilter={lengthFilter}
              onLength={setLengthFilter}
              onSelect={onSelect}
            />
          )}
          {mode === "match" && (
            <MatchMode
              referenceImage={referenceImage}
              matches={matches}
              loading={matchLoading}
              error={matchError}
              onUpload={onReferenceUpload}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BrowseMode({
  loading, filtered, query, onQuery, toneFilter, onTone,
  lengthFilter, onLength, onSelect
}: {
  loading: boolean;
  filtered: Template[];
  query: string;
  onQuery: (v: string) => void;
  toneFilter: string;
  onTone: (v: string) => void;
  lengthFilter: string;
  onLength: (v: string) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <div>
      {/* Filter bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 h-9 min-w-[200px]">
          <Search size={14} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search templates…"
            className="w-full text-[13px] outline-none"
          />
        </div>
        <select
          value={toneFilter}
          onChange={(e) => onTone(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-[13px]"
        >
          <option value="">Any tone</option>
          {TONES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={lengthFilter}
          onChange={(e) => onLength(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-[13px]"
        >
          <option value="">Any length</option>
          {LENGTHS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <div className="ml-auto text-[12px] font-semibold text-slate-500">
          {filtered.length} shown
        </div>
      </div>

      {/* Grid */}
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-[13px] text-slate-500">
            No templates match those filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <TemplateCard key={t.id} template={t} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
  match
}: {
  template: Template;
  onSelect: (id: string) => void;
  match?: { score: number; reasons: string[] };
}): JSX.Element {
  return (
    <button
      onClick={() => onSelect(template.id)}
      className="group flex flex-col overflow-hidden rounded-lg border-2 border-slate-200 bg-white text-left transition hover:border-slate-900 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
        {template.thumbnailUrl ? (
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url('${template.thumbnailUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : template.palette ? (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${template.palette.primary} 0%, ${template.palette.secondary} 60%, ${template.palette.accent} 100%)`
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <ImagePlus size={32} />
          </div>
        )}

        {/* Tone + length pills */}
        <div className="absolute left-2 top-2 flex gap-1">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            {template.tone}
          </span>
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: BRAND_AMBER }}
          >
            {template.length}
          </span>
        </div>

        {/* Match score badge */}
        {match && (
          <div
            className="absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            Match {match.score}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1 p-3">
        <div className="text-[14px] font-bold text-slate-900">{template.name}</div>
        <div className="text-[12px] leading-relaxed text-slate-600">{template.tagline}</div>
        {match && match.reasons.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {match.reasons.slice(0, 3).map((r) => (
              <span
                key={r}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
              >
                {r}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {template.homeSectionCount} sections
          </div>
          <span
            className="rounded-md px-2 py-1 text-[12px] font-bold opacity-0 transition group-hover:opacity-100"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            Use this →
          </span>
        </div>
      </div>
    </button>
  );
}

function MatchMode({
  referenceImage, matches, loading, error, onUpload, onSelect
}: {
  referenceImage: string | null;
  matches: Match[];
  loading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <Wand2 size={16} color={BRAND_AMBER} />
          <div className="text-[16px] font-bold text-slate-900">
            Got a look you like?
          </div>
        </div>
        <div className="mb-6 text-[13px] leading-relaxed text-slate-700">
          Upload a screenshot of any landing page — a competitor, Pinterest, Loveable, Framer — and I'll match it to the top 5 templates in your gallery.
        </div>

        {/* Upload zone */}
        {!referenceImage && (
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 hover:border-slate-900 hover:bg-slate-100"
          >
            <Upload size={28} className="text-slate-500" />
            <div className="text-[14px] font-semibold text-slate-900">Upload a reference image</div>
            <div className="text-[12px] text-slate-500">PNG or JPG — screenshots are perfect</div>
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

        {referenceImage && (
          <div className="mb-6 flex items-start gap-4">
            <div
              className="h-40 w-40 flex-shrink-0 rounded-md border border-slate-200 bg-slate-100"
              style={{
                backgroundImage: `url('${referenceImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            />
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Your reference
              </div>
              <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-slate-700 hover:underline">
                <Upload size={12} />
                Replace
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
              {loading && (
                <div className="mt-3 flex items-center gap-2 text-[13px] text-slate-600">
                  <Loader2 size={14} className="animate-spin" />
                  Analysing your reference…
                </div>
              )}
              {error && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Check size={14} color="#10B981" />
              <div className="text-[14px] font-bold text-slate-900">
                Top {matches.length} matches
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <TemplateCard
                  key={m.templateId}
                  template={m.template}
                  onSelect={onSelect}
                  match={{ score: m.score, reasons: m.reasons }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
