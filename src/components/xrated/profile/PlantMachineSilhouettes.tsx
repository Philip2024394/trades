// PlantMachineSilhouettes — category-specific SVG shapes rendered
// inside the MachineSizeModal. Every silhouette shares the same
// brand palette (yellow #FFB300 fill, deep black #0A0A0A outline)
// and the same 320×180 canvas, so the modal feels uniform across
// all 31 machines even though the shapes differ.
//
// The container decides scale: everything is drawn on a normalised
// 320×180 viewBox with a small padding.

import type { PlantCategorySlug } from "@/lib/plantHire";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const STROKE = 3;

type SilhouetteProps = {
  slug: PlantCategorySlug;
  className?: string;
};

/** Master switch — picks the right shape per category slug. */
export function PlantMachineSilhouette({ slug, className }: SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 320 180"
      className={className}
      role="img"
      aria-label={`${slug} silhouette`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {SHAPES[slug]?.() ?? DefaultBox()}
    </svg>
  );
}

// ─── Shape library ────────────────────────────────────────────────
// Each function returns the inner SVG children (paths, rects, etc.).
// Coordinate system: 0..320 x, 0..180 y. Ground line at y = 150.

const GROUND_Y = 150;

function ground() {
  return (
    <line
      x1="10"
      y1={GROUND_Y}
      x2="310"
      y2={GROUND_Y}
      stroke={BLACK}
      strokeWidth={STROKE}
      strokeLinecap="round"
    />
  );
}

function track(x: number, w: number, h = 18) {
  return (
    <>
      <rect
        x={x}
        y={GROUND_Y - h}
        width={w}
        height={h}
        rx={h / 2}
        fill={BLACK}
      />
      <ellipse cx={x + h / 2 + 3} cy={GROUND_Y - h / 2} rx="4" ry="4" fill={YELLOW} />
      <ellipse cx={x + w - h / 2 - 3} cy={GROUND_Y - h / 2} rx="4" ry="4" fill={YELLOW} />
    </>
  );
}

function wheels(cx: number[], radius = 12) {
  return (
    <>
      {cx.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={GROUND_Y - radius} r={radius} fill={BLACK} />
          <circle cx={x} cy={GROUND_Y - radius} r={radius / 2.2} fill={YELLOW} />
        </g>
      ))}
    </>
  );
}

// ─── Machine bodies ───────────────────────────────────────────────

function excavatorBody(scale = 1) {
  // Cab + tracks + boom
  const tx = 50;
  const tw = 140 * scale;
  return (
    <g>
      {/* Boom */}
      <path
        d={`M ${tx + tw * 0.65} 90 L ${tx + tw * 0.35} 55 L ${tx + tw * 0.9} 45 L ${tx + tw * 1.05} 100 L ${tx + tw * 0.9} 105 Z`}
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Bucket */}
      <path
        d={`M ${tx + tw * 1.02} 100 L ${tx + tw * 1.18} 108 L ${tx + tw * 1.14} 128 L ${tx + tw * 0.96} 120 Z`}
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Cab body */}
      <path
        d={`M ${tx + tw * 0.05} 130 L ${tx + tw * 0.05} 95 L ${tx + tw * 0.2} 70 L ${tx + tw * 0.5} 70 L ${tx + tw * 0.7} 95 L ${tx + tw * 0.7} 130 Z`}
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Window */}
      <rect x={tx + tw * 0.2} y="78" width={tw * 0.22} height="18" rx="2" fill={BLACK} />
      {/* Tracks */}
      {track(tx, tw)}
    </g>
  );
}

function backhoeLoader() {
  // Front loader bucket + tractor cab + rear digger arm
  return (
    <g>
      {/* Rear arm */}
      <path
        d="M 220 118 L 260 60 L 285 65 L 292 118 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M 285 60 L 300 55 L 305 78 L 292 85 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Tractor body */}
      <path
        d="M 90 132 L 90 90 L 110 68 L 175 68 L 210 90 L 220 132 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="115" y="78" width="45" height="18" rx="2" fill={BLACK} />
      {/* Front bucket */}
      <path
        d="M 30 130 L 45 120 L 90 100 L 90 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {wheels([70, 140, 210, 260], 14)}
      {wheels([100, 175], 22)}
    </g>
  );
}

