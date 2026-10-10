# NEX Settings Header · Account-Gate Doctrine

**Sealed 2026-10-10 · branch `nex/directory-work` · founder-authored requirement.**

> "Users must have account created to see the settings buttons in header
> — meaning Settings button has 3D lock icon until user has created
> account. When clicked, if account not created, will see pop-up window
> to create account to use all features on NEX application."

---

## 1 · Why GATE instead of HIDE

The Settings button is a **feature-reveal**, not a navigation restructure.
Hiding the button for anonymous visitors would silently remove a core
affordance from the header — users would not know Settings exists until
they signed in, which is a chicken-and-egg trap: new users see nothing
inviting them to create an account from the chrome.

The LOCKED state is **the gate itself**. The button is always rendered,
always visible, always tappable — tapping a locked button is the primary
entry point into onboarding for someone who has already explored the
app and now wants to configure it.

**Load-bearing rule:** `SettingsHeaderSlot` NEVER returns `null`. The
first paint is always the LOCKED state (safe default on the server
render), then the client hydrates and upgrades to the UNLOCKED gear if
the account-exists probe confirms a `nex_account` row.

## 2 · Why the 3D-lock icon

A locked padlock is the only universally-recognised "you must unlock
this" symbol in UI design — more immediately legible than an exclamation
mark, a key, or a text badge. The 3D treatment (gradient body + offset
shadow + metal shackle) gives the icon enough visual presence to be
read even at 18px in a crowded header.

The icon uses the SAME physical dimensions as its sibling header icons
(home / search / gear) so the gate changes **meaning** without changing
**geometry** — the UI never shifts.

## 3 · Why amber, not red

Red is reserved for the **Emergency** surface (sealed
`EMERGENCY_PALETTE.emergency = #DC2626`). The gate must NOT alarm the
visitor; it signals "create an account to unlock", not "forbidden /
dangerous". Amber (sealed in `account-gate/_palette.ts` as a gradient
`#FFC46B → #FF8A2A → #C85A00`) reads as "gated / optional unlock" and
sits comfortably on the NEX dark-navy header without competing with the
cyan outlines of the sibling buttons.

## 4 · Two prompt variants

| Variant                | Trigger                                                        | Primary CTA copy  |
|------------------------|----------------------------------------------------------------|-------------------|
| `anonymous`            | No Supabase auth session · no `nex_account` row                | "Create account"  |
| `signed_in_no_account` | Supabase auth session exists but no `nex_account` row yet      | "Finish setup"    |

Both variants route to the SAME canonical onboarding entry
(`/nex-native/create-account`). The variant switch is a copy change
only — it prevents the "Create account" wording from feeling misleading
to someone who already has a sign-in in flight.

