"use client";

// PlantBreakdownForm — comprehensive breakdown report form. Everything
// is captured client-side then handed off via WhatsApp with a rich
// pre-filled message so the merchant sees every field before dispatch.
// No DB persistence in v1 — merchant can save details to their own CRM
// / notes app after receiving the WA message.
//
// Media (photos + optional 60s video) uploads to the same trade-off
// storage endpoints already used elsewhere; URLs are inlined in the
// message so the merchant clicks through.

import { useState } from "react";
import type { PlantBreakdownService } from "@/lib/plantHire";

const MACHINE_TYPES = [
  "Mini excavator",
  "Midi / large excavator",
  "Backhoe loader",
  "Wheel loader",
  "Bulldozer",
  "Articulated dumper",
  "Grader",
  "Site dumper",
  "Tracked dumper",
  "Telehandler",
  "Forklift",
  "Roller / compactor",
  "Plate compactor",
  "Trench rammer",
  "Scissor lift",
  "Cherry picker",
  "Skid steer",
  "Breaker",
  "Generator",
  "Compressor",
  "Water bowser",
  "Space heater",
  "Concrete mixer",
  "Concrete pump",
  "Wood chipper",
  "Trencher",
  "Floor saw",
  "Flail mower",
  "Plant trailer",
  "Welfare unit",
  "Other"
];

const SYMPTOMS = [
  "Won't start",
  "Loss of power",
  "Hydraulic weakness",
  "Overheating",
  "Warning light on dash",
  "Strange noise",
  "Fluid leak",
  "Smoke / smell",
  "Cracked / broken component",
  "Track / wheel issue",
  "Electrical fault",
  "Other"
];

const LEVELS = ["Full", "75%", "50%", "25%", "Empty", "Don't know"];
const FUEL_SOURCES = [
  "Merchant supply",
  "Fuel station",
  "Bulk delivery",
  "Farm tank",
  "Unknown"
];
const ACTIVITY = [
  "Working normally",
  "Under load",
  "Idle",
  "Starting up",
  "Cold start"
];
const TIMELINE = [
  "Right now",
  "In the last hour",
  "This morning",
  "Yesterday",
  "Days ago"
];

type Ownership = "our_hire" | "own_machine" | "third_party";
type PaymentChoice = "card_before_dispatch" | "card_after_fix" | "cash_on_fix" | "trade_account";

