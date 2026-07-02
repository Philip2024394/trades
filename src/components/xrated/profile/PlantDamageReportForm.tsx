"use client";

// Damage inspection form — pre-hire or post-hire. Records photos of
// damage, location on machine, severity, and captures a signature.

import { useState } from "react";
import { PLANT_CATEGORIES, type PlantCategorySlug } from "@/lib/plantHire";
import {
  MachineSelect,
  PhotoUploader,
  SignaturePad,
  TextField
} from "./PlantEvidenceShared";

const DAMAGE_LOCATIONS = [
  "Cab / operator area",
  "Boom / arm",
  "Bucket / attachment",
  "Track / undercarriage",
  "Wheels / tyres",
  "Engine bay",
  "Hydraulic hoses",
  "Bodywork panels",
  "Lights / mirrors",
  "Other"
];

const SEVERITY = [
  { slug: "cosmetic", label: "Cosmetic (paint, scratch)" },
  { slug: "minor", label: "Minor (dent, guard, hose)" },
  { slug: "major", label: "Major (structural, running gear)" },
  { slug: "off_road", label: "Off-road (won't safely operate)" }
];

export function PlantDamageReportForm({
  merchantName,
  merchantSlug,
  waHref,
  fleet,
  presetRef
}: {
  merchantName: string;
  merchantSlug: string;
  waHref: string | null;
  fleet: { slug: PlantCategorySlug; label: string }[];
  presetRef?: string;
}) {
  const [phase, setPhase] = useState<"pre_hire" | "post_hire">("post_hire");
  const [slug, setSlug] = useState<PlantCategorySlug | "">("");
  const [custom, setCustom] = useState("");
  const [hireRef, setHireRef] = useState(presetRef ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(DAMAGE_LOCATIONS[0]);
  const [severity, setSeverity] = useState<string>(SEVERITY[0].slug);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const machineLabel = slug
    ? PLANT_CATEGORIES.find((m) => m.slug === slug)?.label ?? String(slug)
    : custom || "Machine — not specified";
  const severityLabel = SEVERITY.find((s) => s.slug === severity)?.label ?? severity;

  const canSubmit =
    (slug || custom.length > 2) &&
    description.length > 5 &&
    photos.length >= 3 &&
    signatureUrl.length > 0 &&
    name.length > 1 &&
    phone.length >= 6;

  const submit = async () => {
    try {
      await fetch("/api/plant-hire/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_slug: merchantSlug,
          kind: phase === "pre_hire" ? "damage_pre" : "damage_post",
          hire_reference: hireRef,
          machine_slug: slug,
          machine_label: machineLabel,
          photo_urls: photos,
          signature_url: signatureUrl,
          damage_location: location,
          damage_severity: severity,
          damage_description: description,
          phase,
          reporter_name: name,
          reporter_phone: phone,
          notes
        })
      });
    } catch {
      // fail open
    }
    const parts: string[] = [
      `🛠 *DAMAGE REPORT — ${merchantName}*`,
      `_${phase === "pre_hire" ? "Pre-hire inspection" : "Post-hire inspection"}_`,
      "",
      `🚜 Machine: ${machineLabel}`,
      hireRef ? `🔖 Hire ref: ${hireRef}` : "",
      `📅 Inspected: ${date}`,
      "",
      `📍 Location: ${location}`,
      `⚠ Severity: ${severityLabel}`,
      "",
      `Description:`,
      description,
      "",
      "*Photos*",
      ...photos,
      "",
      `✍ Signature: ${signatureUrl}`,
      "",
      `👤 ${name} · ${phone}`,
      notes ? `📝 ${notes}` : "",
      "",
      phase === "post_hire"
        ? "Please assess chargeable damage per hire T&Cs and reply with the invoice/waiver decision."
        : "Please confirm pre-existing damage is on record — subsequent charges must exclude these items."
    ];
    const msg = encodeURIComponent(parts.filter((p) => p !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex gap-2">
        {(["pre_hire", "post_hire"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPhase(p)}
            className={`h-11 flex-1 rounded-xl border text-[12px] font-extrabold uppercase tracking-widest transition ${
              phase === p
                ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
            }`}
          >
            {p === "pre_hire" ? "Pre-hire" : "Post-hire"}
          </button>
        ))}
      </div>

      <MachineSelect
        fleet={fleet}
        value={slug}
        onChange={setSlug}
        customValue={custom}
        onCustomChange={setCustom}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Hire reference / job no."
          value={hireRef}
          onChange={setHireRef}
          placeholder="e.g. RH-2026-01234"
        />
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Inspection date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Location on machine
          </span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          >
            {DAMAGE_LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Severity
          </span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          >
            {SEVERITY.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
          Description (min 5 characters)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What happened, when, and how the damage manifests. Include cause if known."
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
        />
      </label>

      <PhotoUploader
        label="Damage photos (min 3 — close-ups + context shot)"
        values={photos}
        onChange={setPhotos}
        required
        minPhotos={3}
      />

      <SignaturePad value={signatureUrl} onChange={setSignatureUrl} label="Sign to submit" />

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
          Send report →
        </button>
      </div>
    </div>
  );
}
