// Universal Composer — the Facebook-style post box.
//
// User is auto-identified via the shared identity fixture (Bob Watson).
// Dropdown selects post type. Body morphs to match. Submit routes to
// the destination area with the composed content as query params. The
// area's own page picks up the query params and pre-populates fields.
//
// "Fill once" principle: the identity header at the top is read-only.
// Every composer type reads Bob's name / trade / merchant slug from
// SUI. The trade only ever types the tier-3 content-specific fields.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Check,
  ArrowRight,
  ShieldCheck,
  MapPin,
  ImageIcon as ImageIconL
} from "lucide-react";
import {
  COMPOSER_TYPES,
  findComposerType,
  type ComposerType,
  type ComposerTypeKey,
  type ComposerField
} from "../data/composerTypes";
import type { VerifiedTradeIdentity } from "@/apps/identity/data/tradeIdentities";
import { countVerifiedLayers } from "@/apps/identity/data/tradeIdentities";

type Props = {
  identity: VerifiedTradeIdentity;
  /** Compact mode used in the FAB modal — same composer, tighter padding. */
  compact?: boolean;
};

export function UniversalComposer({ identity, compact }: Props) {
  const [selectedKey, setSelectedKey] = useState<ComposerTypeKey>("tc-product");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const router = useRouter();

  const selected = useMemo(() => findComposerType(selectedKey)!, [selectedKey]);
  const verifiedLayers = countVerifiedLayers(identity);

  function setValue(key: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function pickType(key: ComposerTypeKey) {
    setSelectedKey(key);
    setValues({});
    setDropdownOpen(false);
  }

  function submit() {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false || v === "") return;
      params.set(k, String(v));
    });
    params.set("compose", selected.key);
    const url = `${selected.destinationRoute}?${params.toString()}`;
    router.push(url);
  }

  return (
    <section
      className={`rounded-2xl border bg-white shadow-sm ${compact ? "" : "shadow-md"}`}
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Identity header — never re-asked, always visible */}
      <header
        className="flex items-center gap-3 rounded-t-2xl border-b p-4"
        style={{
          borderColor: "rgba(139,69,19,0.10)",
          backgroundColor: "#FBF6EC"
        }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          aria-hidden
        >
          {identity.headshotInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[13px] font-black text-neutral-900">{identity.displayName}</div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
            >
              <ShieldCheck size={8} strokeWidth={2.5}/>
              Verified {verifiedLayers}/8
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-neutral-600">
            <span>{identity.tradeType}</span>
            <span>·</span>
            <MapPin size={9}/>
            <span>{identity.homeCity}</span>
          </div>
        </div>
        <Link
          href="/tc/identity"
          className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          Edit identity
        </Link>
      </header>

      {/* Body */}
      <div className={compact ? "p-4" : "p-5"}>
        {/* Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-xl border bg-white px-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${selected.areaColour}18`, color: selected.areaColour }}
              >
                <selected.Icon size={16} strokeWidth={2}/>
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[12px] font-black text-neutral-900">
                  {selected.label}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10.5px] text-neutral-500">
                  {selected.description}
                </div>
              </div>
            </div>
            <ChevronDown size={14} className="flex-shrink-0 text-neutral-500"/>
          </button>

          {dropdownOpen && (
            <>
              <button
                type="button"
                aria-label="Close post-type menu"
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <ul
                className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[360px] overflow-y-auto rounded-xl border bg-white p-1 shadow-xl"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
                role="listbox"
              >
                {COMPOSER_TYPES.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => pickType(t.key)}
                      className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-50"
                      role="option"
                      aria-selected={t.key === selected.key}
                    >
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${t.areaColour}18`, color: t.areaColour }}
                      >
                        <t.Icon size={15} strokeWidth={2}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="text-[12px] font-black text-neutral-900">
                            {t.label}
                          </div>
                          {t.key === selected.key && (
                            <Check size={11} className="text-[#166534]" strokeWidth={2.5}/>
                          )}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[10.5px] text-neutral-500">
                          {t.description}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Morphing body */}
        {selected.fields.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {selected.fields.map((f) => (
              <ComposerFieldRow key={f.key} field={f} value={values[f.key]} onChange={(v) => setValue(f.key, v)}/>
            ))}
          </div>
        )}
        {selected.fields.length === 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-50 p-3">
            <ImageIconL size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <p className="text-[11px] leading-snug text-neutral-600">
              {selected.description}
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[10.5px] text-neutral-500">
            Publishes as{" "}
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: `${selected.areaColour}18`, color: selected.areaColour }}
            >
              {selected.areaLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: selected.areaColour }}
          >
            {selected.cta}
            <ArrowRight size={13} strokeWidth={2.5}/>
          </button>
        </div>
      </div>
    </section>
  );
}

function ComposerFieldRow({
  field,
  value,
  onChange
}: {
  field: ComposerField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  const border = "rgba(139,69,19,0.15)";

  if (field.kind === "text") {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          {field.label}
          {field.required && <span className="ml-1 text-red-600">*</span>}
        </span>
        {field.multiline ? (
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="rounded-lg border bg-white p-3 text-[13px]"
            style={{ borderColor: border }}
          />
        ) : (
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="min-h-[44px] rounded-lg border bg-white px-3 text-[13px]"
            style={{ borderColor: border }}
          />
        )}
      </label>
    );
  }

  if (field.kind === "number") {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          {field.label}
          {field.required && <span className="ml-1 text-red-600">*</span>}
        </span>
        <div className="relative">
          {field.prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-neutral-500">
              {field.prefix}
            </span>
          )}
          <input
            type="number"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            className={`min-h-[44px] w-full rounded-lg border bg-white pr-3 text-[13px] font-black ${
              field.prefix ? "pl-7" : "pl-3"
            }`}
            style={{ borderColor: border }}
          />
        </div>
      </label>
    );
  }

  if (field.kind === "select") {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          {field.label}
        </span>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[44px] rounded-lg border bg-white px-3 text-[13px]"
          style={{ borderColor: border }}
        >
          <option value="">Choose one…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === "toggle") {
    return (
      <label
        className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg border bg-neutral-50 p-3"
        style={{ borderColor: border }}
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <div>
          <div className="text-[11.5px] font-black text-neutral-800">{field.label}</div>
          {field.hint && (
            <div className="mt-0.5 text-[10.5px] leading-snug text-neutral-500">{field.hint}</div>
          )}
        </div>
      </label>
    );
  }

  if (field.kind === "image") {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          {field.label}
        </span>
        <div
          className="flex min-h-[80px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-neutral-50 px-3 py-4 text-center"
          style={{ borderColor: "rgba(139,69,19,0.25)" }}
        >
          <div className="flex items-center gap-2">
            <ImageIconL size={16} className="text-neutral-500"/>
            <div className="text-[11px] font-bold text-neutral-600">
              Drop an image or tap to browse
              {field.hint && <div className="mt-0.5 text-[10px] font-normal text-neutral-500">{field.hint}</div>}
            </div>
          </div>
        </div>
      </label>
    );
  }

  return null;
}
