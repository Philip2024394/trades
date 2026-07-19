"use client";

// Guide tour — driver.js wrapper. Given an array of GuideStep, launches
// a spotlight tour on the live page elements. Loads driver.js lazily so
// non-tour users don't pay the ~5kb bundle cost. Adds a brand-aligned
// theme override so the popover matches SiteBook's yellow accents.

import { useCallback, useRef } from "react";
import type { GuideStep } from "@/lib/homeowners/howItWorks";

type DriverInstance = {
  drive: () => void;
  destroy: () => void;
};

export function useGuideTour() {
  const driverRef = useRef<DriverInstance | null>(null);

  const runTour = useCallback(async (steps: GuideStep[]) => {
    if (steps.length === 0) return;
    // Dynamic import — keeps the initial bundle small.
    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css")
    ]);

    // Destroy any prior tour before starting a new one
    driverRef.current?.destroy?.();

    const inst = driver({
      showProgress:      true,
      progressText:      "{{current}} of {{total}}",
      nextBtnText:       "Next →",
      prevBtnText:       "← Back",
      doneBtnText:       "Done",
      allowClose:        true,
      overlayOpacity:    0.55,
      overlayColor:      "#0A0A0A",
      stagePadding:      6,
      stageRadius:       10,
      popoverClass:      "tn-guide-popover",
      steps: steps.map((s) => ({
        element: s.element,
        popover: {
          title:      s.title,
          description: s.body,
          side:       s.side  ?? "bottom",
          align:      s.align ?? "start"
        }
      }))
    });

    driverRef.current = inst;
    inst.drive();
  }, []);

  const stopTour = useCallback(() => {
    driverRef.current?.destroy?.();
    driverRef.current = null;
  }, []);

  return { runTour, stopTour };
}
