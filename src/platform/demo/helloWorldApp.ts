// Hello-World demo App — Week 1 platform validation fixture.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  This isn't a production App. It's the fixture
//    the Platform Validation Test uses to prove discovery works.
//    Lives under `src/platform/demo/` so it's never confused with a
//    real installable App.
//
// 2. Which future Apps benefit?  Every future App uses this as the
//    reference implementation of the ADR-033–ADR-047 declarations.
//
// 3. Which doc authorises?  TRADE_CENTER_PLATFORM_DELTA §6 Week 1
//    implementation backlog + `PLATFORM_ARCHITECTURE.md §21` Week 0
//    Platform Validation Test.
//
// ─── Purpose ───────────────────────────────────────────────────────
//
// This App declares one of each new manifest slice:
//   • one AI tool
//   • one feature flag
//   • one telemetry metric
//   • one command palette action
//   • the platformCompat envelope
//
// The Week 1 verification script imports + registers this App and
// asserts each declaration is discoverable end-to-end.

import type { AppManifest } from "@/platform/manifest/types";

export const helloWorldAppManifest: AppManifest = {
  manifestVersion: 1,
  slug: "hello-world",
  name: "Hello World",
  tagline: "Week 1 platform validation fixture",
  description:
    "A no-op App that exercises every ADR-033-through-ADR-047 manifest slice. Used by the Platform Validation Test to prove discovery works without any App-specific wiring.",
  icon: "TestTube",
  category: "operations",
  version: "1.0.0",
  publisher: {
    name: "Trade Center Platform Team",
    verified: true
  },
  compatibility: {
    industries: ["*"],
    pages: ["*"],
    createsPages: []
  },
  requirements: {
    plan: "free",
    dependencies: [],
    conflicts: [],
    capabilities: ["events"],
    permissions: []
  },
  studio: {
    sections: []
  },
  appStore: {
    screenshots: [],
    benefits: ["Proves the platform discovery mechanisms work"],
    priceLabel: "Free"
  },

  // ─── The new manifest slices (ADR-033 through ADR-047) ────────

  platformCompat: {
    apiVersion: "1.0.0",
    schemaVersion: "1.0.0",
    minPlatformVersion: "1.0.0"
  },

  aiTools: [
    {
      name: "hello-world.echo",
      description:
        "Echo the input string back — used to prove the AI Dispatcher discovers and can invoke a tool.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" }
        },
        required: ["message"]
      },
      cost: "low"
    }
  ],

  featureFlags: [
    {
      key: "hello-world.enabled",
      description:
        "Master switch for the hello-world demo. Used by the Platform Validation Test.",
      default: true,
      scope: "global"
    }
  ],

  telemetry: [
    {
      metric: "hello-world.echo.count",
      kind: "counter",
      description: "Count of AI echo tool invocations.",
      labels: ["outcome"]
    }
  ],

  commands: [
    {
      id: "hello-world.say-hi",
      label: "Say hi from Hello World",
      group: "actions",
      shortcut: "g h",
      icon: "Hand"
    }
  ]
};
