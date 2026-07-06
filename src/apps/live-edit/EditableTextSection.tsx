// EditableTextSection — a reference implementation showing how a
// section without its own inline editor plugs into the live-edit
// framework. Renders a headline + subhead + CTA. In edit mode the
// floating pencil opens a lightweight inline editor.
//
// This is a template — real sections (about, services, contact) can
// follow the same shape.

"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditMode } from "./EditModeContext";
import { EditableSection } from "./EditableSection";

export type EditableTextSectionProps = {
  id: string;
  initial?: {
    eyebrow?: string;
    headline?: string;
    subhead?: string;
    ctaLabel?: string;
  };
};

export function EditableTextSection({ id, initial }: EditableTextSectionProps) {
  const editCtx = useEditMode();
  const [values, setValues] = useState({
    eyebrow: initial?.eyebrow ?? "About us",
    headline:
      initial?.headline ?? "We build trade websites that actually work.",
    subhead:
      initial?.subhead ??
      "Fast to launch. Simple to edit. Designed for tradespeople, not developers.",
    ctaLabel: initial?.ctaLabel ?? "Get started"
  });
  const [editing, setEditing] = useState(false);

  // Report current state to the shell's registry so auto-save picks
  // it up. Runs on every values change including initial mount so
  // the merchant's page always has an up-to-date snapshot.
  useEffect(() => {
    editCtx.registerSectionState(id, values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, values]);

  const patch = (field: keyof typeof values, v: string) => {
    setValues((f) => ({ ...f, [field]: v }));
    editCtx.markDirty();
  };

  return (
    <EditableSection
      id={id}
      type="text"
      label="Text block"
      onEdit={() => setEditing(true)}
    >
      <div className="px-4 py-10 text-center">
        {values.eyebrow ? (
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            {values.eyebrow}
          </div>
        ) : null}
        <h2 className="mx-auto max-w-2xl text-[24px] font-bold leading-tight text-neutral-900 md:text-[32px]">
          {values.headline}
        </h2>
        {values.subhead ? (
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-neutral-600 md:text-[15px]">
            {values.subhead}
          </p>
        ) : null}
        {values.ctaLabel ? (
          <button
            type="button"
            className="mt-5 rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-neutral-800"
          >
            {values.ctaLabel}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-neutral-900">
                Edit text block
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close editor"
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Eyebrow
                </span>
                <input
                  type="text"
                  value={values.eyebrow}
                  onChange={(e) => patch("eyebrow", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Headline
                </span>
                <textarea
                  rows={2}
                  value={values.headline}
                  onChange={(e) => patch("headline", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Subhead
                </span>
                <textarea
                  rows={2}
                  value={values.subhead}
                  onChange={(e) => patch("subhead", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Button label
                </span>
                <input
                  type="text"
                  value={values.ctaLabel}
                  onChange={(e) => patch("ctaLabel", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </EditableSection>
  );
}
