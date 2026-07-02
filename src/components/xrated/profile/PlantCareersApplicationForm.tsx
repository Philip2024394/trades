"use client";

// Full-fat careers application form. Multi-role select, personal
// details, driving-specific block (only when a driving role is picked),
// experience blocks, CV upload, cover note. Persists to
// hammerex_plant_hire_applications via /api/plant-hire/applications
// then fires a WhatsApp handoff with the reference so the merchant can
// look the applicant up in the dashboard.

import { useMemo, useRef, useState } from "react";
import {
  DRIVER_POSITION_PRESETS,
  type PlantDriverRecruitment
} from "@/lib/plantHire";

const DRIVING_ROLES: Set<string> = new Set(
  DRIVER_POSITION_PRESETS.filter((p) => p.group === "Driving").map((p) => p.slug as string)
);
const MECHANIC_ROLES: Set<string> = new Set(
  DRIVER_POSITION_PRESETS.filter((p) => p.group === "Workshop").map((p) => p.slug as string)
);
const LICENCE_CLASSES = ["B", "B+E", "C1", "C1+E", "C", "C+E", "D1", "D", "D+E"];
const RIGHT_TO_WORK: { slug: string; label: string }[] = [
  { slug: "uk_national", label: "UK national" },
  { slug: "irish", label: "Irish national" },
  { slug: "settled_status", label: "Settled / pre-settled status" },
  { slug: "skilled_worker", label: "Skilled worker visa" },
  { slug: "student", label: "Student visa (limited hours)" },
  { slug: "other", label: "Other — details on request" }
];
const WORK_PATTERNS: { slug: string; label: string }[] = [
  { slug: "full_time", label: "Full-time" },
  { slug: "part_time", label: "Part-time" },
  { slug: "weekends", label: "Weekends only" },
  { slug: "temp_cover", label: "Temp / holiday cover" },
  { slug: "owner_driver", label: "Owner-driver" }
];

type ExperienceBlock = {
  employer: string;
  role: string;
  years: string;
  duties: string;
};

const emptyExperience = (): ExperienceBlock => ({
  employer: "",
  role: "",
  years: "",
  duties: ""
});

