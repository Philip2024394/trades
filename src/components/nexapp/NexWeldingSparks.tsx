// NEX welding sparks · 2026-08-23 (Philip · Option B cascading team).
// Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
// "Welding sparks · cascading 4-welder team along the top rim ·
//  sparks fall from ABOVE the rim (not spawning on it)."
//
// Design:
//   · 4 welder positions across the top rim: 15% · 38% · 62% · 85%.
//   · They fire sequentially with brief overlap so the crew reads as
//     "coordinated" rather than "one welder teleporting."
//   · Timeline (loops every ~10s):
//         A(2s) · A+B(0.5s overlap) · B(1.5s) · B+C(0.5s) · C(1.5s) ·
//         C+D(0.5s) · D(1.5s) · pause(2s)
//   · Sparks originate at translateY(-70 px) with FULL opacity.
//     overflow:hidden on the container clips them until they cross
//     the rim, so they visibly fall INTO the frame from above instead
//     of popping in at the rim line.
//   · Fall keyframe stops are non-linear so linear interpolation
//     produces an accelerating gravity feel (slow near the top, faster
//     near the bottom).

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const SPARK_COUNT_PER_WELDER = 10;
const WELDER_POSITIONS = [15, 38, 62, 85] as const;

type Visibility = [boolean, boolean, boolean, boolean];

const PHASES: Array<{ visible: Visibility; duration: number }> = [
  { visible: [true,  false, false, false], duration: 2000 }, // A alone
  { visible: [true,  true,  false, false], duration: 500  }, // A + B handoff
  { visible: [false, true,  false, false], duration: 1500 }, // B alone
  { visible: [false, true,  true,  false], duration: 500  }, // B + C handoff
  { visible: [false, false, true,  false], duration: 1500 }, // C alone
  { visible: [false, false, true,  true ], duration: 500  }, // C + D handoff
  { visible: [false, false, false, true ], duration: 1500 }, // D alone
  { visible: [false, false, false, false], duration: 2000 }, // brief pause · loop
];

// Fall keyframe · starts ABOVE the rim (translateY -70 px, clipped by
// overflow:hidden on the parent) and travels down through the frame.
// Non-linear stops → accelerating fall under linear interpolation.
const KEYFRAMES = `
  @keyframes nex-welding-fall {
    0%   { transform: translateY(-70px)  scaleY(1);   opacity: 1;    }
    22%  { transform: translateY(20px)   scaleY(1);   opacity: 1;    }
    60%  { transform: translateY(200px)  scaleY(1);   opacity: 1;    }
    82%  { transform: translateY(380px)  scaleY(0.85); opacity: 0.5; }
    100% { transform: translateY(560px)  scaleY(0.4);  opacity: 0;   }
  }
`;

type Spark = {
  id: number;
  xPercent: number;
  duration: number;
  delay: number;
  size: number;
  streakHeight: number;
};

export function NexWeldingSparks() {
  const [visible, setVisible] = useState<Visibility>([false, false, false, false]);

  useEffect(() => {
    let phaseIdx = 0;
    let timerId: ReturnType<typeof setTimeout>;

    const step = () => {
      const phase = PHASES[phaseIdx];
      setVisible(phase.visible);
      timerId = setTimeout(() => {
        phaseIdx = (phaseIdx + 1) % PHASES.length;
        step();
      }, phase.duration);
    };

    step();
    return () => clearTimeout(timerId);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: 24,
        pointerEvents: "none",
        zIndex: 5,
      }}
      aria-hidden
      data-nex-welding-sparks
    >
      <style>{KEYFRAMES}</style>
      <AnimatePresence>
        {WELDER_POSITIONS.map((pos, i) =>
          visible[i] ? <WelderGroup key={`w${i}`} positionPercent={pos} /> : null,
        )}
      </AnimatePresence>
    </div>
  );
}

function WelderGroup({ positionPercent }: { positionPercent: number }) {
  // Fresh random pool per mount · each activation looks slightly
  // different from the last, natural welder variance.
  const sparks = useMemo<Spark[]>(() => {
    return Array.from({ length: SPARK_COUNT_PER_WELDER }, (_, i) => ({
      id: i,
      xPercent: positionPercent + (Math.random() - 0.5) * 3, // ±1.5 % subtle spread
      duration: 1.6 + Math.random() * 1.2, // 1.6 – 2.8 s
      delay: Math.random() * 2.0,          // 0 – 2.0 s stagger
      size: 1.3 + Math.random() * 1.4,     // 1.3 – 2.7 px wide
      streakHeight: 2 + Math.random() * 5, // 2 – 7 px tall · original
      // Reverted to small realistic spark particles (Philip 2026-08-23).
    }));
  }, [positionPercent]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: "absolute", inset: 0 }}
    >
      {sparks.map((spark) => (
        <div
          key={spark.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${spark.xPercent}%`,
            width: spark.size,
            height: spark.streakHeight,
            background:
              "linear-gradient(180deg, #ffffee 0%, #ffe4a0 35%, #ffa050 75%, #ff5a10 100%)",
            borderRadius: spark.size / 2,
            boxShadow: `0 0 ${spark.size * 2}px rgba(255, 160, 80, 0.7), 0 0 ${spark.size * 4}px rgba(255, 90, 16, 0.35)`,
            animation: `nex-welding-fall ${spark.duration}s linear infinite`,
            animationDelay: `${spark.delay}s`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </motion.div>
  );
}
