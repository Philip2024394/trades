// Xrated Trades — About column header + bio.
//
// Renders the About Us heading with a yellow "Services" button on the
// right. The button is a link to /trade/<slug>/services — the dedicated
// services subpage shows the radar-ping service-area map + the full
// services list, with no video / pricing / gallery distractions.
//
// Bio paragraphs split only on a BLANK line so a tradesperson's
// continuous prose stays one paragraph unless they deliberately add a
// blank-line break.

export function AboutFlipPanel({
  bioParas,
  defaultBio,
  slug
}: {
  bioParas: string[];
  defaultBio: string;
  slug: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          About Us
        </h2>
        <a
          href={`/trade/${slug}/services`}
          className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
          style={{ background: "#FFB300" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Services
        </a>
      </div>

      <div className="mt-3 line-clamp-8">
        {bioParas.length === 0 ? (
          <p className="text-justify text-[15px] leading-[1.55] text-neutral-700">
            {defaultBio}
          </p>
        ) : (
          bioParas.map((p, i) => (
            <p
              key={i}
              className={`text-justify text-[15px] leading-[1.55] text-neutral-700 ${i === 0 ? "" : "mt-1.5"}`}
            >
              {p}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
