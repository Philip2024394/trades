// Nex Global Intelligence — public barrel.

export type {
  ClarificationRequest,
  ClimateZoneLabel,
  CountryCode,
  CountryProfile,
  Evidence,
  TerminologyEntry
} from "./types";
export { evidenceFor } from "./types";

export { profileFor, supportedCountries } from "./profiles";
export { needsClarification } from "./clarification";
export { localize, localTerm } from "./terminology";

export {
  answerCountryProfile,
  answerGlobal,
  answerGlobalRegulation,
  classifyGlobalQuestion
} from "./answer";
export type { GlobalQuestion, GlobalRegulationInput, GlobalRegulationReply, GlobalRegulationTopic } from "./answer";
