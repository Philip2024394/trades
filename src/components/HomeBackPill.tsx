// HomeBackPill — floating "back to home" chip.
//
// Renders top-left, z-30 (below the invite CTA sticky footer on
// z-40). One tap returns the user to their home surface — SiteBook
// for homeowners, own canteen for trades/suppliers.
//
// Server component wrapper does the identity detection; the client
// wrapper below is used for pages that want to render the pill from
// client-only code. Both share the same visual.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { HomeBackContext } from "@/lib/homeBackContext";

const BRAND_YELLOW = "#FFB300";

export function HomeBackPill({ ctx }: { ctx: HomeBackContext | null }) {
  if (!ctx) return null;
  return (
    <div className="pointer-events-none fixed top-4 left-4 z-30">
      <Link
        href={ctx.href}
        className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border-2 bg-white pl-2 pr-3.5 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-lg transition hover:brightness-95"
        style={{ borderColor: BRAND_YELLOW }}
      >
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-900"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
        </span>
        {ctx.label}
      </Link>
    </div>
  );
}
