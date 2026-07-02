"use client";

// Hire extension / off-hire / early-collection request form. Prefills
// the hire reference from ?ref query param when routed from My Hires.

import { useState } from "react";
import { PLANT_CATEGORIES, type PlantCategorySlug } from "@/lib/plantHire";
import { MachineSelect, TextField } from "./PlantEvidenceShared";

type Mode = "extend" | "off_hire" | "early_collection";

export function PlantHireExtensionForm({
  merchantName,
  waHref,
  fleet,
  presetRef
}: {
  merchantName: string;
  waHref: string | null;
  fleet: { slug: PlantCategorySlug; label: string }[];
  presetRef?: string;
}) {
  const [mode, setMode] = useState<Mode>("extend");
  const [hireRef, setHireRef] = useState(presetRef ?? "");
  const [slug, setSlug] = useState<PlantCategorySlug | "">("");
  const [custom, setCustom] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [reason, setReason] = useState("");
  const [collectPostcode, setCollectPostcode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const machineLabel = slug
    ? PLANT_CATEGORIES.find((m) => m.slug === slug)?.label ?? String(slug)
    : custom || "Machine — not specified";

  const canSubmit =
    hireRef.length > 0 &&
    name.length > 1 &&
    phone.length >= 6 &&
    (mode !== "extend" || newEndDate.length === 10) &&
    (mode === "extend" || collectionDate.length === 10);

  const modeLabel: Record<Mode, string> = {
    extend: "HIRE EXTENSION",
    off_hire: "OFF-HIRE REQUEST",
    early_collection: "EARLY COLLECTION"
  };

  const submit = () => {
    const parts: string[] = [
      `⏱ *${modeLabel[mode]} — ${merchantName}*`,
      "",
      `🔖 Hire ref: ${hireRef}`,
      `🚜 Machine: ${machineLabel}`,
      "",
      mode === "extend" ? `📅 Extend to: ${newEndDate}` : "",
      mode !== "extend" ? `📅 Collect on: ${collectionDate}` : "",
      collectPostcode ? `📍 Collect from: ${collectPostcode}` : "",
      "",
      reason ? `Reason: ${reason}` : "",
      notes ? `Notes: ${notes}` : "",
      "",
      `👤 ${name} · ${phone}`,
      "",
      mode === "extend"
        ? "Please confirm extension + updated rate."
        : "Please confirm collection slot + off-hire paperwork."
    ];
    const msg = encodeURIComponent(parts.filter((p) => p !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid grid-cols-3 gap-1">
        {([
          { m: "extend", label: "Extend" },
          { m: "off_hire", label: "Off-hire" },
          { m: "early_collection", label: "Early collect" }
        ] as { m: Mode; label: string }[]).map((o) => (
          <button
            key={o.m}
            type="button"
            onClick={() => setMode(o.m)}
            className={`h-11 rounded-xl border text-[12px] font-extrabold uppercase tracking-widest transition ${
              mode === o.m
                ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <TextField
        label="Hire reference"
        value={hireRef}
        onChange={setHireRef}
        placeholder="e.g. RH-2026-01234"
      />

      <MachineSelect
        fleet={fleet}
        value={slug}
        onChange={setSlug}
        customValue={custom}
        onCustomChange={setCustom}
      />

      {mode === "extend" ? (
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            New end date
          </span>
          <input
            type="date"
            value={newEndDate}
            onChange={(e) => setNewEndDate(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
      ) : (
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Collection date
          </span>
          <input
            type="date"
            value={collectionDate}
            onChange={(e) => setCollectionDate(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
      )}

      {mode !== "extend" && (
        <TextField
          label="Collect from postcode"
          value={collectPostcode}
          onChange={(v) => setCollectPostcode(v.toUpperCase())}
          placeholder="LS10 1LG"
        />
      )}

      <label className="block">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
          Reason (optional)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. project overrun by 2 weeks, ground conditions delayed dig"
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Your name" value={name} onChange={setName} />
        <TextField label="WhatsApp / phone" value={phone} onChange={setPhone} inputMode="tel" />
      </div>

      <label className="block">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
          Anything else? (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] outline-none focus:border-[#FFB300] focus:bg-white"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={`inline-flex h-12 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
            canSubmit
              ? "bg-[#25D366] text-white hover:brightness-95"
              : "cursor-not-allowed bg-neutral-200 text-neutral-500"
          }`}
        >
          Send request →
        </button>
      </div>
    </div>
  );
}
