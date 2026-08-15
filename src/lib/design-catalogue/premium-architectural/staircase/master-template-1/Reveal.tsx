// NEX Design Catalogue · Master Template 1 · Reveal wrapper
// (Philip 2026-08-14).
//
// Fades + slides children in when they scroll into view. Small subtle
// animation (16px translate · 500ms ease-out) that adds cinematic
// rhythm without feeling gimmicky. First-in-viewport sections reveal
// immediately (no jank on the initial page load).
//
// Honours prefers-reduced-motion.

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  children: React.ReactNode;
  /** Extra translateY in px · defaults to 16. */
  from?: number;
  /** Transition duration in ms · defaults to 520. */
  duration?: number;
  /** Delay before starting · defaults to 0. */
  delay?: number;
};

export function Reveal({ children, from = 16, duration = 520, delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    // If element is already above the fold at mount, reveal immediately.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setVisible(true); io.disconnect(); }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translate3d(0,0,0)" : `translate3d(0, ${from}px, 0)`,
    transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: "opacity, transform"
  };

  return <div ref={ref} style={style}>{children}</div>;
}
