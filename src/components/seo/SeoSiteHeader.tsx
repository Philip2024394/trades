// SeoSiteHeader — the standard GlobalHeader wired for every Phase
// 2/3 SEO page. Wraps GlobalHeader in Suspense (GlobalHeader uses
// useSearchParams internally, which requires a boundary when
// rendered inside a server component) + provides the standard
// "Sign in" right-slot link.
//
// Drop this ONCE at the top of every SEO leaf/hub — it renders the
// same header users see everywhere else on the app so navigation
// stays consistent from SERP-landing all the way through the
// ecosystem.

import { Suspense } from "react";
import Link from "next/link";
import { GlobalHeader } from "@/components/shell/GlobalHeader";

export function SeoSiteHeader() {
  return (
    <Suspense fallback={<div className="h-14"/>}>
      <GlobalHeader
        variant="sticky"
        rightSlot={
          <Link
            href="/home/sign-in"
            className="inline-flex shrink-0 items-center rounded-full border border-[#1B1A17]/15 px-3 py-1.5 text-[11px] font-bold text-[#1B1A17] hover:bg-black/[0.04]"
          >
            Sign in
          </Link>
        }
      />
    </Suspense>
  );
}
