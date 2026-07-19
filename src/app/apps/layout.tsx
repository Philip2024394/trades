// /apps layout — wraps every App Warehouse page with the shared
// GlobalHeader strip so viewers can jump to Yard / Canteen / Site
// Interest / Trade Center / Apps from any app page.

import Link from "next/link";
import { GlobalHeader } from "@/components/shell/GlobalHeader";

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalHeader
        rightSlot={
          <Link
            href="/home/sign-in"
            className="inline-flex shrink-0 items-center rounded-full border border-[#1B1A17]/15 px-3 py-1.5 text-[11px] font-bold text-[#1B1A17] hover:bg-black/[0.04]"
          >
            Sign in
          </Link>
        }
      />
      {children}
    </>
  );
}
