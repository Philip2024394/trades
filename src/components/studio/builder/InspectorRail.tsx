"use client";

// InspectorRail — right-side contextual editor.
//
// Wakes up when the user toggles Inspector mode in the shell header.
// Listens to `inspector:select` messages from the preview iframe and
// routes to the right inspector for the selected element type.
//
// Slice 1: Button + Hero inspectors. Text / Image / Section land in
// the follow-up turn.

import { useEffect, useState } from "react";
import {
  X,
  Palette,
  Upload,
  ImageIcon,
  Sparkles,
  MousePointer,
  Type,
  Wand2,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight
} from "lucide-react";
import type { InspectorSelection } from "@/lib/studio/ai/inspectorBus";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER } from "@/lib/brand/tokens";

type HeroCandidate = {
  id: string;
  imageUrl: string;
  subject: string;
  score: number;
};

type Props = {
  open: boolean;
  selection: InspectorSelection | null;
  heroCandidates: readonly HeroCandidate[];
  currentHeroImage: string | null;
  onClose: () => void;
  onApplyButtonColor: (scope: "this" | "all" | "theme", color: string) => void;
  onApplyHero: (imageUrl: string) => void;
  onApplyText: (patch: TextPatch) => void;
  onApplyImage: (patch: { role: string; imageUrl: string }) => void;
};

export type TextPatch = {
  /** Which text element to update — matched by the target's role. */
  targetRole?: string;
  content?: string;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  weight?: 400 | 500 | 600 | 700 | 800;
  color?: string;
  align?: "left" | "center" | "right";
};

