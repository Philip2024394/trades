// statistics.band_1 — 4-cell trust metrics band.
//
// The numbers-talk-louder-than-words section. Merchant fills in years
// in business, jobs completed, star rating, coverage — whatever proves
// scale. Best just above testimonials or the CTA. Dark surface by
// default makes the numbers pop, but every colour is token-bound so
// Colour tool can flip it to light in one click.

"use client";

import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
import { NumberTicker } from "@/components/magicui/number-ticker";

type Slot = 1 | 2 | 3 | 4;

/** Parse a stat string like "12,000+" or "4.9★" or "28" into a numeric
 *  value + non-numeric prefix/suffix so the NumberTicker can count up
 *  the numeric part while preserving the merchant's original garnish. */
function parseStatValue(raw: string): {
  numeric: number | null;
  prefix: string;
  suffix: string;
  decimals: number;
} {
  if (typeof raw !== "string" || raw.length === 0) {
    return { numeric: null, prefix: "", suffix: "", decimals: 0 };
  }
  // Match "<prefix><number><suffix>" where number can be "12,000" or "4.9".
  const m = raw.match(/^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return { numeric: null, prefix: "", suffix: "", decimals: 0 };
  const numericStr = m[2].replace(/,/g, "");
  const decimals = numericStr.includes(".") ? numericStr.split(".")[1].length : 0;
  const numeric = Number(numericStr);
  if (!Number.isFinite(numeric)) {
    return { numeric: null, prefix: "", suffix: "", decimals: 0 };
  }
  return { numeric, prefix: m[1] ?? "", suffix: m[3] ?? "", decimals };
}

type Config = {
  eyebrow: string;
  heading: string;
  s1Value: string; s1Label: string;
  s2Value: string; s2Label: string;
  s3Value: string; s3Label: string;
  s4Value: string; s4Label: string;
  darkSurface: boolean;
};

export function StatisticsBand({
  instanceId,
  config,
  tokens
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;

  const darkMode = config.darkSurface;
  const bg = darkMode ? "#0A0A0A" : surface;
  const fg = darkMode ? "#FFFFFF" : text;
  const subFg = darkMode ? "rgba(255,255,255,0.60)" : muted;

  type Stat = { i: Slot; value: string; label: string };
  const slots: Stat[] = [
    { i: 1, value: config.s1Value, label: config.s1Label },
    { i: 2, value: config.s2Value, label: config.s2Label },
    { i: 3, value: config.s3Value, label: config.s3Label },
    { i: 4, value: config.s4Value, label: config.s4Label }
  ];
  const stats = slots.filter((s) => s.value);

  return (
    <section
      className="w-full"
      style={{ background: bg, color: fg }}
      {...sectionRootAttrs(instanceId, "statistics.band_1", "Statistics")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {(config.eyebrow || config.heading) && (
          <div className="text-center">
            {config.eyebrow && (
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: accent }}
                {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
              >
                {config.eyebrow}
              </p>
            )}
            {config.heading && (
              <h2
                className="mt-2 text-3xl leading-tight sm:text-4xl"
                style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
                {...treeAttrs(instanceId, "heading", "Main headline", "text")}
              >
                {config.heading}
              </h2>
            )}
          </div>
        )}

        <ul
          className={`grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8 ${
            config.eyebrow || config.heading ? "mt-10" : ""
          }`}
        >
          {stats.map((s) => {
            const parsed = parseStatValue(s.value);
            return (
            <li key={s.i} className="text-center">
              <p
                className="text-4xl leading-none sm:text-5xl"
                style={{
                  fontFamily: headingFont,
                  fontWeight: headingWeight ?? 900,
                  color: accent
                }}
                {...treeAttrs(instanceId, `s${s.i}Value`, `Stat ${s.i} value`, "text")}
              >
                {parsed.numeric !== null ? (
                  <NumberTicker
                    value={parsed.numeric}
                    decimals={parsed.decimals}
                    prefix={parsed.prefix}
                    suffix={parsed.suffix}
                  />
                ) : (
                  s.value
                )}
              </p>
              <p
                className="mt-2 text-[12px] font-bold uppercase tracking-widest"
                style={{
                  color: subFg,
                  fontFamily: bodyFont,
                  fontWeight: bodyWeight ?? 600
                }}
                {...treeAttrs(instanceId, `s${s.i}Label`, `Stat ${s.i} label`, "text")}
              >
                {s.label}
              </p>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

