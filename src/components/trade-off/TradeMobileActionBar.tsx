// Sticky bottom action bar shown only on mobile (md:hidden). Three equal-
// flex buttons: WhatsApp / Call / Email. The page is padded with pb-20
// md:pb-0 so its content never gets hidden behind this bar.
//
// Server component — all CTAs are plain <a> links.

export function TradeMobileActionBar({
  waUrl,
  phone,
  email,
  displayName
}: {
  waUrl: string;
  phone: string | null;
  email: string;
  displayName: string;
}) {
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent("Quotation request via Hammerex Trade Off")}&body=${encodeURIComponent(`Hi ${displayName}, I found your profile on Hammerex Trade Off.`)}`
    : null;
  const tel = phone ? `tel:${phone.replace(/\s+/g, "")}` : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-brand-bg/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-6xl items-stretch gap-2 px-3 py-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-brand-whatsapp px-2 text-xs font-bold text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Zm4.55-6.23c-.25-.13-1.47-.73-1.7-.82s-.39-.13-.55.13-.64.81-.78.97-.29.19-.54.06a6.84 6.84 0 0 1-2-1.24 7.55 7.55 0 0 1-1.4-1.74c-.15-.25 0-.39.11-.51s.25-.29.37-.43a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.55-1.33-.76-1.82s-.4-.41-.55-.42h-.47a.91.91 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07 4.83 4.83 0 0 0 1 2.55 11 11 0 0 0 4.21 3.73c.59.25 1 .4 1.4.52a3.41 3.41 0 0 0 1.55.1 2.55 2.55 0 0 0 1.66-1.17 2 2 0 0 0 .15-1.17c-.06-.11-.23-.18-.48-.31Z" />
          </svg>
          WhatsApp
        </a>
        {tel && (
          <a
            href={tel}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-brand-line bg-brand-surface px-2 text-xs font-semibold text-brand-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
            </svg>
            Call
          </a>
        )}
        {mailto && (
          <a
            href={mailto}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-brand-line bg-brand-surface px-2 text-xs font-semibold text-brand-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
              <path d="m22 6-10 7L2 6" />
            </svg>
            Email
          </a>
        )}
      </div>
    </div>
  );
}

export default TradeMobileActionBar;
