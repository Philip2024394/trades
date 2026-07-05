// Booking flow templates — 4 seed flows registered here.
//
// Each flow is a strategy-aware React component + a manifest. The
// manifest declares which facets it consumes; the renderer receives
// facet-adapted props (services, cta label, deposit policy, gate,
// availability display) from StrategyAwareBookingFlow.
//
// New flows should be added here — don't hard-code flow selection
// anywhere else in the platform.

"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  MapPin,
  Palette,
  Phone,
  Store
} from "lucide-react";
import { useState } from "react";
import { bookingRegistry } from "./registry";
import type { BookingRendererProps } from "./types";

const P = { name: "Xrated Trades Platform", verified: true } as const;

// ─── Shared shell ─────────────────────────────────────────────
function Shell({
  title,
  step,
  totalSteps,
  onBack,
  children,
  footer
}: {
  title: string;
  step: number;
  totalSteps: number;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-[13px] text-neutral-500">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : (
          <span />
        )}
        <span>
          Step {step} of {totalSteps}
        </span>
      </div>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}

function humaniseServiceSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── 1. Simple service booking ────────────────────────────────
// Standard flow: pick service → date → info → confirm.
function SimpleServiceBookingRenderer(props: BookingRendererProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [choice, setChoice] = useState<Record<string, unknown>>({});
  const steps = ["service", "date", "info", "confirm"] as const;
  const totalSteps = steps.length;
  const step = steps[stepIdx];

  const next = (patch: Record<string, unknown>) => {
    setChoice((c) => ({ ...c, ...patch }));
    setStepIdx((i) => Math.min(i + 1, totalSteps - 1));
  };
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  if (step === "service") {
    return (
      <Shell title="Choose a service" step={1} totalSteps={totalSteps}>
        <ul className="flex flex-col gap-2">
          {props.services.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => next({ service: s })}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-left text-[13px] hover:border-neutral-900 hover:bg-neutral-50"
              >
                <span>
                  {humaniseServiceSlug(s)}
                  {i === 0 ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                      Featured
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </button>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  if (step === "date") {
    return (
      <Shell title="Choose a date" step={2} totalSteps={totalSteps} onBack={back}>
        <div className="rounded-xl border border-neutral-200 p-4 text-[13px] text-neutral-600">
          <CalendarDays className="mb-2 h-4 w-4 text-neutral-400" />
          {props.availabilityDisplay === "next-available"
            ? "Next available: today 4pm"
            : "Pick any weekday · 8am–6pm"}
        </div>
        <button
          type="button"
          onClick={() => next({ date: "2026-07-08T10:00" })}
          className="mt-4 w-full rounded-xl bg-neutral-900 py-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
        >
          Confirm date
        </button>
      </Shell>
    );
  }

  if (step === "info") {
    return (
      <Shell title="Your details" step={3} totalSteps={totalSteps} onBack={back}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            next({
              name: (f.elements.namedItem("name") as HTMLInputElement)?.value,
              phone: (f.elements.namedItem("phone") as HTMLInputElement)?.value,
              postcode: (f.elements.namedItem("postcode") as HTMLInputElement)?.value
            });
          }}
          className="flex flex-col gap-3 text-[13px]"
        >
          <input name="name" required placeholder="Your name" className="rounded-xl border border-neutral-200 px-4 py-3" />
          <input name="phone" required placeholder="Phone" className="rounded-xl border border-neutral-200 px-4 py-3" />
          <input name="postcode" required placeholder="Postcode" className="rounded-xl border border-neutral-200 px-4 py-3" />
          <button className="mt-2 rounded-xl bg-neutral-900 py-3 font-semibold text-white hover:bg-neutral-800">
            Continue
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Confirm" step={4} totalSteps={totalSteps} onBack={back}>
      <div className="rounded-xl bg-neutral-50 p-4 text-[13px] text-neutral-700">
        <div className="mb-1 font-semibold text-neutral-900">
          {humaniseServiceSlug(String(choice.service ?? ""))}
        </div>
        <div className="text-neutral-600">Booking summary — ready to send.</div>
      </div>
      <button
        type="button"
        onClick={() => props.onSubmit(choice)}
        className="mt-4 w-full rounded-xl bg-neutral-900 py-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
      >
        {props.primaryCtaLabel}
      </button>
    </Shell>
  );
}

bookingRegistry.register({
  manifestVersion: 1,
  slug: "simple-service-booking",
  name: "Simple service booking",
  description:
    "Standard flow: pick service → date → info → confirm. Suits residential trades with clear service list.",
  version: "1.0.0",
  flowKind: "simple",
  steps: [
    { key: "choose-service", order: 1, required: true },
    { key: "choose-date", order: 2, required: true },
    { key: "customer-info", order: 3, required: true, formId: "booking-info" },
    { key: "confirm", order: 4, required: true }
  ],
  policy: {
    minCustomerLeadHours: 24,
    maxAdvanceDays: 90,
    cancellationDeadlineHours: 24,
    reminderHours: [24, 2]
  },
  requiresPayment: false,
  requiresCalendarSync: true,
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "booking.priorityServices", optional: true },
    { kind: "booking.availabilityDisplay", optional: true }
  ],
  trades: ["*"],
  profileFlags: ["residential", "value", "premium"],
  renderer: SimpleServiceBookingRenderer,
  publisher: P
});

