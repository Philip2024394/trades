// Platform SDK — install/uninstall passthrough.
//
// These are direct re-exports of the Runtime verbs. The SDK adds no
// behaviour — install/uninstall are already authoritative at the
// Runtime layer. Consumers can equally well call runtime.installApp
// directly; exposing them here means Apps that need to trigger
// installs (AI recommender, referral bundles) have one import path.

import { runtime } from "../runtime";

export const installApp = runtime.installApp;
export const uninstallApp = runtime.uninstallApp;
export const getInstalledApp = runtime.getInstalledApp;
export const listActiveInstalls = runtime.listActiveInstalls;
