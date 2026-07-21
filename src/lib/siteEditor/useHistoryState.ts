// useHistoryState — drop-in replacement for useState that tracks a
// history stack (past / present / future) so the editor can undo /
// redo state changes with Ctrl+Z / Ctrl+Y.
//
// Design notes:
//   • push() records the current state into `past` before applying the
//     new one. Callers can pass { skipHistory: true } to bypass, which
//     is useful for continuous drags (record only the final drop, not
//     every mouse-move).
//   • Cap at MAX_HISTORY (50) so long sessions don't leak memory.
//   • Redo stack cleared on any fresh push — matches every mainstream
//     editor's behaviour.
//   • Equality check via JSON.stringify — cheap enough for editor
//     state (< 10KB typical), skips no-op pushes.

"use client";

import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 50;

export type SetHistoryStateAction<T> = T | ((prev: T) => T);

export function useHistoryState<T>(initial: T): {
  state:    T;
  setState: (action: SetHistoryStateAction<T>, opts?: { skipHistory?: boolean }) => void;
  undo:     () => boolean;    // returns true if it undid, false if nothing to undo
  redo:     () => boolean;
  canUndo:  boolean;
  canRedo:  boolean;
  reset:    (next: T) => void;
} {
  const [state, setStateRaw] = useState<T>(initial);
  const pastRef   = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  // Force re-render for canUndo/canRedo when stacks change.
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  const setState = useCallback((action: SetHistoryStateAction<T>, opts?: { skipHistory?: boolean }) => {
    setStateRaw((prev) => {
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      // No-op skip — cheap equality via JSON string compare.
      let same = false;
      try { same = JSON.stringify(prev) === JSON.stringify(next); } catch { /* ignore */ }
      if (same) return prev;
      if (!opts?.skipHistory) {
        pastRef.current = [...pastRef.current, prev].slice(-MAX_HISTORY);
        futureRef.current = [];
        rerender();
      }
      return next;
    });
  }, [rerender]);

  const undo = useCallback((): boolean => {
    if (pastRef.current.length === 0) return false;
    const prev = pastRef.current[pastRef.current.length - 1];
    setStateRaw((cur) => {
      futureRef.current = [cur, ...futureRef.current].slice(0, MAX_HISTORY);
      return prev;
    });
    pastRef.current = pastRef.current.slice(0, -1);
    rerender();
    return true;
  }, [rerender]);

  const redo = useCallback((): boolean => {
    if (futureRef.current.length === 0) return false;
    const next = futureRef.current[0];
    setStateRaw((cur) => {
      pastRef.current = [...pastRef.current, cur].slice(-MAX_HISTORY);
      return next;
    });
    futureRef.current = futureRef.current.slice(1);
    rerender();
    return true;
  }, [rerender]);

  const reset = useCallback((next: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setStateRaw(next);
    rerender();
  }, [rerender]);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    reset
  };
}
