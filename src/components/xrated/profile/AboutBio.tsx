"use client";

// Xrated Trades — premium-tier About bio with line-clamp + "Read more".
// Client component because we own the expanded/collapsed state. We use
// Tailwind's `line-clamp-5` for the collapsed form. The toggle only renders
// if the rendered text would actually overflow — we detect this in an
// effect by comparing scrollHeight to clientHeight on the clamped node.

import { useEffect, useRef, useState } from "react";

export function AboutBio({
  text,
  themeColor
}: {
  text: string;
  themeColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Measure only in the COLLAPSED state. If the content overflows the
    // clamp, expose the toggle.
    if (!expanded) {
      setClamped(node.scrollHeight - node.clientHeight > 1);
    }
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={ref}
        className={`whitespace-pre-wrap text-[13px] leading-relaxed text-brand-text ${
          expanded ? "" : "line-clamp-5"
        }`}
      >
        {text}
      </p>
      {clamped && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[13px] font-semibold underline-offset-4 hover:underline"
          style={{ color: themeColor }}
          aria-expanded={expanded}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
