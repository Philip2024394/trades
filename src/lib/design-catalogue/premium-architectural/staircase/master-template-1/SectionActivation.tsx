// NEX Master Template 1 · Section activation infrastructure.
//
// Philip 2026-08-17 · STANDING. Every append-on-demand chapter in MT-1
// uses this hook — the presentation stays a single continuous scrolling
// experience, and activating a chapter never routes away.
//
// Contract:
//   • Activation ≠ navigation. Calling `activate("gallery")` mounts
//     ST-G01 into the same page stream and smooth-scrolls the user to
//     it. There is no route change.
//   • Once activated, a section stays mounted for the session. Users
//     can freely move between chapters without paying a re-mount /
//     re-fetch cost.
//   • The activation set is not persisted (no localStorage). A refresh
//     returns to the clean initial state. Deep links via URL hash
//     (e.g. /nex-app/design-catalogue/staircase/master-template-1#gallery)
//     ARE honoured — the provider auto-activates any hash matching one
//     of its known appendable keys on mount.
//   • Provider throws if `useSectionActivation` is called outside its
//     tree, so misuse fails loudly instead of silently no-op.
//
// Wiring a NEW appendable chapter needs three edits (no matcher changes):
//   1. Add its key to `Mt1ExperienceStream`'s appendable list.
//   2. Conditionally mount the section behind `isActive(key)`.
//   3. Add an activation trigger somewhere (chapter-end chip, nav chip,
//      hero CTA — anywhere) that calls `activate(key)`.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SectionActivationCtx = {
  /** True when a section key has been activated in this session. */
  isActive: (key: string) => boolean;
  /** Activate a section (mount if not already) and smooth-scroll to it.
   *  Idempotent — calling it repeatedly on an already-active section
   *  just re-scrolls without a re-mount. */
  activate: (key: string) => void;
};

const Ctx = createContext<SectionActivationCtx | null>(null);

export function SectionActivationProvider({
  children,
  /** Keys the provider will auto-activate on mount if they appear as
   *  the URL hash (deep-link support). Passed by the shell that knows
   *  its own section catalogue. */
  deepLinkKeys = [],
}: {
  children: ReactNode;
  deepLinkKeys?: readonly string[];
}) {
  const [activated, setActivated] = useState<Set<string>>(new Set());
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  const activate = useCallback((key: string) => {
    setActivated((prev) => {
      if (prev.has(key)) return prev; // same-reference · no re-render
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setScrollTarget(key);
  }, []);

  // Deep-link support · run once on mount. If the URL hash names a known
  // appendable section, activate it so a shared/refreshed link lands the
  // user directly on that chapter.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (!hash) return;
    if (deepLinkKeys.includes(hash)) activate(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll effect. Fires after React commits the new DOM so the target
  // element is guaranteed to exist by the time we reach for it. Runs on
  // every scrollTarget change (including re-activation of an already-
  // mounted section), then clears itself.
  useEffect(() => {
    if (!scrollTarget) return;
    if (!activated.has(scrollTarget)) return;
    const el =
      typeof document !== "undefined"
        ? document.getElementById(scrollTarget)
        : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTarget(null);
    }
  }, [activated, scrollTarget]);

  const isActive = useCallback((key: string) => activated.has(key), [activated]);

  return <Ctx.Provider value={{ isActive, activate }}>{children}</Ctx.Provider>;
}

export function useSectionActivation(): SectionActivationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useSectionActivation must be called inside <SectionActivationProvider>. Wrap the master template shell with the provider before rendering any activation trigger.",
    );
  }
  return ctx;
}
