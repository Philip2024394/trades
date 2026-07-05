// Public-facing credential badge.
//
// Renders a trust badge for one scheme. If the merchant doesn't hold
// the scheme, or it's expired/suspended, the widget renders NULL — no
// broken badge ever appears on a public site.
//
// Usage from a section:
//   <CredentialWidget scheme="companies-house" credentials={publicCreds} />
//
// The section is responsible for rendering multiple widgets (a trust
// bar is typically 3–5 badges).

import type { PublicCredential } from "@/lib/studio/credentials/loader";
import type { CredentialScheme } from "@/lib/studio/blueprints";

const SCHEME_META: Record<
  CredentialScheme,
  { label: string; publicHref: string | null }
> = {
  "companies-house": {
    label: "Companies House",
    publicHref:
      "https://find-and-update.company-information.service.gov.uk/company/"
  },
  vat: { label: "VAT", publicHref: "https://www.gov.uk/check-uk-vat-number" },
  "gas-safe": { label: "Gas Safe", publicHref: "https://www.gassaferegister.co.uk/" },
  niceic: { label: "NICEIC", publicHref: "https://niceic.com/" },
  napit: { label: "NAPIT", publicHref: "https://napit.org.uk/" },
  stroma: { label: "STROMA", publicHref: "https://www.stroma-certification.co.uk/" },
  trustmark: { label: "TrustMark", publicHref: "https://www.trustmark.org.uk/" },
  fmb: { label: "FMB", publicHref: "https://www.fmb.org.uk/" },
  mcs: { label: "MCS", publicHref: "https://mcscertified.com/" },
  hetas: { label: "HETAS", publicHref: "https://www.hetas.co.uk/" },
  oftec: { label: "OFTEC", publicHref: "https://www.oftec.org/" },
  fensa: { label: "FENSA", publicHref: "https://www.fensa.org.uk/" },
  certass: { label: "CERTASS", publicHref: "https://www.certass.co.uk/" },
  chas: { label: "CHAS", publicHref: "https://www.chas.co.uk/" },
  safecontractor: { label: "SafeContractor", publicHref: "https://www.safecontractor.com/" },
  smas: { label: "SMAS", publicHref: "https://www.smasltd.com/" },
  constructionline: {
    label: "Constructionline",
    publicHref: "https://www.constructionline.co.uk/"
  },
  ipaf: { label: "IPAF", publicHref: "https://www.ipaf.org/" },
  pasma: { label: "PASMA", publicHref: "https://pasma.co.uk/" },
  "waste-carrier": {
    label: "Waste Carrier",
    publicHref: "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers"
  },
  "public-liability": { label: "Public Liability", publicHref: null },
  cscs: { label: "CSCS", publicHref: "https://www.cscs.uk.com/" }
};

export function CredentialWidget({
  scheme,
  credentials,
  variant = "chip"
}: {
  scheme: CredentialScheme;
  credentials: PublicCredential[];
  variant?: "chip" | "card";
}) {
  const held = credentials.find((c) => c.scheme === scheme);
  if (!held) return null;

  const meta = SCHEME_META[scheme];
  const href =
    scheme === "companies-house" && meta.publicHref
      ? `${meta.publicHref}${encodeURIComponent(held.number)}`
      : meta.publicHref;

  const displayNumber = maskNumber(scheme, held.number);
  const isAuto = held.status === "verified";

  if (variant === "card") {
    return (
      <a
        href={href ?? undefined}
        target={href ? "_blank" : undefined}
        rel={href ? "noreferrer noopener" : undefined}
        className="inline-flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 no-underline transition hover:bg-neutral-50"
      >
        <TickIcon verified={isAuto} />
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            {meta.label}
          </p>
          <p className="text-[13px] font-extrabold">
            {held.displayLabel ?? displayNumber}
          </p>
          {!isAuto && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
              Self-declared · verify with register
            </p>
          )}
        </div>
      </a>
    );
  }

  return (
    <a
      href={href ?? undefined}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer noopener" : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-extrabold text-neutral-800 no-underline transition hover:bg-neutral-50"
      title={
        isAuto
          ? `${meta.label} · verified against public register`
          : `${meta.label} · self-declared, verify at the public register`
      }
    >
      <TickIcon verified={isAuto} small />
      <span>{meta.label}</span>
      <span className="text-[10px] font-mono text-neutral-500">
        {displayNumber}
      </span>
    </a>
  );
}

function TickIcon({
  verified,
  small
}: {
  verified: boolean;
  small?: boolean;
}) {
  const size = small ? 12 : 18;
  const color = verified ? "#10B981" : "#2563EB";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill={color} stroke="none" />
      <polyline points="7 12 11 16 17 8" stroke="#FFFFFF" />
    </svg>
  );
}

// Mask sensitive numbers on public pages — full CH numbers are public
// info; VAT is fine to display; card-check numbers (CSCS/IPAF) are
// personally identifying and we show a masked form. Insurance/PL is
// never rendered as a raw number.
function maskNumber(scheme: CredentialScheme, number: string): string {
  const clean = number.replace(/\s+/g, "");
  switch (scheme) {
    case "public-liability":
      return "certificate on file";
    case "cscs":
    case "ipaf":
    case "pasma":
      if (clean.length <= 4) return "••••";
      return `••••${clean.slice(-4)}`;
    default:
      return clean;
  }
}
