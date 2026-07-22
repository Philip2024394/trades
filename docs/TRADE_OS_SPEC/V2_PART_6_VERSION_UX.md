# Trade Operating System · Volume 2 · Part 6
## Version UX (Preview, Approval & Rollback)

**Audience:** Product Architects, UX Engineers, Frontend Engineers, AI Platform Engineers
**Source:** ChatGPT design-brief architecture series, V2 Part 6.

---

## Philosophy

The biggest frustration with AI design tools: **the AI changes something and you lose the version you liked.**

Professional designers never work this way. Adobe, Figma, and Git all teach the same lesson:

> **Never destroy work. Always create a new version.**

The Trade OS should feel like **GitHub for branding.**

---

## Core Principles

Every change must:

1. Never overwrite
2. Always create a new version
3. Show exactly what changed
4. Show what will be affected
5. Let the merchant approve or reject
6. Allow rollback forever

---

## Version Architecture

Every asset belongs to a Brand Version:

```
Brand v12
├── Logo v7
├── Colours v5
├── Typography v3
└── Photography v4
        ↓
Vehicle v18
Website v12
Business Card v10
Invoice v7
Social v5
```

**Nothing is edited in-place.**

---

## The Flow — Merchant Changes One Thing

Merchant changes Primary Colour Gold → Navy.

**System does NOT regenerate immediately.** Instead it analyses.

### Dependency Engine

```
Colour Changed
       ↓
Dependency Graph
       ↓
Assets Using Primary Colour
       ↓
18 Assets Found
```

Result — full affected list surfaced:

Van Wrap · Website · Business Card · Invoice · Email Signature · Pull-up Banner · Polo Shirt · Hoodie · Yard Sign · Facebook Banner · Instagram · App UI · Quote Template · Letterhead · Fleet Vehicle · Trailer · Window Decals · Presentation.

---

## Preview Screen (never regenerate silently)

```
────────────────────────────────────────────
Brand Update

Primary Colour
Gold → Navy

18 Assets will change
────────────────────────────────────────────

[View All]  [Approve All]  [Select Individually]  [Cancel]
```

**No surprises.**

### Grid Preview

Cards for each affected asset with Before / After thumbnails + individual approve checkbox.

### Before / After Slider

Every asset supports drag-slider comparison, exactly like professional photo software.

### Side-by-Side Mode

Alternative to the slider. Two panels: OLD | NEW.

---

## AI Summary (above the previews)

```
Creative Director

I've updated:
  ✓ Primary colour
  ✓ Gradient overlays
  ✓ Button colours
  ✓ Vehicle graphics
  ✓ Icons
  ✓ Background panels
  ✓ Website theme

Brand Health  96 → 98
```

Merchant understands what happened.

---

## Asset Selection

Merchant decides which assets to regenerate:

```
☑ Van
☑ Website
☑ Cards
☑ Invoice
☐ Facebook
☐ Hoodie
☐ Trailer
```

**Nothing forced.**

---

## Estimated Cost + Time

```
Selected     9 Assets
Estimated    42 seconds
Cost         Included
```

Reassures the merchant before firing.

---

## Regeneration Queue

`Queued → Generating → AI Review → QA → Ready`

Show progress per asset.

---

## AI Review Score (per generated asset)

```
Vehicle         98
Website         97
Invoice        100
Business Card   96
```

If below 92 threshold → **Auto Improve loop kicks in.** Merchant never sees poor work.

---

## Publish Screen

```
9 Assets Ready

Publish?

[Publish]  [Review Again]  [Download]
```

---

## Version Timeline (Git-style)

```
Today       v18   Colour Gold → Navy   Approved
Yesterday   v17   Phone Updated
Last Week   v16   Logo Improved
```

---

## Asset History (per asset)

Opening Van shows:

```
Van v18   Today   Approved   ★★★★★

[Open]  [Duplicate]  [Rollback]  [Export]  [Compare]
```

---

## Rollback UX

Merchant regrets a change → clicks **Rollback** → choose version:

```
v18   Today
v17   Yesterday
v16   Monday
v15   Last Week
```

### Compare Any Versions (not just previous)

Compare v12 vs v18. Diff shows: Colour Changed · Logo Changed · Typography Same · Layout Changed · Photography Same.

### Rollback Confirmation

```
Restore Vehicle to v15?

Nothing is deleted.
A new version (v19) will be created.

[Restore]
```

