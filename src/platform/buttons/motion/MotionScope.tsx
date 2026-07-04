"use client";

// MotionScope — a tiny wrapper every button renderer can use to inject
// its keyframes once and apply the current animation shorthand. Kept as
// a component (not a hook-only helper) so the <style> tag lives beside
// the animated element in the DOM — dedupes cleanly if two identical
// buttons render on the same page.

import { useMotionCss } from "./useMotionCss";
import type { ButtonState, MotionSpec } from "../types";

export function MotionScope({
  motion,
  state,
  children
}: {
  motion: MotionSpec;
  state: ButtonState;
  children: (args: { animation: string }) => React.ReactNode;
}) {
  const { animation, styleTag } = useMotionCss({ motion, state });
  return (
    <>
      {styleTag && <style dangerouslySetInnerHTML={{ __html: styleTag }} />}
      {children({ animation })}
    </>
  );
}
