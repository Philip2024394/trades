// useDragReorder — the core drag hook powering section reorder.
//
// Pointer events (unified touch + mouse). On pointer-down over a
// drag handle we capture the section id and start tracking the
// pointer. On move, we broadcast the current x/y so drop targets
// can highlight. On pointer-up over a target we fire onDrop.
//
// Design choices:
//  - Pure pointer events (no HTML5 dragstart) — works identically on
//    touch, doesn't have Safari drag quirks, and doesn't need a
//    custom drag image.
//  - The drag ghost is a lightweight overlay rendered by PageBuilder;
//    this hook doesn't touch the DOM ghost, it just publishes state.
//  - Long-press start (250ms) on touch so a normal tap on a section
//    doesn't accidentally start a drag.
//  - Drop targets register themselves via a ref-based registry and
//    the hook calculates which target is under the pointer using
//    getBoundingClientRect. That way targets don't need pointer
//    listeners — one handler covers the whole page.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DropTargetHitTest = {
  /** Client-space rect of the target. */
  rect: DOMRect;
  /** Payload returned to onDrop when this target wins. */
  payload: DropTargetPayload;
};

export type DropTargetPayload = {
  slotId: string;
};

export type DragState = {
  isDragging: boolean;
  sectionId: string | null;
  pointerX: number;
  pointerY: number;
  activeSlotId: string | null;
};

export type UseDragReorderOptions = {
  /** Called once the drag settles on a target. */
  onDrop: (sectionId: string, slotId: string) => void;
  /** Optional long-press threshold in ms for touch. Mouse starts
   *  immediately. Default 250. */
  longPressMs?: number;
};

type PointerStart = {
  sectionId: string;
  clientX: number;
  clientY: number;
  isTouch: boolean;
  startedAt: number;
};

const MOVE_THRESHOLD_PX = 6;

export function useDragReorder({
  onDrop,
  longPressMs = 250
}: UseDragReorderOptions) {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    sectionId: null,
    pointerX: 0,
    pointerY: 0,
    activeSlotId: null
  });

  const startRef = useRef<PointerStart | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const targetsRef = useRef<Map<string, DropTargetHitTest>>(new Map());
  const isDraggingRef = useRef(false);

  /** Called by drop targets to register/unregister their bounds. */
  const registerDropTarget = useCallback(
    (slotId: string, hit: DropTargetHitTest | null) => {
      if (hit === null) {
        targetsRef.current.delete(slotId);
      } else {
        targetsRef.current.set(slotId, hit);
      }
    },
    []
  );

  const hitTest = useCallback(
    (x: number, y: number): string | null => {
      for (const [slotId, target] of targetsRef.current.entries()) {
        const r = target.rect;
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return slotId;
        }
      }
      return null;
    },
    []
  );

  const stopDrag = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startRef.current = null;
    isDraggingRef.current = false;
    setState({
      isDragging: false,
      sectionId: null,
      pointerX: 0,
      pointerY: 0,
      activeSlotId: null
    });
  }, []);

  const beginDrag = useCallback(
    (sectionId: string, x: number, y: number) => {
      isDraggingRef.current = true;
      // Refresh all target rects at drag start (positions may have
      // shifted since last registration).
      targetsRef.current.forEach((hit, slotId) => {
        const el = document.querySelector<HTMLElement>(
          `[data-slot-drop="${slotId}"]`
        );
        if (el) {
          targetsRef.current.set(slotId, {
            rect: el.getBoundingClientRect(),
            payload: hit.payload
          });
        }
      });
      setState({
        isDragging: true,
        sectionId,
        pointerX: x,
        pointerY: y,
        activeSlotId: hitTest(x, y)
      });
    },
    [hitTest]
  );

  /** Attach a drag start handler to a drag-handle element. Returns
   *  the onPointerDown callback. */
  const dragHandleProps = useCallback(
    (sectionId: string) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        // Ignore right-clicks and secondary buttons.
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        const isTouch = e.pointerType === "touch";
        startRef.current = {
          sectionId,
          clientX: e.clientX,
          clientY: e.clientY,
          isTouch,
          startedAt: Date.now()
        };
        // Mouse starts immediately; touch waits for long-press.
        if (!isTouch) {
          beginDrag(sectionId, e.clientX, e.clientY);
        } else {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
          }
          longPressTimerRef.current = setTimeout(() => {
            const s = startRef.current;
            if (s) {
              beginDrag(s.sectionId, s.clientX, s.clientY);
            }
          }, longPressMs);
        }
        // Try to capture the pointer so we keep receiving events
        // even if the pointer leaves the handle.
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // ignore — some environments don't support capture
        }
      }
    }),
    [beginDrag, longPressMs]
  );

  /** Global pointer move + up — attached to window in edit mode. */
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const start = startRef.current;
      if (!start) return;

      // If we haven't crossed the drag threshold yet and we're on
      // touch mid-long-press, cancel the pending drag.
      if (!isDraggingRef.current) {
        const dx = Math.abs(e.clientX - start.clientX);
        const dy = Math.abs(e.clientY - start.clientY);
        if (start.isTouch && (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX)) {
          // Pointer moved before long-press timer fired — cancel it.
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          startRef.current = null;
        }
        return;
      }

      const slot = hitTest(e.clientX, e.clientY);
      setState((prev) => ({
        ...prev,
        pointerX: e.clientX,
        pointerY: e.clientY,
        activeSlotId: slot
      }));
      // Prevent scroll while dragging on touch.
      if (e.pointerType === "touch") {
        e.preventDefault();
      }
    }

    function onUp(e: PointerEvent) {
      const start = startRef.current;
      if (!start) return;
      if (isDraggingRef.current) {
        const slot = hitTest(e.clientX, e.clientY);
        if (slot) {
          onDrop(start.sectionId, slot);
        }
      }
      stopDrag();
    }

    function onCancel() {
      stopDrag();
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [hitTest, onDrop, stopDrag]);

  return {
    dragState: state,
    dragHandleProps,
    registerDropTarget,
    cancelDrag: stopDrag
  };
}
