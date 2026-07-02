"use client";

// PlantHaulageWizard — reusable across all merchant apps that enable
// the plant_hire add-on. Two products under one roof:
//
//   Product A "Hire a machine" — customer picks from the merchant's own
//     fleet; delivery cost auto-derives from delivery_zones + rate card.
//   Product B "Move my machine" — full haulage-only workflow for a
//     third-party machine. Wizardised into 4 steps so the ~30 fields
//     stay usable on mobile.
//
// Both flows end in a rich WhatsApp handoff to the merchant so dispatch
// sees the entire report before agreeing.

import { useMemo, useRef, useState } from "react";
import {
  DEFAULT_TRAILER_BANDS,
  HAULAGE_ACCESS_TYPES,
  HAULAGE_LOAD_METHODS,
  PLANT_CATEGORIES,
  haulageRegFlags,
  pickTrailerBand,
  type HaulageTrailerBand,
  type PlantCategoryConfig,
  type PlantCategorySlug,
  type PlantHaulageService
} from "@/lib/plantHire";

type FleetItem = {
  slug: PlantCategorySlug;
  label: string;
  emoji: string;
  cfg: PlantCategoryConfig;
};

type Props = {
  merchantName: string;
  waHref: string | null;
  config: PlantHaulageService;
  depotPostcode: string;
  fleet: FleetItem[];
};

type Product = "hire" | "move" | null;

export function PlantHaulageWizard({
  merchantName,
  waHref,
  config,
  depotPostcode,
  fleet
}: Props) {
  const [product, setProduct] = useState<Product>(null);

  if (product === null) {
    return (
      <ProductPicker
        onPick={setProduct}
        hireEnabled={config.own_fleet_enabled && fleet.length > 0}
        moveEnabled={config.third_party_enabled}
      />
    );
  }
  if (product === "hire") {
    return (
      <HireFlow
        merchantName={merchantName}
        waHref={waHref}
        config={config}
        depotPostcode={depotPostcode}
        fleet={fleet}
        onBack={() => setProduct(null)}
      />
    );
  }
  return (
    <MoveFlow
      merchantName={merchantName}
      waHref={waHref}
      config={config}
      onBack={() => setProduct(null)}
    />
  );
}

// ─── Product picker ─────────────────────────────────────────────────

