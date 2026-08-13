"use client";

// QuoteFlow — customer-facing quote modal for Staircase Renovations.
//
// Not part of Headquarters · not part of G1-G6 · not part of the burn-in.
// Two paths per the v1.0 spec:
//   Option A · Choose a staircase plan  → picks from /api/nex/staircase-renovations/plans
//   Option B · Show us your staircase   → photograph upload (bottom · top · side · balcony)
// Both paths capture: name, phone, email, optional postcode. Both preserve
// the renovation context the customer was viewing when they opened Quote.
// Submits ONCE atomically to /api/nex/staircase-renovations/enquiry.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, ChevronLeft, ImageIcon, Loader2, X } from "lucide-react";

export type QuoteContext = {
  collection_slug: string | null;
  collection_label: string | null;
  image_src:  string | null;
  image_alt:  string | null;
  image_id:   string | null;
  source_page: string;
};

type Plan = { slug: string; label: string; description: string | null; src: string | null };
type FlowStep = "choose" | "plan" | "photos" | "success";

type Props = {
  open: boolean;
  onClose: () => void;
  context: QuoteContext;
  onEvent?: (event_name: string, payload?: Record<string, unknown>) => void;
};

const PHOTO_SLOTS: Array<{ key: string; label: string; hint: string; required: boolean }> = [
  { key: "photo_bottom",  label: "From the bottom",  hint: "Looking up the staircase from the bottom.",              required: false },
  { key: "photo_top",     label: "From the top",     hint: "Looking down from the top of the staircase.",            required: false },
  { key: "photo_side",    label: "From the side",    hint: "Full-run side profile so we see stringer + spindles.",   required: false },
  { key: "photo_balcony", label: "Balcony / landing",hint: "Optional · include if you have a landing / balustrade.", required: false },
];

