// SiteAddressInput — 3-mode UK address input for maximum accuracy.
//
// Modes:
//   1. Postcode Lookup (default) — postcode → API returns matching
//      addresses → user picks. Zero typo risk. Gold standard.
//   2. Manual — structured fields for edge cases + validation.
//   3. What3Words — 3-word grid reference. For new-build sites without
//      a Royal Mail postcode yet.
//
// Reusable primitive. Emits a normalised address object on save.

"use client";

import { useState } from "react";
import { MapPin, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  isValidUkPostcode,
  lookupPostcode,
  type PostcodeAddress
} from "../data/postcodeLookup";

export type SiteAddress = {
  mode: "postcode" | "manual" | "what3words";
  label: string;                // one-line canonical formatted address
  postcode?: string;
  buildingLabel?: string;
  street?: string;
  town?: string;
  what3words?: string;
  latLng?: { lat: number; lng: number };
};

type Props = {
  onSave: (address: SiteAddress) => void;
  onCancel?: () => void;
  initial?: Partial<SiteAddress>;
};

const W3W_REGEX = /^\/{2,3}?[a-z]+\.[a-z]+\.[a-z]+$/i;

export function SiteAddressInput({ onSave, onCancel, initial }: Props) {
  const [mode, setMode] = useState<SiteAddress["mode"]>(initial?.mode ?? "postcode");

  return (
    <div
      className="rounded-2xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Mode tabs */}
      <div
        className="mb-4 inline-flex w-full items-center gap-1 rounded-full border bg-neutral-50 p-1"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <ModeTab active={mode === "postcode"}    onSelect={() => setMode("postcode")}    label="Postcode Lookup"/>
        <ModeTab active={mode === "manual"}      onSelect={() => setMode("manual")}      label="Manual"/>
        <ModeTab active={mode === "what3words"}  onSelect={() => setMode("what3words")}  label="What3Words"/>
      </div>

      {mode === "postcode"    && <PostcodePanel onSave={onSave} onCancel={onCancel}/>}
      {mode === "manual"      && <ManualPanel   onSave={onSave} onCancel={onCancel}/>}
      {mode === "what3words"  && <W3wPanel      onSave={onSave} onCancel={onCancel}/>}
    </div>
  );
}

function ModeTab({ active, onSelect, label }: { active: boolean; onSelect: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider transition"
      style={{
        backgroundColor: active ? "#0A0A0A" : "transparent",
        color: active ? "#FFB300" : "#525252"
      }}
    >
      {label}
    </button>
  );
}

// ─── Mode 1: Postcode Lookup ─────────────────────────────────────────

