// Magic UI · NumberTicker
//
// Count-up animation for statistics — Framer Motion springs give a
// premium, non-jittery feel that CSS transitions can't. Runs once when
// the number enters the viewport (IntersectionObserver). Respects
// prefers-reduced-motion by jumping straight to the final value.
//
// Usage:
//   <NumberTicker value={12000} suffix="+" durationMs={1500} />
//   <NumberTicker value={4.9} decimals={1} />

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

export function NumberTicker({
  value,
  decimals = 0,
  prefix,
  suffix,
  durationMs = 1500,
  className
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  const spring = useSpring(0, {
    duration: durationMs,
    bounce: 0
  });

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, spring, value]);

  const display = useTransform(spring, (v: number) => {
    const n = reducedMotion ? value : v;
    return n.toFixed(decimals);
  });

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
