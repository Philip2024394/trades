"use client";

// useUndoRedo — headless ring-buffer undo/redo for any editor state.
//
// The hook owns:
//   · Present state (what's currently on screen)
//   · Past stack (bounded to `maxHistory`)
//   · Future stack (cleared on any non-undo/redo mutation)
//
// Consumers call `push(next)` after every meaningful mutation.
// `undo()` and `redo()` return the resulting state so callers can
// re-hydrate downstream (e.g. push it back to the server).
//
// Also binds Ctrl-Z / Cmd-Z (undo) and Ctrl-Shift-Z / Cmd-Shift-Z
// (redo) at the window level when `enableShortcuts` is true (default).
// Ignores when focus is in an <input>, <textarea>, or contenteditable
// so text-field native undo still works.

import { useCallback, useEffect, useRef, useState } from "react";

export type UndoRedoOptions = {
  /** Max past + future entries. Default 50 each. */
  maxHistory?: number;
  /** Bind Ctrl-Z / Ctrl-Shift-Z globally. Default true. */
  enableShortcuts?: boolean;
  /** Called AFTER an undo/redo settles, so consumers can propagate
   *  the resulting state (e.g. persist to draft layout). */
  onSettled?: (state: unknown, direction: "undo" | "redo") => void;
};

export function useUndoRedo<T>(initial: T, options: UndoRedoOptions = {}) {
  const maxHistory = options.maxHistory ?? 50;
  const enableShortcuts = options.enableShortcuts ?? true;

  const [present, setPresent] = useState<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  // React state mirrors of the stack sizes so canUndo/canRedo trigger
  // re-renders in consumers.
  const [pastCount, setPastCount] = useState(0);
  const [futureCount, setFutureCount] = useState(0);
  const onSettledRef = useRef(options.onSettled);
  onSettledRef.current = options.onSettled;

  const push = useCallback(
    (next: T) => {
      pastRef.current.push(present);
      if (pastRef.current.length > maxHistory) pastRef.current.shift();
      futureRef.current = [];
      setPresent(next);
      setPastCount(pastRef.current.length);
      setFutureCount(0);
    },
    [present, maxHistory]
  );

  const undo = useCallback((): T | null => {
    const past = pastRef.current;
    if (past.length === 0) return null;
    const prev = past.pop() as T;
    futureRef.current.push(present);
    if (futureRef.current.length > maxHistory) futureRef.current.shift();
    setPresent(prev);
    setPastCount(pastRef.current.length);
    setFutureCount(futureRef.current.length);
    onSettledRef.current?.(prev, "undo");
    return prev;
  }, [present, maxHistory]);

  const redo = useCallback((): T | null => {
    const future = futureRef.current;
    if (future.length === 0) return null;
    const next = future.pop() as T;
    pastRef.current.push(present);
    if (pastRef.current.length > maxHistory) pastRef.current.shift();
    setPresent(next);
    setPastCount(pastRef.current.length);
    setFutureCount(futureRef.current.length);
    onSettledRef.current?.(next, "redo");
    return next;
  }, [present, maxHistory]);

  const reset = useCallback((next: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setPresent(next);
    setPastCount(0);
    setFutureCount(0);
  }, []);

  useEffect(() => {
    if (!enableShortcuts) return;
    function onKey(e: KeyboardEvent) {
      if (isTextInputFocused()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, enableShortcuts]);

  return {
    present,
    push,
    undo,
    redo,
    reset,
    canUndo: pastCount > 0,
    canRedo: futureCount > 0,
    pastCount,
    futureCount
  };
}

function isTextInputFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}