function PostcodePanel({ onSave, onCancel }: { onSave: (a: SiteAddress) => void; onCancel?: () => void }) {
  const [postcode, setPostcode] = useState("");
  const [addresses, setAddresses] = useState<PostcodeAddress[] | null>(null);
  const [selected, setSelected] = useState<PostcodeAddress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const postcodeValid = isValidUkPostcode(postcode);

  async function find() {
    setError(null);
    setSelected(null);
    setAddresses(null);
    if (!postcodeValid) {
      setError("Enter a valid UK postcode (e.g. M20 2AB)");
      return;
    }
    setLoading(true);
    const results = await lookupPostcode(postcode);
    setLoading(false);
    if (results.length === 0) {
      setError("No addresses found at that postcode. Try Manual or check your postcode.");
      return;
    }
    setAddresses(results);
  }

  function save() {
    if (!selected) return;
    onSave({
      mode: "postcode",
      label: `${selected.buildingLabel}, ${selected.town}, ${selected.postcode}`,
      postcode: selected.postcode,
      buildingLabel: selected.buildingLabel,
      street: selected.street,
      town: selected.town,
      latLng: selected.latLng
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Postcode</span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => { setPostcode(e.target.value); setError(null); }}
            placeholder="M20 2AB"
            className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] uppercase"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </label>
        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={find}
            disabled={loading || !postcodeValid}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-4 text-[11px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
            Find
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0"/>
          {error}
        </div>
      )}

      {addresses && addresses.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
            Pick your address ({addresses.length})
          </span>
          <ul
            className="max-h-[240px] overflow-y-auto rounded-md border bg-white"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {addresses.map((a, i) => {
              const isSelected = selected === a;
              return (
                <li key={i} className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.05)" }}>
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left hover:bg-neutral-50"
                    style={{ backgroundColor: isSelected ? "#FEF3C7" : "transparent" }}
                  >
                    <MapPin size={13} className="flex-shrink-0 text-neutral-500"/>
                    <span className="min-w-0 flex-1 text-[12px] font-bold text-neutral-800">
                      {a.buildingLabel}, {a.town}
                    </span>
                    {isSelected && <CheckCircle2 size={13} className="text-[#166534]"/>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selected && (
        <div className="rounded-lg border bg-[#F0FDF4] p-3 text-[11.5px] leading-snug" style={{ borderColor: "rgba(22,101,52,0.35)" }}>
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#166534" }}>
            Selected address
          </div>
          <div className="mt-1 font-bold text-neutral-900">
            {selected.buildingLabel}
            <br/>
            {selected.town}
            <br/>
            {selected.postcode}
          </div>
        </div>
      )}

      <FooterButtons canSave={selected !== null} onSave={save} onCancel={onCancel}/>
    </div>
  );
}

// ─── Mode 2: Manual ──────────────────────────────────────────────────

function ManualPanel({ onSave, onCancel }: { onSave: (a: SiteAddress) => void; onCancel?: () => void }) {
  const [buildingLabel, setBuildingLabel] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave =
    buildingLabel.trim() !== "" &&
    street.trim() !== "" &&
    town.trim() !== "" &&
    postcode.trim() !== "" &&
    isValidUkPostcode(postcode);

  function save() {
    if (!canSave) {
      if (!isValidUkPostcode(postcode)) {
        setError("Postcode format looks off (should be like M20 2AB).");
      } else {
        setError("Fill every required field.");
      }
      return;
    }
    onSave({
      mode: "manual",
      label: `${buildingLabel}, ${street}, ${town}, ${postcode.toUpperCase()}`,
      buildingLabel,
      street,
      town,
      postcode: postcode.toUpperCase()
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Building number or name" required>
        <input
          type="text"
          value={buildingLabel}
          onChange={(e) => setBuildingLabel(e.target.value)}
          placeholder="47 or 'The Oaks'"
          className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>
      <Field label="Street" required>
        <input
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="Elm Street"
          className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>
      <Field label="Town / City" required>
        <input
          type="text"
          value={town}
          onChange={(e) => setTown(e.target.value)}
          placeholder="Manchester"
          className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px]"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>
      <Field label="Postcode" required>
        <input
          type="text"
          value={postcode}
          onChange={(e) => { setPostcode(e.target.value); setError(null); }}
          placeholder="M20 2AB"
          className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px] uppercase"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
        {postcode && !isValidUkPostcode(postcode) && (
          <span className="text-[10px] text-red-700">Format looks off (should be M20 2AB style).</span>
        )}
      </Field>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0"/>
          {error}
        </div>
      )}

      <FooterButtons canSave={canSave} onSave={save} onCancel={onCancel}/>
    </div>
  );
}

// ─── Mode 3: What3Words ──────────────────────────────────────────────

function W3wPanel({ onSave, onCancel }: { onSave: (a: SiteAddress) => void; onCancel?: () => void }) {
  const [w3w, setW3w] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValid = W3W_REGEX.test(w3w);

  function save() {
    if (!isValid) {
      setError("Format must be ///word.word.word (three lowercase words separated by dots).");
      return;
    }
    const clean = w3w.replace(/^\/+/, "");
    onSave({
      mode: "what3words",
      label: `///${clean}`,
      what3words: clean
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="What3Words">
        <input
          type="text"
          value={w3w}
          onChange={(e) => { setW3w(e.target.value); setError(null); }}
          placeholder="///filled.count.soap"
          className="min-h-[44px] w-full rounded-md border bg-white px-3 text-[13px] lowercase"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
      </Field>
      <div className="rounded-md bg-neutral-50 p-3 text-[10.5px] leading-snug text-neutral-600">
        <strong className="text-neutral-800">Why What3Words?</strong> Every 3m×3m square in the
        UK has a unique 3-word address. Use this when a plot has no Royal Mail postcode yet
        (new-builds, greenfield sites, remote yards). Get the words from the
        <em> what3words.com</em> app or website.
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0"/>
          {error}
        </div>
      )}

      <FooterButtons canSave={isValid} onSave={save} onCancel={onCancel}/>
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function FooterButtons({
  canSave,
  onSave,
  onCancel
}: {
  canSave: boolean;
  onSave: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
        style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
      >
        <MapPin size={13}/>
        Use this address
      </button>
    </div>
  );
}
