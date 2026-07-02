// Industry Packs — barrel.
//
// Every Pack is imported here so its manifest self-registers with the
// Pack Registry at module load. Phase 9 landed the first Pack —
// Essentials — as a proof of end-to-end platform wiring.
//
// Adding a new Pack: one import line here. Nothing else on the
// platform changes.

import "@/packs/essentials-pack";

export {};