function dumper(swivel = false) {
  return (
    <g>
      {/* Body / bin */}
      <path
        d={
          swivel
            ? "M 70 130 L 60 95 L 90 78 L 205 78 L 235 108 L 240 130 Z"
            : "M 70 130 L 70 95 L 100 80 L 210 80 L 230 105 L 235 130 Z"
        }
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Driver seat */}
      <rect x="188" y="60" width="22" height="20" rx="2" fill={BLACK} />
      {wheels([100, 165, 220], 18)}
    </g>
  );
}

function trackedDumper() {
  return (
    <g>
      {/* Bin */}
      <path
        d="M 60 128 L 65 95 L 100 78 L 200 78 L 235 100 L 240 128 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {track(55, 195, 20)}
    </g>
  );
}

function articulatedDumper() {
  return (
    <g>
      {/* Cab */}
      <path
        d="M 40 132 L 40 90 L 60 68 L 100 68 L 118 90 L 118 132 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="55" y="78" width="35" height="18" rx="2" fill={BLACK} />
      {/* Bin */}
      <path
        d="M 118 132 L 125 85 L 275 78 L 295 132 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Hinge */}
      <line x1="118" y1="115" x2="128" y2="115" stroke={BLACK} strokeWidth={STROKE} />
      {wheels([70, 160, 230, 275], 15)}
    </g>
  );
}

function telehandler() {
  return (
    <g>
      {/* Body */}
      <path
        d="M 50 130 L 50 95 L 70 70 L 130 70 L 145 95 L 145 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="65" y="80" width="45" height="18" rx="2" fill={BLACK} />
      {/* Telescopic boom */}
      <path
        d="M 130 95 L 260 55 L 285 62 L 290 78 L 155 118 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Forks */}
      <path
        d="M 290 65 L 305 65 L 305 105 L 300 105 L 300 78 L 295 78 L 295 105 L 290 105 Z"
        fill={BLACK}
      />
      {wheels([80, 155], 20)}
    </g>
  );
}

function forklift() {
  return (
    <g>
      {/* Body */}
      <path
        d="M 90 132 L 90 100 L 110 80 L 155 80 L 175 100 L 175 132 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Overhead guard */}
      <path
        d="M 108 40 L 108 82 M 168 40 L 168 82 M 108 40 L 168 40"
        stroke={BLACK}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
      />
      {/* Mast */}
      <rect x="180" y="35" width="8" height="105" fill={BLACK} />
      <rect x="192" y="35" width="8" height="105" fill={BLACK} />
      {/* Forks */}
      <path d="M 195 130 L 240 130 L 240 138 L 200 138 Z" fill={BLACK} />
      <path d="M 195 122 L 240 122" stroke={BLACK} strokeWidth={STROKE} fill="none" />
      {wheels([110, 165], 15)}
    </g>
  );
}

function wheelLoader() {
  return (
    <g>
      {/* Body */}
      <path
        d="M 90 130 L 90 90 L 115 70 L 165 70 L 180 90 L 195 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="115" y="80" width="45" height="18" rx="2" fill={BLACK} />
      {/* Arms + bucket */}
      <path
        d="M 195 115 L 245 110 L 260 130 L 200 132 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M 245 105 L 275 105 L 280 138 L 250 138 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {wheels([110, 175], 20)}
    </g>
  );
}

function bulldozer() {
  return (
    <g>
      {/* Cab */}
      <path
        d="M 90 130 L 90 90 L 110 70 L 190 70 L 210 90 L 210 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="115" y="80" width="55" height="18" rx="2" fill={BLACK} />
      {/* Blade */}
      <path
        d="M 40 100 L 60 90 L 90 90 L 90 138 L 45 138 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {track(80, 150, 22)}
    </g>
  );
}

function grader() {
  return (
    <g>
      {/* Front section */}
      <path
        d="M 40 130 L 40 105 L 60 105 L 60 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Long frame */}
      <path
        d="M 60 118 L 190 118 L 195 130 L 60 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Cab */}
      <path
        d="M 195 128 L 195 88 L 220 68 L 265 68 L 285 88 L 285 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="215" y="78" width="45" height="18" rx="2" fill={BLACK} />
      {/* Blade */}
      <path
        d="M 90 120 L 170 120 L 172 132 L 92 132 Z"
        fill={BLACK}
      />
      {wheels([50, 220, 260, 290], 12)}
    </g>
  );
}

