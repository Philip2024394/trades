// Brain Admin flag — gates the Admin review UI + /api/brain-admin/*.
//
// Independent from Author Studio flag and Brain Runtime flag. The
// Admin persona reviews Author-accepted candidates BEFORE they are
// eligible for the Runtime pack. Nothing publishes without them.
//
// Env: NEX_BRAIN_ADMIN_ENABLED = "1" | "true" | "yes" | "on"

export function nexBrainAdminEnabled(): boolean {
  const raw = process.env.NEX_BRAIN_ADMIN_ENABLED;
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
