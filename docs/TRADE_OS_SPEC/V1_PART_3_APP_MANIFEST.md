# Trade Operating System · Volume 1 · Part 3
## Studio App Manifest v2.0

**Audience:** Senior Platform Engineers, AI Engineers, Runtime Engineers
**Source:** ChatGPT design-brief architecture series, Part 3 of 5.

---

## Philosophy

A Studio is **not a page in the UI**. It is a self-contained capability that subscribes to Brand DNA, consumes events, generates assets, and publishes outputs back to the Brand Vault.

**Think of every Studio as a plugin.**

```
Trade OS
│
├── Brand Studio
├── Vehicle Studio
├── Website Studio
├── Print Studio
├── Marketing Studio
├── Photography Studio
├── Social Studio
├── Documents Studio
└── App Studio
```

Each Studio contains one or more Apps:

```
Vehicle Studio
│
├── Van Wrap
├── Fleet Branding
├── Pickup Branding
├── Trailer Branding
├── Magnetic Signs
└── Reflective Kit
```

Everything is installed through a Manifest.

---

## Runtime Architecture

```
Capability Registry
        ↓
Loads Manifest
        ↓
Registers Events
        ↓
Registers Generator
        ↓
Registers Permissions
        ↓
Registers Exporters
        ↓
Ready
```

**No hard coding.**

---

## Manifest Responsibilities

A Manifest answers:

1. What is this app?
2. What Brand DNA does it need?
3. What AI models does it use?
4. What outputs does it generate?
5. What events trigger it?
6. What permissions are required?
7. What QA rules apply?
8. What does it cost to run?
9. What exports are supported?

---

## TypeScript Interfaces

### Master Manifest

```ts
export interface StudioAppManifest {
  id:                   string;
  name:                 string;
  version:              string;

  studio:
    | "Brand" | "Vehicle" | "Website" | "Print"
    | "Marketing" | "Photography" | "Documents"
    | "Social" | "Office" | "Growth";

  category:             string;
  description:          string;
  icon:                 string;
  status:               "enabled" | "disabled" | "beta";

  dependencies:         Dependency[];
  requiredBrandFields:  BrandField[];
  outputs:              OutputDefinition[];
  permissions:          Permission[];
  subscriptions:        EventSubscription[];
  generator:            GeneratorDefinition;
  storage:              StorageDefinition;
  exporters:            ExportDefinition[];
  pricing:              PricingDefinition;
  ai:                   AIConfiguration;
  qa:                   QAConfiguration;
}
```

### Supporting types

```ts
interface Dependency {
  id:              string;
  minimumVersion:  string;
  required:        boolean;
}

interface BrandField {
  path:      string;   // e.g. "identity.companyName"
  required:  boolean;
}

interface OutputDefinition {
  type:        string;
  mime:        string;
  resolution:  string;
  editable:    boolean;
}

interface Permission {
  role:    "Owner" | "Designer" | "Viewer" | "Printer";
  action:  string;
}

interface EventSubscription {
  event:    string;
  handler:  string;
  priority: number;
}

interface GeneratorDefinition {
  type:      "image" | "document" | "website" | "app" | "video";
  compiler:  string;
  workflow:  string;
}

interface StorageDefinition {
  bucket:     string;
  retention:  string;
  versioned:  boolean;
  cache:      boolean;
}

interface ExportDefinition {
  type:     string;
  enabled:  boolean;
}

interface PricingDefinition {
  plan:     "free" | "one_time" | "subscription";
  price:    number;
  credits:  number;
}

interface AIConfiguration {
  reasoningModel:  string;
  imageModel:      string;
  criticModel:     string;
  maxAttempts:     number;
  temperature:     number;
}

interface QAConfiguration {
  minimumScore:    number;
  rules:           string[];
  autoFix:         boolean;
  humanApproval:   boolean;
}
```

---

## Complete Manifest Example — Vehicle Studio → Van Wrap App

