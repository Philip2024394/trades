"use client";

// HowItWorksSectionChip — a tiny "?" chip that sits next to a section
// header on the sitebook page. Tapping it deep-links directly to the
// matching feature card in the guide (?guide=<featureId>).

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { HelpCircle } from "lucide-react";

export function HowItWorksSectionChip({ featureId, title }: {
  featureId: string;
  title?:    string;
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function open() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("guide", featureId);
    router.push(`${pathname}?${sp.toString()}`, { scroll: true });
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
      style={{ borderColor: "rgba(0,0,0,0.12)" }}
      aria-label={title ? `How ${title} works` : "How it works"}
      title={title ? `How ${title} works` : "How it works"}
    >
      <HelpCircle size={11} strokeWidth={2.5}/>
    </button>
  );
}
