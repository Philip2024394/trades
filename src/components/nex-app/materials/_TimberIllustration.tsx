// _TimberIllustration — subtle SVG timber-tone illustrations for each
// launcher card. Placeholder for real product photography that will
// replace them in a later phase. Each variant returns a rectangular
// SVG designed to fill the card's thumbnail slot.
//
// The illustrations are intentionally minimal — the card structure
// carries the design weight; the timber tone signals category without
// competing for attention.

import type { CSSProperties } from "react";

type Variant =
  | "packs"          // stacked planks
  | "board"          // single board end-grain
  | "measure"        // caliper on board
  | "stack"          // ordered stack
  | "staircase"      // stair silhouette
  | "offcuts";       // scattered offcuts

type Props = { variant: Variant; className?: string; style?: CSSProperties };

const woodA = "#E7CA9E";
const woodB = "#C99260";
const woodC = "#A9743F";
const woodDark = "#6E4522";
const woodShadow = "rgba(84, 48, 12, 0.18)";
const bgWarm = "linear-gradient(135deg, #F5EBD8 0%, #EDD7B0 100%)";

export function TimberIllustration({ variant, className, style }: Props) {
  return (
    <div
      className={className}
      style={{ background: bgWarm, position: "relative", overflow: "hidden", ...style }}
      aria-hidden
    >
      <svg width="100%" height="100%" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
        <defs>
          <linearGradient id={`plank-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={woodA} />
            <stop offset="55%" stopColor={woodB} />
            <stop offset="100%" stopColor={woodC} />
          </linearGradient>
          <linearGradient id={`plank-end-${variant}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={woodC} />
            <stop offset="100%" stopColor={woodDark} />
          </linearGradient>
        </defs>
        {renderVariant(variant)}
      </svg>
    </div>
  );

  function renderVariant(v: Variant) {
    switch (v) {
      case "packs":     return <PacksArt   fill={`url(#plank-${variant})`} end={`url(#plank-end-${variant})`} />;
      case "board":     return <BoardArt   fill={`url(#plank-${variant})`} end={`url(#plank-end-${variant})`} />;
      case "measure":   return <MeasureArt fill={`url(#plank-${variant})`} end={`url(#plank-end-${variant})`} />;
      case "stack":     return <StackArt   fill={`url(#plank-${variant})`} end={`url(#plank-end-${variant})`} />;
      case "staircase": return <StaircaseArt fill={`url(#plank-${variant})`} end={`url(#plank-end-${variant})`} />;
      case "offcuts":   return <OffcutsArt fill={`url(#plank-${variant})`} end={`url(#plank-end-${variant})`} />;
    }
  }
}

const shadowProps = { fill: woodShadow };

function PacksArt({ fill, end }: { fill: string; end: string }) {
  return (
    <g>
      <ellipse cx="100" cy="140" rx="70" ry="8" {...shadowProps} />
      {/* Three stacked planks in perspective */}
      <g transform="translate(30, 60)">
        <polygon points="0,40 130,40 145,25 15,25" fill={fill} />
        <polygon points="130,40 145,25 145,55 130,70" fill={end} />
        <polygon points="0,40 130,40 130,70 0,70" fill={fill} opacity="0.85" />
      </g>
      <g transform="translate(20, 40)">
        <polygon points="0,40 130,40 145,25 15,25" fill={fill} opacity="0.94" />
        <polygon points="130,40 145,25 145,55 130,70" fill={end} />
        <polygon points="0,40 130,40 130,70 0,70" fill={fill} opacity="0.78" />
      </g>
      <g transform="translate(40, 20)">
        <polygon points="0,40 130,40 145,25 15,25" fill={fill} />
        <polygon points="130,40 145,25 145,55 130,70" fill={end} />
        <polygon points="0,40 130,40 130,70 0,70" fill={fill} opacity="0.9" />
      </g>
    </g>
  );
}

function BoardArt({ fill, end }: { fill: string; end: string }) {
  return (
    <g>
      <ellipse cx="100" cy="140" rx="70" ry="8" {...shadowProps} />
      {/* One prominent board */}
      <g transform="translate(20, 50)">
        <polygon points="0,40 140,40 160,15 20,15" fill={fill} />
        <polygon points="140,40 160,15 160,55 140,80" fill={end} />
        <polygon points="0,40 140,40 140,80 0,80" fill={fill} opacity="0.88" />
        {/* Grain streaks */}
        <path d="M20,55 Q80,50 130,60" stroke={woodC} strokeWidth="0.5" fill="none" opacity="0.4" />
        <path d="M20,65 Q80,62 130,70" stroke={woodC} strokeWidth="0.5" fill="none" opacity="0.35" />
      </g>
    </g>
  );
}

function MeasureArt({ fill, end }: { fill: string; end: string }) {
  return (
    <g>
      <ellipse cx="100" cy="140" rx="70" ry="8" {...shadowProps} />
      {/* Board */}
      <g transform="translate(15, 65)">
        <polygon points="0,25 150,25 170,10 20,10" fill={fill} />
        <polygon points="150,25 170,10 170,40 150,55" fill={end} />
        <polygon points="0,25 150,25 150,55 0,55" fill={fill} opacity="0.88" />
      </g>
      {/* Caliper — simplified */}
      <g transform="translate(50, 45)">
        <rect x="0" y="0" width="60" height="6" rx="1" fill="#4A4E56" />
        <rect x="0" y="0" width="4" height="30" rx="1" fill="#4A4E56" />
        <rect x="40" y="0" width="4" height="30" rx="1" fill="#4A4E56" />
        {/* Digital screen */}
        <rect x="55" y="-14" width="30" height="14" rx="2" fill="#1F2126" />
        <text x="70" y="-3" fontSize="7" fontFamily="monospace" fill="#F5C33B" textAnchor="middle" fontWeight="700">32.50</text>
      </g>
    </g>
  );
}

function StackArt({ fill, end }: { fill: string; end: string }) {
  return (
    <g>
      <ellipse cx="100" cy="140" rx="70" ry="8" {...shadowProps} />
      {/* Ordered stack of short boards */}
      {[0, 1, 2, 3].map(i => (
        <g key={i} transform={`translate(${40 + i * 4}, ${30 + i * 22})`}>
          <polygon points="0,25 110,25 122,15 12,15" fill={fill} opacity={0.9 - i * 0.08} />
          <polygon points="110,25 122,15 122,35 110,45" fill={end} />
          <polygon points="0,25 110,25 110,45 0,45" fill={fill} opacity={0.8 - i * 0.07} />
        </g>
      ))}
    </g>
  );
}

function StaircaseArt({ fill, end }: { fill: string; end: string }) {
  return (
    <g>
      <ellipse cx="100" cy="140" rx="70" ry="8" {...shadowProps} />
      {/* Simple staircase silhouette in wood tones */}
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i} transform={`translate(${25 + i * 25}, ${115 - i * 18})`}>
          <rect x="0" y="0" width="35" height="18" fill={fill} />
          <polygon points="35,0 45,-6 45,12 35,18" fill={end} />
          <rect x="0" y="0" width="35" height="4" fill={woodA} opacity="0.7" />
        </g>
      ))}
    </g>
  );
}

function OffcutsArt({ fill, end }: { fill: string; end: string }) {
  return (
    <g>
      <ellipse cx="100" cy="140" rx="70" ry="8" {...shadowProps} />
      {/* Scattered small offcut pieces */}
      <g transform="translate(30, 70) rotate(-8)">
        <rect x="0" y="0" width="60" height="20" fill={fill} />
        <polygon points="60,0 70,-8 70,12 60,20" fill={end} />
      </g>
      <g transform="translate(45, 95) rotate(6)">
        <rect x="0" y="0" width="80" height="18" fill={fill} opacity="0.94" />
        <polygon points="80,0 90,-8 90,10 80,18" fill={end} />
      </g>
      <g transform="translate(80, 55) rotate(-14)">
        <rect x="0" y="0" width="40" height="14" fill={fill} opacity="0.92" />
        <polygon points="40,0 48,-6 48,8 40,14" fill={end} />
      </g>
      <g transform="translate(110, 85) rotate(4)">
        <rect x="0" y="0" width="50" height="16" fill={fill} />
        <polygon points="50,0 58,-6 58,10 50,16" fill={end} />
      </g>
    </g>
  );
}
