// CanteenSocialLinks — social icons row shown under the "Powered by"
// strip. Max 3 icons (Instagram · TikTok · Facebook) — each renders
// only when the owner has published that platform's URL. Zero-URL
// state → nothing renders (honest empty).
//
// Uses inline SVGs so no additional icon dependencies are needed and
// each brand mark carries its official colour on a round chip.

export function CanteenSocialLinks({
  instagram,
  tiktok,
  facebook
}: {
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
}) {
  const links = [
    instagram ? { url: instagram, label: "Instagram", chip: "#E1306C", icon: <InstagramIcon size={13}/> } : null,
    tiktok    ? { url: tiktok,    label: "TikTok",    chip: "#000000", icon: <TikTokIcon size={13}/> } : null,
    facebook  ? { url: facebook,  label: "Facebook",  chip: "#1877F2", icon: <FacebookIcon size={13}/> } : null
  ].filter((x): x is { url: string; label: string; chip: string; icon: React.ReactNode } => x !== null);

  if (links.length === 0) return null;

  return (
    <div className="mx-auto mt-3 max-w-[1400px] px-3 pb-0 md:px-6">
      <div className="text-center">
        <div className="text-[12px] font-black text-neutral-900 md:text-[13px]">
          Check Out Our Social Media
        </div>
        <p className="mt-0.5 text-[10.5px] leading-snug text-neutral-500 md:text-[11px]">
          New designs updated weekly across our social media channels
        </p>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        {links.map((s) => (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={s.label}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md transition active:scale-[0.95]"
            style={{ backgroundColor: s.chip }}
          >
            {s.icon}
          </a>
        ))}
      </div>
    </div>
  );
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="text-white" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-white" aria-hidden>
      <path d="M19.321 5.562a5.124 5.124 0 0 1-.443-.258 6.228 6.228 0 0 1-1.137-.966c-.849-.966-1.166-1.947-1.284-2.633h.004C16.363 1.076 16.415 0.5 16.417 0.5h-3.397v13.11c0 .175 0 .348-.007.519a3.24 3.24 0 0 1-.05.549c-.108.646-.427 1.221-.9 1.653a3.185 3.185 0 0 1-2.181.87c-1.815 0-3.286-1.481-3.286-3.31 0-1.827 1.471-3.308 3.286-3.308.343 0 .674.053.985.151V7.283a6.749 6.749 0 0 0-1.024-.077c-3.702 0-6.703 3.023-6.703 6.75 0 3.727 3.001 6.75 6.703 6.75 3.702 0 6.703-3.023 6.703-6.75V8.126a9.643 9.643 0 0 0 5.555 1.767V6.482a5.657 5.657 0 0 1-2.98-.92z"/>
    </svg>
  );
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-white" aria-hidden>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
    </svg>
  );
}