function fmtPounds(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

export function PlantBreakdownForm({
  merchantName,
  waHref,
  config
}: {
  merchantName: string;
  waHref: string | null;
  config: PlantBreakdownService;
}) {
  // Form state
  const [machineType, setMachineType] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("our_hire");
  const [postcode, setPostcode] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState("");
  const [activity, setActivity] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [hydraulic, setHydraulic] = useState("");
  const [fuel, setFuel] = useState("");
  const [fuelSource, setFuelSource] = useState("");
  const [battery, setBattery] = useState("");
  const [warningLights, setWarningLights] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [urgency, setUrgency] = useState("On-site production stopped");
  const [payment, setPayment] = useState<PaymentChoice | "">("");
  const [terms, setTerms] = useState(false);
  const [sending, setSending] = useState(false);

  const availablePayments: { key: PaymentChoice; label: string }[] = [];
  if (config.payment_options.card_before_dispatch)
    availablePayments.push({ key: "card_before_dispatch", label: "Card pre-auth before dispatch" });
  if (config.payment_options.card_after_fix)
    availablePayments.push({ key: "card_after_fix", label: "Card payment after fix" });
  if (config.payment_options.cash_on_fix)
    availablePayments.push({ key: "cash_on_fix", label: "Cash on completion" });
  if (config.payment_options.trade_account)
    availablePayments.push({ key: "trade_account", label: "Trade account (30 days)" });

  function toggleSymptom(sym: string) {
    setSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  }

  function shareLocation() {
    if (!navigator.geolocation) {
      setLocError("Location not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Location blocked. Enter your postcode manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string };
      if (j.ok && j.url) setPhotos((prev) => [...prev, j.url as string].slice(0, 4));
    } finally {
      setUploading(false);
    }
  }

  async function uploadVideo(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-video", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string };
      if (j.ok && j.url) setVideo(j.url);
    } finally {
      setUploading(false);
    }
  }

  function ownershipCostBlock(): string {
    if (ownership === "our_hire") {
      return `Ownership: OUR HIRE — covered by your SLA (local ${config.sla_local_hours}h / national ${config.sla_national_hours}h).`;
    }
    const parts = ["Ownership:", ownership === "own_machine" ? "CUSTOMER'S OWN MACHINE" : "3RD-PARTY MACHINE"];
    if (config.callout_fee_pence)
      parts.push(`\n  · Callout fee: ${fmtPounds(config.callout_fee_pence)}`);
    if (config.hourly_rate_pence)
      parts.push(`\n  · Labour: ${fmtPounds(config.hourly_rate_pence)}/hr (min ${config.minimum_callout_hours}h)`);
    if (config.parts_markup_percent)
      parts.push(`\n  · Parts: at cost + ${config.parts_markup_percent}% markup`);
    return parts.join("");
  }

  function buildMessage(): string {
    const lines: string[] = [];
    lines.push(`🚨 BREAKDOWN REPORT for ${merchantName}`);
    lines.push("");
    lines.push(`MACHINE`);
    lines.push(`Type: ${machineType || "(not specified)"}`);
    if (makeModel) lines.push(`Make/Model: ${makeModel}`);
    lines.push(ownershipCostBlock());
    lines.push("");
    lines.push(`LOCATION`);
    if (postcode) lines.push(`Postcode: ${postcode.toUpperCase()}`);
    if (coords)
      lines.push(
        `Live coords: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} → https://www.google.com/maps?q=${coords.lat},${coords.lng}`
      );
    lines.push("");
    lines.push(`ISSUE`);
    if (timeline) lines.push(`Started: ${timeline}`);
    if (activity) lines.push(`Doing when it failed: ${activity}`);
    if (symptoms.length > 0) lines.push(`Symptoms: ${symptoms.join(", ")}`);
    if (issueDescription) lines.push(`Detail: ${issueDescription}`);
    lines.push("");
    lines.push(`DIAGNOSTICS`);
    if (hydraulic) lines.push(`Hydraulic oil: ${hydraulic}`);
    if (fuel) lines.push(`Fuel level: ${fuel}`);
    if (fuelSource) lines.push(`Fuel source: ${fuelSource}`);
    if (battery) lines.push(`Battery: ${battery}`);
    if (warningLights) lines.push(`Warning lights: ${warningLights}`);
    lines.push("");
    if (photos.length > 0 || video) {
      lines.push(`MEDIA`);
      photos.forEach((u, i) => lines.push(`Photo ${i + 1}: ${u}`));
      if (video) lines.push(`Video: ${video}`);
      lines.push("");
    }
    lines.push(`CONTACT`);
    lines.push(`Name: ${name || "(not provided)"}`);
    if (phone) lines.push(`Phone: ${phone}`);
    lines.push(`Urgency: ${urgency}`);
    lines.push("");
    if (payment) {
      const label = availablePayments.find((p) => p.key === payment)?.label ?? payment;
      lines.push(`PAYMENT: Customer picked "${label}".`);
    }
    lines.push(`TERMS: Customer accepted terms of service.`);
    return lines.join("\n");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms || !waHref) return;
    setSending(true);
    try {
      const url = `${waHref}?text=${encodeURIComponent(buildMessage())}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 1. Machine */}
      <Section title="Machine" step={1}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Machine type">
            <select
              value={machineType}
              onChange={(e) => setMachineType(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
              required
            >
              <option value="">Choose…</option>
              {MACHINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Make / model (optional)">
            <input
              type="text"
              value={makeModel}
              onChange={(e) => setMakeModel(e.target.value)}
              placeholder="e.g. Kubota U10-5"
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            />
          </Field>
        </div>
        <fieldset className="mt-3">
          <legend className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Who owns this machine?
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <OwnershipPill
              active={ownership === "our_hire"}
              onClick={() => setOwnership("our_hire")}
              title="Your hire"
              sub="Covered by SLA"
            />
            {config.own_machine_supported && (
              <OwnershipPill
                active={ownership === "own_machine"}
                onClick={() => setOwnership("own_machine")}
                title="My own machine"
                sub={
                  config.callout_fee_pence
                    ? `Callout ${fmtPounds(config.callout_fee_pence)} + labour`
                    : "Chargeable"
                }
              />
            )}
            {config.third_party_supported && (
              <OwnershipPill
                active={ownership === "third_party"}
                onClick={() => setOwnership("third_party")}
                title="Someone else's"
                sub={
                  config.hourly_rate_pence
                    ? `${fmtPounds(config.hourly_rate_pence)}/hr + parts`
                    : "Chargeable"
                }
              />
            )}
          </div>
        </fieldset>
      </Section>

      {/* 2. Location */}
      <Section title="Location" step={2}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Site postcode">
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="LS1 4AP"
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 font-mono text-[13px]"
              required={!coords}
            />
          </Field>
          <button
            type="button"
            onClick={shareLocation}
            disabled={locating}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md px-4 text-[11px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a6 6 0 0 0-6 6c0 5 6 12 6 12s6-7 6-12a6 6 0 0 0-6-6z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
            {locating ? "Locating…" : "Share live location"}
          </button>
        </div>
        {coords && (
          <p className="mt-2 rounded-md bg-green-50 px-2 py-1.5 text-[11px] font-bold text-green-800">
            ✓ Location captured: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        )}
        {locError && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-900">
            {locError}
          </p>
        )}
      </Section>

      {/* 3. Issue triage */}
      <Section title="Issue triage" step={3}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="When did it start?">
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            >
              <option value="">Choose…</option>
              {TIMELINE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What was it doing?">
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            >
              <option value="">Choose…</option>
              {ACTIVITY.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="mt-3">
          <legend className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Symptoms (tap all that apply)
          </legend>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {SYMPTOMS.map((sym) => {
              const active = symptoms.includes(sym);
              return (
                <li key={sym}>
                  <button
                    type="button"
                    onClick={() => toggleSymptom(sym)}
                    className="rounded-full border-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest transition"
                    style={{
                      borderColor: active ? "#FFB300" : "#E5E7EB",
                      background: active ? "#FFF8E1" : "#FFFFFF",
                      color: "#0A0A0A"
                    }}
                    aria-pressed={active}
                  >
                    {sym}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <Field label="Anything else worth flagging?" className="mt-3">
          <textarea
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            rows={3}
            placeholder="Free text — what the operator saw, heard, smelled, or felt before the machine stalled."
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px]"
            maxLength={800}
          />
        </Field>
      </Section>

      {/* 4. Diagnostics */}
      <Section title="Machine diagnostics" step={4}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Hydraulic oil level">
            <select
              value={hydraulic}
              onChange={(e) => setHydraulic(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            >
              <option value="">Choose…</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fuel level">
            <select
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            >
              <option value="">Choose…</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fuel source">
            <select
              value={fuelSource}
              onChange={(e) => setFuelSource(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            >
              <option value="">Choose…</option>
              {FUEL_SOURCES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Battery">
            <select
              value={battery}
              onChange={(e) => setBattery(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            >
              <option value="">Choose…</option>
              {["Full", "Low", "Dead", "Don't know"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Warning lights on dash (optional)" className="mt-3">
          <input
            type="text"
            value={warningLights}
            onChange={(e) => setWarningLights(e.target.value)}
            placeholder="e.g. red engine, glow plug, hydraulic filter"
            className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
            maxLength={200}
          />
        </Field>
      </Section>

      {/* 5. Media */}
      <Section title="Photos + video (optional)" step={5}>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-800 hover:border-[#FFB300]">
            {uploading ? "Uploading…" : "+ Photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
              }}
            />
          </label>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-800 hover:border-[#FFB300]">
            {uploading ? "Uploading…" : "+ Video (60s max)"}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadVideo(f);
              }}
            />
          </label>
        </div>
        {(photos.length > 0 || video) && (
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <li key={i} className="relative overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="aspect-square h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-[14px] font-extrabold text-white"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
            {video && (
              <li className="relative overflow-hidden rounded-md bg-black">
                <video src={video} className="aspect-square h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setVideo("")}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-[14px] font-extrabold text-white"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            )}
          </ul>
        )}
      </Section>

      {/* 6. Contact */}
      <Section title="Contact + urgency" step={6}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Your name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dave M."
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
              required
              maxLength={60}
            />
          </Field>
          <Field label="Phone (WhatsApp preferred)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 …"
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 font-mono text-[13px]"
              required
              maxLength={20}
            />
          </Field>
        </div>
        <Field label="Urgency" className="mt-3">
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px]"
          >
            <option>On-site production stopped</option>
            <option>Critical — needed today</option>
            <option>Non-urgent — needed within 24-48h</option>
          </select>
        </Field>
      </Section>

      {/* 7. Payment terms (only when merchant has any activated) */}
      {ownership !== "our_hire" && availablePayments.length > 0 && (
        <Section title="Payment method" step={7}>
          <fieldset>
            <legend className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              How you&rsquo;d like to settle
            </legend>
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {availablePayments.map((p) => (
                <li key={p.key}>
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md border-2 p-3 text-[13px] font-bold text-neutral-800 transition"
                    style={{
                      borderColor: payment === p.key ? "#FFB300" : "#E5E7EB",
                      background: payment === p.key ? "#FFF8E1" : "#FFFFFF"
                    }}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={p.key}
                      checked={payment === p.key}
                      onChange={() => setPayment(p.key)}
                      className="h-4 w-4 accent-[#FFB300]"
                    />
                    {p.label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </Section>
      )}

      {/* 8. Terms */}
      <Section title="Terms of service" step={8}>
        {config.terms_of_service && (
          <div className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-700">
            {config.terms_of_service}
          </div>
        )}
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#FFB300]"
          />
          <span className="text-[12px] font-bold text-neutral-800">
            I&rsquo;ve read and accept the terms of service and understand any charges shown above.
          </span>
        </label>
      </Section>

      {/* Submit */}
      <div className="rounded-2xl bg-neutral-900 p-5 text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#FFB300]">
          Ready to report?
        </p>
        <p className="mt-1 text-[13px] text-neutral-300">
          Submitting sends every detail above straight to {merchantName}&rsquo;s WhatsApp so a
          technician can be dispatched with the right kit and parts.
        </p>
        <button
          type="submit"
          disabled={!terms || !waHref || !name || !phone || !machineType || sending}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "#DC2626" }}
        >
          🚨 Report breakdown now
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  step,
  children
}: {
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-black"
          style={{ background: "#FFB300" }}
        >
          {step}
        </span>
        <h2 className="text-[15px] font-extrabold text-neutral-900">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function OwnershipPill({
  active,
  onClick,
  title,
  sub
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-md border-2 p-3 text-left transition"
      style={{
        borderColor: active ? "#FFB300" : "#E5E7EB",
        background: active ? "#FFF8E1" : "#FFFFFF"
      }}
      aria-pressed={active}
    >
      <span className="text-[12px] font-extrabold uppercase tracking-widest text-neutral-900">
        {title}
      </span>
      <span className="text-[10px] text-neutral-600">{sub}</span>
    </button>
  );
}