function roller() {
  return (
    <g>
      {/* Cab */}
      <path
        d="M 110 128 L 110 90 L 130 68 L 200 68 L 220 90 L 220 128 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="132" y="78" width="55" height="20" rx="2" fill={BLACK} />
      {/* Drum */}
      <ellipse cx="80" cy={GROUND_Y - 28} rx="45" ry="28" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      <ellipse cx="80" cy={GROUND_Y - 28} rx="25" ry="20" fill="none" stroke={BLACK} strokeWidth="1" />
      {wheels([245], 22)}
    </g>
  );
}

function plateCompactor() {
  return (
    <g>
      {/* Base plate */}
      <rect x="60" y="130" width="210" height="15" rx="3" fill={BLACK} />
      {/* Engine housing */}
      <path
        d="M 100 130 L 100 80 L 210 80 L 210 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      <circle cx="230" cy="105" r="18" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Handle */}
      <path
        d="M 90 90 Q 60 60 40 45 M 90 90 Q 60 65 45 55"
        stroke={BLACK}
        strokeWidth={STROKE + 1}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function trenchRammer() {
  return (
    <g>
      {/* Foot */}
      <rect x="130" y="135" width="60" height="10" rx="2" fill={BLACK} />
      {/* Bellow */}
      <path
        d="M 140 90 L 180 90 L 178 100 L 182 108 L 178 118 L 182 128 L 178 135 L 142 135 L 138 128 L 142 118 L 138 108 L 142 100 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Engine */}
      <path
        d="M 130 90 L 130 55 L 195 55 L 195 90 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Handle */}
      <path
        d="M 195 60 Q 240 60 240 100 Q 240 130 200 130"
        stroke={BLACK}
        strokeWidth={STROKE + 1}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function scissorLift() {
  return (
    <g>
      {/* Platform */}
      <rect x="70" y="55" width="180" height="14" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Railings */}
      <path
        d="M 70 55 L 70 30 L 250 30 L 250 55 M 100 55 L 100 30 M 130 55 L 130 30 M 160 55 L 160 30 M 190 55 L 190 30 M 220 55 L 220 30"
        stroke={BLACK}
        strokeWidth={STROKE - 1}
        fill="none"
      />
      {/* Scissor arms */}
      <path
        d="M 85 70 L 235 130 M 235 70 L 85 130 M 100 90 L 220 130 M 220 90 L 100 130"
        stroke={BLACK}
        strokeWidth={STROKE}
        fill="none"
      />
      {/* Base */}
      <rect x="70" y="130" width="180" height="15" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
    </g>
  );
}

function cherryPicker() {
  return (
    <g>
      {/* Base + wheels */}
      <rect x="40" y="115" width="120" height="20" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {wheels([60, 130], 15)}
      {/* Articulated boom */}
      <path
        d="M 80 115 L 130 60 L 210 55 L 270 90"
        stroke={BLACK}
        strokeWidth={STROKE + 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 80 115 L 130 60 L 210 55 L 270 90"
        stroke={YELLOW}
        strokeWidth={STROKE - 1}
        strokeLinecap="round"
        fill="none"
      />
      {/* Basket */}
      <rect x="260" y="82" width="35" height="22" rx="2" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      <path d="M 262 82 L 262 65 M 293 82 L 293 65 M 262 65 L 293 65" stroke={BLACK} strokeWidth="1.5" fill="none" />
    </g>
  );
}

function skidSteer() {
  return (
    <g>
      {/* Body */}
      <path
        d="M 100 130 L 100 80 L 120 62 L 200 62 L 220 80 L 220 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="128" y="72" width="60" height="24" rx="2" fill={BLACK} />
      {/* Loader arms */}
      <path
        d="M 100 118 L 240 118 L 258 130 L 100 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Bucket */}
      <path
        d="M 240 108 L 275 108 L 280 138 L 245 138 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {wheels([120, 160, 200], 15)}
    </g>
  );
}

function breaker() {
  return (
    <g>
      {/* Head + handle */}
      <path
        d="M 120 40 L 200 40 L 200 100 L 120 100 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Chisel */}
      <path
        d="M 145 100 L 175 100 L 165 145 L 155 145 Z"
        fill={BLACK}
      />
      {/* Grip */}
      <rect x="90" y="55" width="30" height="14" fill={BLACK} />
      <rect x="200" y="55" width="30" height="14" fill={BLACK} />
    </g>
  );
}

function generator() {
  return (
    <g>
      <rect
        x="60"
        y="70"
        width="200"
        height="70"
        rx="8"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Vents */}
      <path
        d="M 80 90 L 110 90 M 80 100 L 110 100 M 80 110 L 110 110 M 80 120 L 110 120"
        stroke={BLACK}
        strokeWidth="2"
      />
      {/* Panel */}
      <rect x="150" y="85" width="45" height="40" rx="2" fill={BLACK} />
      <circle cx="215" cy="105" r="12" fill={BLACK} />
      <circle cx="215" cy="105" r="4" fill={YELLOW} />
      {wheels([90, 230], 10)}
    </g>
  );
}

function compressor() {
  return (
    <g>
      <path
        d="M 60 130 L 60 80 Q 60 65 80 65 L 250 65 Q 265 65 265 82 L 265 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Handle */}
      <path
        d="M 60 100 Q 40 105 40 130"
        stroke={BLACK}
        strokeWidth={STROKE + 1}
        fill="none"
        strokeLinecap="round"
      />
      {/* Vent */}
      <path
        d="M 90 85 L 240 85"
        stroke={BLACK}
        strokeWidth="2"
      />
      {wheels([155], 13)}
    </g>
  );
}

function waterBowser() {
  return (
    <g>
      {/* Tank */}
      <ellipse cx="160" cy="90" rx="105" ry="35" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Hatch */}
      <circle cx="140" cy="60" r="9" fill={BLACK} />
      {/* Chassis */}
      <rect x="60" y="115" width="200" height="18" fill={BLACK} />
      {/* Tow tongue */}
      <path
        d="M 60 124 L 30 124 L 22 130"
        stroke={BLACK}
        strokeWidth={STROKE + 1}
        fill="none"
        strokeLinecap="round"
      />
      {wheels([100, 220], 14)}
    </g>
  );
}

function spaceHeater() {
  return (
    <g>
      {/* Body — cylinder */}
      <ellipse cx="100" cy="90" rx="30" ry="42" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      <path
        d="M 100 48 L 220 48 Q 240 48 240 68 L 240 112 Q 240 132 220 132 L 100 132"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Nozzle */}
      <circle cx="70" cy="90" r="15" fill={BLACK} />
      <circle cx="70" cy="90" r="6" fill={YELLOW} />
      {/* Wheels */}
      {wheels([180, 235], 12)}
    </g>
  );
}

function concreteMixer() {
  return (
    <g>
      {/* Drum */}
      <ellipse cx="180" cy="85" rx="65" ry="45" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      <ellipse cx="180" cy="85" rx="65" ry="45" fill="none" stroke={BLACK} strokeWidth="1" strokeDasharray="4 4" />
      {/* Engine */}
      <rect x="60" y="90" width="55" height="40" rx="3" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Frame */}
      <rect x="55" y="128" width="220" height="10" fill={BLACK} />
      {/* Tow tongue */}
      <path
        d="M 55 133 L 25 133 L 20 138"
        stroke={BLACK}
        strokeWidth={STROKE + 1}
        fill="none"
        strokeLinecap="round"
      />
      {wheels([215], 15)}
    </g>
  );
}

