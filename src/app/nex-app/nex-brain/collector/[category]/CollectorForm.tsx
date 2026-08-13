"use client";

// CollectorForm — worker-facing add/verify form.
//
// Category-agnostic: reads capability list + qualification rubric from the
// TradeCategoryConfig passed in from the server page.
//
// On submit, POSTs to /api/admin/collector/[category]/save which runs
// duplicate detection + writes the DirectorySeed JSON. The public directory
// picks it up automatically at request-time (file-based loader).

import { useCallback, useMemo, useState } from "react";
import type { TradeCategoryConfig } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";

type CapabilityAnswer = "yes" | "no" | "unknown";

type EmailStatus = "verified" | "needs_manual_verification" | "not_found";

type FormState = {
  business_name: string;
  trading_name:  string;
  website:       string;
  description:   string;
  address_line_1: string;
  town:          string;
  county:        string;
  postcode:      string;
  service_area:  string;
  telephone:     string;
  email:         string;
  email_source_url: string;
  email_status:  "" | EmailStatus;
  google_rating:      string; // as string to allow ""
  google_review_count: string;
  google_maps_url:    string;
  discovery_source:   string;
  worker_notes:       string;
  refacing_qualification: "" | "A+" | "A" | "B" | "C" | "excluded";
  evidence_url:       string;
  evidence_type:      string;
  evidence_category:  string;
  evidence_summary:   string;
};

const EMPTY: FormState = {
  business_name: "", trading_name: "", website: "", description: "",
  address_line_1: "", town: "", county: "", postcode: "", service_area: "",
  telephone: "", email: "", email_source_url: "", email_status: "",
  google_rating: "", google_review_count: "", google_maps_url: "",
  discovery_source: "", worker_notes: "",
  refacing_qualification: "",
  evidence_url: "", evidence_type: "company_website", evidence_category: "",
  evidence_summary: "",
};

type DuplicateHit = {
  match_type: "strong" | "medium" | "fuzzy";
  slug: string;
  business_name: string;
  town: string | null;
  signal: string;
};

type SaveResult =
  | { ok: true; created: true;  listing_id: string; slug: string; directory_url: string }
  | { ok: true; created: false; duplicates: DuplicateHit[] }
  | { ok: false; error: string };

