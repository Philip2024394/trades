// Xrated Design System — component registrations barrel.
//
// Importing this module side-effect-registers every component with the
// Design System registry. Studio's picker, the AI recommender, and the
// preview harness all consume the registry populated by this barrel.
//
// New component:
//   1. Create the file under `components/<category>/<name>.tsx`
//   2. Call `designSystemRegistry.register(...)` at module top level
//   3. Add one import line here — nothing else on the platform changes

// ─── Typography ────────────────────────────────────
import "./typography/h1";
import "./typography/paragraph";

// ─── Buttons ───────────────────────────────────────
import "./buttons/primary";
import "./buttons/whatsapp";

// ─── Containers ────────────────────────────────────
import "./containers/single-column";

// ─── Cards ─────────────────────────────────────────
import "./cards/product";

// ─── Placeholder categories (populated as needed) ─
// Forms, Navigation, Sections, Media will register components here
// as they are built. Empty categories don't break the registry — they
// simply return [] from listByCategory.

export {};