export function PlantCareersApplicationForm({
  merchantName,
  merchantSlug,
  waHref,
  cfg
}: {
  merchantName: string;
  merchantSlug: string;
  waHref: string | null;
  cfg: PlantDriverRecruitment;
}) {
  // Roles
  const [roleSlugs, setRoleSlugs] = useState<string[]>(cfg.positions_available.slice(0, 1));
  // Personal
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [rightToWork, setRightToWork] = useState("uk_national");
  // Role-specific
  const [licenceClasses, setLicenceClasses] = useState<string[]>([]);
  const [cpcExpiry, setCpcExpiry] = useState("");
  const [hasDigitacho, setHasDigitacho] = useState(false);
  const [qualifications, setQualifications] = useState("");
  // Availability / preference
  const [yearsExperience, setYearsExperience] = useState("");
  const [notice, setNotice] = useState("");
  const [salary, setSalary] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [workPattern, setWorkPattern] = useState("full_time");
  // Experience blocks
  const [experience, setExperience] = useState<ExperienceBlock[]>([emptyExperience()]);
  // CV upload
  const [cvUrl, setCvUrl] = useState("");
  const [cvName, setCvName] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cvRef = useRef<HTMLInputElement | null>(null);
  // Cover + terms
  const [cover, setCover] = useState("");
  const [terms, setTerms] = useState(false);
  // Submit state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentReference, setSentReference] = useState<string | null>(null);

  const showDrivingFields = roleSlugs.some((r) => DRIVING_ROLES.has(r));
  const showMechanicFields = roleSlugs.some((r) => MECHANIC_ROLES.has(r));

  const groupedRoles = useMemo(() => {
    const groups = new Map<string, typeof DRIVER_POSITION_PRESETS[number][]>();
    for (const p of DRIVER_POSITION_PRESETS) {
      const list = groups.get(p.group) ?? [];
      list.push(p);
      groups.set(p.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const toggleRole = (slug: string) => {
    setRoleSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 5)
    );
  };
  const toggleLicence = (v: string) => {
    setLicenceClasses((prev) =>
      prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]
    );
  };

  const canSubmit =
    roleSlugs.length > 0 &&
    name.trim().length > 1 &&
    phone.replace(/[^\d+]/g, "").length >= 6 &&
    terms &&
    !busy;

  const uploadCv = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    setUploadBusy(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/trade-off/upload-document", {
        method: "POST",
        body: fd
      });
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string };
      if (!r.ok || !j.ok || !j.url) throw new Error(j.error ?? "upload failed");
      setCvUrl(j.url);
      setCvName(f.name);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "upload error");
    } finally {
      setUploadBusy(false);
      if (cvRef.current) cvRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    let reference = "";
    try {
      const r = await fetch("/api/plant-hire/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_slug: merchantSlug,
          role_slugs: roleSlugs,
          applicant_name: name,
          applicant_email: email,
          applicant_phone: phone,
          applicant_age: age ? Number(age) : undefined,
          applicant_postcode: postcode,
          applicant_city: city,
          right_to_work: rightToWork,
          driving_licence_classes: licenceClasses,
          cpc_expiry: cpcExpiry,
          has_digitacho: hasDigitacho,
          qualifications_note: qualifications,
          years_experience: yearsExperience ? Number(yearsExperience) : undefined,
          experience,
          notice_period: notice,
          salary_expectation: salary,
          available_from: availableFrom,
          work_pattern: workPattern,
          cv_url: cvUrl,
          cover_note: cover
        })
      });
      const j = (await r.json()) as { ok?: boolean; reference?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "save failed");
      reference = j.reference ?? "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "save error");
      setBusy(false);
      return;
    }
    setSentReference(reference);
    // Fire WhatsApp handoff
    const roleLabels = roleSlugs
      .map((s) => DRIVER_POSITION_PRESETS.find((p) => p.slug === s)?.label ?? s)
      .join(", ");
    const wa: string[] = [
      `💼 *CAREERS APPLICATION — ${merchantName}*`,
      reference ? `Ref: ${reference}` : "",
      "",
      `Role(s): ${roleLabels}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : "",
      age ? `Age: ${age}` : "",
      postcode ? `Postcode: ${postcode}` : "",
      city ? `City: ${city}` : "",
      `Right to work: ${RIGHT_TO_WORK.find((r) => r.slug === rightToWork)?.label ?? rightToWork}`,
      "",
      showDrivingFields
        ? `Licences: ${licenceClasses.join(", ") || "not specified"}`
        : "",
      showDrivingFields && cpcExpiry ? `CPC expiry: ${cpcExpiry}` : "",
      showDrivingFields ? `Digitacho: ${hasDigitacho ? "yes" : "no"}` : "",
      "",
      yearsExperience ? `Years experience: ${yearsExperience}` : "",
      notice ? `Notice period: ${notice}` : "",
      salary ? `Salary expectation: ${salary}` : "",
      availableFrom ? `Available from: ${availableFrom}` : "",
      `Work pattern: ${WORK_PATTERNS.find((w) => w.slug === workPattern)?.label ?? workPattern}`,
      "",
      cvUrl ? `CV: ${cvUrl}` : "(CV not attached — please request)",
      "",
      cover ? `Cover note:\n${cover}` : ""
    ];
    if (experience.length > 0) {
      wa.push("", "Experience:");
      for (const e of experience) {
        if (!e.employer && !e.role) continue;
        wa.push(
          `• ${e.employer || "?"} — ${e.role || "?"}${e.years ? ` · ${e.years} yrs` : ""}${e.duties ? `\n  ${e.duties}` : ""}`
        );
      }
    }
    const msg = encodeURIComponent(wa.filter((x) => x !== "").join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
    setBusy(false);
  };

  if (sentReference) {
    return (
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-[28px] text-emerald-700 mx-auto">
          ✓
        </div>
        <h2 className="mt-4 text-[22px] font-extrabold text-emerald-900">Application received.</h2>
        <p className="mt-2 text-[13px] text-emerald-800">
          Reference <strong>{sentReference}</strong>. We&rsquo;ll reply on WhatsApp inside 2
          working days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roles */}
      <Section title="1 · Which role(s) are you applying for?" hint="Multi-select — up to 5. Filter picks the questions we ask you.">
        <div className="space-y-3">
          {groupedRoles.map(([group, roles]) => (
            <div key={group}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                {group}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {roles.map((r) => {
                  const on = roleSlugs.includes(r.slug);
                  return (
                    <button
                      key={r.slug}
                      type="button"
                      onClick={() => toggleRole(r.slug)}
                      className={`inline-flex h-9 items-center rounded-full px-3 text-[11px] font-bold transition ${
                        on
                          ? "bg-neutral-900 text-white"
                          : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Personal */}
      <Section title="2 · About you">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Full name" value={name} onChange={setName} />
          <TextField label="Phone / WhatsApp" value={phone} onChange={setPhone} type="tel" />
          <TextField label="Email (optional)" value={email} onChange={setEmail} type="email" />
          <TextField label="Age" value={age} onChange={(v) => setAge(v.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" />
          <TextField
            label="Postcode"
            value={postcode}
            onChange={(v) => setPostcode(v.toUpperCase())}
            placeholder="LS10 1LG"
          />
          <TextField label="Town / City" value={city} onChange={setCity} />
          <SelectField
            label="Right to work in the UK"
            value={rightToWork}
            options={RIGHT_TO_WORK.map((r) => ({ value: r.slug, label: r.label }))}
            onChange={setRightToWork}
          />
          <SelectField
            label="Work pattern"
            value={workPattern}
            options={WORK_PATTERNS.map((w) => ({ value: w.slug, label: w.label }))}
            onChange={setWorkPattern}
          />
        </div>
      </Section>

      {/* Driving-specific */}
      {showDrivingFields && (
        <Section
          title="3 · Driving qualifications"
          hint="Only shown because you picked a driving role."
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Licence classes held
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {LICENCE_CLASSES.map((c) => {
                const on = licenceClasses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleLicence(c)}
                    className={`inline-flex h-9 items-center rounded-full px-3 text-[11px] font-extrabold transition ${
                      on
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="CPC expiry"
              value={cpcExpiry}
              onChange={setCpcExpiry}
              type="date"
            />
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={hasDigitacho}
                onChange={(e) => setHasDigitacho(e.target.checked)}
                className="h-5 w-5 rounded border-neutral-300 accent-[#FFB300]"
              />
              <span className="text-[13px] font-bold text-neutral-900">
                I hold a digitacho card
              </span>
            </label>
          </div>
        </Section>
      )}

      {/* Mechanic / general qualifications */}
      <Section
        title={showDrivingFields ? "4 · Other qualifications" : "3 · Qualifications"}
        hint={
          showMechanicFields
            ? "NVQs, City & Guilds, IMI, hydraulics tickets — anything relevant to the role."
            : "Any tickets, certificates or courses relevant to the role."
        }
      >
        <textarea
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          rows={3}
          placeholder="e.g. NVQ Level 3 Heavy Vehicle Maintenance · AAT Level 4 (accountancy) · Health & Safety at Work"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
        />
      </Section>

      {/* Experience */}
      <Section
        title={showDrivingFields ? "5 · Work history" : "4 · Work history"}
        hint="Most-recent first. Add up to 10 blocks."
      >
        <div className="space-y-3">
          {experience.map((e, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Job #{i + 1}
                </p>
                {experience.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setExperience(experience.filter((_, j) => j !== i))}
                    className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <TextField
                  label="Employer"
                  value={e.employer}
                  onChange={(v) =>
                    setExperience(experience.map((x, j) => (j === i ? { ...x, employer: v } : x)))
                  }
                  small
                />
                <TextField
                  label="Role"
                  value={e.role}
                  onChange={(v) =>
                    setExperience(experience.map((x, j) => (j === i ? { ...x, role: v } : x)))
                  }
                  small
                />
                <TextField
                  label="Years"
                  value={e.years}
                  onChange={(v) =>
                    setExperience(
                      experience.map((x, j) =>
                        j === i ? { ...x, years: v.replace(/[^0-9.]/g, "").slice(0, 4) } : x
                      )
                    )
                  }
                  inputMode="numeric"
                  small
                />
              </div>
              <div className="mt-2">
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                    Main duties (optional)
                  </span>
                  <textarea
                    value={e.duties}
                    onChange={(ev) =>
                      setExperience(
                        experience.map((x, j) => (j === i ? { ...x, duties: ev.target.value } : x))
                      )
                    }
                    rows={2}
                    placeholder="e.g. Delivered up to 40T STGO abnormal loads across Yorkshire; brake tests + Cat 1 STGO paperwork."
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-[#FFB300]"
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExperience([...experience, emptyExperience()])}
            disabled={experience.length >= 10}
            className="inline-flex h-10 items-center rounded-xl border-2 border-dashed border-neutral-300 px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 hover:border-[#FFB300] hover:text-neutral-900 disabled:opacity-40"
          >
            + Add previous job
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <TextField
            label="Total years experience"
            value={yearsExperience}
            onChange={(v) => setYearsExperience(v.replace(/[^0-9.]/g, "").slice(0, 4))}
            inputMode="numeric"
            small
          />
          <TextField label="Notice period" value={notice} onChange={setNotice} placeholder="1 week" small />
          <TextField
            label="Salary expectation"
            value={salary}
            onChange={setSalary}
            placeholder="£38,000"
            small
          />
          <TextField
            label="Available from"
            value={availableFrom}
            onChange={setAvailableFrom}
            type="date"
            small
          />
        </div>
      </Section>

      {/* CV + cover */}
      <Section
        title={showDrivingFields ? "6 · CV + cover note" : "5 · CV + cover note"}
        hint="Attach PDF/DOC/DOCX up to 10 MB. Optional but strongly preferred."
      >
        <label
          className={`flex h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-[12px] font-bold transition ${
            uploadBusy
              ? "border-neutral-300 text-neutral-400"
              : cvUrl
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-neutral-300 text-neutral-500 hover:border-[#FFB300] hover:text-neutral-900"
          }`}
        >
          <input
            ref={cvRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(e) => uploadCv(e.target.files)}
          />
          {uploadBusy
            ? "Uploading CV…"
            : cvUrl
              ? `✓ ${cvName} — tap to replace`
              : "Tap to upload CV (PDF / DOC / DOCX)"}
        </label>
        {uploadError && <p className="mt-1 text-[11px] font-bold text-red-600">{uploadError}</p>}
        <label className="mt-3 block">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Cover note (optional)
          </span>
          <textarea
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            rows={4}
            placeholder="Anything you'd like the yard manager to know — availability, why this role, references, etc."
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
      </Section>

      {/* Terms */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-neutral-300 accent-[#FFB300]"
          />
          <span className="text-[12px] font-bold text-neutral-800">
            I confirm the information is accurate. {merchantName} may check my DVLA record, right
            to work and references before offering employment.
          </span>
        </label>
        {error && <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={`mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl text-[12px] font-extrabold uppercase tracking-widest transition ${
            canSubmit
              ? "bg-[#25D366] text-white hover:brightness-95"
              : "cursor-not-allowed bg-neutral-200 text-neutral-500"
          }`}
        >
          {busy ? "Sending…" : "Send application →"}
        </button>
      </div>
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        {title}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type,
  placeholder,
  inputMode,
  small
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  small?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 outline-none focus:border-[#FFB300] focus:bg-white ${
          small ? "h-10 text-[13px]" : "h-12 text-[14px]"
        }`}
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
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
