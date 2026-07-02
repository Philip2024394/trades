// Public sections for the plant hire home showcase:
//   - PlantTradeAccountsSection
//   - PlantDriverRecruitmentSection
//   - PlantTeamSection
//   - PlantPartsCounterSection
//   - PlantComplianceInfoSection
//
// All server-safe. Interactive forms use anchor tags with pre-filled
// WhatsApp URLs so no client-side state is needed.

import {
  DRIVER_POSITION_PRESETS,
  type PlantComplianceInfo,
  type PlantDriverRecruitment,
  type PlantHaulageService,
  type PlantPartsCounter,
  type PlantTeamMember,
  type PlantTeamSection as TeamSection,
  type PlantTradeAccounts
} from "@/lib/plantHire";

// ─── Trade Accounts ────────────────────────────────────────────────

export function PlantTradeAccountsSection({
  cfg,
  merchantName,
  merchantSlug,
  waHref
}: {
  cfg: PlantTradeAccounts;
  merchantName: string;
  merchantSlug: string;
  waHref: string | null;
}) {
  if (!cfg.enabled) return null;
  const waMsg = encodeURIComponent(
    `Hi ${merchantName}, I'd like to open a trade account.\n\nBusiness:\nCompany reg:\nVAT no.:\nContact name + role:\nTrade:\nYears trading:\nRequested credit limit £:\n\nHappy to send bank details + trade references on WhatsApp.`
  );
  const applyOnlineHref = waHref ? `${waHref}?text=${waMsg}` : `/${merchantSlug}`;
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Credit accounts · Trade only
      </p>
      <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
        {cfg.heading}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>

      {cfg.benefits.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cfg.benefits.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-[12px] font-bold leading-tight text-neutral-800"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-black"
                style={{ background: "#FFB300" }}
              >
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-neutral-50 p-3 text-[11px] font-bold text-neutral-600">
        {cfg.credit_limit_max_pence && (
          <span>
            Credit limits up to <strong className="text-neutral-900">£{(cfg.credit_limit_max_pence / 100).toLocaleString()}</strong>
          </span>
        )}
        {cfg.min_years_trading && (
          <span>
            · Min <strong className="text-neutral-900">{cfg.min_years_trading} yrs trading</strong>
          </span>
        )}
        {cfg.turnaround_days && (
          <span>
            · Decision inside <strong className="text-neutral-900">{cfg.turnaround_days} working day{cfg.turnaround_days === 1 ? "" : "s"}</strong>
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {cfg.online_application_enabled && waHref && (
          <a
            href={applyOnlineHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-xl bg-neutral-900 px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
          >
            Apply on WhatsApp →
          </a>
        )}
        {cfg.pdf_download_enabled && cfg.pdf_url && (
          <a
            href={cfg.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-50"
          >
            Download form (PDF)
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Drivers Wanted ────────────────────────────────────────────────

export function PlantDriverRecruitmentSection({
  cfg,
  merchantName,
  waHref
}: {
  cfg: PlantDriverRecruitment;
  merchantName: string;
  waHref: string | null;
}) {
  if (!cfg.enabled) return null;
  const positions = cfg.positions_available
    .map((slug) => DRIVER_POSITION_PRESETS.find((p) => p.slug === slug))
    .filter((p): p is (typeof DRIVER_POSITION_PRESETS)[number] => p != null);
  const waMsg = encodeURIComponent(
    `Hi ${merchantName}, I'd like to apply as a driver.\n\nName:\nPhone:\nPostcode:\nLicence classes held (e.g. C+E):\nCPC valid until:\nDigitacho card: Y/N\nYears experience:\nPlant experience: Y/N\nLow-loader experience: Y/N\nSTGO experience: Y/N\nEarliest start date:\n\nHappy to send CV + licence photo.`
  );
  const applyHref = waHref ? `${waHref}?text=${waMsg}` : "#";
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Careers · Drivers wanted
      </p>
      <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
        {cfg.heading}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>

      {positions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {positions.map((p) => (
            <span
              key={p.slug}
              className="inline-flex items-center rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-widest text-white"
            >
              {p.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cfg.salary_range_display && (
          <div className="rounded-2xl bg-neutral-50 p-3">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
              Salary
            </p>
            <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900">
              {cfg.salary_range_display}
            </p>
          </div>
        )}
        {cfg.base_location && (
          <div className="rounded-2xl bg-neutral-50 p-3">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
              Base
            </p>
            <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900">
              {cfg.base_location}
            </p>
          </div>
        )}
      </div>

      {cfg.benefits.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cfg.benefits.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-[12px] font-bold leading-tight text-neutral-800"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-black"
                style={{ background: "#FFB300" }}
              >
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {cfg.require_cpc_card && <span className="rounded-full bg-neutral-100 px-2 py-0.5">CPC required</span>}
        {cfg.require_digitacho && <span className="rounded-full bg-neutral-100 px-2 py-0.5">Digitacho required</span>}
        {cfg.require_plant_experience && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">Plant experience</span>
        )}
        {cfg.require_stgo_experience && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">STGO experience</span>
        )}
        {cfg.full_time_available && <span className="rounded-full bg-neutral-100 px-2 py-0.5">Full-time</span>}
        {cfg.part_time_available && <span className="rounded-full bg-neutral-100 px-2 py-0.5">Part-time</span>}
        {cfg.owner_driver_available && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">Owner-driver</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {cfg.online_application_enabled && waHref && (
          <a
            href={applyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-xl bg-neutral-900 px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
          >
            Apply on WhatsApp →
          </a>
        )}
        {cfg.pdf_download_enabled && cfg.pdf_url && (
          <a
            href={cfg.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-50"
          >
            Download application (PDF)
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Meet The Team ────────────────────────────────────────────────

export function PlantTeamSectionView({ cfg }: { cfg: TeamSection }) {
  if (!cfg.enabled || cfg.members.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Meet the team
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        {cfg.heading}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>

      <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cfg.members.map((m, i) => (
          <li key={m.name + i}>
            <TeamCard m={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamCard({ m }: { m: PlantTeamMember }) {
  const initials = m.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const waDigits = m.whatsapp.replace(/[^\d]/g, "");
  const phoneDigits = m.phone.replace(/[^\d+]/g, "");
  // Fallback profile image — UI-Avatars generates a branded circle
  // with the person's initials against the yellow accent so cards
  // never render as a solid black chip.
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    m.name
  )}&background=FFB300&color=0A0A0A&size=200&font-size=0.45&bold=true`;
  const avatar = m.photo_url || fallbackAvatar;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt={m.name || initials}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
        />
        <div className="flex-1">
          <p className="text-[15px] font-extrabold leading-tight text-neutral-900">{m.name}</p>
          {m.role && <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">{m.role}</p>}
          {m.hours && <p className="mt-1 text-[11px] text-neutral-500">{m.hours}</p>}
        </div>
      </div>
      {/* initials retained for aria-label context */}
      <span className="sr-only">{initials}</span>

      {m.specialities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {m.specialities.map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
          >
            📞 {m.phone}
            {m.extension && <span className="text-white/70">· ext {m.extension}</span>}
          </a>
        )}
        {waDigits && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
            style={{ background: "#25D366" }}
          >
            💬 WhatsApp
          </a>
        )}
        {m.email && (
          <a
            href={`mailto:${m.email}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-50"
          >
            ✉ Email
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Parts Counter ────────────────────────────────────────────────

export function PlantPartsCounterSection({
  cfg
}: {
  cfg: PlantPartsCounter;
}) {
  if (!cfg.enabled) return null;
  const waDigits = cfg.whatsapp.replace(/[^\d]/g, "");
  const phoneDigits = cfg.phone.replace(/[^\d+]/g, "");
  return (
    <div
      className="mt-10 rounded-3xl border p-5 sm:p-6"
      style={{ background: "#0F172A", borderColor: "#111827" }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Trade counter · Spare parts + manuals
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{cfg.heading}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-white/80">{cfg.subheading}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-white/80">
            <span className="rounded-full bg-white/10 px-3 py-1">{cfg.hours_summary}</span>
            {cfg.same_day_cutoff && (
              <span className="rounded-full bg-white/10 px-3 py-1">
                🚚 {cfg.same_day_cutoff}
              </span>
            )}
            {cfg.minimum_order_pence && (
              <span className="rounded-full bg-white/10 px-3 py-1">
                Min order £{(cfg.minimum_order_pence / 100).toFixed(2)}
              </span>
            )}
            {cfg.delivery_available && (
              <span className="rounded-full bg-white/10 px-3 py-1">Delivery available</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Direct to counter
          </p>
          {phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              className="inline-flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-[13px] font-extrabold text-white transition hover:bg-white/15"
            >
              📞 {cfg.phone}
              <span className="text-white/60">Call</span>
            </a>
          )}
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-extrabold text-white transition hover:brightness-95"
              style={{ background: "#25D366" }}
            >
              💬 {cfg.whatsapp}
              <span>WhatsApp</span>
            </a>
          )}
          {cfg.email && (
            <a
              href={`mailto:${cfg.email}`}
              className="inline-flex items-center justify-between rounded-xl border border-white/20 bg-transparent px-3 py-2 text-[12px] font-extrabold text-white transition hover:bg-white/10"
            >
              ✉ {cfg.email}
            </a>
          )}
          {cfg.address && (
            <p className="mt-2 text-[11px] text-white/60">{cfg.address}</p>
          )}
        </div>
      </div>

      {cfg.categories.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.categories.map((c, i) => (
            <li
              key={c.name + i}
              className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4 text-white"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-extrabold leading-tight">{c.name}</p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${
                    c.in_stock ? "bg-emerald-500 text-white" : "bg-neutral-500 text-white"
                  }`}
                >
                  {c.in_stock ? "In stock" : "To order"}
                </span>
              </div>
              {c.description && (
                <p className="text-[11px] leading-relaxed text-white/70">{c.description}</p>
              )}
              {c.lead_time && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Lead time · {c.lead_time}
                </p>
              )}
              {c.manual_url && (
                <a
                  href={c.manual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2 text-[10px] font-extrabold uppercase tracking-widest text-white transition hover:bg-white/15"
                >
                  📄 Manual
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {cfg.manual_library_url && (
        <div className="mt-5">
          <a
            href={cfg.manual_library_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-xl bg-[#FFB300] px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
          >
            Open full manual library →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Compliance Info ────────────────────────────────────────────────

export function PlantComplianceInfoSection({
  cfg,
  haulage,
  merchantSlug
}: {
  cfg: PlantComplianceInfo;
  haulage: PlantHaulageService;
  merchantSlug: string;
}) {
  if (!cfg.enabled) return null;
  return (
    <div className="mt-10 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Wide load · Nationwide delivery · Compliance
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        {cfg.heading}
      </h3>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-700">
        {cfg.subheading}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard title="Wide load process" body={cfg.wide_load_note} />
        <InfoCard title="Nationwide coverage" body={cfg.nationwide_note} />
        {cfg.route_survey_note && (
          <InfoCard title="Route surveys" body={cfg.route_survey_note} />
        )}
        {cfg.emergency_line_note && (
          <InfoCard title="On the network" body={cfg.emergency_line_note} />
        )}
      </div>

      {cfg.extra_regs.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Compliance credentials
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cfg.extra_regs.map((r) => (
              <li
                key={r}
                className="flex items-start gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-[12px] font-bold leading-tight text-neutral-800"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-black"
                  style={{ background: "#FFB300" }}
                >
                  ✓
                </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 rounded-2xl bg-neutral-900 p-4 text-white sm:flex-nowrap sm:items-center">
        <div className="flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Regs at a glance
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-white/85">
            {haulage.operators_licence_number && (
              <span>OL {haulage.operators_licence_number}</span>
            )}
            {haulage.goods_in_transit_cover_pence && (
              <span>· GIT £{(haulage.goods_in_transit_cover_pence / 100).toLocaleString()}</span>
            )}
            {haulage.handles_notifications && <span>· VR1 filed for you</span>}
            {haulage.escort_per_day_pence && haulage.escort_per_day_pence > 0 && (
              <span>· Escorts arranged</span>
            )}
          </p>
        </div>
        <a
          href={`/${merchantSlug}/plant-hire/delivery-zones`}
          className="inline-flex h-11 shrink-0 items-center rounded-xl bg-[#FFB300] px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
        >
          Check zone rates →
        </a>
      </div>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-700">{body}</p>
    </div>
  );
}