**Critical: Rollback never deletes. Rollback creates a new version.**

### Version Graph

```
v1 → v2 → v3 → v4 → [Rollback to v2] → v5
```

Git-style. Linear by default; branch only for advanced users.

---

## Auto Suggestions

Merchant changes logo → system prompts:

```
Would you also like to update
  ☐ Website
  ☐ Van
  ☐ Workwear
  ☐ Business Cards
```

Smart.

---

## Preview Badge

Every affected asset shows **"Needs Update"** (never "Outdated" — friendlier).

---

## Notification Centre

- Vehicle Updated
- Website Ready
- Business Cards Approved
- Brand Health Improved
- Printer Pack Ready

---

## Merchant Confidence — always answer these six

1. **What changed?**
2. **Why?**
3. **Can I undo?**
4. **What is affected?**
5. **How long?**
6. **What will it cost?**

If those six answers exist, support tickets fall dramatically.

---

## Version Data Model

```ts
interface Version {
  id:             string;
  assetId:        string;
  brandVersion:   string;
  createdBy:      string;
  createdAt:      Date;
  parentVersion:  string;
  reason:         string;
  approved:       boolean;
  published:      boolean;
  score:          number;
}

interface VersionDiff {
  field:       string;
  oldValue:    unknown;
  newValue:    unknown;
  reason:      string;
  confidence:  number;
}
```

Example diff:

```
Primary Colour   Gold → Navy
Reason           Merchant Request
Confidence       100%
```

---

## Approval Workflow

```
Merchant
    ↓
Change Brand
    ↓
Dependency Engine
    ↓
Affected Assets
    ↓
Generate Preview
    ↓
AI Review
    ↓
Merchant Review
    ↓
Approve
    ↓
Publish
    ↓
Store Version
    ↓
Brand Vault
```

---

## Bulk Approval (agencies + Owner tier)

```
Approve All · Reject All · Select All · Invert Selection
```

Huge time saver.

---

## Signature Feature — Brand Impact Map

Instead of saying "18 assets affected", show a **visual relationship graph**:

```
                    Brand Colour
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
      Van             Website         Business Card
        │                 │                  │
        ▼                 ▼                  ▼
   Fleet Van        Landing Page      Invoice
        │
        ▼
   Trailer
```

Clicking any node opens a live preview of that asset.

**Turns version control from a technical feature into something every merchant instantly understands.**

---

## Three Regeneration Modes

### 1. Safe Refresh (default)
Keeps layout · Updates colours, logo, text, typography · Fast · Lowest risk.

### 2. Smart Refresh
Keeps brand · AI may improve spacing, hierarchy, image cropping, composition · Best for most users.

### 3. Creative Refresh
Generates multiple new design concepts while preserving Brand DNA · Ideal for merchants wanting a fresh look without starting over.

**Gives merchants confidence** because they control how much AI is allowed to change, reducing the fear of losing a design they already like.

---

## Networkers-specific implementation notes

- **Dependency Engine** is the killer piece. Computed from the App Manifest's `requiredBrandFields` (V1 Part 3) — every App declares which brand fields it depends on. Reverse-index those to find "who is affected when field X changes".
- **Brand Version + Asset Version** map to `hammerex_brand_snapshots` (already exists) + a new `hammerex_asset_versions` table (add in this slice) with `parent_version` for the Git-style graph.
- **Preview grid + before/after slider** = new component `src/components/studio/vault/ChangePreviewGrid.tsx`, mounted in the Version UX flow. Uses cached recipes to render both before and after without expensive regeneration until approved.
- **Auto Improve loop** activates when Design Critic (V3 Q12) scores <92. Regenerates with feedback ≤3 attempts (per Van Wrap manifest `qa.autoFix: true` + `ai.maxAttempts: 3`).
- **Brand Impact Map** rendered as SVG force-directed graph (D3 or React Flow). Non-blocking for MVP — can start as a simple list, upgrade to graph in Phase 2.
- **Three Regeneration Modes** exposed as a toggle before the Preview screen. Passes to the Prompt Compiler as a `regeneration_mode` field on the SDS. Compiler adjusts prompt template accordingly.
- **Rollback = new version.** Enforced at the DB level — no UPDATE, no DELETE on version rows. Same pattern as `hammerex_events` from V1 Part 4.