// ─── 2. Emergency callout ─────────────────────────────────────
// Emergency gate → Call Now / Book Emergency Visit
function EmergencyCalloutRenderer(props: BookingRendererProps) {
  const [chose, setChose] = useState<"call" | "visit" | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown>>({});

  if (chose === null) {
    return (
      <Shell title="Is this an emergency?" step={1} totalSteps={2}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-900">
          <AlertTriangle className="mb-2 h-4 w-4 text-red-600" />
          If you have a burst pipe, leak, or safety risk — call us now.
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setChose("call")}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-[13px] font-semibold text-white hover:bg-red-700"
          >
            <Phone className="h-4 w-4" /> Call Now
          </button>
          <button
            type="button"
            onClick={() => setChose("visit")}
            className="rounded-xl border border-neutral-300 py-3 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Book Emergency Visit
          </button>
        </div>
      </Shell>
    );
  }

  if (chose === "call") {
    return (
      <Shell title="Calling…" step={2} totalSteps={2} onBack={() => setChose(null)}>
        <div className="rounded-xl bg-neutral-50 p-4 text-center text-[13px] text-neutral-700">
          <Phone className="mx-auto mb-2 h-6 w-6 text-red-600" />
          Dial the number on the site header.
          <br />
          <span className="text-neutral-500">We aim to answer within 30 seconds.</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Emergency visit" step={2} totalSteps={2} onBack={() => setChose(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const payload = {
            urgency: "asap",
            name: (f.elements.namedItem("name") as HTMLInputElement)?.value,
            phone: (f.elements.namedItem("phone") as HTMLInputElement)?.value,
            postcode: (f.elements.namedItem("postcode") as HTMLInputElement)?.value,
            ...detail
          };
          void props.onSubmit(payload);
        }}
        className="flex flex-col gap-3 text-[13px]"
      >
        <input name="name" required placeholder="Your name" className="rounded-xl border border-neutral-200 px-4 py-3" />
        <input name="phone" required placeholder="Phone" className="rounded-xl border border-neutral-200 px-4 py-3" />
        <input name="postcode" required placeholder="Postcode" className="rounded-xl border border-neutral-200 px-4 py-3" />
        <div className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-600">
          <Clock className="mr-1 inline h-3.5 w-3.5" /> We aim to be on-site within 60 minutes.
        </div>
        <button className="mt-2 rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700">
          {props.primaryCtaLabel}
        </button>
      </form>
    </Shell>
  );
}

