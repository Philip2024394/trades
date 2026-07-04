"use client";

// useButtonState — the state machine every button renderer subscribes to.
//
// Drives: default → hover → focus_visible → pressed → active → loading
//        → success → error → visited → disabled
//
// Respects prefers-reduced-motion at the OS level. When set, motion
// presets swap to the `none` equivalent (no transforms), but state
// COLOUR / SHADOW overrides still apply — the merchant still sees
// hover/press feedback, just without movement.
//
// Consumers:
//   const { state, bindings } = useButtonState({ disabled, resolvePromise });
//   <button {...bindings} data-state={state} />
//
// The resolvePromise handle wires "loading → success/error" for async
// actions (add-to-cart, submit, book). If omitted, the button behaves
// as a plain link/button with only default → hover → pressed states.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ButtonState } from "../types";

export type UseButtonStateArgs = {
  /** Force the button into the disabled state. */
  disabled?: boolean;
  /** Optional async resolver. When the user clicks, the button jumps
   *  to `loading`; the returned promise decides `success` vs `error`.
   *  Success + error auto-revert to `default` after 2s. */
  resolvePromise?: () => Promise<void>;
  /** External trigger — for example, a form submit that lives outside
   *  the button. Merchants rarely wire this in the Studio; the runtime
   *  uses it. */
  externalState?: ButtonState;
};

export function useButtonState({
  disabled,
  resolvePromise,
  externalState
}: UseButtonStateArgs = {}) {
  const [state, setState] = useState<ButtonState>("default");
  const reducedMotion = usePrefersReducedMotion();
  const revertTimer = useRef<number | null>(null);

  useEffect(() => {
    if (externalState) setState(externalState);
  }, [externalState]);

  useEffect(() => {
    if (disabled) setState("disabled");
    else if (state === "disabled") setState("default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const clearRevert = useCallback(() => {
    if (revertTimer.current) {
      window.clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
  }, []);

  const revertLater = useCallback(
    (ms: number) => {
      clearRevert();
      revertTimer.current = window.setTimeout(() => {
        setState("default");
        revertTimer.current = null;
      }, ms);
    },
    [clearRevert]
  );

  useEffect(() => () => clearRevert(), [clearRevert]);

  const runAsync = useCallback(async () => {
    if (!resolvePromise || disabled) return;
    setState("loading");
    try {
      await resolvePromise();
      setState("success");
      revertLater(2000);
    } catch {
      setState("error");
      revertLater(1500);
    }
  }, [resolvePromise, disabled, revertLater]);

  const bindings = useMemo(
    () => ({
      onMouseEnter: () => {
        if (disabled) return;
        if (state === "default") setState("hover");
      },
      onMouseLeave: () => {
        if (disabled) return;
        if (state === "hover" || state === "pressed") setState("default");
      },
      onMouseDown: () => {
        if (disabled) return;
        setState("pressed");
      },
      onMouseUp: () => {
        if (disabled) return;
        setState("hover");
      },
      onFocus: (e: React.FocusEvent) => {
        if (disabled) return;
        // Only surface focus_visible for keyboard focus — pointer focus
        // stays visually quiet to avoid flashing a ring on click.
        if (e.target.matches(":focus-visible")) setState("focus_visible");
      },
      onBlur: () => {
        if (disabled) return;
        if (state === "focus_visible") setState("default");
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") setState("pressed");
      },
      onKeyUp: (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          setState("focus_visible");
          if (resolvePromise) void runAsync();
        }
      },
      onClick: (e: React.MouseEvent) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        if (resolvePromise) {
          e.preventDefault();
          void runAsync();
        }
      }
    }),
    [disabled, state, resolvePromise, runAsync]
  );

  return { state, reducedMotion, bindings, runAsync };
}

// ─── Reduced-motion detection ────────────────────────────────

/** Track `(prefers-reduced-motion: reduce)` — updates when the OS
 *  preference changes without a reload. Server-safe (returns false). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