const PRESET_BUTTON_COLORS = [
  { name: "Yellow (brand)", value: BRAND_YELLOW },
  { name: "Black", value: BRAND_BLACK },
  { name: "Amber", value: BRAND_AMBER },
  { name: "Green", value: "#10B981" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Red", value: "#DC2626" },
  { name: "White", value: "#FFFFFF" }
];

export function InspectorRail({
  open,
  selection,
  heroCandidates,
  currentHeroImage,
  onClose,
  onApplyButtonColor,
  onApplyHero,
  onApplyText,
  onApplyImage
}: Props): JSX.Element | null {
  if (!open) return null;

  return (
    <aside className="flex w-[340px] flex-shrink-0 flex-col border-l border-slate-200 bg-white">
      <header
        className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-200 px-3"
        style={{ backgroundColor: BRAND_BLACK, color: "white" }}
      >
        <MousePointer size={14} color={BRAND_YELLOW} />
        <div className="text-[13px] font-semibold">Inspector</div>
        {selection && (
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            {selection.kind}
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
          aria-label="Close Inspector"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {!selection && <EmptyState />}
        {selection?.kind === "button" && (
          <ButtonInspector
            selection={selection}
            onApply={onApplyButtonColor}
          />
        )}
        {selection?.kind === "hero" && (
          <HeroInspector
            currentImage={currentHeroImage}
            candidates={heroCandidates}
            onApply={onApplyHero}
          />
        )}
        {selection?.kind === "text" && (
          <TextInspector selection={selection} onApply={onApplyText} />
        )}
        {selection?.kind === "image" && (
          <ImageInspector selection={selection} onApply={onApplyImage} />
        )}
        {selection &&
          selection.kind !== "button" &&
          selection.kind !== "hero" &&
          selection.kind !== "text" &&
          selection.kind !== "image" && (
            <GenericState kind={selection.kind} label={selection.label} />
          )}
      </div>
    </aside>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_BLACK }}
      >
        <Sparkles size={22} color={BRAND_YELLOW} />
      </div>
      <div className="text-[14px] font-semibold text-slate-900">
        Click anything on the preview
      </div>
      <div className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-slate-600">
        Every glowing element is editable — buttons, hero, sections. Click one and its controls will land here.
      </div>
    </div>
  );
}

function GenericState({
  kind,
  label
}: {
  kind: string;
  label: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {kind}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-slate-900">{label}</div>
      <div className="mt-2 text-[12px] text-slate-600">
        Editor for this element type lands next turn.
      </div>
    </div>
  );
}

function ButtonInspector({
  selection,
  onApply
}: {
  selection: InspectorSelection;
  onApply: (scope: "this" | "all" | "theme", color: string) => void;
}): JSX.Element {
  const [color, setColor] = useState(BRAND_YELLOW);
  const [scope, setScope] = useState<"this" | "all" | "theme">("this");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Selected
        </div>
        <div className="text-[14px] font-semibold text-slate-900">{selection.label}</div>
      </div>

      {/* Preset colour circles */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Palette size={12} />
          Colour
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_BUTTON_COLORS.map((c) => {
            const isActive = color.toLowerCase() === c.value.toLowerCase();
            return (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition"
                style={{
                  backgroundColor: c.value,
                  borderColor: isActive ? BRAND_BLACK : "transparent"
                }}
                aria-label={c.name}
                title={c.name}
              />
            );
          })}
          {/* Custom colour picker */}
          <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-[10px] font-bold text-slate-500 hover:border-slate-600">
            +
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
        </div>
      </div>

      {/* Apply scope */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Apply to
        </div>
        <div className="flex flex-col gap-1.5">
          {(
            [
              { id: "this", label: "This button only" },
              { id: "all", label: "All buttons on this page" },
              { id: "theme", label: "Set as theme accent (every page)" }
            ] as const
          ).map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-slate-400"
              style={
                scope === s.id
                  ? { borderColor: BRAND_BLACK, backgroundColor: "#F8FAFC" }
                  : {}
              }
            >
              <input
                type="radio"
                name="scope"
                checked={scope === s.id}
                onChange={() => setScope(s.id)}
                className="accent-black"
              />
              <span className="text-[13px] font-medium text-slate-900">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={() => onApply(scope, color)}
        className="h-11 rounded-md text-[14px] font-semibold"
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        Apply
      </button>
    </div>
  );
}

const TEXT_COLORS = [
  { name: "Ink", value: BRAND_BLACK },
  { name: "Yellow", value: BRAND_YELLOW },
  { name: "Amber", value: BRAND_AMBER },
  { name: "Slate", value: "#334155" },
  { name: "Muted", value: "#64748B" },
  { name: "White", value: "#FFFFFF" },
  { name: "Danger", value: "#DC2626" }
];

const TEXT_SIZES: Array<{ id: TextPatch["size"]; label: string }> = [
  { id: "xs", label: "XS" },
  { id: "sm", label: "S" },
  { id: "base", label: "M" },
  { id: "lg", label: "L" },
  { id: "xl", label: "XL" },
  { id: "2xl", label: "2XL" },
  { id: "3xl", label: "3XL" }
];

const TEXT_WEIGHTS: Array<{ id: TextPatch["weight"]; label: string }> = [
  { id: 400, label: "Regular" },
  { id: 500, label: "Medium" },
  { id: 600, label: "Semibold" },
  { id: 700, label: "Bold" },
  { id: 800, label: "Extra" }
];

function TextInspector({
  selection,
  onApply
}: {
  selection: InspectorSelection;
  onApply: (patch: TextPatch) => void;
}): JSX.Element {
  const initialContent =
    (selection.config?.content as string | undefined) ??
    (selection.config?.text as string | undefined) ??
    selection.label;
  const [content, setContent] = useState(initialContent);
  const [size, setSize] = useState<TextPatch["size"]>("base");
  const [weight, setWeight] = useState<TextPatch["weight"]>(600);
  const [color, setColor] = useState(BRAND_BLACK);
  const [align, setAlign] = useState<TextPatch["align"]>("left");
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const targetRole = (selection.config?.role as string | undefined) ?? selection.label;

  const commit = (patch: Partial<TextPatch>) => {
    onApply({ targetRole, content, size, weight, color, align, ...patch });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Selected
        </div>
        <div className="text-[14px] font-semibold text-slate-900">{selection.label}</div>
      </div>

      {/* Content textarea */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Type size={12} />
          Text
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => commit({ content })}
          rows={3}
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] leading-relaxed focus:border-slate-900 focus:outline-none"
        />
        <button
          onClick={async () => {
            setRegenerating(true);
            try {
              // Call the mutate endpoint for AI regen — simplified;
              // pipes through the existing constitution retry.
              const res = await fetch("/api/ai/complete", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  task: "copy.rewrite",
                  hints: { tone: "trades-native" },
                  context: {
                    payload: {
                      promptTemplate: `Rewrite this ${targetRole} copy in UK-trades voice — direct, no marketing fluff. Keep the same intent. Return JSON { "rewritten": "..." } only.`,
                      currentConfig: { text: content },
                      aiPromptable: ["rewritten"]
                    }
                  }
                })
              });
              const json = (await res.json()) as {
                ok: boolean;
                result?: { rewritten?: string; text?: string; content?: string };
              };
              const rewritten = json.result?.rewritten ?? json.result?.text ?? json.result?.content;
              if (json.ok && typeof rewritten === "string") {
                setContent(rewritten);
                commit({ content: rewritten });
              }
            } catch {
              /* silent */
            } finally {
              setRegenerating(false);
            }
          }}
          disabled={regenerating}
          className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white text-[12px] font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          <Wand2 size={12} />
          {regenerating ? "Rewriting…" : "Regenerate with AI"}
        </button>
      </div>

      {/* Size scale */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Size
        </div>
        <div className="flex gap-1">
          {TEXT_SIZES.map((s) => {
            const isActive = size === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSize(s.id);
                  commit({ size: s.id });
                }}
                className="h-8 flex-1 rounded-md text-[11px] font-bold transition"
                style={
                  isActive
                    ? { backgroundColor: BRAND_BLACK, color: "white" }
                    : { backgroundColor: "#F1F5F9", color: "#334155" }
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weight */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Bold size={12} />
          Weight
        </div>
        <div className="flex gap-1">
          {TEXT_WEIGHTS.map((w) => {
            const isActive = weight === w.id;
            return (
              <button
                key={w.id}
                onClick={() => {
                  setWeight(w.id);
                  commit({ weight: w.id });
                }}
                className="h-8 flex-1 rounded-md text-[10px] font-semibold transition"
                style={
                  isActive
                    ? { backgroundColor: BRAND_BLACK, color: "white" }
                    : { backgroundColor: "#F1F5F9", color: "#334155" }
                }
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Colour swatches */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Palette size={12} />
          Colour
        </div>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLORS.map((c) => {
            const isActive = color.toLowerCase() === c.value.toLowerCase();
            return (
              <button
                key={c.value}
                onClick={() => {
                  setColor(c.value);
                  commit({ color: c.value });
                }}
                className="h-9 w-9 rounded-full border-2 transition"
                style={{
                  backgroundColor: c.value,
                  borderColor: isActive ? BRAND_BLACK : "transparent"
                }}
                title={c.name}
                aria-label={c.name}
              />
            );
          })}
          <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-[10px] font-bold text-slate-500 hover:border-slate-600">
            +
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                commit({ color: e.target.value });
              }}
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
        </div>
      </div>

      {/* Alignment */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Alignment
        </div>
        <div className="flex gap-1">
          {(
            [
              { id: "left", icon: AlignLeft },
              { id: "center", icon: AlignCenter },
              { id: "right", icon: AlignRight }
            ] as const
          ).map(({ id, icon: Icon }) => {
            const isActive = align === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setAlign(id);
                  commit({ align: id });
                }}
                className="flex h-9 flex-1 items-center justify-center rounded-md transition"
                style={
                  isActive
                    ? { backgroundColor: BRAND_BLACK, color: "white" }
                    : { backgroundColor: "#F1F5F9", color: "#334155" }
                }
                aria-label={`Align ${id}`}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ImageInspector({
  selection,
  onApply
}: {
  selection: InspectorSelection;
  onApply: (patch: { role: string; imageUrl: string }) => void;
}): JSX.Element {
  const role = (selection.config?.role as string | undefined) ?? "image";
  const current =
    (selection.config?.currentImageUrl as string | null | undefined) ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Selected
        </div>
        <div className="text-[14px] font-semibold text-slate-900">{selection.label}</div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <ImageIcon size={12} />
          Current image
        </div>
        {current ? (
          <div
            className="h-24 w-full rounded-md border border-slate-200 bg-slate-100"
            style={{
              backgroundImage: `url('${current}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-[12px] text-slate-500">
            No image set
          </div>
        )}
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-50">
          <Upload size={14} />
          Upload replacement
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const url = ev.target?.result as string;
                onApply({ role, imageUrl: url });
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Or paste an image URL
        </label>
        <input
          type="url"
          placeholder="https://…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) onApply({ role, imageUrl: val });
            }
          }}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-slate-900 focus:outline-none"
        />
        <div className="mt-1 text-[11px] text-slate-500">Press Enter to apply.</div>
      </div>
    </div>
  );
}

function HeroInspector({
  currentImage,
  candidates,
  onApply
}: {
  currentImage: string | null;
  candidates: readonly HeroCandidate[];
  onApply: (imageUrl: string) => void;
}): JSX.Element {
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <ImageIcon size={12} />
          Current banner
        </div>
        {currentImage ? (
          <div
            className="h-24 w-full rounded-md border border-slate-200 bg-slate-100"
            style={{
              backgroundImage: `url('${currentImage}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-[12px] text-slate-500">
            No banner set
          </div>
        )}
      </div>

      {/* Upload own */}
      <div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-50">
          <Upload size={14} />
          Upload your own
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const url = ev.target?.result as string;
                setUploadPreview(url);
                onApply(url);
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {uploadPreview && (
          <div className="mt-1 text-[11px] text-slate-500">Uploaded — applied to the hero.</div>
        )}
      </div>

      {/* Trade-matched candidates */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Trade-matched banners ({candidates.length})
        </div>
        {candidates.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-[12px] text-slate-600">
            No banner library matches for this trade yet. Upload your own above.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {candidates.slice(0, 20).map((c) => {
              const isActive = currentImage === c.imageUrl;
              return (
                <button
                  key={c.id}
                  onClick={() => onApply(c.imageUrl)}
                  className="group relative aspect-square overflow-hidden rounded-md border-2 transition"
                  style={{
                    borderColor: isActive ? BRAND_YELLOW : "#E2E8F0",
                    backgroundImage: `url('${c.imageUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                  title={c.subject}
                >
                  {isActive && (
                    <div
                      className="absolute bottom-1 right-1 rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      Active
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
