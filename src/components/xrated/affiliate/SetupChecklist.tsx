// Affiliate dashboard — Overview setup checklist.
//
// Four-step onboarding card. Each step shows a green tick or empty
// circle based on simple field-presence checks against the affiliate
// row. When all 4 are complete the card collapses to a single "all set
// up" line so we don't keep nagging fully onboarded affiliates.
import Link from "next/link";

type Props = {
  hasAvatar: boolean;
  hasPaymentDetails: boolean;
  hasCustomLinks: boolean;
  hasSocialLinks: boolean;
};

type Item = {
  label: string;
  href: string;
  done: boolean;
};

export function SetupChecklist({
  hasAvatar,
  hasPaymentDetails,
  hasCustomLinks,
  hasSocialLinks
}: Props) {
  const items: Item[] = [
    {
      label: "Add your profile photo and bio",
      href: "/affiliates/dashboard/profile",
      done: hasAvatar
    },
    {
      label: "Add your payment details",
      href: "/affiliates/dashboard/payment-details",
      done: hasPaymentDetails
    },
    {
      label: "Generate marketing links",
      href: "/affiliates/dashboard/links",
      done: hasCustomLinks
    },
    {
      label: "Post your referral link somewhere",
      href: "/affiliates/dashboard/social",
      done: hasSocialLinks
    }
  ];

  const allDone = items.every((i) => i.done);

  if (allDone) {
    return (
      <section
        className="rounded-xl border bg-brand-surface p-4"
        style={{ borderColor: "#22c55e" }}
        aria-label="Setup complete"
      >
        <p className="text-[13px] font-bold text-[#22c55e]">
          <span aria-hidden="true">✓</span> You&apos;re all set up — keep promoting!
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border bg-brand-surface p-4 sm:p-5"
      style={{ borderColor: "#FFB300" }}
      aria-label="Setup checklist"
    >
      <p
        className="text-[14px] font-extrabold"
        style={{ color: "#FFB300" }}
      >
        Get set up — 4 quick steps
      </p>
      <p className="mt-1 text-[13px] text-brand-muted">
        Finish these once and you&apos;re ready to earn. Tap any step to jump to it.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item, idx) => (
          <li key={idx}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-brand-line bg-brand-bg p-3 hover:bg-brand-line"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
                style={{
                  backgroundColor: item.done ? "#22c55e" : "transparent",
                  border: item.done ? "none" : "2px solid #6b7280",
                  color: item.done ? "white" : "transparent"
                }}
              >
                {item.done ? "✓" : ""}
              </span>
              <span className="flex-1 text-[13px] text-brand-text">
                <span className="font-bold">Step {idx + 1}:</span> {item.label}
              </span>
              <span
                className="text-[13px] font-bold"
                style={{ color: item.done ? "#22c55e" : "#FFB300" }}
              >
                {item.done ? "Done" : "Start →"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