export function QuoteFlow({ open, onClose, context, onEvent }: Props) {
  const [step, setStep]         = useState<FlowStep>("choose");
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes]       = useState("");
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [photoFiles, setPhotoFiles]     = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [successRef, setSuccessRef]     = useState<{ enquiry_id: string } | null>(null);

  // Reset when the modal closes so the next open is clean.
  useEffect(() => {
    if (!open) {
      // Small delay so exit animation reads coherently.
      const t = setTimeout(() => {
        setStep("choose"); setName(""); setPhone(""); setEmail("");
        setPostcode(""); setNotes(""); setSelectedPlan(null);
        setPhotoFiles({}); setSubmitError(null); setSuccessRef(null);
      }, 240);
      return () => clearTimeout(t);
    }
    // Emit open event · reference IDs only · no personal data.
    onEvent?.("renovation_quote_opened", {
      collection_slug: context.collection_slug,
      image_id:        context.image_id,
    });
  }, [open, context, onEvent]);

  // Lazy-load plans when the customer picks Option A.
  useEffect(() => {
    if (step !== "plan" || plans.length > 0 || plansLoading) return;
    let alive = true;
    (async () => {
      setPlansLoading(true);
      try {
        const res = await fetch("/api/nex/staircase-renovations/plans", { cache: "no-store" });
        const j = await res.json().catch(() => null);
        if (alive && j?.ok && Array.isArray(j.plans)) setPlans(j.plans);
      } catch { /* honest empty state renders below */ }
      finally { if (alive) setPlansLoading(false); }
    })();
    return () => { alive = false; };
  }, [step, plans.length, plansLoading]);

  const gotoPlan = useCallback(() => {
    onEvent?.("quote_plan_path_selected", { collection_slug: context.collection_slug });
    setStep("plan");
  }, [context.collection_slug, onEvent]);
  const gotoPhotos = useCallback(() => {
    onEvent?.("quote_existing_staircase_path_selected", { collection_slug: context.collection_slug });
    setStep("photos");
  }, [context.collection_slug, onEvent]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setSubmitError("Please enter your name, phone, and email so we can reply.");
      return;
    }
    if (step === "plan" && !selectedPlan) {
      setSubmitError("Please choose a staircase plan first.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("path", step === "plan" ? "plan" : "photos");
      fd.set("name", name.trim());
      fd.set("phone", phone.trim());
      fd.set("email", email.trim());
      if (postcode.trim()) fd.set("postcode", postcode.trim());
      if (notes.trim()) fd.set("notes", notes.trim());
      // Renovation context (authoritative from viewer state).
      fd.set("renovation_slug",      context.collection_slug ?? "");
      fd.set("renovation_image_src", context.image_src        ?? "");
      fd.set("renovation_image_alt", context.image_alt        ?? "");
      fd.set("renovation_image_id",  context.image_id         ?? "");
      fd.set("source_page",          context.source_page);
      if (step === "plan" && selectedPlan) {
        fd.set("plan_slug",  selectedPlan.slug);
        fd.set("plan_label", selectedPlan.label);
      }
      if (step === "photos") {
        for (const slot of PHOTO_SLOTS) {
          const f = photoFiles[slot.key];
          if (f) fd.append(slot.key, f, f.name);
        }
      }
      const res = await fetch("/api/nex/staircase-renovations/enquiry", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      setSuccessRef({ enquiry_id: j.enquiry_id });
      onEvent?.("staircase_quote_submitted", {
        enquiry_id:      j.enquiry_id,
        path:            step === "plan" ? "plan" : "photos",
        collection_slug: context.collection_slug,
        image_id:        context.image_id,
        plan_slug:       selectedPlan?.slug ?? null,
        photos_stored:   j.photos_stored ?? 0,
      });
      setStep("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [step, name, phone, email, postcode, notes, context, selectedPlan, photoFiles, onEvent]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="quote-scrim"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Request a staircase renovation quote"
          onClick={onClose}
        >
          <motion.div
            key="quote-sheet"
            className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl md:rounded-2xl"
            style={{ background: "var(--nex-cream)", boxShadow: "var(--nex-shadow-lg)" }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{    y: 40, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header · always shows the renovation context so the customer sees
                exactly what will be attached to the quote. */}
            <header className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: "var(--nex-neutral-200)" }}>
              {step !== "choose" && step !== "success" ? (
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => setStep("choose")}
                  className="grid h-8 w-8 flex-none place-items-center rounded-full transition hover:scale-105"
                  style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-700)" }}
                >
                  <ChevronLeft size={18} strokeWidth={2} />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--nex-accent-600)" }}>
                  NEX · Request a Quote
                </div>
                <div className="mt-0.5 truncate text-[13px] font-semibold" style={{ color: "var(--nex-neutral-800)" }}>
                  {context.collection_label
                    ? <>Renovation you're viewing: <span style={{ color: "var(--nex-neutral-700)" }}>{context.collection_label}</span></>
                    : <>No renovation selected</>}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-8 w-8 flex-none place-items-center rounded-full transition hover:scale-105"
                style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-700)" }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {step === "choose" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px]" style={{ color: "var(--nex-neutral-600)" }}>
                    Choose how you'd like to move forward. We'll keep your current renovation choice attached to the enquiry automatically.
                  </p>
                  <QuoteChoiceCard
                    icon={<ImageIcon size={22} strokeWidth={1.9} />}
                    title="Choose a staircase plan"
                    subtitle="Pick a plan you like from our library. We'll pair it with the renovation you're viewing."
                    onClick={gotoPlan}
                  />
                  <QuoteChoiceCard
                    icon={<Camera size={22} strokeWidth={1.9} />}
                    title="Show us your staircase"
                    subtitle="Send us a few photos so we can understand what you have and what to change."
                    onClick={gotoPhotos}
                  />
                </div>
              ) : null}

              {step === "plan" ? (
                <div className="flex flex-col gap-4">
                  <h2 className="text-[17px] font-black" style={{ color: "var(--nex-neutral-900)" }}>Choose a staircase plan</h2>
                  <p className="text-[12.5px]" style={{ color: "var(--nex-neutral-600)" }}>
                    Choose the staircase design you're interested in and we'll use it with your renovation enquiry.
                  </p>
                  <PlanPicker
                    plans={plans}
                    loading={plansLoading}
                    selected={selectedPlan}
                    onSelect={(p) => {
                      setSelectedPlan(p);
                      onEvent?.("quote_plan_selected", { plan_slug: p.slug });
                    }}
                  />
                  <CustomerFields
                    name={name} setName={setName}
                    phone={phone} setPhone={setPhone}
                    email={email} setEmail={setEmail}
                    postcode={postcode} setPostcode={setPostcode}
                  />
                </div>
              ) : null}

              {step === "photos" ? (
                <div className="flex flex-col gap-4">
                  <h2 className="text-[17px] font-black" style={{ color: "var(--nex-neutral-900)" }}>Show us your staircase</h2>
                  <p className="text-[12.5px]" style={{ color: "var(--nex-neutral-600)" }}>
                    Send us a few photographs so we can understand what you have and what you want to change. Mobile users can use their camera directly.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PHOTO_SLOTS.map((slot) => (
                      <PhotoSlotInput
                        key={slot.key}
                        label={slot.label}
                        hint={slot.hint}
                        value={photoFiles[slot.key] ?? null}
                        onChange={(file) => {
                          setPhotoFiles((prev) => ({ ...prev, [slot.key]: file }));
                          if (file) onEvent?.("quote_photo_uploaded", { slot: slot.key, size_bytes: file.size });
                        }}
                      />
                    ))}
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--nex-neutral-500)" }}>
                      Anything else you'd like us to know?
                    </span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Optional · anything about the staircase we should know"
                      className="rounded-lg border px-3 py-2 text-[13px]"
                      style={{ background: "var(--nex-neutral-0)", borderColor: "var(--nex-neutral-200)", color: "var(--nex-neutral-900)" }}
                    />
                  </label>
                  <CustomerFields
                    name={name} setName={setName}
                    phone={phone} setPhone={setPhone}
                    email={email} setEmail={setEmail}
                    postcode={postcode} setPostcode={setPostcode}
                  />
                </div>
              ) : null}

              {step === "success" && successRef ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--nex-success-500)", color: "#fff" }}>
                    <CheckCircle2 size={24} strokeWidth={2} />
                  </div>
                  <div className="text-[17px] font-black" style={{ color: "var(--nex-neutral-900)" }}>
                    Quote request received
                  </div>
                  <div className="text-[13px]" style={{ color: "var(--nex-neutral-600)" }}>
                    Reference: <span className="font-mono">{successRef.enquiry_id}</span>
                  </div>
                  <div className="mt-1 text-[12px]" style={{ color: "var(--nex-neutral-500)" }}>
                    We'll be in touch on the phone or email you provided.
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer · primary action visible when relevant. */}
            {(step === "plan" || step === "photos") ? (
              <footer className="flex flex-col gap-2 border-t px-5 py-4" style={{ borderColor: "var(--nex-neutral-200)", background: "var(--nex-cream-elev)" }}>
                {submitError ? (
                  <div className="text-[12px]" style={{ color: "var(--nex-error-500)" }}>
                    {submitError}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-black uppercase tracking-wider transition-transform active:scale-[.98] disabled:opacity-60"
                  style={{ background: "var(--nex-accent-500)", color: "#fff", boxShadow: "var(--nex-shadow-sm)" }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" strokeWidth={2.4} /> : null}
                  Request a Quote
                </button>
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ─── sub-components ──────────────────────────────────────────────

function QuoteChoiceCard({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border p-4 text-left transition-transform active:scale-[.99]"
      style={{ background: "var(--nex-neutral-0)", borderColor: "var(--nex-neutral-200)", boxShadow: "var(--nex-shadow-sm)" }}
    >
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl" style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-600)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black" style={{ color: "var(--nex-neutral-900)" }}>{title}</span>
        <span className="mt-1 block text-[12px]" style={{ color: "var(--nex-neutral-600)" }}>{subtitle}</span>
      </span>
    </button>
  );
}

function CustomerFields({
  name, setName, phone, setPhone, email, setEmail, postcode, setPostcode,
}: {
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  postcode: string; setPostcode: (v: string) => void;
}) {
  const inputStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", borderColor: "var(--nex-neutral-200)", color: "var(--nex-neutral-900)" };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <LabelledInput label="Name"     required value={name}     onChange={setName}     autoComplete="name"          style={inputStyle} />
      <LabelledInput label="Phone"    required value={phone}    onChange={setPhone}    autoComplete="tel" type="tel" style={inputStyle} />
      <LabelledInput label="Email"    required value={email}    onChange={setEmail}    autoComplete="email" type="email" style={inputStyle} />
      <LabelledInput label="Postcode" value={postcode} onChange={setPostcode} autoComplete="postal-code" style={inputStyle} />
    </div>
  );
}

function LabelledInput({ label, value, onChange, required, type = "text", autoComplete, style }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; autoComplete?: string; style?: React.CSSProperties;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--nex-neutral-500)" }}>
        {label}{required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="rounded-lg border px-3 py-2 text-[13px]"
        style={style}
      />
    </label>
  );
}

function PhotoSlotInput({ label, hint, value, onChange }: { label: string; hint: string; value: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded-lg border p-3" style={{ background: "var(--nex-neutral-0)", borderColor: value ? "var(--nex-success-500)" : "var(--nex-neutral-200)" }}>
      <span className="flex items-center gap-2 text-[12px] font-black" style={{ color: "var(--nex-neutral-800)" }}>
        <Camera size={14} strokeWidth={2} />{label}
        {value ? <CheckCircle2 size={14} strokeWidth={2.4} style={{ color: "var(--nex-success-500)", marginLeft: "auto" }} /> : null}
      </span>
      <span className="text-[10.5px]" style={{ color: "var(--nex-neutral-500)" }}>{hint}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="mt-1 text-[11px]"
      />
      {value ? (
        <span className="mt-1 truncate text-[10px]" style={{ color: "var(--nex-neutral-600)" }}>{value.name} · {Math.round(value.size / 1024)} KB</span>
      ) : null}
    </label>
  );
}

function PlanPicker({ plans, loading, selected, onSelect }: { plans: Plan[]; loading: boolean; selected: Plan | null; onSelect: (p: Plan) => void }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--nex-neutral-500)" }}>
        <Loader2 size={14} className="animate-spin" strokeWidth={2} /> Loading plans…
      </div>
    );
  }
  if (plans.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-[12.5px]" style={{ background: "var(--nex-neutral-0)", borderColor: "var(--nex-neutral-200)", color: "var(--nex-neutral-600)" }}>
        No staircase plans available yet. Pick <strong>Show us your staircase</strong> from the back arrow to send photos of your existing staircase instead.
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {plans.map((p) => {
        const isSel = selected?.slug === p.slug;
        return (
          <button
            key={p.slug}
            type="button"
            onClick={() => onSelect(p)}
            className="flex items-start gap-3 rounded-lg border p-3 text-left transition-transform active:scale-[.99]"
            style={{
              background: isSel ? "var(--nex-accent-50)" : "var(--nex-neutral-0)",
              borderColor: isSel ? "var(--nex-accent-500)" : "var(--nex-neutral-200)",
              boxShadow: isSel ? "var(--nex-shadow-sm)" : "none",
            }}
            aria-pressed={isSel}
          >
            <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-lg" style={{ background: "var(--nex-neutral-100)" }}>
              {p.src
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={p.src} alt={p.label} className="h-full w-full object-cover" />
                : <ImageIcon size={22} strokeWidth={1.6} style={{ color: "var(--nex-neutral-400)" }} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black" style={{ color: "var(--nex-neutral-900)" }}>{p.label}</span>
              {p.description ? <span className="mt-0.5 block text-[11px]" style={{ color: "var(--nex-neutral-500)" }}>{p.description}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
