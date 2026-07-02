// Tier-2 + operational public sections:
//   - PlantTrustSignalsSection (accreditations + reviews + insurance + awards)
//   - PlantCdmPackSection
//   - PlantClosureCalendarSection
//   - PlantSubHireSection
//   - PlantRepeatLadderSection
//   - PlantNotifyWhenFreeCard  (small teaser card)
//   - PlantBulkQuoteCard       (small teaser card)
//
// All server-safe. Interactive quote-request buttons use anchor tags
// with WhatsApp deep-links.

import type {
  PlantBulkQuote,
  PlantCdmPack,
  PlantClosureCalendar,
  PlantNotifyWhenFree,
  PlantRepeatLadder,
  PlantSubHire,
  PlantTrustSignals
} from "@/lib/plantHire";

// ─── Trust Signals ────────────────────────────────────────────────

export function PlantTrustSignalsSection({ cfg }: { cfg: PlantTrustSignals }) {
  if (!cfg.enabled) return null;
  const hasReviews = !!cfg.google_reviews_embed_url || !!cfg.trustpilot_embed_url;
  return (
    <div className="mt-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Vetted · Insured · Audited
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        {cfg.heading}
      </h3>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
        {cfg.subheading}
      </p>

      {cfg.accreditations.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cfg.accreditations.map((a) => (
            <li
              key={a.slug + a.label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-center"
            >
              <div className="grid h-14 w-full place-items-center overflow-hidden">
                {a.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.logo_url}
                    alt={a.label}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB300]">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-[11px] font-extrabold leading-tight text-neutral-900">
                {a.label}
              </p>
              {a.cert_number && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                  {a.cert_number}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {(cfg.insurance_cert_url || cfg.insurance_cover_pence || cfg.net_promoter_score !== null) && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cfg.insurance_cover_pence && (
            <StatCard
              kicker="Public Liability"
              value={`£${(cfg.insurance_cover_pence / 100).toLocaleString()}`}
              body="Employer's + public liability displayed on every quote."
            />
          )}
          {cfg.insurance_cert_url && (
            <div className="flex flex-col justify-between rounded-2xl bg-neutral-50 p-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Insurance certificate
                </p>
                <p className="mt-1 text-[13px] font-bold leading-tight text-neutral-900">
                  Download our current cert
                </p>
              </div>
              <a
                href={cfg.insurance_cert_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-neutral-900 px-3 text-[10px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
              >
                📄 Open PDF
              </a>
            </div>
          )}
          {cfg.net_promoter_score !== null && (
            <StatCard
              kicker="Net Promoter Score"
              value={String(cfg.net_promoter_score)}
              body="Customer-verified — anything above +50 is 'excellent'."
            />
          )}
        </div>
      )}

      {cfg.awards.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Awards + recognition
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.awards.map((a, i) => (
              <li
                key={a.title + i}
                className="rounded-2xl border border-neutral-200 bg-white p-3"
              >
                <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                  {a.title}
                </p>
                {(a.year || a.issuer) && (
                  <p className="mt-1 text-[11px] text-neutral-600">
                    {a.issuer}
                    {a.year ? ` · ${a.year}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasReviews && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cfg.google_reviews_embed_url && (
            <EmbedFrame url={cfg.google_reviews_embed_url} label="Google Reviews" />
          )}
          {cfg.trustpilot_embed_url && (
            <EmbedFrame url={cfg.trustpilot_embed_url} label="TrustPilot" />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ kicker, value, body }: { kicker: string; value: string; body: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        {kicker}
      </p>
      <p className="mt-1 text-[22px] font-extrabold leading-tight text-neutral-900">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}

function EmbedFrame({ url, label }: { url: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          {label}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
        >
          Open →
        </a>
      </div>
      <iframe
        src={url}
        title={label}
        loading="lazy"
        className="h-64 w-full"
      />
    </div>
  );
}

// ─── CDM Pack ────────────────────────────────────────────────────

export function PlantCdmPackSection({
  cfg,
  merchantSlug,
  waHref
}: {
  cfg: PlantCdmPack;
  merchantSlug: string;
  waHref: string | null;
}) {
  if (!cfg.enabled) return null;
  const waMsg = encodeURIComponent(
    `Hi, I'd like the CDM 2015 risk-assessment pack added to my next hire. Machine + site postcode to follow.`
  );
  const requestHref = waHref ? `${waHref}?text=${waMsg}` : `/${merchantSlug}`;
  return (
    <div className="mt-10 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            CDM 2015 · Site safety pack
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            {cfg.heading}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{cfg.subheading}</p>
          {cfg.bullets.length > 0 && (
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[12px] font-bold text-neutral-800">
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
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Get the pack
          </p>
          {cfg.price_pence !== null && (
            <p className="text-[22px] font-extrabold leading-tight text-neutral-900">
              £{(cfg.price_pence / 100).toFixed(2)}
            </p>
          )}
          {cfg.auto_included_on_hires_over_pence && cfg.auto_included_on_hires_over_pence > 0 && (
            <p className="text-[11px] text-neutral-600">
              Free with hires over £{(cfg.auto_included_on_hires_over_pence / 100).toFixed(0)}.
            </p>
          )}
          {cfg.pdf_url && (
            <a
              href={cfg.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex h-10 items-center rounded-xl bg-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
            >
              📄 Sample pack
            </a>
          )}
          <a
            href={requestHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-xl bg-[#FFB300] px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
          >
            Add to next hire →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Closure Checker (contact-page card) ─────────────────────────

/** Contact-page card — "Check our dates" with a collapsible list of
 *  upcoming closed / half-day dates. Server-safe (uses <details>). */
export function PlantClosureCheckerCard({
  cfg
}: {
  cfg: PlantClosureCalendar;
}) {
  if (!cfg.enabled) return null;
  const upcoming = cfg.closures
    .filter((c) => c.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 20);
  const nextTwo = upcoming.slice(0, 2);
  return (
    <details className="group rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Check our dates · Yard opening
          </p>
          <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
            {cfg.heading}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>
          {cfg.weekend_note && (
            <p className="mt-2 inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-700">
              🕐 {cfg.weekend_note}
            </p>
          )}
          {nextTwo.length > 0 && (
            <p className="mt-2 text-[11px] font-bold text-neutral-500">
              Next closure{nextTwo.length > 1 ? "s" : ""}:{" "}
              {nextTwo.map((c) => c.date).join(" · ")}
            </p>
          )}
        </div>
        <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-open:bg-[#FFB300] group-open:text-neutral-900">
          <span className="group-open:hidden">Open calendar →</span>
          <span className="hidden group-open:inline">Close calendar ×</span>
        </span>
      </summary>
      <div className="mt-5 border-t border-neutral-200 pt-5">
        {upcoming.length === 0 ? (
          <p className="text-[12px] text-neutral-500">
            No scheduled closures in the coming window — we&rsquo;re open normal hours.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((c) => (
              <li
                key={c.date}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-center">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                    {c.date.slice(5, 7)}
                  </span>
                  <span className="-mt-1 text-[15px] font-extrabold leading-tight text-neutral-900">
                    {c.date.slice(8, 10)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                    {c.label || "Closed"}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-red-600">
                    {c.half_day ? "Half day" : "Closed all day"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

// ─── Closure Calendar ────────────────────────────────────────────

export function PlantClosureCalendarSection({ cfg }: { cfg: PlantClosureCalendar }) {
  if (!cfg.enabled) return null;
  const upcoming = cfg.closures
    .filter((c) => c.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 10);
  return (
    <div className="mt-10 rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Yard opening · Planned closures
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        {cfg.heading}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>
      {cfg.weekend_note && (
        <p className="mt-3 inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-700">
          🕐 {cfg.weekend_note}
        </p>
      )}
      {upcoming.length > 0 ? (
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((c) => (
            <li
              key={c.date}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-center">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {c.date.slice(5, 7)}
                </span>
                <span className="-mt-1 text-[15px] font-extrabold leading-tight text-neutral-900">
                  {c.date.slice(8, 10)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                  {c.label || "Closed"}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-red-600">
                  {c.half_day ? "Half day" : "Closed all day"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[12px] text-neutral-500">
          No closures scheduled — we&rsquo;re open normal hours through the next window.
        </p>
      )}
    </div>
  );
}

// ─── Sub-Hire Network / Trade Circle sourcing ────────────────────

export function PlantSubHireSection({
  cfg,
  waHref,
  merchantName
}: {
  cfg: PlantSubHire;
  waHref: string | null;
  merchantName: string;
}) {
  if (!cfg.enabled) return null;
  const waMsg = encodeURIComponent(
    `Hi ${merchantName}, I'm looking for something not listed on your site.\n\nWhat I need:\nMachine / part / consumable:\nMake + model / spec:\nQuantity:\nSite postcode:\nDate needed:\n\nPlease source it through your Trade Circle network — happy with your usual rate + service.`
  );
  const askHref = waHref ? `${waHref}?text=${waMsg}` : "#";
  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Trade Circle powered · Sourcing network
        </p>
        <span
          className="inline-flex h-5 items-center rounded-full px-2 text-[9px] font-extrabold uppercase tracking-widest text-black"
          style={{ background: "#FFB300" }}
        >
          UK-wide
        </span>
      </div>
      <h3
        className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl"
        dangerouslySetInnerHTML={{ __html: cfg.heading }}
      />
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
        {cfg.subheading}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["Same rates", "Same insurance", "Same delivery SLA", "Same paperwork"].map((b) => (
          <li
            key={b}
            className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[12px] font-bold text-neutral-800"
          >
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-black"
              style={{ background: "#FFB300" }}
            >
              ✓
            </span>
            {b}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12px] leading-relaxed text-neutral-700">
        <strong className="text-neutral-900">You deal with us.</strong> We do the running around
        — sourcing, insurance paperwork, delivery scheduling — through the Trade Circle network
        of vetted UK yards. One invoice, one contact, one service standard.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={askHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
          style={{ background: "#25D366" }}
        >
          Ask us to source →
        </a>
        <a
          href="/trade-off/yard?context=plant-hire"
          className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-50"
        >
          About Trade Circle →
        </a>
      </div>

      {cfg.markup_percent !== null && cfg.markup_percent > 0 && (
        <p className="mt-3 text-[11px] font-bold text-neutral-500">
          Network-sourced items: our own rate + {cfg.markup_percent}% handling for the sourcing,
          coordination and insurance paperwork.
        </p>
      )}
    </div>
  );
}

// ─── Repeat Ladder ────────────────────────────────────────────────

export function PlantRepeatLadderSection({ cfg }: { cfg: PlantRepeatLadder }) {
  if (!cfg.enabled || cfg.tiers.length === 0) return null;
  return (
    <div className="relative mt-10 overflow-hidden rounded-3xl bg-neutral-900 p-5 text-white sm:p-6">
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2004_00_55%20PM.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark cinematic overlay for text legibility */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.65) 55%, rgba(10,10,10,0.35) 100%)"
        }}
      />

      <div className="relative z-10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Repeat customer ladder
        </p>
        <h3 className="mt-1 text-2xl font-extrabold sm:text-3xl">{cfg.heading}</h3>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/85">
          {cfg.subheading}
        </p>

        <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cfg.tiers.map((t, i) => (
            <li
              key={i}
              className="relative flex flex-col gap-1 rounded-2xl bg-white/10 p-4 backdrop-blur-sm"
            >
              <span
                className="absolute -top-2 left-4 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-black"
                style={{ background: "#FFB300" }}
              >
                Hire #{t.hires_required}+
              </span>
              <p className="mt-3 text-[28px] font-extrabold leading-none">
                {t.discount_percent}%
              </p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                off day rate
              </p>
              <p className="mt-1 text-[12px] text-white/85">{t.label}</p>
            </li>
          ))}
        </ol>

        {cfg.reset_after_months && (
          <p className="mt-4 text-[11px] font-bold text-white/70">
            Tier held for {cfg.reset_after_months} months from last hire, then resets.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Notify When Free promo ──────────────────────────────────────

export function PlantNotifyWhenFreeCard({ cfg }: { cfg: PlantNotifyWhenFree }) {
  if (!cfg.enabled) return null;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Notify when free
      </p>
      <p className="mt-1 text-[14px] font-extrabold leading-tight text-neutral-900">
        {cfg.heading}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{cfg.subheading}</p>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        Look for the bell icon on any machine detail page.
      </p>
    </div>
  );
}

// ─── Bulk Quote promo ────────────────────────────────────────────

export function PlantBulkQuoteCard({
  cfg,
  waHref,
  merchantName
}: {
  cfg: PlantBulkQuote;
  waHref: string | null;
  merchantName: string;
}) {
  if (!cfg.enabled) return null;
  const waMsg = encodeURIComponent(
    `Hi ${merchantName}, we're planning a project hire.\n\nMachines needed:\nSite postcode:\nStart date:\nDuration (weeks):\nOperators required: Y/N\nDelivery / self-collect:\n\nHappy to send a full spec — please quote.`
  );
  const href = waHref ? `${waHref}?text=${waMsg}` : "#";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Bulk / project hire
      </p>
      <p className="mt-1 text-[14px] font-extrabold leading-tight text-neutral-900">
        {cfg.heading}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{cfg.subheading}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold text-neutral-500">
        {cfg.min_machines && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">
            {cfg.min_machines}+ machines
          </span>
        )}
        {cfg.min_duration_weeks && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">
            {cfg.min_duration_weeks}+ weeks
          </span>
        )}
        {cfg.discount_hint_percent && (
          <span className="rounded-full bg-[#FFB300]/20 px-2 py-0.5 text-neutral-900">
            up to −{cfg.discount_hint_percent}%
          </span>
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-9 items-center rounded-lg bg-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
      >
        Request bulk quote →
      </a>
    </div>
  );
}
