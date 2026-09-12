// src/components/nex-gate/NexEnvironment.tsx
//
// The world behind the gate · Philip 2026-09-07
//
// Renders the atmospheric NEX environment plus the reference-style orb.
//
//   Background: three soft ocean-blue radial blobs drifting on very
//   long cycles (120s-180s) + a slow rotating lighting sweep.
//
//   Orb: dark spherical core with deep-blue internal illumination, a
//   pale specular highlight top-left, a soft orange energy pulse in
//   the middle, and a faint orbital ring rotating around it with two
//   small markers riding the ring (the ::before/::after pseudos).
//
// Motion is entirely CSS-driven (see glass-gate.module.css) so this
// component is a static render tree · zero JS in the animation hot path
// · reduced-motion is honored by the CSS.
//
// The gate orb is intentionally NOT the production NexVoiceOrb — that
// component owns voice-waveform state and pupil directionality that
// don't belong on the entry surface. Keeping it inline preserves
// NexVoiceOrb per §22 hard scope lock.

import styles from "./glass-gate.module.css";

export function NexEnvironment() {
  return (
    <div className={styles.environment} aria-hidden data-testid="nex-gate-environment">
      {/* Soft radial blobs · slow drift · the NEX world behind everything. */}
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />

      {/* Very slow rotating lighting sweep · subconscious "something is
          happening in there" without ever spotlighting. */}
      <div className={styles.lightingSweep} />

      {/* Gate orb · calm breathing presence · dark centre, deep-blue
          internal depth, subtle orange energy, faint rotating orbital
          ring with two markers. */}
      <div className={styles.orbWrap} data-testid="nex-gate-orb">
        <div className={styles.orb}>
          <div className={styles.orbHighlight} />
          <div className={styles.orbEnergy} />
          <div className={styles.orbRim} />
        </div>
        <div className={styles.orbitalRing} aria-hidden />
      </div>
    </div>
  );
}