export function CollectorForm({ config }: { config: TradeCategoryConfig }) {
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [caps,  setCaps]          = useState<Record<string, CapabilityAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [result, setResult]       = useState<SaveResult | null>(null);

  const setField = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const setCap = useCallback((key: string, v: CapabilityAnswer) => {
    setCaps((c) => ({ ...c, [key]: v }));
  }, []);

  const emailPresent = form.email.trim().length > 0;

  const canSubmit = useMemo(() => {
    return form.business_name.trim().length > 1 && !submitting;
  }, [form.business_name, submitting]);

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/nex/collector/${config.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, capabilities: caps, force_create: confirmedDuplicate }),
      });
      const data = (await res.json()) as SaveResult;
      setResult(data);
      if (data.ok && "created" in data && data.created) {
        setForm(EMPTY);
        setCaps({});
        setConfirmedDuplicate(false);
      }
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
    >
      {/* ── BUSINESS ────────────────────────────────────────────── */}
      <Section title="Business">
        <Grid>
          <Field label="Company name *">
            <input required value={form.business_name} onChange={(e) => setField("business_name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Trading name (if different)">
            <input value={form.trading_name} onChange={(e) => setField("trading_name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Website">
            <input type="url" value={form.website} onChange={(e) => setField("website", e.target.value)} className={inputClass} placeholder="https://" />
          </Field>
          <Field label="Business description">
            <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} className={inputClass} rows={3} placeholder="Copy verbatim relevant text from the company website." />
          </Field>
        </Grid>
      </Section>

      {/* ── LOCATION ────────────────────────────────────────────── */}
      <Section title="Location">
        <Grid>
          <Field label="Address">
            <input value={form.address_line_1} onChange={(e) => setField("address_line_1", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Town / city">
            <input value={form.town} onChange={(e) => setField("town", e.target.value)} className={inputClass} />
          </Field>
          <Field label="County">
            <input value={form.county} onChange={(e) => setField("county", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Postcode">
            <input value={form.postcode} onChange={(e) => setField("postcode", e.target.value.toUpperCase())} className={inputClass} />
          </Field>
          <Field label="Service area (free text)">
            <input value={form.service_area} onChange={(e) => setField("service_area", e.target.value)} className={inputClass} placeholder="e.g. Greater Manchester + 30 mile radius" />
          </Field>
        </Grid>
      </Section>

      {/* ── CONTACT ─────────────────────────────────────────────── */}
      <Section
        title="Contact"
        subtitle="Public business email is a priority field — this record will enter the claim / member acquisition funnel. Never invent an email."
      >
        <Grid>
          <Field label="Phone">
            <input value={form.telephone} onChange={(e) => setField("telephone", e.target.value)} className={inputClass} />
          </Field>
          <Field
            label="Public business email"
            hint={emailPresent ? undefined : "info@ · sales@ · enquiries@ · office@ · contact@ — verbatim from the company website only · leave blank if none found"}
          >
            <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email source URL (where you found it)">
            <input type="url" value={form.email_source_url} onChange={(e) => setField("email_source_url", e.target.value)} className={inputClass} placeholder="https://company.co.uk/contact" />
          </Field>
          <Field
            label="Email status *"
            hint="🟢 verified = you saw the email clearly on the source · 🟡 needs manual verification = email appears to exist but couldn't be reliably extracted (fetch masked · image · JS-only) · 🔴 not found = no public email located after search"
          >
            <div className="flex flex-wrap gap-2">
              {(["verified", "needs_manual_verification", "not_found"] as const).map((s) => {
                const icon  = s === "verified" ? "🟢" : s === "needs_manual_verification" ? "🟡" : "🔴";
                const label = s === "verified" ? "Verified" : s === "needs_manual_verification" ? "Needs manual verification" : "Not found";
                const active = form.email_status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField("email_status", s)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                      active
                        ? s === "verified"
                          ? "bg-emerald-500 text-white shadow"
                          : s === "needs_manual_verification"
                            ? "bg-amber-500 text-white shadow"
                            : "bg-red-500 text-white shadow"
                        : "border border-black/10 bg-white text-black/70 hover:bg-black/5"
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        </Grid>
      </Section>

      {/* ── REPUTATION ─────────────────────────────────────────── */}
      <Section title="Reputation (Google — only if genuinely visible)">
        <Grid>
          <Field label="Google rating (0.0–5.0)">
            <input type="number" step="0.1" min="0" max="5" value={form.google_rating} onChange={(e) => setField("google_rating", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Google review count">
            <input type="number" min="0" value={form.google_review_count} onChange={(e) => setField("google_review_count", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Google Maps URL">
            <input type="url" value={form.google_maps_url} onChange={(e) => setField("google_maps_url", e.target.value)} className={inputClass} />
          </Field>
        </Grid>
      </Section>

      {/* ── CAPABILITIES ──────────────────────────────────────── */}
      <Section title="Capabilities" subtitle="Mark yes only where the company website provides evidence. Default = unknown.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {config.capabilityOrder.map((key) => (
            <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-black/5 bg-white p-2">
              <div className="text-xs">{config.capabilityLabels[key] ?? key}</div>
              <div className="flex gap-1">
                {(["yes", "no", "unknown"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCap(key, v)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      (caps[key] ?? "unknown") === v
                        ? v === "yes"
                          ? "bg-emerald-500 text-white"
                          : v === "no"
                            ? "bg-red-500 text-white"
                            : "bg-neutral-400 text-white"
                        : "border border-black/10 bg-white text-black/60"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── EVIDENCE + QUALIFICATION ──────────────────────────── */}
      <Section title="Evidence + qualification">
        <Grid>
          <Field label="Evidence URL (the specific page proving they do this work)">
            <input type="url" value={form.evidence_url} onChange={(e) => setField("evidence_url", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Evidence type">
            <select value={form.evidence_type} onChange={(e) => setField("evidence_type", e.target.value)} className={inputClass}>
              <option value="company_website">company_website</option>
              <option value="contact_page">contact_page</option>
              <option value="services_page">services_page</option>
              <option value="trade_directory">trade_directory</option>
              <option value="checkatrade">checkatrade</option>
              <option value="yell">yell</option>
              <option value="trustpilot">trustpilot</option>
              <option value="rated_people">rated_people</option>
              <option value="bark">bark</option>
              <option value="houzz">houzz</option>
              <option value="mybuilder">mybuilder</option>
              <option value="google_business_profile">google_business_profile</option>
              <option value="other">other</option>
            </select>
          </Field>
          <Field label="Evidence category">
            <input value={form.evidence_category} onChange={(e) => setField("evidence_category", e.target.value)} className={inputClass} placeholder={config.id === "staircase_refacing" ? "e.g. staircase_refurbishment" : "e.g. bespoke_new_staircases"} />
          </Field>
          <Field label="Evidence summary (why this company qualifies · verbatim quote preferred)">
            <textarea value={form.evidence_summary} onChange={(e) => setField("evidence_summary", e.target.value)} className={inputClass} rows={3} />
          </Field>
          <Field label="Qualification">
            <select value={form.refacing_qualification} onChange={(e) => setField("refacing_qualification", e.target.value as FormState["refacing_qualification"])} className={inputClass}>
              <option value="">— assess based on evidence —</option>
              <option value="A+">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="excluded">excluded</option>
            </select>
            {form.refacing_qualification && (
              <div className="mt-1 text-[11px] text-black/60">
                {config.qualificationRubric[form.refacing_qualification]}
              </div>
            )}
          </Field>
        </Grid>
      </Section>

      {/* ── DISCOVERY + NOTES ─────────────────────────────────── */}
      <Section title="Discovery">
        <Grid>
          <Field label="Discovery source (e.g. google · yell · referral)">
            <input value={form.discovery_source} onChange={(e) => setField("discovery_source", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Worker notes (private · not published)">
            <textarea value={form.worker_notes} onChange={(e) => setField("worker_notes", e.target.value)} className={inputClass} rows={2} />
          </Field>
        </Grid>
      </Section>

      {/* ── SUBMIT ────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        {result && !result.ok && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {result.error}
          </div>
        )}
        {result && result.ok && "created" in result && result.created && (
          <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✓ Saved. <a href={result.directory_url} className="font-semibold underline" target="_blank" rel="noopener noreferrer">View listing</a> · listing_id: <code>{result.listing_id}</code>
          </div>
        )}
        {result && result.ok && "duplicates" in result && (
          <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="mb-1 font-black uppercase tracking-wider">Potential duplicate found</div>
            <ul className="mb-2 list-inside list-disc space-y-0.5">
              {result.duplicates.map((d) => (
                <li key={d.slug}>
                  <span className="font-semibold">{d.business_name}</span>{d.town ? ` · ${d.town}` : ""} — <span className="italic">{d.match_type} match on {d.signal}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmedDuplicate} onChange={(e) => setConfirmedDuplicate(e.target.checked)} />
              <span>I confirm this is a different business — create anyway</span>
            </label>
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full bg-orange-500 py-3 text-sm font-black uppercase tracking-wider text-white shadow-md transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : confirmedDuplicate ? "Save (override duplicate check)" : "Save company"}
        </button>
      </div>
    </form>
  );
}

// ── Layout helpers ─────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-black/80">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11.5px] text-black/60">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-[11.5px] font-semibold text-black/75">
          {label} {required && <span className="text-orange-600">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="text-[10.5px] text-black/50">{hint}</span>}
    </label>
  );
}
const inputClass = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20";