function concretePump() {
  return (
    <g>
      {/* Base */}
      <rect x="40" y="105" width="240" height="28" rx="3" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Hopper */}
      <path
        d="M 60 105 L 90 60 L 155 60 L 175 105 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Pump housing */}
      <rect x="185" y="80" width="80" height="25" fill={BLACK} />
      {/* Outlet */}
      <path
        d="M 260 90 L 290 60 L 300 65 L 275 95 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {wheels([80, 235], 12)}
    </g>
  );
}

function woodChipper() {
  return (
    <g>
      {/* Chute */}
      <path
        d="M 50 60 L 130 90 L 130 130 L 90 130 L 50 90 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Body */}
      <path
        d="M 130 90 L 130 130 L 250 130 L 250 65 L 200 65 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Discharge */}
      <path
        d="M 210 65 L 240 30 L 260 35 L 235 75 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Vent */}
      <path
        d="M 155 90 L 220 90 M 155 105 L 220 105 M 155 120 L 220 120"
        stroke={BLACK}
        strokeWidth="1.5"
      />
      {wheels([150, 220], 14)}
    </g>
  );
}

function trencher() {
  return (
    <g>
      {/* Body */}
      <path
        d="M 90 130 L 90 80 L 120 62 L 200 62 L 220 80 L 220 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x="115" y="72" width="60" height="20" rx="2" fill={BLACK} />
      {track(85, 145, 20)}
      {/* Cutting wheel */}
      <circle cx="40" cy="112" r="26" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Teeth */}
      <path
        d="M 40 86 L 42 78 L 46 88 M 62 100 L 70 96 L 62 108 M 62 128 L 70 128 L 62 138"
        stroke={BLACK}
        strokeWidth="2"
        fill={BLACK}
      />
    </g>
  );
}

