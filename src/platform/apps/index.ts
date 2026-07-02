// Platform Apps — barrel.
//
// Every App on the platform is imported here so its manifest
// self-registers with the App Registry at module load. The pattern
// mirrors `src/lib/studio/sections/index.ts` — a single side-effect
// import chain per App directory.
//
// Phase 9 landed the first three retrofits. Every subsequent App adds
// one line here. Nothing else on the platform changes.

import "@/apps/meet-the-team";
import "@/apps/newsletter";
import "@/apps/trade-connections";

export {};
