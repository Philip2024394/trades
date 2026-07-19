"use client";

// HowItWorksOpenButton — the primary "How it works" CTA on the right
// sidebar. Navigates to ?guide=1 which the parent page interprets as
// "swap the center column for the guide". URL state = deep-linkable +
// shareable (email a colleague: "check this out — thenetworkers.app/
// sitebook?guide=message-a-trade").

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

export function HowItWorksOpenButton({ label = "How it works" }: { label?: string }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function open() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("guide", "1");
    router.push(`${pathname}?${sp.toString()}`, { scroll: true });
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
      style={{ borderColor: BRAND_YELLOW, boxShadow: `0 4px 14px ${BRAND_YELLOW}33` }}
    >
      <BookOpen size={13} strokeWidth={2.5} style={{ color: BRAND_YELLOW }}/>
      {label}
    </button>
  );
}
