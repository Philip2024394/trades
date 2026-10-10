# chat-render · CORE + CHROME registry

**Sealed 2026-09-29 · Founder direction: 100+ themes without cross-contamination.**

## The problem this exists to solve

At Bridge 34 we had ONE `PortraitBloomShell` rendering every theme.
That worked at 5 themes. It won't work at 100. A single shell means:

- A bug in one theme's renderer breaks every theme
- Adding a wildly different layout (terminal / voice-first / photo-wall)
  requires forking the shell — the classic pattern that starts as
  "one small branch" and ends as five drifted shells that all forgot
  to encrypt payments the same way
- Two designers can never work on two themes in parallel without
  hitting the same file

## The doctrine

Split the render pipeline into TWO zones with a registry between them:

```
┌─────────────────────────────────────────────────────────────────┐
│  CORE   — never forked · one implementation for every theme      │
│           E2E decrypt · presence · WebRTC signalling ·           │
│           notifications · message plumbing · audit               │
├─────────────────────────────────────────────────────────────────┤
│  registry.ts  — maps layout_style → ChromeSet                    │
├─────────────────────────────────────────────────────────────────┤
│  CHROME — per layout · owned independently                       │
│           bubbles · sky_cards · timeline_ribbon · terminal ...   │
│           Each renders Header · Feed · Composer · ShopModal ·    │
│           ProductPage. Nothing security-critical lives here.     │
└─────────────────────────────────────────────────────────────────┘
```

**CORE is the constitution. CHROME is the wallpaper.**

## The seven rules

1. **CORE cannot be forked per theme.** Encryption, presence, WebRTC,
   notifications, audit are all in `core/`. A chrome MUST NOT ship
   a "just for this theme" variant of any of these.
2. **CHROME cannot weaken CORE invariants.** A chrome can render
   messages any shape it likes but cannot bypass the E2E decrypt
   step, cannot skip the audit log, cannot render an un-decrypted
   ciphertext. TypeScript enforces this by requiring the chrome to
   accept plaintext-only props.
3. **The registry is the only boundary.** Peer-chat page never
   imports a chrome directly — it always calls
   `resolveChromeSet(layoutStyle)` and renders what comes back.
4. **A new theme = new database row + a `layout_style` value.**
   No code change per theme. Colours + wallpaper travel with the
   catalogue row.
5. **A new layout = a new chrome folder + one registry entry.**
   Existing chromes are untouched. Wrong shape → typecheck fails,
   not production users.
6. **Feature flags scope by `(theme_id, feature_id)`.** When a
   feature (voice notes, mascot pack, reactions) is optional, an
   admin flips it per-theme. Wildcard `theme_id='*'` = apply to all.
   Table added in Phase 4.
7. **Doctrine changes go through migrations.** Adding a value to
   `nex_chat_theme.layout_style` requires a migration extending the
   CHECK constraint AND a chrome folder AND a registry entry.
   Missing any one blocks the deploy.

## The phased build

- **Phase 1** (this bridge) · scaffold + `bubbles` chrome delegates
  to today's `PortraitBloomShell` · registry resolves every layout
  to `bubbles` for now · zero behaviour change for existing themes.
- **Phase 2** · terminal chrome lifts from
  `src/app/nex-native/themes/cyber-grid/` into
  `chat-render/chrome/terminal/` · Cyber Grid users see the terminal
  layout on peer chat · every other theme continues to see bubbles.
- **Phase 3** · sky-cards and timeline-ribbon chromes lift from the
  preview pages into `chat-render/chrome/` · Theme 1 + Pink Dream
  users see their sealed designs on peer chat.
- **Phase 4** · `nex_theme_feature_flag(theme_id, feature_id,
  enabled)` table + admin surface for the "apply to all themes"
  lever.

## What lives where

| File | Contains | Forkable? |
|---|---|---|
| `contract.ts` | `ChromeSet` type · `CoreProps` type | No — a shared contract |
| `registry.ts` | `resolveChromeSet(layout_style)` | No |
| `core/` | E2E · presence · signalling · notifications | **Never** |
| `chrome/bubbles/` | The default renderer | Owned by design lead |
| `chrome/sky-cards/` | Night Sky renderer (Phase 3) | Owned per theme |
| `chrome/timeline-ribbon/` | Pink Dream renderer (Phase 3) | Owned per theme |
| `chrome/terminal/` | Cyber Grid renderer (Phase 2) | Owned per theme |

## Checklist for adding the 101st theme

1. Run the theme insert (SQL or admin builder): id, name, accent,
   wallpaper, `layout_style`.
2. If the `layout_style` value already exists in the registry:
   nothing else to do. Ship.
3. If it's a new layout: add `chrome/<name>/` folder, implement the
   `ChromeSet` contract, add one line to `registry.ts`. Add a
   migration extending the CHECK constraint.

## Non-goals

- We do not create a chrome per THEME. A chrome per LAYOUT. Many
  themes share one chrome (colour + wallpaper only).
- We do not add A/B testing infrastructure here. That belongs in
  feature flags, which is Phase 4.
- We do not lift business chat, group chat, or the manage surface
  into this registry — this is peer chat only for Phase 1-4.
