// Xrated Button Studio — public entry.
//
// Import this file once (side-effect) before any code reads from the
// registry. Every variant module registers itself on import.

export { buttonRegistry } from "./buttonRegistry";
export * from "./types";
export * from "./themeAdapter";

// Side-effect: populate the registry.
import "./variants/primarySolid";
import "./variants/secondaryOutline";
import "./variants/ghostText";
import "./variants/whatsappPill";
import "./variants/ctaBookArrow";
import "./variants/iconOnly";
import "./variants/basicPack";
import "./variants/marketingPack";
import "./variants/ecommercePack";
import "./variants/navFloatingPack";
import "./variants/authPack";
import "./variants/paymentPack";
import "./variants/paymentExpansionPack";
import "./variants/interactivePack";
import "./variants/richStatePack";
import "./variants/signatureMotionPack";
