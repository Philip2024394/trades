// Author Studio feature flag — governs the Studio UI + all
// /api/studio/* endpoints. Independent from NEX_BRAIN_RUNTIME_ENABLED
// on purpose: the Studio is invite-only and Author-facing; the runtime
// flag governs whether merchants can query Brains. Studio can be ON
// (Author drafting content) while runtime is still OFF (Brains not
// yet visible to merchants).
//
// Switch ON when:
//   • First Trade Brain Author has signed contract
//   • Author onboarding session scheduled
//   • Author's user ID added to NEX_AUTHOR_ALLOWLIST env var
//
// Env: NEX_AUTHOR_STUDIO_ENABLED = "1" | "true" | "yes" | "on"

export function nexAuthorStudioEnabled(): boolean {
  const raw = process.env.NEX_AUTHOR_STUDIO_ENABLED;
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
