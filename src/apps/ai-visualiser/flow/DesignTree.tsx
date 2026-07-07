// DesignTree — guided render-prompt composer.
//
// The customer never types a prompt. They pick from chips populated by
// the merchant's chosen leaf + its taxonomy options. The result is a
// structured design object — Style + Material + Colour + Hardware —
// which the render route converts into a deterministic prompt on the
// server. Because there's no free text, prompt injection is impossible
// by construction, and the AI can only render things the merchant
// actually sells.
//
// Multi-select is only allowed on Hardware (customer can pick a bar
// pull AND a knob). Style / Material / Colour are single-select — a
// design has one identity.

"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

export type DesignOption = {
  key: string;
  label: string;
  hex?: string;
};

export type LeafOptions = {
  style: DesignOption[];
  material: DesignOption[];
  colour: DesignOption[];
  hardware: DesignOption[];
};

export type DesignChoices = {
  style?: string;
  material?: string;
  colour?: string;
  hardware: string[]; // multi-select
};

export type DesignTreeProps = {
  leafDisplayName: string;
  options: LeafOptions;
  value: DesignChoices;
  onChange: (next: DesignChoices) => void;
  onSubmit: () => void;
  submitting?: boolean;
  className?: string;
};

export function DesignTree({
  leafDisplayName,
  options,
  value,
  onChange,
  onSubmit,
  submitting = false,
  className = ""
}: DesignTreeProps) {
  const canSubmit =
    Boolean(value.style) && Boolean(value.material) && Boolean(value.colour);

  const styleLabel = useMemo(
    () => options.style.find((o) => o.key === value.style)?.label,
    [options.style, value.style]
  );

  return (
    <div className={`flex flex-col gap-5 ${className}`.trim()}>
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Design your
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-neutral-900 md:text-3xl">
          {leafDisplayName}
        </h2>
        {styleLabel ? (
          <p className="mt-1 text-[13px] text-neutral-600">
            {styleLabel}
            {value.material
              ? ` · ${options.material.find((o) => o.key === value.material)?.label}`
              : ""}
            {value.colour
              ? ` · ${options.colour.find((o) => o.key === value.colour)?.label}`
              : ""}
          </p>
        ) : null}
      </header>

      <Section label="Style">
        <ChipRow
          options={options.style}
          activeKey={value.style}
          onSelect={(key) => onChange({ ...value, style: key })}
        />
      </Section>

      <Section label="Material">
        <ChipRow
          options={options.material}
          activeKey={value.material}
          onSelect={(key) => onChange({ ...value, material: key })}
        />
      </Section>

      <Section label="Colour / Finish">
        <ChipRow
          options={options.colour}
          activeKey={value.colour}
          onSelect={(key) => onChange({ ...value, colour: key })}
          swatch
        />
      </Section>

      {options.hardware.length > 0 ? (
        <Section
          label="Hardware"
          hint="Pick one or more — leave empty if not relevant."
        >
          <ChipRow
            options={options.hardware}
            activeKeys={value.hardware}
            onToggle={(key) => {
              const set = new Set(value.hardware);
              if (set.has(key)) set.delete(key);
              else set.add(key);
              onChange({ ...value, hardware: Array.from(set) });
            }}
            multi
          />
        </Section>
      ) : null}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-neutral-900 px-5 text-[14px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitting ? "Generating your render…" : "Show me the design"}
        </button>
        {!canSubmit ? (
          <p className="mt-2 text-center text-[13px] text-neutral-500">
            Pick a style, material and colour to continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Section wrapper
// -----------------------------------------------------------------
function Section({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
          {label}
        </h3>
        {hint ? (
          <p className="text-[13px] text-neutral-500">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// -----------------------------------------------------------------
// ChipRow — horizontally scrolling chip picker, single- or multi-select
// -----------------------------------------------------------------
type ChipRowSingleProps = {
  options: DesignOption[];
  activeKey?: string;
  onSelect: (key: string) => void;
  swatch?: boolean;
  multi?: false;
  activeKeys?: never;
  onToggle?: never;
};

type ChipRowMultiProps = {
  options: DesignOption[];
  activeKeys: string[];
  onToggle: (key: string) => void;
  swatch?: boolean;
  multi: true;
  activeKey?: never;
  onSelect?: never;
};

type ChipRowProps = ChipRowSingleProps | ChipRowMultiProps;

function ChipRow(props: ChipRowProps) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {props.options.map((o) => {
        const active = props.multi
          ? props.activeKeys.includes(o.key)
          : props.activeKey === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() =>
              props.multi ? props.onToggle(o.key) : props.onSelect(o.key)
            }
            className={`inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition ${
              active
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
            }`}
            aria-pressed={active}
          >
            {props.swatch && o.hex ? (
              <span
                className="inline-block h-4 w-4 rounded-full border border-black/10"
                style={{ backgroundColor: o.hex }}
                aria-hidden
              />
            ) : null}
            <span>{o.label}</span>
            {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
