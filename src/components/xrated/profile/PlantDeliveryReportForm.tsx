"use client";

// Delivery evidence form — customer confirms receipt of the machine.
// Records photos, hour meter, fuel level, damage-on-arrival flag, and
// captures a signature.

import { useState } from "react";
import { PLANT_CATEGORIES, type PlantCategorySlug } from "@/lib/plantHire";
import {
  MachineSelect,
  PhotoUploader,
  SignaturePad,
  TextField
} from "./PlantEvidenceShared";

export function PlantDeliveryReportForm({
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
  const [slug, setSlug] = useState<PlantCategorySlug | "">("");
  const [custom, setCustom] = useState("");
  const [hireRef, setHireRef] = useState(presetRef ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hourMeter, setHourMeter] = useState("");
  const [fuelPercent, setFuelPercent] = useState("100");
  const [damageOnArrival, setDamageOnArrival] = useState(false);
  const [damageNote, setDamageNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const machineLabel = slug
    ? PLANT_CATEGORIES.find((m) => m.slug === slug)?.label ?? String(slug)
    : custom || "Machine — not specified";

  const canSubmit =
    (slug || custom.length > 2) &&
    hireRef.length > 0 &&
    photos.length >= 4 &&
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
          kind: "delivery_evidence",
          hire_reference: hireRef,
          machine_slug: slug,
          machine_label: machineLabel,
          photo_urls: photos,
          signature_url: signatureUrl,
          hour_meter: Number(hourMeter) || undefined,
          fuel_percent: Number(fuelPercent) || undefined,
          damage_description: damageOnArrival ? damageNote : "",
          reporter_name: name,
          reporter_phone: phone,
          notes
        })
      });
    } catch {
      // fail open
    }
    const parts: string[] = [
      `📸 *DELIVERY CONFIRMATION — ${merchantName}*`,
      "",
      `🚜 Machine: ${machineLabel}`,
      `🔖 Hire ref: ${hireRef}`,
      `📅 Delivered: ${date}`,
      hourMeter ? `⏱ Hour meter: ${hourMeter} h` : "",
      fuelPercent ? `⛽ Fuel: ${fuelPercent}%` : "",
      "",
      damageOnArrival
        ? `⚠ DAMAGE ON ARRIVAL: ${damageNote || "not described"}`
        : "✓ No visible damage on delivery",
      "",
      "*Photos*",
      ...photos,
      "",
      `✍ Signature: ${signatureUrl}`,
      "",
      `👤 ${name} · ${phone}`,
      notes ? `📝 ${notes}` : "",
      "",
      "Customer confirms machine received in condition shown. Any post-delivery damage handled per hire T&Cs."
    ];
    const msg = encodeURIComponent(parts.filter((p) => p !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
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
            Delivery date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
        <TextField
          label="Hour meter reading"
          value={hourMeter}
          onChange={(v) => setHourMeter(v.replace(/[^0-9.]/g, ""))}
          placeholder="e.g. 4200"
          inputMode="numeric"
        />
        <TextField
          label="Fuel level (%)"
          value={fuelPercent}
          onChange={(v) => setFuelPercent(v.replace(/[^0-9]/g, ""))}
          placeholder="100"
          inputMode="numeric"
        />
      </div>

      <PhotoUploader
        label="Machine photos — front, back, both sides (min 4)"
        values={photos}
        onChange={setPhotos}
        required
        minPhotos={4}
      />

      <div className="rounded-2xl bg-neutral-50 p-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={damageOnArrival}
            onChange={(e) => setDamageOnArrival(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-neutral-300 accent-[#DC2626]"
          />
          <span className="text-[13px] font-extrabold text-neutral-900">
            I&rsquo;ve spotted damage on arrival
          </span>
        </label>
        {damageOnArrival && (
          <textarea
            value={damageNote}
            onChange={(e) => setDamageNote(e.target.value)}
            placeholder="Describe location + severity — hydraulic hose, cab window, bucket edge, track link etc."
            rows={2}
            className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-red-500"
          />
        )}
      </div>

      <SignaturePad value={signatureUrl} onChange={setSignatureUrl} label="Sign to confirm receipt" />

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
          Send confirmation →
        </button>
      </div>
    </div>
  );
}
