// Studio App Manifest — the shape every App declares.
//
// Studio is the merchant-facing visual editor. Apps are modular
// features (Live Feed, Story Arcs, Reviews, Plant Hire, etc.) that
// register themselves against the Studio runtime via a manifest.
//
// Design invariants from the platform architecture memory:
//   - Manifest-first — no hard-coded App logic in the Runtime
//   - Storage tables MUST be prefixed app_<slug>_
//   - Every App is a self-contained unit that ships / uninstalls
//     cleanly
//
// This file is the type contract. Each App exports a manifest that
// conforms.

import type { ComponentType } from "react";

export type StudioAppSlot =
  | "hero"
  | "value_prop"
  | "services"
  | "proof"
  | "gallery"
  | "contact"
  | "cta"
  | "footer"
  | "any";

export type StudioAppCategory =
  | "content"
  | "commerce"
  | "trust"
  | "operations"
  | "marketing"
  | "productivity";

export type StudioAppTier = "free" | "starter" | "pro" | "verified";

export type StudioAppManifest = {
  /** Unique kebab-case slug. Storage tables get prefixed with app_<slug>_. */
  slug: string;
  /** Display name shown in the Studio App Store. */
  name: string;
  /** One-line pitch. */
  tagline: string;
  /** Longer description — appears on the App detail page. */
  description: string;
  /** Icon (lucide-react name — enforced by user-memory feedback_lucide_icons_only). */
  iconName: string;
  category: StudioAppCategory;
  /** Which page slots this App can render into. `any` for utility Apps. */
  slots: StudioAppSlot[];
  /** Which subscription tier gates access. */
  tier: StudioAppTier;
  /** Semantic version. */
  version: string;
  /** Optional list of other App slugs this App depends on. */
  dependencies?: string[];
  /** Optional list of feature flags this App reads. */
  featureFlags?: string[];
  /** Server-side install hook — called ONCE when a merchant installs
   *  the App. Creates DB rows, subscribes to events, etc. */
  install?: (context: StudioAppContext) => Promise<void>;
  /** Server-side uninstall hook — must clean up everything install
   *  created. */
  uninstall?: (context: StudioAppContext) => Promise<void>;
  /** React component for rendering the App inside a page slot.
   *  Receives normalised content + theme props from Studio. */
  render?: ComponentType<StudioAppRenderProps>;
  /** React component for editing the App's content — shown in the
   *  merchant's Studio editor. */
  editor?: ComponentType<StudioAppEditorProps>;
};

export type StudioAppContext = {
  merchantId: string;
  /** Runtime-provided helpers so Apps don't reach into globals. */
  emit: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
  storage: {
    get: (key: string) => Promise<unknown>;
    put: (key: string, value: unknown) => Promise<void>;
    del: (key: string) => Promise<void>;
  };
};

export type StudioAppRenderProps = {
  merchantId: string;
  content: Record<string, unknown>;
  theme: Record<string, string>;
  slot: StudioAppSlot;
};

export type StudioAppEditorProps = {
  merchantId: string;
  content: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
};

/** Every App declared in the workspace. Add new Apps by adding a
 *  file under src/apps/<slug>/manifest.ts and importing it here. */
import { liveFeedApp } from "@/apps/live-feed/manifest";

export const STUDIO_APPS: StudioAppManifest[] = [liveFeedApp];

export function findApp(slug: string): StudioAppManifest | undefined {
  return STUDIO_APPS.find((a) => a.slug === slug);
}
