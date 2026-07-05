// Prose — typography wrapper for long-form content (article body,
// terms pages, help articles).
//
// Applies consistent spacing + hierarchy to raw HTML-shaped children.
// If you have an <h2>, <p>, <ul>, <ol>, <a>, <code>, <blockquote>,
// this wrapper styles them all.

import type { ReactNode } from "react";

export type ProseSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<ProseSize, string> = {
  sm: "text-[13px] leading-relaxed",
  md: "text-[14px] leading-relaxed md:text-[15px]",
  lg: "text-[15px] leading-relaxed md:text-[17px]"
};

export type ProseProps = {
  size?: ProseSize;
  children: ReactNode;
  className?: string;
};

export function Prose({
  size = "md",
  children,
  className = ""
}: ProseProps) {
  return (
    <div
      className={`text-neutral-800 ${SIZE_CLASS[size]}
        [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900
        [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:text-neutral-900
        [&_p]:mb-4
        [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
        [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
        [&_a]:text-neutral-900 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-amber-700
        [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]
        [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-neutral-700
        [&_hr]:my-8 [&_hr]:border-neutral-200
        ${className}`.trim()}
    >
      {children}
    </div>
  );
}
