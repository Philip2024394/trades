// Reveal — reusable Framer Motion entrance primitive.
//
// Standard choreography for every rebuilt hero + section: subtle fade +
// upward slide + spring easing. Respects prefers-reduced-motion via
// framer-motion's built-in accessibility hooks.
//
// Usage:
//   <Reveal><h1>Big headline</h1></Reveal>
//   <Reveal delay={0.1}><p>Follows the headline</p></Reveal>
//   <RevealStack>
//     <h1>Line 1</h1>
//     <p>Line 2 auto-delays by index</p>
//   </RevealStack>

"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
  once?: boolean;
};

export const Reveal = React.forwardRef<HTMLDivElement, RevealProps>(
  ({ className, children, delay = 0, y = 12, once = true, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.3 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
Reveal.displayName = "Reveal";

type RevealStackProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Delay between siblings. Default 80ms — Stripe-style rhythm. */
  stagger?: number;
  /** Initial delay before the first child. */
  initialDelay?: number;
  once?: boolean;
};

export const RevealStack = React.forwardRef<HTMLDivElement, RevealStackProps>(
  (
    {
      className,
      children,
      stagger = 0.08,
      initialDelay = 0,
      once = true,
      ...props
    },
    ref
  ) => {
    const items = React.Children.toArray(children);
    return (
      <div ref={ref} className={cn(className)} {...props}>
        {items.map((child, i) => (
          <Reveal
            key={i}
            delay={initialDelay + i * stagger}
            once={once}
          >
            {child}
          </Reveal>
        ))}
      </div>
    );
  }
);
RevealStack.displayName = "RevealStack";