```ts
export const VanWrapManifest: StudioAppManifest = {
  id:          "vehicle.van-wrap",
  name:        "Van Wrap",
  version:     "2.0.0",
  studio:      "Vehicle",
  category:    "Vehicle Branding",
  description: "Professional UK commercial vehicle wrap generator.",
  icon:        "van",
  status:      "enabled",

  dependencies: [
    { id: "brand",               minimumVersion: "2.0", required: true },
    { id: "prompt-compiler",     minimumVersion: "1.4", required: true },
    { id: "design-intelligence", minimumVersion: "3.0", required: true }
  ],

  requiredBrandFields: [
    { path: "identity.companyName", required: true },
    { path: "logo.master",          required: true },
    { path: "colours.primary",      required: true },
    { path: "typography.heading",   required: true },
    { path: "vehicle.layout",       required: true },
    { path: "photography.style",    required: true }
  ],

  outputs: [
    { type: "png", mime: "image/png",     resolution: "1600x900", editable: false },
    { type: "svg", mime: "image/svg+xml", resolution: "vector",   editable: true },
    { type: "pdf", mime: "application/pdf", resolution: "print",  editable: true }
  ],

  permissions: [
    { role: "Owner",    action: "generate" },
    { role: "Designer", action: "edit" },
    { role: "Printer",  action: "download" }
  ],

  subscriptions: [
    { event: "BrandUpdated",  handler: "generatePreview", priority: 1 },
    { event: "LogoUpdated",   handler: "generatePreview", priority: 2 },
    { event: "ColourUpdated", handler: "generatePreview", priority: 2 }
  ],

  generator: {
    type:     "image",
    compiler: "VehiclePromptCompiler",
    workflow: "VehicleWorkflow"
  },

  storage: {
    bucket:    "vehicle-assets",
    retention: "forever",
    versioned: true,
    cache:     true
  },

  exporters: [
    { type: "PNG", enabled: true },
    { type: "PDF", enabled: true },
    { type: "SVG", enabled: true },
    { type: "ZIP", enabled: true }
  ],

  pricing: {
    plan:    "one_time",
    price:   29.99,
    credits: 0
  },

  ai: {
    reasoningModel: "gpt-5.5",
    imageModel:     "gpt-image",
    criticModel:    "gpt-5.5",
    maxAttempts:    3,
    temperature:    0.2
  },

  qa: {
    minimumScore:  92,
    autoFix:       true,
    humanApproval: true,
    rules: [
      "No graphics over number plate",
      "No graphics over headlights",
      "No graphics over tail lights",
      "No graphics over wheel arches",
      "Logo visible",
      "Phone readable",
      "Contrast AA",
      "Premium score >92"
    ]
  }
};
```

---

## App Lifecycle

```
Manifest Loaded
       ↓
Validate Dependencies
       ↓
Register Events
       ↓
Register Permissions
       ↓
Register Prompt Compiler
       ↓
Register Generator
       ↓
Register QA
       ↓
Ready
```

---

## Generation Lifecycle

```
Merchant
       ↓
Generate Van
       ↓
Capability Runtime
       ↓
Manifest Loaded
       ↓
Brand DNA Validation
       ↓
Prompt Compiler
       ↓
AI Orchestrator
       ↓
GPT Image
       ↓
Design Critic
       ↓
QA Engine
       ↓
Asset Store
       ↓
Brand Vault
       ↓
Publish Event
```

---

## Capability Registry

```ts
export interface CapabilityRegistry {
  install(manifest: StudioAppManifest):  Promise<void>;
  remove(id: string):                    Promise<void>;
  get(id: string):                       StudioAppManifest;
  list():                                StudioAppManifest[];
  findByStudio(studio: string):          StudioAppManifest[];
}
```

**Adding a new capability requires no code changes outside the capability itself — only a new manifest and its implementation.**

---

## Dependency Graph Example

```
Brand DNA
      ↓
Prompt Compiler
      ↓
Vehicle Studio
      ↓
Design Critic
      ↓
QA Engine
      ↓
Brand Vault
```

Vehicle Studio **never** talks directly to Print Studio, Website Studio, or Marketing Studio. It only publishes events such as `AssetGenerated` or `BrandUpdated`. Other Studios subscribe if they care.

---

## Final Architectural Principle

A Studio App Manifest is **the contract between the Trade OS kernel and every capability**. It should contain everything the runtime needs to know about an App — dependencies, inputs, outputs, permissions, AI configuration, pricing, QA, events, and exports.

The kernel should be able to install, validate, execute, monitor, and remove an App purely from its manifest, making the platform extensible without modifying the core runtime.

---

## Networkers-specific implementation notes

- **Refactor `src/lib/design/trade-os/runtime.ts::CapabilityManifest`** to match the sectioned `StudioAppManifest` shape once V1 is fully received.
- **Every existing App (`src/apps/*`) gets a manifest** using this shape — retrofit as we go, no big-bang rewrite.
- **Van Wrap App** becomes the reference implementation. Every other Studio App copy-adapts its manifest.
- **Capability Registry lives at** `src/lib/design/trade-os/registry.ts` — new file when V1 complete.
- **Runtime App discovery** — scan `src/apps/*/manifest.ts` at boot, validate, register. No hard-coded App list.
