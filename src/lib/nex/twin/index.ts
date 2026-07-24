// Nex Digital Twin — public barrel.

export type {
  Evidence,
  ScenarioDelta,
  ScenarioKind,
  ScenarioResult,
  SimulationReply
} from "./types";
export { NO_PERSIST_DISCLAIMER, evidenceFor } from "./types";

export {
  runAdvertisingBoost,
  runExtraHire,
  runFuelIncrease,
  runPriceRise,
  runVanPurchase
} from "./scenarios";
export type { AdvertisingBoostInput, ExtraHireInput, FuelIncreaseInput, PriceRiseInput, VanPurchaseInput } from "./scenarios";

export { formatSimulation, runSimulation } from "./simulate";
export type { SimulationInput } from "./simulate";

export { answerTwin, classifyTwinQuestion } from "./answer";
export type { AnswerTwinInput, TwinQuestion } from "./answer";
