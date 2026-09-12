// NEX useLongPress · Philip 2026-09-02.
//
// Replaces the duplicated setTimeout / clearTimeout patterns previously
// copy-pasted into NexComposer (+ button, 2s hold) and NexWorkspaceFriends
// (friend card, 500ms hold). One hook, one timer-management pattern.
//
// Contract:
//   · onTap fires on pointer-up IF the long-press timer never fired
//   · onLongPress fires when the timer completes · onTap is suppressed
//   · onPointerLeave / onPointerCancel abort the timer without firing
//   · Works with both mouse + touch (uses PointerEvent API)
//   · Disabled skips both handlers
//
// Return shape:
//   { handlers } · spread onto the button/element as event props
//
// Usage:
//   const { handlers } = useLongPress({
//     onTap: () => setMode("category"),
//     onLongPress: () => setPanelOpen(true),
//     ms: 500,
//   });
//   return <button {...handlers}>...</button>;

import { useCallback, useRef } from "react";

export interface UseLongPressOpts {
  /** Fired on pointer-up when the hold timer never elapsed (i.e. a tap). */
  onTap?: () => void;
  /** Fired when the hold timer elapses · suppresses the subsequent onTap. */
  onLongPress?: () => void;
  /** How long the user must hold before onLongPress fires · default 500ms. */
  ms?: number;
  /** When true, ignore all pointer events. Timer never starts. */
  disabled?: boolean;
}

export interface UseLongPressReturn {
  handlers: {
    onPointerDown:   (e: React.PointerEvent) => void;
    onPointerUp:     (e: React.PointerEvent) => void;
    onPointerLeave:  (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useLongPress({
  onTap, onLongPress, ms = 500, disabled = false,
}: UseLongPressOpts): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const start = useCallback(() => {
    if (disabled) return;
    firedRef.current = false;
    // Only start the timer if a long-press handler is registered.
    if (!onLongPress) return;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      onLongPress();
    }, ms);
  }, [disabled, onLongPress, ms]);

  const finish = useCallback(() => {
    if (disabled) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      // Timer never fired → treat as a tap.
      if (!firedRef.current) onTap?.();
    } else if (!firedRef.current && !onLongPress) {
      // No long-press configured · every pointer-up is a tap.
      onTap?.();
    }
    // Timer already fired → long-press handled it, do nothing.
  }, [disabled, onTap, onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    handlers: {
      onPointerDown:   start,
      onPointerUp:     finish,
      onPointerLeave:  cancel,
      onPointerCancel: cancel,
    },
  };
}
