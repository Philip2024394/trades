// NEX App Builder · Chat · barrel export (Philip 2026-08-14).

export { routeIntent, listStarterTemplates, getStarterTemplateById } from "./intent-router";
export type { StarterTemplate, IntentRouteResult } from "./intent-router";

export { generateNextQuestion } from "./question-generator";
export type { ChatQuestion } from "./question-generator";

export { applyFact } from "./fact-applier";
export type { FactApplyResult } from "./fact-applier";
