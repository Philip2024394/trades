// Nex Brain Runtime feature flag.
//
// The Brain runtime is dark-shipped: all substrate code lands and can
// be exercised in tests, but the public /api/brain/* endpoints return
// 503 and the Phase 24 catalog hook does not route through the Brain
// loader until the flag is switched ON.
//
// Switch ON only when:
//   • ADR-0017 (Trade Brain Contract) has signoff
//   • ADR-0021 (Intelligence Domain Separation) has signoff
//   • At least one Trade Brain Author has a signed contract
//   • Merchant advisory panel has reviewed the first Brain V0
//
// Env var: NEX_BRAIN_RUNTIME_ENABLED = "1" | "true" (case-insensitive).
// Any other value — including unset — leaves the runtime dark.

export function nexBrainRuntimeEnabled(): boolean {
  const raw = process.env.NEX_BRAIN_RUNTIME_ENABLED;
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
