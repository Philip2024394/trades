// Xrated Trades — premium-tier "Service locations" chip strip.
// Server component. v1 hardcodes all three locations (On-site, Mobile,
// Workshop) because tradies typically offer all three. If we add an
// opt-out column later, we just pull it from the listing.

export function ServiceLocationsStrip({ themeColor }: { themeColor: string }) {
  const chips = [
    { icon: "\u{1F3E0}", label: "On-site" },
    { icon: "\u{1F69A}", label: "Mobile" },
    { icon: "\u{1F3EA}", label: "Workshop" }
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 pb-2 pt-6">
      <ul className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <li key={c.label}>
            <span
              className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-brand-surface px-4 text-[13px] font-bold text-brand-text"
              style={{ borderColor: themeColor }}
            >
              <span aria-hidden="true">{c.icon}</span>
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