function floorSaw() {
  return (
    <g>
      {/* Handle */}
      <path
        d="M 210 70 L 285 45"
        stroke={BLACK}
        strokeWidth={STROKE + 2}
        strokeLinecap="round"
      />
      {/* Engine block */}
      <rect x="100" y="55" width="115" height="60" rx="4" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Blade guard */}
      <path
        d="M 30 105 A 50 50 0 0 1 100 105 L 100 130 L 30 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      <circle cx="65" cy="118" r="30" fill="none" stroke={BLACK} strokeWidth="1.5" />
      {wheels([120, 190], 12)}
    </g>
  );
}

function flailMower() {
  return (
    <g>
      {/* Tractor cab */}
      <path
        d="M 55 130 L 55 90 L 75 70 L 120 70 L 140 90 L 140 130 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      <rect x="75" y="80" width="45" height="20" rx="2" fill={BLACK} />
      {/* Boom arm */}
      <path
        d="M 140 100 L 200 90 L 235 95 L 245 110 L 165 122 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Flail head */}
      <ellipse cx="255" cy="115" rx="24" ry="16" fill={BLACK} />
      <ellipse cx="255" cy="115" rx="16" ry="10" fill={YELLOW} />
      {wheels([75, 130], 20)}
    </g>
  );
}

function plantTrailer() {
  return (
    <g>
      {/* Bed */}
      <rect x="35" y="115" width="240" height="18" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Ramp */}
      <path
        d="M 275 115 L 300 118 L 300 128 L 275 128 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Rails */}
      <path
        d="M 35 115 L 35 90 M 100 115 L 100 95 M 175 115 L 175 95 M 275 115 L 275 95 M 35 90 L 275 92"
        stroke={BLACK}
        strokeWidth={STROKE - 1}
        fill="none"
      />
      {/* Hitch */}
      <path
        d="M 35 123 L 15 123 L 8 130"
        stroke={BLACK}
        strokeWidth={STROKE + 1}
        fill="none"
        strokeLinecap="round"
      />
      {wheels([100, 175, 220], 13)}
    </g>
  );
}

function welfareUnit() {
  return (
    <g>
      {/* Body */}
      <rect x="55" y="55" width="210" height="82" rx="4" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      {/* Roof line */}
      <path d="M 55 65 L 265 65" stroke={BLACK} strokeWidth="2" />
      {/* Windows */}
      <rect x="75" y="75" width="40" height="30" fill={BLACK} />
      <rect x="130" y="75" width="40" height="30" fill={BLACK} />
      {/* Door */}
      <rect x="190" y="75" width="30" height="60" fill={BLACK} />
      <circle cx="215" cy="105" r="2" fill={YELLOW} />
      {/* Skid feet */}
      <path d="M 55 137 L 45 145 M 265 137 L 275 145" stroke={BLACK} strokeWidth={STROKE} strokeLinecap="round" />
    </g>
  );
}

