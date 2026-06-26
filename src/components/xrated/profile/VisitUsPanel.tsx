// Xrated Trades — premium-tier "Visit us" panel.
// Server component. Renders ONLY when visit_us_enabled is true on the
// listing AND we have lat/lng. The Areas-served panel already shows the
// TradeAreaMap so this block adds a clear directions CTA + address line.

export function VisitUsPanel({
  city,
  country,
  lat,
  lng,
  themeColor
}: {
  city: string;
  country: string;
  lat: number;
  lng: number;
  themeColor: string;
}) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${lat},${lng}`
  )}`;

  return (
    <section className="mx-auto max-w-3xl px-4 pb-2 pt-8">
      <h2
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: themeColor }}
      >
        Visit us
      </h2>
      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-brand-line bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-brand-text">
            {city}
            {country ? `, ${country}` : ""}
          </p>
          <p className="mt-1 text-[13px] text-brand-muted">
            Drop in or call ahead — see operating hours above.
          </p>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-bold"
          style={{ background: themeColor, color: "#000" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Get directions
        </a>
      </div>
    </section>
  );
}