In the current sealed app this signed-in-no-account window is extremely
narrow because `resolveNexAppSessionFromContext` auto-provisions on
first resolve (sealed `session.ts` behaviour). The variant is still
exposed as architectural correctness: if a future flow decouples
sign-in from account creation (e.g. "verify email first, create
profile later"), the UI copy already handles it.

## 5 · Single source of truth · `readAccountExists`

`src/lib/nex-native/account-gate/account-exists-reader.ts` is the ONLY
authorised place that reduces the sealed `NexAppSession` to the two
booleans the gate needs:

```ts
{ accountExists: boolean, signedInWithoutAccount: boolean }
```

Rules:

1. **Safe-default on error.** If the resolver throws, we return
   `{ accountExists: false, signedInWithoutAccount: false }`. The LOCK
   stays on. The user retains the "create account" path.
2. **No caching.** Auth state can change per-request.
3. **Never leaks resolver internals.** The API route
   `GET /api/nex/account-gate/exists` exposes the two booleans and
   nothing else — no account id, no email, no supabase user id.
4. **Lazy session-module import.** The reader dynamically imports
   `app/session.ts` inside the function body so test runs (which inject
   a stub via `deps.resolveSession`) do not trigger
   `supabase-admin.ts`'s env-var hard-fail at module-load time.

## 6 · Dismiss semantics · per-tap, not per-session

Tapping "Not now" closes the modal and does nothing else. No
localStorage. No cookie. No DB row. Re-tapping the locked Settings
button reopens the modal.

**Why:** the gate is a feature-reveal, not a nag. A user who dismisses
once may genuinely want to create an account on their fifth tap after
exploring other surfaces. Persistent dismissal would mute the
onboarding path for exactly the users who need it most.

**What the gate is NOT:**
- Not a "banner that stops bothering you after N views".
- Not a "didn't check 'show again'" preference.
- Not a cookie-backed opt-out.

## 7 · Only Settings is gated · no other header entries change

The brand wordmark, Home icon, and Search icon are untouched. The only
difference between the pre-gate and post-gate header is the SETTINGS
slot. This is a **targeted feature-reveal**, not a navigation
restructure.

- NEX wordmark still routes to `/nex-native` (session-aware).
- Home icon still routes to `/nex-native/home`.
- Search icon still routes to `/nex-native/search`.
- The sealed Vault icon (where present on the Vault shell) is NOT in
  scope — Vault has its own identity gate at the Vault setup flow.
- The sealed Emergency Help entry (where present on Settings itself)
  is NOT in scope — Emergency is a Settings sub-surface, not a header
  entry.

## 8 · Why `SettingsHeaderSlot` is a client component (not SSR prop-drill)

The shared `NexPageHeader` is imported by at least one `"use client"`
consumer today:

```
src/app/nex-native/calls/_calls-client.tsx:16
  import { NexPageHeader } from "../_page-header";
```

Making the header `async` and importing `server-only` modules through
it would break that client-module bundle (and any future client
module that renders the header). Instead:

1. `NexPageHeader` remains **synchronous**.
2. The Settings slot is a self-contained client component
   (`SettingsHeaderSlot`) that fetches the gate state from
   `GET /api/nex/account-gate/exists` on mount.
3. First paint is always the LOCKED state (safe default). On probe
   success the slot swaps to the UNLOCKED Link for signed-in users.

This preserves the sealed header contract while delivering the gate
without regressing any client-component caller.

## 9 · Settings-page behaviour is independent

The sealed `/nex-native/settings` page itself still runs
`resolveNexAppSessionFromContext()` and redirects anonymous visitors to
`/nex-native/sign-in`. The header-level gate is a UX feature-reveal, NOT
a security control. If a user bypasses the header and navigates to
`/nex-native/settings` directly, the page-level auth check still fires.

This separation is intentional: the header gate exists to tell new
users "Settings exists, create an account to unlock it", while the
page-level auth exists to enforce access. They are two independent
guard-rails.

## 10 · Known adjacent blockers (NOT in scope · documented)

As of 2026-10-10, the dev server at `localhost:3008` returns 500 on
every `/nex-native/*` route due to a pre-existing compile error in
`src/app/nex-native/liked/page.tsx:69` (the `const sp = await searchParams`
line is declared twice). This blocks the end-to-end Playwright scenario
until the duplicate declaration is removed. The scenario file at
`tests/e2e/nex-settings-account-gate.spec.ts` is complete and will
exercise the full flow once the dev server renders.

Also observed (pre-existing, out of scope):
- `src/components/nex-native/directory/CountryPicker.test.tsx` has 3
  assertions that reference a flag-badge render path the component no
  longer takes (it now renders a globe icon). These failures are
  independent of the account-gate work.

## 11 · Load-bearing invariants · do NOT violate

- Settings-slot is NEVER hidden. The LOCK is the gate.
- Safe-default on probe error → LOCKED. Never silently unlock.
- The 3D lock icon is INLINE SVG · no external asset · no network fetch.
- The modal uses `role="dialog" aria-modal="true"` with focus-trap, Esc,
  and backdrop-close.
- Dismiss is per-tap, not persistent.
- Only the Settings header entry gains the gate · home/search/wordmark
  are untouched.
- Only `/nex-native/create-account` is the onboarding destination · do
  NOT invent a new sign-up route.
- The sealed Vault / Emergency Help / Directory / Chats surfaces are
  untouched.
