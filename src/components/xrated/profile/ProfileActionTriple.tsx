// Xrated Trades — three big tappable action buttons under the banner.
// Contact (WhatsApp), Visit us (anchor to #visit), Share (anchor to share strip).
// Server component — pure links, no client state.

export function ProfileActionTriple({
  whatsappHref,
  visitHref,
  shareHref,
  themeColor,
  variant = "below"
}: {
  whatsappHref: string;
  visitHref: string;
  shareHref: string;
  themeColor: string;
  /**
   * "below" — renders as a standalone section below the banner with surface
   * backgrounds. "overlay" — renders as a tight 3-up row designed to sit
   * INSIDE the banner image (caller positions it), with translucent dark
   * pill backgrounds so the buttons read against the photo.
   */
  variant?: "below" | "overlay";
}) {
  const buttons = [
    {
      href: whatsappHref,
      label: "Contact",
      external: true,
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
        </svg>
      )
    },
    {
      href: visitHref,
      label: "Visit us",
      external: false,
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )
    },
    {
      href: shareHref,
      label: "Share",
      external: false,
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )
    }
  ];

  if (variant === "overlay") {
    // Banner overlay only renders Contact. Share lives in the top-right
    // icon button; Visit lives as a text link inside the profile container.
    const overlayButtons = buttons.filter((b) => b.label === "Contact");
    return (
      <ul className="flex gap-1.5 sm:gap-3">
        {overlayButtons.map((b) => (
          <li key={b.label}>
            <a
              href={b.href}
              {...(b.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex min-w-[60px] flex-col items-center gap-1 rounded-xl bg-black/55 px-2 py-1.5 backdrop-blur-sm transition hover:bg-black/70 sm:min-w-[76px] sm:px-3 sm:py-2.5"
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10"
                style={{ background: themeColor, color: "#FFFFFF" }}
              >
                {b.icon}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white drop-shadow">
                {b.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pt-6">
      <ul className="grid grid-cols-3 gap-3">
        {buttons.map((b) => (
          <li key={b.label}>
            <a
              href={b.href}
              {...(b.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex h-full min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-brand-line bg-brand-surface px-2 py-3 transition hover:border-brand-accent"
            >
              <span
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: `${themeColor}1F`, color: themeColor }}
              >
                {b.icon}
              </span>
              <span className="text-[13px] font-bold text-brand-text">
                {b.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ProfileActionTriple;
