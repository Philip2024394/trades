// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// Coded by NEX1 via route_2d_small_application · 2026-09-14
// Route 2d first-app demonstration.
// Tiny calculator · 3 state fields · 12 events · locked vocabulary only.
// Every byte in the emitted files was produced deterministically by authorSmallApplication.
// Contract: TinyCalculator
// Deterministic byte-stable output. Do not edit by hand.
"use client";

import { TinyCalculator } from "./TinyCalculator";

export default function Page() {
  return <TinyCalculator />;
}
