// src/app/nex-app/live/page.tsx
//
// NEX · Phase D · City Live "What's Happening?" surface
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §11 §12
//
// In-shell city discovery layer · lives under /nex-app/ (the phone
// frame) rather than /nex-live/ (the bezel chassis) so the user never
// feels ejected from the NEX phone app.
//
// Sections: LIVE NOW / STARTING SOON / TONIGHT
// Categories: All / Music / Food / Gym / Events (only chips with real
//   fixtures render — never fabricated).
//
// Server wrapper · client component owns the fetch and state.

import { CityLiveClient } from "./CityLiveClient";

export const dynamic = "force-dynamic";

export default function CityLivePage() {
  return <CityLiveClient defaultCity="yogyakarta" defaultCityLabel="Yogyakarta" />;
}
