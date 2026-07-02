// Platform SDK — barrel.
//
// The single import surface for App authors. Every SDK verb takes
// an AppContext as its first argument — created once per request
// via `createAppContext(manifest, { merchantId })` and threaded
// through the call chain.
//
// Design rule: every SDK verb is ≤5 lines and calls into
// `src/platform/runtime`. If it isn't, the Runtime is missing a verb
// and should grow it there instead of thickening the SDK.

// ─── Context ────────────────────────────────────────────
export {
  createAppContext,
  type AppContext,
  type AppContextScope
} from "./context";

// ─── Permissions ────────────────────────────────────────
export {
  assertCapability,
  assertPermission,
  hasCapability,
  hasPermission
} from "./permissions";

// ─── Storage ────────────────────────────────────────────
export { appTable, appTableName } from "./storage";

// ─── Analytics ──────────────────────────────────────────
export { trackAppEvent } from "./analytics";

// ─── Navigation ─────────────────────────────────────────
export { getNavigation } from "./navigation";

// ─── Pages ──────────────────────────────────────────────
export { getMyPages, type AppCreatedPage } from "./pages";

// ─── Install / uninstall ────────────────────────────────
export {
  installApp,
  uninstallApp,
  getInstalledApp,
  listActiveInstalls
} from "./install";

// ─── Slots ──────────────────────────────────────────────
export {
  slotsForPage,
  resolveSlot,
  resolveSlotAll,
  KNOWN_SLOT_NAMES
} from "./slots";

// ─── Events ─────────────────────────────────────────────
export { publish, subscribe, replay, currentCursor } from "./events";
