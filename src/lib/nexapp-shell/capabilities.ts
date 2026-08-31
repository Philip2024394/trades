// NEX Capability Surface · type definitions and registry
// Philip 2026-08-30 · Slice 1 foundation
//
// A Capability Surface is a MORE-tier destination that renders INSIDE the
// NEX shell (never a full-page navigation). Each capability declares its
// views, wants (composer/orb/rail-accent), and metadata. The renderer
// resolves the active capability + current URL view → renders the view
// component inside NexHudFrame's children slot.
//
// URL model (locked): /nexapp?cap=<id>&view=<viewId>&id=<targetId>
// Back model (locked): each capability view paints its own back affordance
// via <CapabilityHeader backLabel=... onBack=... />. The global NEX header
// (Search · Notifications · Create) is never disturbed.

import type { ComponentType } from "react";

export type CapabilityId = "studio" | "tools" | "creator" | "network";

/** The union of view ids a capability can render. Strings, not enums, so
 *  each capability owns its own view namespace. */
export interface CapabilityFrame {
  view: string;
  params?: Record<string, string>;
}

export interface CapabilityViewProps {
  frame: CapabilityFrame;
  /** Push a new view onto the URL (adds a browser history entry). */
  navigate: (view: string, params?: Record<string, string>) => void;
  /** Leave the capability entirely; shell returns to prior state. */
  exit: () => void;
}

export interface CapabilityWants {
  /** false = shell hides composer while capability is active. Default true. */
  composer?: boolean;
  /**
   * How the voice orb behaves while inside this capability.
   * "default"  → normal orb position (canonical)
   * "perched"  → orb flies to top-right corner (compact) so the interior gets space
   * "compact"  → alias for "perched" · new name aligned with Persistent Identity Rule
   * "hidden"   → BANNED for consumer artifacts per Persistent Identity Rule
   *              (kept in the type only for legacy; never use for shipped surfaces)
   * Default: "default".
   */
  orb?: "default" | "perched" | "compact" | "hidden";
  /**
   * When true, shell hides the 5-button primary rail so the artifact interior
   * gets maximum content space. Philip 2026-08-30 · Persistent Identity Rule
   * three-state pattern (immersive browsing).
   * Default: false.
   */
  railCollapse?: boolean;
  /** Colour override for the MORE rail button while this capability is active. */
  railAccent?: string;
}

export interface CapabilityDefinition {
  id: CapabilityId;
  label: string;
  /** Which view id renders when the capability is first entered. */
  entryView: string;
  views: Record<string, ComponentType<CapabilityViewProps>>;
  wants: CapabilityWants;
}

class CapabilityRegistry {
  private capabilities = new Map<CapabilityId, CapabilityDefinition>();

  register(def: CapabilityDefinition): void {
    this.capabilities.set(def.id, def);
  }

  get(id: CapabilityId | null | undefined): CapabilityDefinition | undefined {
    if (!id) return undefined;
    return this.capabilities.get(id);
  }

  has(id: string | null | undefined): id is CapabilityId {
    return !!id && this.capabilities.has(id as CapabilityId);
  }
}

export const capabilityRegistry = new CapabilityRegistry();
