// Clarification — decide when Nex should ASK instead of guessing.
//
// Rule (per Phase 21 vision):
//   • If the resolved location.source is 'engine_default' → ask.
//   • If it's 'ip_fallback' AND the question is about regulations
//     → ask (IP is too weak for a legal-touching reply).
//   • Everything else proceeds silently with the resolved country.

import { supportedCountries } from "./profiles";
import type { ClarificationRequest } from "./types";
import type { LocationContext } from "../world/types";

export type NeedsClarificationInput = {
  location:      LocationContext;
  /** True when the caller is about to quote regulation guidance. */
  is_regulatory: boolean;
};

export function needsClarification(input: NeedsClarificationInput): ClarificationRequest | null {
  const src = input.location.source;
  if (src === "engine_default") {
    return {
      reason:  "I don't have your country on file yet — nothing to fall back to.",
      choices: supportedCountries()
    };
  }
  if (input.is_regulatory && src === "ip_fallback") {
    return {
      reason:  "For a regulation reply I need something firmer than IP — please confirm the country.",
      choices: supportedCountries()
    };
  }
  return null;
}
