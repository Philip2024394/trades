"use client";

// src/components/nex-app/live/RightsDeclarationForm.tsx
//
// NEX LIVE · Phase 2 · Rights declaration UI
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2
//
// §13 · Before publication show a clear human-readable declaration.
// The user must actively confirm. No confirmation = cannot publish.
//
// §10 immutable propagated: the UI never claims NEX verified anything.
// The submission surfaces `OWNER_DECLARED / LICENSED / PUBLIC_DOMAIN /
// CREATIVE_COMMONS` — never "verified".

import { useState } from "react";
import type { DeclaredRightsKind } from "@/lib/nex/live/rights-declaration";

export type RightsDeclarationValue = {
  declared_kind: DeclaredRightsKind;
  declared_statement: string;
  supporting_reference: string | null;
  confirmed: boolean;
};

export type RightsDeclarationFormProps = {
  value: RightsDeclarationValue;
  onChange: (next: RightsDeclarationValue) => void;
  disabled?: boolean;
};

const KIND_OPTIONS: { value: DeclaredRightsKind; label: string; hint: string }[] = [
  { value: "OWNER_DECLARED",    label: "I own this content",              hint: "You recorded / created it yourself." },
  { value: "LICENSED",          label: "I have a valid licence",           hint: "You hold a permission or licence to use it." },
  { value: "PUBLIC_DOMAIN",     label: "Public domain",                    hint: "No copyright protection applies." },
  { value: "CREATIVE_COMMONS",  label: "Creative Commons",                 hint: "A CC licence permits your use." },
];

export function RightsDeclarationForm({ value, onChange, disabled = false }: RightsDeclarationFormProps) {
  const [expanded, setExpanded] = useState(false);
  const set = <K extends keyof RightsDeclarationValue>(key: K, next: RightsDeclarationValue[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <fieldset
      disabled={disabled}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white"
      data-testid="nex-live-rights-declaration-form"
    >
      <legend className="px-2 text-[10px] uppercase tracking-widest text-white/50">
        Rights &amp; ownership · required
      </legend>

      {/* Kind selection · radio group */}
      <div className="mt-1 space-y-1">
        {KIND_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-2 rounded-lg p-2 cursor-pointer ${value.declared_kind === opt.value ? "bg-white/8" : "hover:bg-white/5"}`}
            data-testid={`nex-live-rights-kind-${opt.value}`}
          >
            <input
              type="radio"
              name="declared_kind"
              className="mt-1 accent-white"
              checked={value.declared_kind === opt.value}
              onChange={() => set("declared_kind", opt.value)}
            />
            <span className="flex-1">
              <span className="block text-sm">{opt.label}</span>
              <span className="block text-[11px] text-white/40">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {/* Statement — required for audit + moderator context */}
      <label className="mt-3 block">
        <span className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">
          Brief statement · required
        </span>
        <textarea
          value={value.declared_statement}
          onChange={(e) => set("declared_statement", e.target.value)}
          minLength={5}
          maxLength={500}
          rows={2}
          placeholder="e.g. I recorded this original song myself."
          className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          data-testid="nex-live-rights-statement"
        />
      </label>

      {/* Optional supporting reference */}
      {expanded && (
        <label className="mt-3 block">
          <span className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">
            Supporting reference · optional
          </span>
          <input
            type="url"
            value={value.supporting_reference ?? ""}
            onChange={(e) => set("supporting_reference", e.target.value.trim() || null)}
            placeholder="Optional licence URL"
            className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            data-testid="nex-live-rights-supporting-reference"
          />
        </label>
      )}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-[11px] text-white/50 hover:text-white/70"
        >
          + add supporting licence URL (optional)
        </button>
      )}

      {/* Mandatory confirmation checkbox */}
      <label
        className="mt-4 flex items-start gap-2 rounded-lg p-2 bg-white/[0.04] cursor-pointer"
        data-testid="nex-live-rights-confirm-checkbox"
      >
        <input
          type="checkbox"
          className="mt-1 accent-white"
          checked={value.confirmed}
          onChange={(e) => set("confirmed", e.target.checked)}
        />
        <span className="flex-1 text-[12px] leading-snug text-white/80">
          I confirm that I own this content or have the necessary rights or permission to upload
          and make it available on NEX.
        </span>
      </label>

      {/* Honesty footer · §10 never claims verification */}
      <p className="mt-3 text-[10px] text-white/40">
        NEX records your declaration. NEX does <span className="underline underline-offset-2">not</span> independently verify ownership.
      </p>
    </fieldset>
  );
}

/** Predicate the parent form uses to enable/disable the Publish
 *  button. All conditions must hold. */
export function isRightsDeclarationComplete(v: RightsDeclarationValue): boolean {
  if (!v.confirmed) return false;
  if (v.declared_statement.trim().length < 5) return false;
  return true;
}
