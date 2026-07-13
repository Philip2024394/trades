# ADR-0001: Manifest-first apps

Status: Accepted
Date: 2026-07-11

## Context

The platform grew multiple parallel feature systems — canteen, marketplace, notebook, plant hire, key cutting, calculators, etc. Bolting each one into the main app directly would produce a monolithic runtime where any change risks breaking unrelated features. We also want future features (industry packs, community-contributed modules) to install / uninstall like plugins, not require a code branch.

## Decision

Every feature module is an "App" declared via `src/apps/{slug}/manifest.ts`. The manifest describes what the app is, which surfaces it plugs into, which tiers unlock it, and which storage tables it owns (all prefixed `app_{slug}_`). The platform runtime (`src/platform/runtime/`) is the only thing that reads manifests — it composes navigation, storage installation, tier gating, and page routing from them. The runtime never references an app by slug.

## Consequences

- **Positive:** New feature = new folder + manifest. No changes to core code required. Apps can be enabled / disabled per canteen without deploying. Future App Store install / uninstall flow uses the same manifest interface.
- **Positive:** Every app owns its own tables — no shared-schema coupling.
- **Negative:** Small overhead per app (writing the manifest). Merchants who want to add functionality must go through the App Store, not code.
- **Neutral:** Requires the runtime to be well-tested — it's now load-bearing across the whole platform.

## Alternatives considered

- **Direct integration into `src/lib/`** — rejected. Every feature would touch the core codebase; regression risk grows with each addition.
- **Micro-frontend architecture** — rejected. Overkill for a single-team codebase; the manifest pattern gets the same modularity at a fraction of the complexity.
- **Nx workspace with separate apps** — rejected. Would require build-time separation we don't need; manifest-first gives runtime separation which is what we actually want.
</parameter>