function ProductPicker({
  onPick,
  hireEnabled,
  moveEnabled
}: {
  onPick: (p: Product) => void;
  hireEnabled: boolean;
  moveEnabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <button
        type="button"
        disabled={!hireEnabled}
        onClick={() => onPick("hire")}
        className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl border p-6 text-left transition ${
          hireEnabled
            ? "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-lg"
            : "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60"
        }`}
      >
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Product A
          </p>
          <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900">
            Hire &amp; delivery
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
            Pick a machine from our fleet. We deliver, you use it, we collect. All rates + delivery
            calculated live.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900">
          Choose a machine
          <span aria-hidden="true">→</span>
        </div>
        {!hireEnabled && (
          <span className="absolute right-4 top-4 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
            Fleet empty
          </span>
        )}
      </button>

      <button
        type="button"
        disabled={!moveEnabled}
        onClick={() => onPick("move")}
        className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl border p-6 text-left transition ${
          moveEnabled
            ? "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-[#DC2626] hover:shadow-lg"
            : "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60"
        }`}
      >
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#DC2626]">
            Product B
          </p>
          <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900">
            Move my machine
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
            You own the machine, we haul it. From beavertail plant runs to STGO abnormal
            loads with escort. Instant estimate, quote confirmed inside 30 min.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900">
          Get an estimate
          <span aria-hidden="true">→</span>
        </div>
        {!moveEnabled && (
          <span className="absolute right-4 top-4 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
            Not offered
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Wizard shell ───────────────────────────────────────────────────

function WizardShell({
  step,
  total,
  title,
  onBack,
  onExit,
  children
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
  onExit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack ?? onExit}
          className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:text-neutral-900"
        >
          ← Back
        </button>
        <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < step ? "w-6 bg-[#FFB300]" : "w-3 bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 transition hover:text-neutral-900"
        >
          Exit
        </button>
      </div>
      <h2 className="text-[18px] font-extrabold text-neutral-900 sm:text-[20px]">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ─── Product A — Hire flow ──────────────────────────────────────────

type HireState = {
  slug: PlantCategorySlug | null;
  customModel: string;
  duration: "day" | "week" | "month" | "";
  quantity: number;
  operator: boolean;
  attachments: string;
  deliveryPostcode: string;
  siteAddress: string;
  access: string;
  dateFrom: string;
  dateTo: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

function HireFlow({
  merchantName,
  waHref,
  config,
  depotPostcode,
  fleet,
  onBack
}: {
  merchantName: string;
  waHref: string | null;
  config: PlantHaulageService;
  depotPostcode: string;
  fleet: FleetItem[];
  onBack: () => void;
}) {
  const [step, setStep] = useState(1);
  const [s, setS] = useState<HireState>({
    slug: null,
    customModel: "",
    duration: "",
    quantity: 1,
    operator: false,
    attachments: "",
    deliveryPostcode: "",
    siteAddress: "",
    access: "hardstanding",
    dateFrom: "",
    dateTo: "",
    name: "",
    phone: "",
    email: "",
    notes: ""
  });
  const update = (patch: Partial<HireState>) => setS((p) => ({ ...p, ...patch }));

  const totalSteps = 3;
  const machineMeta = s.slug ? PLANT_CATEGORIES.find((m) => m.slug === s.slug) ?? null : null;
  const fleetItem = s.slug ? fleet.find((f) => f.slug === s.slug) ?? null : null;

  // Derived rate estimate
  const rateEstimate = useMemo(() => {
    if (!fleetItem || !s.duration) return null;
    const cfg = fleetItem.cfg;
    const dayP = cfg.price_day_pence ?? 0;
    const weekP = cfg.price_week_pence ?? 0;
    const monthP = cfg.price_month_pence ?? 0;
    const perUnit = s.duration === "day" ? dayP : s.duration === "week" ? weekP : monthP;
    return perUnit * s.quantity;
  }, [fleetItem, s.duration, s.quantity]);

  const canStep1 = (s.slug || s.customModel.length > 2) && !!s.duration;
  const canStep2 =
    s.deliveryPostcode.trim().length >= 3 && s.dateFrom.length === 10 && s.access.length > 0;
  const canStep3 = s.name.trim().length > 1 && s.phone.trim().length >= 6;

  const submit = () => {
    const machineLabel =
      machineMeta?.label ?? (s.customModel ? s.customModel : "Machine — not specified");
    const parts: string[] = [
      `📦 *HIRE ENQUIRY — ${merchantName}*`,
      "",
      `🚜 Machine: ${machineLabel}${s.quantity > 1 ? ` × ${s.quantity}` : ""}`,
      `⏱ Duration: ${s.duration}`,
      s.operator ? "👷 Operator: Yes" : "👷 Operator: No — self-drive",
      s.attachments ? `🪝 Attachments: ${s.attachments}` : ""
    ];
    parts.push("");
    parts.push(`📍 Delivery to: ${s.deliveryPostcode}${s.siteAddress ? ` — ${s.siteAddress}` : ""}`);
    parts.push(`🛣 Access at site: ${s.access}`);
    parts.push(`📅 Dates: ${s.dateFrom}${s.dateTo ? ` → ${s.dateTo}` : ""}`);
    parts.push("");
    parts.push(`👤 Name: ${s.name}`);
    parts.push(`📞 Phone: ${s.phone}`);
    if (s.email) parts.push(`📧 Email: ${s.email}`);
    if (s.notes) parts.push(`📝 Notes: ${s.notes}`);
    if (rateEstimate) {
      parts.push("");
      parts.push(`💷 Estimated hire cost (excl delivery): £${(rateEstimate / 100).toFixed(2)}`);
    }
    if (depotPostcode) parts.push(`🏭 Depot origin: ${depotPostcode}`);
    parts.push("");
    parts.push("Sent from the plant hire wizard — please confirm availability and quote.");
    const msg = encodeURIComponent(parts.filter((p) => p !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <WizardShell
      step={step}
      total={totalSteps}
      title={
        step === 1
          ? "Step 1 — Pick a machine"
          : step === 2
            ? "Step 2 — Where and when"
            : "Step 3 — Your contact details"
      }
      onBack={step > 1 ? () => setStep(step - 1) : undefined}
      onExit={onBack}
    >
      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Pick a machine from our fleet
          </label>
          <MachineTilePicker
            fleet={fleet}
            selected={s.slug}
            onSelect={(slug) => update({ slug, customModel: "" })}
          />
          {s.slug && (
            <p className="text-[11px] text-neutral-500">
              Selected: <strong className="text-neutral-900">
                {fleetItem?.cfg.sub_types?.[0] ?? machineMeta?.label}
              </strong>{" "}
              — tap a different tile to change.
            </p>
          )}
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Not listed? Type a specific model
            </label>
            <input
              type="text"
              placeholder="e.g. JCB 8018 CTS with hydraulic thumb"
              value={s.customModel}
              onChange={(e) => update({ customModel: e.target.value, slug: null })}
              className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300]"
            />
            <p className="mt-2 text-[11px] text-neutral-500">
              We&rsquo;ll confirm availability + price on WhatsApp. Depot may source from partners.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["day", "week", "month"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => update({ duration: d })}
                className={`h-12 rounded-xl border text-[13px] font-extrabold uppercase tracking-widest transition ${
                  s.duration === d
                    ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
                }`}
              >
                {d === "day" ? "1 day" : d === "week" ? "1 week" : "1 month+"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Quantity
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={s.quantity}
                onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={s.operator}
                onChange={(e) => update({ operator: e.target.checked })}
                className="h-5 w-5 rounded border-neutral-300 accent-[#FFB300]"
              />
              <span className="text-[13px] font-bold text-neutral-900">Include an operator</span>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Attachments needed (optional)
            </span>
            <input
              type="text"
              placeholder="e.g. breaker + 300mm bucket"
              value={s.attachments}
              onChange={(e) => update({ attachments: e.target.value })}
              className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
            />
          </label>

          {rateEstimate !== null && rateEstimate > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Estimated hire (excl delivery)
              </p>
              <p className="mt-1 text-[24px] font-extrabold text-neutral-900">
                £{(rateEstimate / 100).toFixed(2)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Confirmed on WhatsApp within 30 minutes. Delivery calculated from your postcode.
              </p>
            </div>
          )}

          <NextRow disabled={!canStep1} onNext={() => setStep(2)} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Delivery postcode
              </span>
              <input
                type="text"
                value={s.deliveryPostcode}
                onChange={(e) => update({ deliveryPostcode: e.target.value.toUpperCase() })}
                placeholder="e.g. LS10 1LG"
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] font-bold uppercase text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Site address (optional)
              </span>
              <input
                type="text"
                value={s.siteAddress}
                onChange={(e) => update({ siteAddress: e.target.value })}
                placeholder="Access gate / site name"
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
              />
            </label>
          </div>

          <label className="block text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Site access
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {HAULAGE_ACCESS_TYPES.map((a) => (
              <button
                key={a.slug}
                type="button"
                onClick={() => update({ access: a.slug })}
                className={`h-11 rounded-xl border px-2 text-[12px] font-bold transition ${
                  s.access === a.slug
                    ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Start date
              </span>
              <input
                type="date"
                value={s.dateFrom}
                onChange={(e) => update({ dateFrom: e.target.value })}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Collection date (optional)
              </span>
              <input
                type="date"
                value={s.dateTo}
                onChange={(e) => update({ dateTo: e.target.value })}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
              />
            </label>
          </div>

          <NextRow disabled={!canStep2} onNext={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Your name"
              value={s.name}
              onChange={(v) => update({ name: v })}
              placeholder="Full name"
            />
            <TextField
              label="WhatsApp / phone"
              value={s.phone}
              onChange={(v) => update({ phone: v })}
              placeholder="+44…"
              inputMode="tel"
            />
            <TextField
              label="Email (optional)"
              value={s.email}
              onChange={(v) => update({ email: v })}
              placeholder="you@example.com"
              inputMode="email"
            />
          </div>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Anything else? (optional)
            </span>
            <textarea
              value={s.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
            />
          </label>
          <SubmitRow disabled={!canStep3} label="Send on WhatsApp →" onSubmit={submit} />
        </div>
      )}
    </WizardShell>
  );
}

// ─── Product B — Move my machine flow ───────────────────────────────

type MoveState = {
  // Step 1 — machine identity
  make: string;
  model: string;
  year: string;
  serial: string;
  category: string;
  condition: string;
  boomOff: boolean;
  bucketOff: boolean;
  counterweightOff: boolean;
  fuelDrained: boolean;
  // Step 2 — dimensions + weight
  length_mm: string;
  width_mm: string;
  height_mm: string;
  weight_kg: string;
  // Step 3 — locations + timing
  pickupPostcode: string;
  pickupAddress: string;
  pickupAccess: string;
  loadingMethod: string;
  deliveryPostcode: string;
  deliveryAddress: string;
  deliveryAccess: string;
  unloadingMethod: string;
  distanceMiles: string;
  earliest: string;
  latest: string;
  weekendOk: boolean;
  overnightOk: boolean;
  escortSupplier: "haulier" | "customer" | "unsure";
  handlesNotifications: boolean;
  // Step 4 — media + contact
  photoUrls: string[];
  videoUrl: string;
  declaredValue: string;
  name: string;
  phone: string;
  email: string;
  termsAccepted: boolean;
  notes: string;
};

const MACHINE_MAKES = [
  "JCB", "Kubota", "Caterpillar", "Komatsu", "Volvo", "Hitachi", "Doosan",
  "Bobcat", "Takeuchi", "Wacker Neuson", "Hyundai", "Case", "New Holland",
  "Manitou", "Merlo", "Bomag", "Thwaites", "Terex", "Genie", "JLG", "Other"
];

const MACHINE_CONDITIONS = [
  { slug: "runner", label: "Runner — drives on/off ramps", surcharge: false },
  { slug: "non_runner", label: "Non-runner — needs winch", surcharge: true },
  { slug: "under_service", label: "Under service / partially dismantled", surcharge: true },
  { slug: "damaged", label: "Damaged / crash recovery", surcharge: true },
  { slug: "auction", label: "Auction pickup / port collection", surcharge: false },
  { slug: "ex_import", label: "Ex-import — sealed unit", surcharge: false }
];

function MoveFlow({
  merchantName,
  waHref,
  config,
  onBack
}: {
  merchantName: string;
  waHref: string | null;
  config: PlantHaulageService;
  onBack: () => void;
}) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [s, setS] = useState<MoveState>({
    make: "",
    model: "",
    year: "",
    serial: "",
    category: "",
    condition: "runner",
    boomOff: false,
    bucketOff: false,
    counterweightOff: false,
    fuelDrained: false,
    length_mm: "",
    width_mm: "",
    height_mm: "",
    weight_kg: "",
    pickupPostcode: "",
    pickupAddress: "",
    pickupAccess: "hardstanding",
    loadingMethod: "self_drive",
    deliveryPostcode: "",
    deliveryAddress: "",
    deliveryAccess: "hardstanding",
    unloadingMethod: "self_drive",
    distanceMiles: "",
    earliest: "",
    latest: "",
    weekendOk: false,
    overnightOk: false,
    escortSupplier: "haulier",
    handlesNotifications: config.handles_notifications,
    photoUrls: [],
    videoUrl: "",
    declaredValue: "",
    name: "",
    phone: "",
    email: "",
    termsAccepted: false,
    notes: ""
  });
  const update = (patch: Partial<MoveState>) => setS((p) => ({ ...p, ...patch }));

  const dims = {
    width_mm: Number(s.width_mm) || 0,
    height_mm: Number(s.height_mm) || 0,
    length_mm: Number(s.length_mm) || 0,
    weight_kg: Number(s.weight_kg) || 0
  };
  const regs = haulageRegFlags(dims);
  const band = pickTrailerBand(dims.weight_kg, config.trailer_bands.length ? config.trailer_bands : DEFAULT_TRAILER_BANDS);
  const conditionMeta = MACHINE_CONDITIONS.find((c) => c.slug === s.condition);

  // Live estimate
  const estimate = useMemo(() => {
    if (!band || band.quote_only) return null;
    const miles = Number(s.distanceMiles) || 0;
    if (miles <= 0) return null;
    let total = (band.fixed_pence ?? 0) + miles * (band.per_mile_pence ?? 0);
    if (conditionMeta?.surcharge) total += config.non_runner_surcharge_pence ?? 0;
    if (regs.private_escort_required || regs.police_escort_required) {
      if (s.escortSupplier === "haulier") {
        total += config.escort_per_day_pence ?? 0;
      }
      if (regs.police_escort_required && config.handles_notifications) {
        total += config.police_escort_notification_pence ?? 0;
      }
    }
    if (s.weekendOk) {
      const mult = (config.weekend_multiplier_percent ?? 100) / 100;
      total = Math.round(total * mult);
    }
    if (s.overnightOk) total += config.overnight_standby_pence ?? 0;
    if (Number(s.declaredValue) > 0 && (config.insurance_percent ?? 0) > 0) {
      total += Math.round((Number(s.declaredValue) * 100 * (config.insurance_percent ?? 0)) / 10000);
    }
    return total;
  }, [band, conditionMeta, config, regs, s.distanceMiles, s.escortSupplier, s.weekendOk, s.overnightOk, s.declaredValue]);

  const canStep1 =
    s.make.length > 0 && s.model.length > 0 && s.condition.length > 0;
  const canStep2 =
    dims.length_mm > 0 && dims.width_mm > 0 && dims.height_mm > 0 && dims.weight_kg > 0;
  const canStep3 =
    s.pickupPostcode.length >= 3 && s.deliveryPostcode.length >= 3 && s.earliest.length === 10;
  const canStep4 =
    s.name.length > 1 && s.phone.length >= 6 && s.termsAccepted && s.photoUrls.length >= 3;

  const submit = () => {
    const p: string[] = [
      `🚛 *HAULAGE ENQUIRY — ${merchantName}*`,
      `_Move my machine flow_`,
      "",
      `*Machine*`,
      `${s.make} ${s.model}${s.year ? ` (${s.year})` : ""}${s.category ? ` — ${s.category}` : ""}`,
      s.serial ? `Serial/PIN: ${s.serial}` : "",
      `Condition: ${conditionMeta?.label ?? s.condition}`,
      s.boomOff || s.bucketOff || s.counterweightOff || s.fuelDrained
        ? `Prep: ${[
            s.boomOff && "boom removed",
            s.bucketOff && "bucket removed",
            s.counterweightOff && "counterweight removed",
            s.fuelDrained && "fuel drained"
          ]
            .filter(Boolean)
            .join(", ")}`
        : "",
      "",
      `*Dimensions (transit)*`,
      `L ${dims.length_mm}mm · W ${dims.width_mm}mm · H ${dims.height_mm}mm · ${dims.weight_kg}kg`,
      band ? `Trailer band: ${band.label}` : "",
      regs.wide_load ? "⚠️ WIDE LOAD" : "",
      regs.private_escort_required ? "⚠️ PRIVATE ESCORT REQUIRED" : "",
      regs.police_escort_required ? "🚨 POLICE ESCORT REQUIRED" : "",
      regs.route_survey_required ? "⚠️ ROUTE SURVEY (bridge strike risk)" : "",
      regs.stgo_cat_2_required ? "⚠️ STGO CAT 2 (>44T)" : "",
      regs.stgo_cat_3_required ? "🚨 STGO CAT 3 (>80T — VR1)" : "",
      "",
      `*Pickup*`,
      `${s.pickupPostcode}${s.pickupAddress ? ` — ${s.pickupAddress}` : ""}`,
      `Access: ${s.pickupAccess} · Loading: ${s.loadingMethod}`,
      "",
      `*Delivery*`,
      `${s.deliveryPostcode}${s.deliveryAddress ? ` — ${s.deliveryAddress}` : ""}`,
      `Access: ${s.deliveryAccess} · Unloading: ${s.unloadingMethod}`,
      s.distanceMiles ? `Distance: ${s.distanceMiles} miles` : "",
      "",
      `*Timing*`,
      `Earliest: ${s.earliest}${s.latest ? ` · Latest: ${s.latest}` : ""}`,
      s.weekendOk ? "✓ Weekend OK" : "",
      s.overnightOk ? "✓ Overnight standby OK" : "",
      "",
      `*Escort / notifications*`,
      `Escort supplier: ${
        s.escortSupplier === "haulier"
          ? "Haulier supplies"
          : s.escortSupplier === "customer"
            ? "Customer supplies"
            : "Not sure — please advise"
      }`,
      `Notifications: ${s.handlesNotifications ? "Haulier handles STGO / VR1" : "Customer has notified"}`,
      "",
      s.declaredValue ? `Declared value: £${Number(s.declaredValue).toLocaleString()}` : "",
      "",
      s.photoUrls.length
        ? `*Photos (${s.photoUrls.length})*\n${s.photoUrls.join("\n")}`
        : "",
      s.videoUrl ? `Video: ${s.videoUrl}` : "",
      "",
      `*Contact*`,
      `${s.name} · ${s.phone}${s.email ? ` · ${s.email}` : ""}`,
      s.notes ? `Notes: ${s.notes}` : "",
      "",
      estimate ? `💷 Live estimate: £${(estimate / 100).toFixed(2)} (confirmed on reply)` : "",
      "",
      `Terms accepted: ${s.termsAccepted ? "yes" : "no"}`
    ];
    const msg = encodeURIComponent(p.filter((x) => x !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <WizardShell
      step={step}
      total={totalSteps}
      title={
        step === 1
          ? "Step 1 — Machine identity"
          : step === 2
            ? "Step 2 — Dimensions & weight"
            : step === 3
              ? "Step 3 — Locations & timing"
              : "Step 4 — Photos & contact"
      }
      onBack={step > 1 ? () => setStep(step - 1) : undefined}
      onExit={onBack}
    >
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Make
              </span>
              <select
                value={s.make}
                onChange={(e) => update({ make: e.target.value })}
                className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
              >
                <option value="">— pick make —</option>
                {MACHINE_MAKES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <TextField
              label="Model"
              value={s.model}
              onChange={(v) => update({ model: v })}
              placeholder="e.g. 8018 CTS"
            />
            <TextField
              label="Year"
              value={s.year}
              onChange={(v) => update({ year: v.replace(/[^0-9]/g, "").slice(0, 4) })}
              placeholder="2019"
              inputMode="numeric"
            />
            <TextField
              label="Serial / PIN (optional)"
              value={s.serial}
              onChange={(v) => update({ serial: v })}
              placeholder="JCB1XXXXXXXXX"
            />
            <TextField
              label="Category (optional)"
              value={s.category}
              onChange={(v) => update({ category: v })}
              placeholder="Mini excavator, dumper, telehandler…"
            />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Machine condition
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MACHINE_CONDITIONS.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => update({ condition: c.slug })}
                  className={`h-14 rounded-xl border px-3 text-left text-[13px] font-bold transition ${
                    s.condition === c.slug
                      ? "border-[#DC2626] bg-red-50 text-red-800"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {c.label}
                  {c.surcharge && (
                    <span className="ml-2 text-[10px] font-extrabold uppercase text-red-500">
                      + surcharge
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Prep for transit (optional)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Boom / arm removed" value={s.boomOff} onChange={(v) => update({ boomOff: v })} />
              <Toggle label="Bucket removed" value={s.bucketOff} onChange={(v) => update({ bucketOff: v })} />
              <Toggle
                label="Counterweight removed"
                value={s.counterweightOff}
                onChange={(v) => update({ counterweightOff: v })}
              />
              <Toggle
                label="Fuel drained"
                value={s.fuelDrained}
                onChange={(v) => update({ fuelDrained: v })}
              />
            </div>
          </div>

          <NextRow disabled={!canStep1} onNext={() => setStep(2)} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[12px] text-neutral-500">
            <strong className="text-neutral-900">Transit position dimensions</strong> — not the
            working position. Get these from the spec plate or manufacturer's PDF.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TextField
              label="Length (mm)"
              value={s.length_mm}
              onChange={(v) => update({ length_mm: v.replace(/[^0-9]/g, "").slice(0, 7) })}
              placeholder="5300"
              inputMode="numeric"
            />
            <TextField
              label="Width (mm)"
              value={s.width_mm}
              onChange={(v) => update({ width_mm: v.replace(/[^0-9]/g, "").slice(0, 7) })}
              placeholder="1900"
              inputMode="numeric"
            />
            <TextField
              label="Height (mm)"
              value={s.height_mm}
              onChange={(v) => update({ height_mm: v.replace(/[^0-9]/g, "").slice(0, 7) })}
              placeholder="2500"
              inputMode="numeric"
            />
            <TextField
              label="Weight (kg)"
              value={s.weight_kg}
              onChange={(v) => update({ weight_kg: v.replace(/[^0-9]/g, "").slice(0, 7) })}
              placeholder="6000"
              inputMode="numeric"
            />
          </div>

          {band && (
            <div
              className={`rounded-2xl border p-4 ${
                band.quote_only ? "border-red-200 bg-red-50" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Trailer band (auto-picked)
              </p>
              <p className="mt-1 text-[16px] font-extrabold text-neutral-900">{band.label}</p>
              {!band.quote_only && band.fixed_pence !== null && (
                <p className="mt-1 text-[12px] text-neutral-600">
                  Base £{((band.fixed_pence ?? 0) / 100).toFixed(2)} + £
                  {((band.per_mile_pence ?? 0) / 100).toFixed(2)}/mile — estimate only.
                </p>
              )}
              {band.quote_only && (
                <p className="mt-1 text-[12px] text-red-800">
                  Abnormal load — quote confirmed after route survey.
                </p>
              )}
            </div>
          )}

          <RegFlags regs={regs} />

          <NextRow disabled={!canStep2} onNext={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Pickup
              </p>
              <TextField
                label="Postcode"
                value={s.pickupPostcode}
                onChange={(v) => update({ pickupPostcode: v.toUpperCase() })}
                placeholder="LS10 1LG"
              />
              <TextField
                label="Address / site name"
                value={s.pickupAddress}
                onChange={(v) => update({ pickupAddress: v })}
                placeholder="Yard / site name"
              />
              <SelectField
                label="Access"
                value={s.pickupAccess}
                options={HAULAGE_ACCESS_TYPES.map((a) => ({ slug: a.slug, label: a.label }))}
                onChange={(v) => update({ pickupAccess: v })}
              />
              <SelectField
                label="Loading method"
                value={s.loadingMethod}
                options={HAULAGE_LOAD_METHODS.map((m) => ({ slug: m.slug, label: m.label }))}
                onChange={(v) => update({ loadingMethod: v })}
              />
            </div>
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                Delivery
              </p>
              <TextField
                label="Postcode"
                value={s.deliveryPostcode}
                onChange={(v) => update({ deliveryPostcode: v.toUpperCase() })}
                placeholder="M1 1AA"
              />
              <TextField
                label="Address / site name"
                value={s.deliveryAddress}
                onChange={(v) => update({ deliveryAddress: v })}
                placeholder="Yard / site name"
              />
              <SelectField
                label="Access"
                value={s.deliveryAccess}
                options={HAULAGE_ACCESS_TYPES.map((a) => ({ slug: a.slug, label: a.label }))}
                onChange={(v) => update({ deliveryAccess: v })}
              />
              <SelectField
                label="Unloading method"
                value={s.unloadingMethod}
                options={HAULAGE_LOAD_METHODS.map((m) => ({ slug: m.slug, label: m.label }))}
                onChange={(v) => update({ unloadingMethod: v })}
              />
            </div>
          </div>

          <TextField
            label="Approximate distance (miles) — optional but gives live estimate"
            value={s.distanceMiles}
            onChange={(v) => update({ distanceMiles: v.replace(/[^0-9]/g, "").slice(0, 4) })}
            placeholder="Look it up on Google Maps between the two postcodes"
            inputMode="numeric"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Earliest date"
              value={s.earliest}
              onChange={(v) => update({ earliest: v })}
              placeholder=""
              type="date"
            />
            <TextField
              label="Latest date (optional)"
              value={s.latest}
              onChange={(v) => update({ latest: v })}
              placeholder=""
              type="date"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Weekend OK (surcharge)" value={s.weekendOk} onChange={(v) => update({ weekendOk: v })} />
            <Toggle
              label="Overnight standby OK"
              value={s.overnightOk}
              onChange={(v) => update({ overnightOk: v })}
            />
          </div>

          {(regs.private_escort_required || regs.police_escort_required) && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">
                Escort required
              </p>
              <div className="mt-2 flex gap-2">
                {(["haulier", "customer", "unsure"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update({ escortSupplier: opt })}
                    className={`h-10 flex-1 rounded-xl border px-2 text-[12px] font-bold transition ${
                      s.escortSupplier === opt
                        ? "border-amber-500 bg-white text-amber-900"
                        : "border-amber-200 bg-white/60 text-amber-700"
                    }`}
                  >
                    {opt === "haulier"
                      ? "Haulier supplies"
                      : opt === "customer"
                        ? "I supply"
                        : "Not sure"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {estimate !== null && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-900 p-4 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/60">
                Live estimate (all-in)
              </p>
              <p className="mt-1 text-[26px] font-extrabold">£{(estimate / 100).toFixed(2)}</p>
              <p className="mt-1 text-[11px] text-white/60">
                Estimate only — final quote confirmed by {merchantName} within 30 min.
              </p>
            </div>
          )}

          <NextRow disabled={!canStep3} onNext={() => setStep(4)} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <PhotoUploader
            label="Machine photos (min 3 — front, sides, back)"
            values={s.photoUrls}
            onChange={(urls) => update({ photoUrls: urls })}
          />
          <TextField
            label="Video walkaround URL (optional — YouTube / Vimeo)"
            value={s.videoUrl}
            onChange={(v) => update({ videoUrl: v })}
            placeholder="https://"
          />
          <TextField
            label="Declared machine value (£)"
            value={s.declaredValue}
            onChange={(v) => update({ declaredValue: v.replace(/[^0-9]/g, "").slice(0, 10) })}
            placeholder="e.g. 25000"
            inputMode="numeric"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Your name"
              value={s.name}
              onChange={(v) => update({ name: v })}
              placeholder="Full name"
            />
            <TextField
              label="WhatsApp / phone"
              value={s.phone}
              onChange={(v) => update({ phone: v })}
              placeholder="+44…"
              inputMode="tel"
            />
            <TextField
              label="Email (optional)"
              value={s.email}
              onChange={(v) => update({ email: v })}
              placeholder="you@example.com"
              inputMode="email"
            />
          </div>

          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Anything else? (optional)
            </span>
            <textarea
              value={s.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
            />
          </label>

          {config.terms_of_service && (
            <details className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <summary className="cursor-pointer text-[11px] font-extrabold uppercase tracking-widest text-neutral-700">
                Haulage terms of service
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-600">
                {config.terms_of_service}
              </p>
            </details>
          )}

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={s.termsAccepted}
              onChange={(e) => update({ termsAccepted: e.target.checked })}
              className="mt-0.5 h-5 w-5 rounded border-neutral-300 accent-[#DC2626]"
            />
            <span className="text-[12px] font-bold text-neutral-800">
              I confirm the details above are accurate and accept {merchantName}&rsquo;s haulage
              terms.
            </span>
          </label>

          <SubmitRow disabled={!canStep4} label="Send report on WhatsApp →" onSubmit={submit} />
        </div>
      )}
    </WizardShell>
  );
}

// ─── Machine tile picker (real images) ─────────────────────────────

function MachineTilePicker({
  fleet,
  selected,
  onSelect
}: {
  fleet: FleetItem[];
  selected: PlantCategorySlug | null;
  onSelect: (slug: PlantCategorySlug) => void;
}) {
  if (fleet.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
        <p className="text-[12px] font-bold text-neutral-500">
          No machines configured yet. Ask the merchant to enable machines in their dashboard.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {fleet.map((f) => {
        const isSelected = selected === f.slug;
        const img = f.cfg.image_url || f.cfg.gallery_urls?.[0] || "";
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onSelect(f.slug)}
            className={`group flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition ${
              isSelected
                ? "border-[#FFB300] shadow-lg ring-2 ring-[#FFB300]"
                : "border-neutral-200 hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
            }`}
          >
            <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-neutral-100">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={f.label}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-2"
                />
              ) : (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center"
                  style={{
                    background:
                      "linear-gradient(135deg, #1f2937 0%, #111827 60%, #0a0a0a 100%)"
                  }}
                >
                  <span
                    className="text-[9px] font-extrabold uppercase tracking-[0.22em]"
                    style={{ color: "#FFB300" }}
                  >
                    Photo pending
                  </span>
                  <span className="text-[11px] font-bold leading-tight text-white/80">
                    {f.label}
                  </span>
                  <span className="text-[9px] font-bold text-white/40">
                    Merchant to upload
                  </span>
                </div>
              )}
              {isSelected && (
                <span className="absolute right-2 top-2 rounded-full bg-[#FFB300] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900">
                  ✓ Selected
                </span>
              )}
              {f.cfg.for_sale && (
                <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
                  Also for sale
                </span>
              )}
            </div>
            <div className="flex-1 p-3">
              <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                {f.label}
              </p>
              {f.cfg.price_day_pence && f.cfg.price_day_pence > 0 && (
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  from £{(f.cfg.price_day_pence / 100).toFixed(0)}/day
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Field helpers ──────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { slug: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:bg-white"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-3 text-left text-[12px] font-bold transition ${
        value
          ? "border-[#FFB300] bg-[#FFB300]/10 text-neutral-900"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-block h-4 w-8 rounded-full transition ${
          value ? "bg-[#FFB300]" : "bg-neutral-300"
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

function NextRow({ disabled, onNext }: { disabled: boolean; onNext: () => void }) {
  return (
    <div className="flex justify-end pt-2">
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className={`inline-flex h-11 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
          disabled
            ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
            : "bg-neutral-900 text-white hover:bg-black"
        }`}
      >
        Continue →
      </button>
    </div>
  );
}

function SubmitRow({
  disabled,
  onSubmit,
  label
}: {
  disabled: boolean;
  onSubmit: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end pt-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className={`inline-flex h-12 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
          disabled ? "cursor-not-allowed bg-neutral-200 text-neutral-500" : "bg-[#25D366] text-white hover:brightness-95"
        }`}
      >
        {label}
      </button>
    </div>
  );
}

function RegFlags({ regs }: { regs: ReturnType<typeof haulageRegFlags> }) {
  const flags: { severity: "amber" | "red"; label: string }[] = [];
  if (regs.wide_load) flags.push({ severity: "amber", label: "Wide load (>2.55m) — traffic notice recommended" });
  if (regs.private_escort_required) flags.push({ severity: "amber", label: "Private escort required (>3.0m wide or >18.65m long)" });
  if (regs.police_escort_required) flags.push({ severity: "red", label: "Police escort required — 2 working days' notice to National Highways" });
  if (regs.route_survey_required) flags.push({ severity: "red", label: "Route survey required — bridge strike risk (>4.95m tall)" });
  if (regs.stgo_cat_2_required) flags.push({ severity: "amber", label: "STGO Cat 2 tractor + low loader required (>44T)" });
  if (regs.stgo_cat_3_required) flags.push({ severity: "red", label: "STGO Cat 3 abnormal load — VR1 form required (>80T)" });

  if (flags.length === 0) return null;
  return (
    <div className="space-y-2">
      {flags.map((f, i) => (
        <div
          key={i}
          className={`rounded-xl border px-3 py-2 text-[12px] font-bold ${
            f.severity === "red"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {f.severity === "red" ? "🚨 " : "⚠️ "}
          {f.label}
        </div>
      ))}
    </div>
  );
}

function PhotoUploader({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handle = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
        const j = (await r.json()) as { url?: string; error?: string };
        if (!r.ok || !j.url) throw new Error(j.error ?? "upload failed");
        uploaded.push(j.url);
      }
      onChange([...values, ...uploaded].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {values.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {values.map((u, i) => (
            <div
              key={u + i}
              className="group relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Machine ${i + 1}`} className="h-full w-full object-contain" />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-neutral-900/90 px-2 py-0.5 text-[10px] font-extrabold text-white opacity-0 transition group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label
        className={`flex h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-[12px] font-bold transition ${
          busy ? "border-neutral-300 text-neutral-400" : "border-neutral-300 text-neutral-500 hover:border-[#FFB300] hover:text-neutral-900"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handle(e.target.files)}
        />
        {busy ? "Uploading…" : values.length === 0 ? "Tap to upload photos" : "+ add more photos"}
      </label>
      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
      <p className="text-[11px] text-neutral-500">
        {values.length}/8 photos ·{" "}
        {values.length >= 3 ? "✓ minimum met" : `${3 - values.length} more required`}
      </p>
    </div>
  );
}
