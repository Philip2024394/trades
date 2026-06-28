// Trust + payment-method badges. Inline SVG only — no third-party SDK,
// no external script, no remote image fetch. Renders a "Secure payments
// via Stripe" mark followed by the card schemes / wallets we accept
// through Stripe Checkout. Two layout variants:
//
//   - default ("full")  : marketing / pricing / upgrade contexts.
//   - "compact"         : footer column. Smaller padding and tagline
//                         dropped so the row fits a footer width.
//
// All text honours the project 13px floor; payment marks are rendered
// as small monochrome glyphs (text + outline boxes) so they remain
// legible without trademark approvals for full-colour scheme logos.

type Variant = "full" | "compact";

const NETWORKS: { label: string; tag: string }[] = [
  { label: "Visa", tag: "VISA" },
  { label: "Mastercard", tag: "MC" },
  { label: "American Express", tag: "AMEX" },
  { label: "Apple Pay", tag: "  Pay" },
  { label: "Google Pay", tag: "G Pay" },
  { label: "Link", tag: "Link" }
];

function StripeLockBadge({ accent }: { accent: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[13px] font-semibold text-white"
      aria-label="Secure payments via Stripe"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>Secure payments via</span>
      <span className="font-extrabold" style={{ color: accent }}>
        Stripe
      </span>
    </span>
  );
}

function PaymentMark({ label, tag }: { label: string; tag: string }) {
  return (
    <span
      className="inline-flex h-6 min-w-[34px] items-center justify-center rounded-[5px] border border-white/20 bg-white/[0.04] px-1.5 text-[10px] font-bold uppercase tracking-wider text-white/85"
      aria-label={label}
      title={label}
    >
      {tag}
    </span>
  );
}

export function TrustBadges({
  variant = "full",
  className = ""
}: {
  variant?: Variant;
  className?: string;
}) {
  const accent = "#FFB300";
  const compact = variant === "compact";

  return (
    <div
      className={`flex flex-col gap-2 ${compact ? "items-start" : "items-center text-center"} ${className}`}
    >
      <div
        className={`flex flex-wrap gap-2 ${compact ? "items-start" : "items-center justify-center"}`}
      >
        <StripeLockBadge accent={accent} />
        <span
          className={`flex flex-wrap gap-1.5 ${compact ? "items-start" : "items-center"}`}
          aria-label="Accepted payment methods"
        >
          {NETWORKS.map((n) => (
            <PaymentMark key={n.label} label={n.label} tag={n.tag} />
          ))}
        </span>
      </div>
      {!compact && (
        <p className="max-w-xl text-[13px] leading-relaxed text-white/70">
          We never store your card details. All payments are processed by{" "}
          <span className="font-bold" style={{ color: accent }}>
            Stripe
          </span>{" "}
          — PCI-DSS Level 1 certified.
        </p>
      )}
      {compact && (
        <p className="text-[13px] leading-relaxed text-white/60">
          Payments processed by Stripe — PCI-DSS Level 1.
        </p>
      )}
    </div>
  );
}