function attachmentsSet() {
  return (
    <g>
      {/* Bucket */}
      <path
        d="M 40 55 L 100 55 L 110 100 L 30 100 Z"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {/* Auger */}
      <rect x="145" y="45" width="18" height="55" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      <path
        d="M 154 100 L 154 145"
        stroke={BLACK}
        strokeWidth={STROKE + 4}
        strokeLinecap="round"
      />
      <path
        d="M 154 108 L 168 115 L 154 122 L 168 130 L 154 137 L 168 144"
        stroke={YELLOW}
        strokeWidth={STROKE - 1}
        fill="none"
      />
      {/* Breaker attachment */}
      <rect x="215" y="55" width="45" height="55" fill={YELLOW} stroke={BLACK} strokeWidth={STROKE} />
      <path d="M 228 110 L 247 110 L 240 145 L 235 145 Z" fill={BLACK} />
    </g>
  );
}

function DefaultBox() {
  return (
    <>
      <rect
        x="60"
        y="70"
        width="200"
        height="65"
        rx="6"
        fill={YELLOW}
        stroke={BLACK}
        strokeWidth={STROKE}
      />
      {wheels([100, 220], 15)}
    </>
  );
}

// ─── Registry ─────────────────────────────────────────────────────

const SHAPES: Partial<Record<PlantCategorySlug, () => React.ReactElement>> = {
  mini_excavator: () => (
    <>
      {excavatorBody(0.85)}
      {ground()}
    </>
  ),
  midi_excavator: () => (
    <>
      {excavatorBody(1)}
      {ground()}
    </>
  ),
  backhoe_loader: () => (
    <>
      {backhoeLoader()}
      {ground()}
    </>
  ),
  wheel_loader: () => (
    <>
      {wheelLoader()}
      {ground()}
    </>
  ),
  bulldozer: () => (
    <>
      {bulldozer()}
      {ground()}
    </>
  ),
  articulated_dumper: () => (
    <>
      {articulatedDumper()}
      {ground()}
    </>
  ),
  grader: () => (
    <>
      {grader()}
      {ground()}
    </>
  ),
  dumper: () => (
    <>
      {dumper(true)}
      {ground()}
    </>
  ),
  tracked_dumper: () => (
    <>
      {trackedDumper()}
      {ground()}
    </>
  ),
  telehandler: () => (
    <>
      {telehandler()}
      {ground()}
    </>
  ),
  forklift: () => (
    <>
      {forklift()}
      {ground()}
    </>
  ),
  roller: () => (
    <>
      {roller()}
      {ground()}
    </>
  ),
  plate_compactor: () => (
    <>
      {plateCompactor()}
      {ground()}
    </>
  ),
  trench_rammer: () => (
    <>
      {trenchRammer()}
      {ground()}
    </>
  ),
  scissor_lift: () => (
    <>
      {scissorLift()}
      {ground()}
    </>
  ),
  cherry_picker: () => (
    <>
      {cherryPicker()}
      {ground()}
    </>
  ),
  skid_steer: () => (
    <>
      {skidSteer()}
      {ground()}
    </>
  ),
  breaker: () => (
    <>
      {breaker()}
      {ground()}
    </>
  ),
  generator: () => (
    <>
      {generator()}
      {ground()}
    </>
  ),
  compressor: () => (
    <>
      {compressor()}
      {ground()}
    </>
  ),
  water_bowser: () => (
    <>
      {waterBowser()}
      {ground()}
    </>
  ),
  space_heater: () => (
    <>
      {spaceHeater()}
      {ground()}
    </>
  ),
  concrete_mixer: () => (
    <>
      {concreteMixer()}
      {ground()}
    </>
  ),
  concrete_pump: () => (
    <>
      {concretePump()}
      {ground()}
    </>
  ),
  wood_chipper: () => (
    <>
      {woodChipper()}
      {ground()}
    </>
  ),
  trencher: () => (
    <>
      {trencher()}
      {ground()}
    </>
  ),
  floor_saw: () => (
    <>
      {floorSaw()}
      {ground()}
    </>
  ),
  flail_mower: () => (
    <>
      {flailMower()}
      {ground()}
    </>
  ),
  plant_trailer: () => (
    <>
      {plantTrailer()}
      {ground()}
    </>
  ),
  welfare_unit: () => (
    <>
      {welfareUnit()}
      {ground()}
    </>
  ),
  attachments: () => (
    <>
      {attachmentsSet()}
      {ground()}
    </>
  )
};
