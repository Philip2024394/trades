// Platform SDK — slot resolution.
//
// Thin re-export of the Runtime's slot conventions. Apps that render
// into a specific slot (e.g. footer) can query "am I currently in
// this slot on this page?" without duplicating the resolution logic.

import { runtime } from "../runtime";

export const slotsForPage = runtime.slotsForPage;
export const resolveSlot = runtime.resolveSlot;
export const resolveSlotAll = runtime.resolveSlotAll;
export const KNOWN_SLOT_NAMES = runtime.KNOWN_SLOT_NAMES;