bookingRegistry.register({
  manifestVersion: 1,
  slug: "emergency-callout",
  name: "Emergency callout",
  description:
    "Emergency triage gate: Call Now / Book Emergency Visit. No service browsing.",
  version: "1.0.0",
  flowKind: "emergency",
  steps: [
    { key: "emergency-gate", order: 1, required: true },
    { key: "customer-info", order: 2, required: true, formId: "callback-request" }
  ],
  policy: {
    minCustomerLeadHours: 0,
    maxAdvanceDays: 1,
    reminderHours: []
  },
  requiresPayment: false,
  requiresCalendarSync: false,
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "booking.gate", optional: true },
    { kind: "booking.availabilityDisplay", optional: true }
  ],
  trades: ["*"],
  profileFlags: ["emergency"],
  renderer: EmergencyCalloutRenderer,
  publisher: P
});

// ─── 3. Consultation appointment ──────────────────────────────
// Luxury / design-led: consultation → showroom → budget → style → deposit
function ConsultationAppointmentRenderer(props: BookingRendererProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const showDeposit = props.depositPolicy !== "none";
  const steps = [
    "consultation",
    "showroom",
    "budget",
    "style",
    ...(showDeposit ? ["deposit"] : [])
  ] as string[];
  const totalSteps = steps.length;
  const step = steps[stepIdx];

  const next = (patch: Record<string, unknown>) => {
    setPayload((p) => ({ ...p, ...patch }));
    setStepIdx((i) => Math.min(i + 1, totalSteps - 1));
  };
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  if (step === "consultation") {
    return (
      <Shell title="Book design consultation" step={1} totalSteps={totalSteps}>
        <p className="text-[13px] text-neutral-600">
          A 60-minute consultation with a senior designer. Pick your preferred
          slot on the next screen.
        </p>
        <button
          type="button"
          onClick={() => next({ consultationRequested: true })}
          className="mt-4 w-full rounded-xl bg-neutral-900 py-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
        >
          Continue
        </button>
      </Shell>
    );
  }

  if (step === "showroom") {
    return (
      <Shell title="Showroom appointment" step={2} totalSteps={totalSteps} onBack={back}>
        <div className="flex flex-col gap-2">
          {["Thursday 10am", "Friday 2pm", "Saturday 11am"].map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => next({ showroomSlot: slot })}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left text-[13px] hover:border-neutral-900 hover:bg-neutral-50"
            >
              <Store className="h-4 w-4 text-neutral-400" />
              {slot}
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  if (step === "budget") {
    return (
      <Shell title="Project budget" step={3} totalSteps={totalSteps} onBack={back}>
        <div className="flex flex-col gap-2 text-[13px]">
          {[
            { v: "20-40k", l: "£20,000 – £40,000" },
            { v: "40-80k", l: "£40,000 – £80,000" },
            { v: "80k-plus", l: "£80,000+" }
          ].map((b) => (
            <button
              key={b.v}
              type="button"
              onClick={() => next({ budget: b.v })}
              className="rounded-xl border border-neutral-200 px-4 py-3 text-left hover:border-neutral-900 hover:bg-neutral-50"
            >
              {b.l}
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  if (step === "style") {
    return (
      <Shell title="Preferred style" step={4} totalSteps={totalSteps} onBack={back}>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          {["Contemporary", "Traditional", "Shaker", "Bespoke"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                showDeposit
                  ? next({ style: s })
                  : void props.onSubmit({ ...payload, style: s })
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 py-4 hover:border-neutral-900 hover:bg-neutral-50"
            >
              <Palette className="h-4 w-4 text-neutral-400" />
              {s}
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // deposit
  return (
    <Shell title="Consultation deposit" step={5} totalSteps={totalSteps} onBack={back}>
      <div className="rounded-xl bg-neutral-50 p-4 text-[13px] text-neutral-700">
        <CreditCard className="mb-2 h-4 w-4 text-neutral-500" />
        A £250 deposit secures your design consultation and is fully credited
        against your project.
      </div>
      <button
        type="button"
        onClick={() =>
          props.onSubmit({ ...payload, depositAmount: 25000, depositCurrency: "GBP" })
        }
        className="mt-4 w-full rounded-xl bg-neutral-900 py-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
      >
        {props.primaryCtaLabel}
      </button>
    </Shell>
  );
}

bookingRegistry.register({
  manifestVersion: 1,
  slug: "consultation-appointment",
  name: "Consultation appointment",
  description:
    "Luxury / design-led flow: consultation → showroom → budget → style → optional deposit.",
  version: "1.0.0",
  flowKind: "consultation",
  steps: [
    { key: "showroom-appointment", order: 1, required: true },
    { key: "budget-range", order: 2, required: true },
    { key: "style-preference", order: 3, required: true },
    {
      key: "deposit",
      order: 4,
      required: false,
      requiresIntegration: "stripe-deposit",
      visibleWhen: {
        domain: "booking",
        field: "depositPolicy",
        equalsAnyOf: ["required", "optional"]
      }
    },
    { key: "confirm", order: 5, required: true }
  ],
  policy: {
    minCustomerLeadHours: 48,
    maxAdvanceDays: 120,
    cancellationDeadlineHours: 48,
    reminderHours: [72, 24]
  },
  requiresPayment: true,
  requiresCalendarSync: true,
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "booking.depositPolicy", optional: true },
    { kind: "booking.availabilityDisplay", optional: true }
  ],
  trades: ["*"],
  profileFlags: ["luxury", "premium"],
  renderer: ConsultationAppointmentRenderer,
  publisher: P
});

// ─── 4. Quote-only ────────────────────────────────────────────
// Fast quote request, no calendar. Consumers who prefer WhatsApp
// handoff or async quotes.
function QuoteOnlyRenderer(props: BookingRendererProps) {
  return (
    <Shell title="Request a quote" step={1} totalSteps={1}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          void props.onSubmit({
            name: (f.elements.namedItem("name") as HTMLInputElement)?.value,
            email: (f.elements.namedItem("email") as HTMLInputElement)?.value,
            phone: (f.elements.namedItem("phone") as HTMLInputElement)?.value,
            postcode: (f.elements.namedItem("postcode") as HTMLInputElement)?.value,
            service: (f.elements.namedItem("service") as HTMLSelectElement)?.value,
            message: (f.elements.namedItem("message") as HTMLTextAreaElement)?.value
          });
        }}
        className="flex flex-col gap-3 text-[13px]"
      >
        <input name="name" required placeholder="Your name" className="rounded-xl border border-neutral-200 px-4 py-3" />
        <input name="email" required type="email" placeholder="Email" className="rounded-xl border border-neutral-200 px-4 py-3" />
        <input name="phone" required placeholder="Phone" className="rounded-xl border border-neutral-200 px-4 py-3" />
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3">
          <MapPin className="h-4 w-4 text-neutral-400" />
          <input name="postcode" required placeholder="Postcode" className="flex-1 outline-none" />
        </div>
        <select name="service" required className="rounded-xl border border-neutral-200 px-4 py-3">
          {props.services.map((s) => (
            <option key={s} value={s}>
              {humaniseServiceSlug(s)}
            </option>
          ))}
        </select>
        <textarea name="message" placeholder="Anything else?" rows={3} className="rounded-xl border border-neutral-200 px-4 py-3" />
        <button className="mt-2 rounded-xl bg-neutral-900 py-3 font-semibold text-white hover:bg-neutral-800">
          {props.primaryCtaLabel}
        </button>
        <p className="text-center text-[11px] text-neutral-500">
          <Check className="mr-1 inline h-3 w-3" />
          Typical response within 1 working day.
        </p>
      </form>
    </Shell>
  );
}

bookingRegistry.register({
  manifestVersion: 1,
  slug: "quote-only",
  name: "Quote-only request",
  description:
    "Single-page quote request. No calendar, no deposit. Best for quote-driven merchants who prefer async follow-up.",
  version: "1.0.0",
  flowKind: "quote-only",
  steps: [{ key: "quote-request", order: 1, required: true, formId: "quote-request" }],
  policy: {
    reminderHours: []
  },
  requiresPayment: false,
  requiresCalendarSync: false,
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "booking.priorityServices", optional: true }
  ],
  trades: ["*"],
  profileFlags: ["premium", "value"],
  renderer: QuoteOnlyRenderer,
  publisher: P
});
