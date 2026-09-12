// NEX TouchButton primitive · Philip 2026-09-02.
//
// Universal touch-first button for the NEX shell. Every interactive
// control inside /nexapp should use this instead of raw <button> +
// onMouseEnter/Leave patterns. Guarantees:
//
//   · Immediate press-in scale feedback (no hover dependency)
//   · Correct release animation timing
//   · Optional long-press handler (uses shared useLongPress hook)
//   · ≥44px effective hit target via invisible padding when needed
//   · Works with mouse AND touch (uses PointerEvent API only)
//   · Ref forwarded so guidance-target integration keeps working
//
// Consumers keep full control over VISUAL styling via the `style` prop.
// TouchButton only injects `transform` (for press-scale) + `transition`
// values into the style object at runtime · never overrides bg/border/
// color/padding etc. If the consumer passes their own transform, we
// compose (multiply the scales) so their transform intent is preserved.
//
// Import:
//   import { TouchButton } from "@/components/nexapp/primitives/TouchButton";

"use client";

import React, { forwardRef, useMemo, type CSSProperties } from "react";
import { useLongPress } from "@/lib/nex-ui/useLongPress";
import { usePressFeedback } from "@/lib/nex-ui/usePressFeedback";
import {
  NEX_SCALE,
  NEX_TRANSITION_PRESS,
  NEX_TRANSITION_RELEASE,
  NEX_TOUCH_TARGET_MIN,
} from "@/lib/nex-ui/touch-system";

export interface TouchButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Fired on a normal tap (pointer-up without a long-press). */
  onTap?: () => void;
  /** Fired when the user holds `holdMs` without releasing. onTap is
   *  suppressed on the same press if this fires. */
  onLongPress?: () => void;
  /** How long the hold must be for onLongPress · default 500ms. */
  holdMs?: number;
  /** Scale value when pressed · default NEX_SCALE.press (0.96). */
  pressScale?: number;
  /** When true, ignore all interactions and skip press feedback. */
  disabled?: boolean;
  /** When true, enforce a ≥44px effective hit target via padding. Use
   *  when the visual button size is small (chips, icon buttons). The
   *  extra padding is transparent · doesn't affect the visual bounds. */
  enforceMinTouchTarget?: boolean;
}

export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  function TouchButton(
    {
      onTap,
      onLongPress,
      holdMs = 500,
      pressScale = NEX_SCALE.press,
      disabled = false,
      enforceMinTouchTarget = false,
      style,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    // If a long-press handler is set, useLongPress owns the tap/hold
    // decision. Otherwise fall back to pure press feedback where every
    // pointer-up is a tap.
    const long = useLongPress({ onTap, onLongPress, ms: holdMs, disabled });
    const press = usePressFeedback({ disabled });

    // Merge our transform (scale) with any transform the consumer already
    // supplied · we prepend our scale so their transform still applies.
    const composedStyle = useMemo<CSSProperties>(() => {
      const consumerTransform = style?.transform;
      const pressTransform = press.pressing ? `scale(${pressScale})` : "";
      // Prepend our press transform so consumer transforms (translate,
      // rotate) still compose. CSS applies transforms left-to-right.
      const combinedTransform = [pressTransform, consumerTransform]
        .filter(Boolean)
        .join(" ") || undefined;
      const transition = press.pressing
        ? NEX_TRANSITION_PRESS
        : NEX_TRANSITION_RELEASE;
      // If consumer had a transition, we replace ONLY when we're driving
      // press feedback · at rest, respect their transition.
      const finalTransition = press.pressing
        ? transition
        : (style?.transition ?? transition);
      const minPadding = enforceMinTouchTarget ? NEX_TOUCH_TARGET_MIN : undefined;
      const finalMinWidth  = minPadding && (style?.minWidth  == null) ? minPadding : style?.minWidth;
      const finalMinHeight = minPadding && (style?.minHeight == null) ? minPadding : style?.minHeight;
      return {
        ...style,
        transform: combinedTransform,
        transition: finalTransition,
        minWidth:  finalMinWidth,
        minHeight: finalMinHeight,
      };
    }, [style, press.pressing, pressScale, enforceMinTouchTarget]);

    // Combine the two hooks' pointer handlers · long-press handlers own
    // onPointerDown/Up (they need to control tap firing), while press
    // feedback needs its own onPointerDown/Up/Leave/Cancel to toggle the
    // pressing state. We chain them.
    const chained = {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        long.handlers.onPointerDown(e);
        press.handlers.onPointerDown(e);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        long.handlers.onPointerUp(e);
        press.handlers.onPointerUp(e);
      },
      onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
        long.handlers.onPointerLeave(e);
        press.handlers.onPointerLeave(e);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
        long.handlers.onPointerCancel(e);
        press.handlers.onPointerCancel(e);
      },
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        style={composedStyle}
        {...chained}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
