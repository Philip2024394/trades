"use client";

// HowItWorksSlot — thin client wrapper around HowItWorksGuide that
// handles the URL-based close (navigate back to the page without the
// ?guide param). Sits inside the center column of the mock/live page
// when guide mode is active.

import { useRouter, usePathname } from "next/navigation";
import { HowItWorksGuide } from "./HowItWorksGuide";

export function HowItWorksSlot({ focusId }: { focusId?: string | null }) {
  const router   = useRouter();
  const pathname = usePathname();

  function handleClose() {
    router.replace(pathname);
  }

  return <HowItWorksGuide onClose={handleClose} focusId={focusId ?? null}/>;
}
