// src/lib/nex/marketing/deliverability/index.ts
//
// NEX Deliverability Intelligence · public API
// Founder-authorised programme · Session-5 · Part 12 · 2026-09-21.

export * from "./types";
export {
  NULL_DOMAIN_CHECKER, computeAligned,
  loadDomainAuth, loadAllDomainAuth,
  recordDomainAuthCheck, refreshDomainAuth,
  type DomainAuthChecker, type DomainAuthCheckResult,
} from "./domain-auth";
export {
  classifyReputation,
  recomputeSenderReputation,
  loadSenderReputation,
} from "./reputation";
export {
  nextPermittedSend,
} from "./next-permitted-send";
export {
  classifyBounceEvent, weightForKind, DEFAULT_EVENT_WEIGHTS,
  _CLASSIFIER_NEVER_FABRICATES, _CLASSIFIER_NEVER_GUESSES_PROVIDER,
  _CLASSIFIER_UNSUBSCRIBE_NOT_COUNTED_AGAINST_REPUTATION,
  type ClassifiedEvent, type ClassifiedKind, type ProviderHint, type ClassifyInput,
  type EventWeights,
} from "./bounce-classifier";
export {
  recordClassifiedEvent, computeEventFingerprint, eventTypeFor, bounceTypeFor,
  _RECORDER_NEVER_FABRICATES, _RECORDER_NEVER_REVERSES_SUPPRESSION, _RECORDER_IDEMPOTENT_BY_FINGERPRINT,
  type RecordEventInput, type RecordEventOutcome,
} from "./event-recorder";
export {
  handleAuthenticatedWebhook,
  _HANDLER_REQUIRES_BOTH_GATES, _HANDLER_NEVER_TRUSTS_UNVERIFIED,
  _HANDLER_DELEGATES_TO_PROVEN_LAYERS,
  type HandleWebhookInput, type HandleWebhookResult,
} from "./webhook-handler";
export {
  verifyResend, verifySendGrid, verifySesSns, verifyMailgun, verifyPostmark,
  verifyProviderWebhook,
  _VERIFIER_MODULE_HAS_NO_ROUTE_HANDLER,
  _VERIFIER_FAILS_CLOSED_ON_MISSING_SECRET,
  _VERIFIER_NEVER_NETWORK_FETCHES,
  _VERIFIER_USES_CONSTANT_TIME_COMPARE,
  type WebhookProvider, type VerifyInput, type VerifyOutcome,
} from "./webhook-verifiers";
export {
  generateSendingSafetyReadinessReport,
  readVerifierReadinessFromEnv,
  readActivationGatesFromEnv,
  WEBHOOK_SECRET_ENV_KEYS,
  _READINESS_READ_ONLY,
  _READINESS_NEVER_LEAKS_SECRETS,
  _READINESS_NEVER_RETURNS_ADDRESSES,
  type SendingSafetyReadinessReport, type LayerState,
  type VerifierReadiness, type RecorderReadiness, type ReputationReadiness,
  type DomainAuthReadiness, type ActivationGatesReadiness,
} from "./readiness";
export {
  DnsDomainAuthChecker, createNodeDnsResolver,
  classifySpf, classifyDkim, classifyDmarc,
  COMMON_DKIM_SELECTORS,
  _DNS_CHECKER_IS_NOT_MODULE_DEFAULT,
  _DNS_CHECKER_FAILS_CLOSED_ON_ERROR,
  _DNS_CHECKER_ONLY_QUERIES_THREE_NAMESPACES,
  type DnsResolver, type DnsCheckerOptions,
} from "./dns-domain-auth-checker";
export {
  analyzeEmailContent,
  _ANALYSER_NEVER_BLOCKS_SENDS, _ANALYSER_NEVER_MODIFIES_CONTENT,
  _ANALYSER_NO_THIRD_PARTY_AI, _ANALYSER_NEVER_NETWORK_FETCHES,
  type ContentAnalysisInput, type ContentAnalysis, type ContentCheck, type CheckSeverity,
} from "./content-analyser";
export {
  computeNextRun, enumerateOccurrences, validateRecurrenceSpec,
  _RECURRENCE_NEVER_TRIGGERS, _RECURRENCE_NEVER_PERSISTS,
  _RECURRENCE_DETERMINISTIC, _RECURRENCE_RESPECTS_ENDS_AT,
  type RecurrenceSpec, type RecurrenceFrequency, type DayOfWeek,
  type NextRunOutcome, type EnumerateOptions, type EnumerateOutcome,
} from "./recurrence";
export {
  composeCampaignPreflight,
  _COMPOSER_NEVER_SENDS, _COMPOSER_NEVER_PERSISTS,
  _COMPOSER_FAIL_FAST_ON_REPUTATION_HOLD,
  _COMPOSER_NO_EMAIL_ADDRESSES_IN_OUTPUT,
  type CampaignPreflightInput, type CampaignPreflightOutcome, type PerVariantProjection,
} from "./campaign-preflight";
export {
  computeSuppressionProjection, SUPPRESSION_REASONS,
  _PREFLIGHT_NEVER_RETURNS_EMAILS,
  _PREFLIGHT_NEVER_UNSUPPRESSES,
  _PREFLIGHT_DETERMINISTIC_PRECEDENCE,
  _PREFLIGHT_HARD_BOUNCE_HIGHEST_PRECEDENCE,
  type SuppressionInputRow, type SuppressionProjection, type SuppressionReason,
} from "./suppression-preflight";
export {
  assignVariant, assignVariantsBatch, computeVariantStats,
  computeStatisticalSignificance, selectWinner,
  _AB_TESTING_NEVER_SENDS, _AB_TESTING_NEVER_PERSISTS,
  _AB_TESTING_DETERMINISTIC_ASSIGNMENT,
  _AB_TESTING_NEVER_CLAIMS_SIGNIFICANCE_BELOW_THRESHOLD,
  type VariantDefinition, type VariantAssignmentInput, type VariantAssignment,
  type VariantObservation, type VariantStats,
  type SignificanceInput, type SignificanceOutcome,
  type SelectWinnerInput, type WinnerOutcome, type MetricKey,
} from "./ab-testing";
export {
  computeSendSchedule, REPUTATION_CEILING_MULTIPLIER,
  _SCHEDULER_NEVER_SENDS, _SCHEDULER_NEVER_QUEUES,
  _SCHEDULER_REPUTATION_HARD_BLOCKS, _SCHEDULER_DETERMINISTIC,
  type SendSchedulerInput, type SendSlot, type SendScheduleOutcome,
} from "./send-scheduler";
export {
  CATEGORIES, buildAcceptanceMatrix,
  checkInvariantA, checkInvariantB, checkInvariantC,
  checkInvariantL_reputation, checkInvariantM_domainAuthNull,
  checkInvariantN_bounceClassifier, checkInvariantO_unsubscribeWeightZero,
  checkInvariantQ_recorderNoReverseSuppression,
  checkInvariantT_verifierDispatcher, checkInvariantV_readinessAggregator,
  checkInvariantX_dnsCheckerNotDefault, checkInvariantY_gatesStrictOn,
  checkInvariantZ_standingLine,
  _MATRIX_NEVER_CLAIMS_WORLD_PROOF_WITHOUT_GATES, _MATRIX_PURE_AGGREGATION,
  type AcceptanceCategory, type CategoryLetter, type CategoryState,
  type AcceptanceMatrixReport, type InvariantCheck,
} from "./acceptance-matrix";
