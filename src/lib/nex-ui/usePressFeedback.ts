// NEX usePressFeedback · Philip 2026-09-02.
//
// Tracks the boolean "is-user-pressing-this-element" state via pointer
// events. Consumer applies visual response (typically transform:scale)
// based on the returned `pressing` value. Complements useLongPress but
// is standalone — you can use one without the other.
//
// Contract:
//   · pressing=true from onPointerDown until onPointerUp/Leave/Cancel
//   · No hover dependency · works on touch AND mouse
//   · Disabled forces pressing=false and blocks state changes
//
// Return shape:
//   { pressing, handlers } · spread handlers onto the element
//
// Usage:
//   const { pressing, handlers } = usePressFeedback();
//   return (
//     <button {...handlers} style={{
//       transform: pressing ? "scale(0.96)" : "scale(1)",
//       transition: pressing ? NEX_TRANSITION_PRESS : NEX_TRANSITION_RELEASE,
//     }}>...</button>
//   );

import { useCallback, useState } from "react";

export interface UsePressFeedbackOpts {
  disabled?: boolean;
}

export interface UsePressFeedbackReturn {
  pressing: boolean;
  handlers: {
    onPointerDown:   (e: React.PointerEvent) => void;
    onPointerUp:     (e: React.PointerEvent) => void;
    onPointerLeave:  (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function usePressFeedback({ disabled = false }: UsePressFeedbackOpts = {}): UsePressFeedbackReturn {
  const [pressing, setPressing] = useState(false);

  const down = useCallback(() => {
    if (disabled) return;
    setPressing(true);
  }, [disabled]);
  const up = useCallback(() => {
    setPressing(false);
  }, []);

  return {
    pressing,
    handlers: {
      onPointerDown:   down,
      onPointerUp:     up,
      onPointerLeave:  up,
      onPointerCancel: up,
    },
  };
}
