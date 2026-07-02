// Platform Runtime — facade barrel.
//
// This is the ONLY module SDK / consumers should import from the
// Runtime layer. It exposes install, uninstall, ledger reads,
// navigation composition, and slot resolution as a single named
// export.
//
// Design rule: the Runtime facade must remain small enough that its
// surface can be understood at a glance. When it grows past ~a dozen
// verbs, split into sub-facades (`runtime.pages`, `runtime.slots`,
// `runtime.nav`) — do NOT let the flat namespace balloon.

import { installApp } from "./install";
import { uninstallApp } from "./uninstall";
import {
  getInstalledApp,
  listActiveInstalls
} from "./installedApps";
import { composeNavigation } from "./navigationComposer";
import { listAppCreatedPages } from "./pageManagement";
import { recordAppEvent } from "./appEvents";
import {
  publishEvent,
  publishDurableEvent,
  subscribeEvent,
  subscriberCount
} from "./eventBus";
import { installPack } from "./packInstall";
import { uninstallPack } from "./packUninstall";
import {
  getInstalledPack,
  listActivePackInstalls
} from "./installedPacks";
import {
  replayEvents,
  currentEventCursor
} from "./eventReplay";
import {
  appsSubscribedTo,
  appsPublishing,
  eventTopology,
  isDeclaredEventKind
} from "./eventDiscovery";
import {
  KNOWN_SLOT_NAMES,
  resolveSlot,
  resolveSlotAll,
  slotsForPage
} from "./slots";

export const runtime = {
  // ─── App lifecycle ───────────────────────────
  installApp,
  uninstallApp,

  // ─── Ledger reads ────────────────────────────
  getInstalledApp,
  listActiveInstalls,

  // ─── Pages ───────────────────────────────────
  listAppCreatedPages,

  // ─── Navigation ──────────────────────────────
  composeNavigation,

  // ─── Slots ──────────────────────────────────
  slotsForPage,
  resolveSlot,
  resolveSlotAll,
  KNOWN_SLOT_NAMES,

  // ─── Analytics ──────────────────────────────
  recordAppEvent,

  // ─── Event Bus — in-process (fast path) ─────
  publishEvent,
  subscribeEvent,
  subscriberCount,

  // ─── Event Bus — durable (App path) ─────────
  publishDurableEvent,
  replayEvents,
  currentEventCursor,

  // ─── Event Bus — manifest discovery ─────────
  appsSubscribedTo,
  appsPublishing,
  eventTopology,
  isDeclaredEventKind,

  // ─── Industry Packs ─────────────────────────
  installPack,
  uninstallPack,
  getInstalledPack,
  listActivePackInstalls
};

// Type re-exports so SDK modules don't need to know the eventLog
// module path.
export type { StoredEvent } from "./eventLog";
export type { ReplayOptions } from "./eventReplay";
export type {
  PackInstallOptions,
  PackInstallResult,
  PackInstallError
} from "./packInstall";
export type {
  PackUninstallOptions,
  PackUninstallResult,
  PackUninstallError
} from "./packUninstall";
export type { InstalledPackRow } from "./installedPacks";

// Type re-exports so consumers can import both the runtime and its
// types from one path.
export type {
  InstalledAppRow,
  InstallOptions,
  InstallResult,
  InstallError,
  UninstallOptions,
  UninstallResult,
  UninstallError,
  ComposedNavigation,
  ComposedNavEntry,
  SlotDefinition,
  SlotResolution,
  SlotConstraint
} from "./types";
