// NEX Comms Centre · Social · shared types.
//
// Phase 0 · foundation only. Types for tenants, roles, accounts,
// publish intents, and audit events land here. Post-generation and
// analytics types are deferred to later phases.
//
// Doctrine: `docs/NEX_SOCIAL_ENGINE_CHARTER.md` (v0.1) +
// `docs/NEX_SOCIAL_ENGINE_CHARTER_v0.2_PROPOSAL.md`.

export type TenantId = string;                  // UUID · S-I
export type UserId   = string;                  // reserved for future Nex user identity

export type TenantKind = "hq" | "trade";
export type TenantStatus = "active" | "suspended" | "deleted";

export interface Tenant {
  tenant_id:    TenantId;
  kind:         TenantKind;
  slug:         string;
  display_name: string;
  country:      string | null;
  status:       TenantStatus;
  created_at:   string;
  updated_at:   string;
}

// Roles per charter §S-V + Nex-admin roles per §0 Boundary 3.
export const SOCIAL_ROLES = [
  "owner",
  "admin",
  "marketing_manager",
  "staff",
  "viewer",
  "agency_manager",
  "nex_admin_support",
  "nex_admin_publish",
] as const;
export type SocialRole = typeof SOCIAL_ROLES[number];

export interface RoleGrant {
  grant_id:   string;
  tenant_id:  TenantId;
  user_id:    UserId;
  role:       SocialRole;
  granted_by: UserId | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  reason:     string | null;
}

// Platforms · adapter identity string. `simulator` is the Phase 0
// non-provider adapter used for boundary tests. Real providers arrive
// in Phase 5 under strict isolation (S-II).
export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "google_business",
  "simulator",
] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export type AccountStatus =
  | "pending"
  | "connected"
  | "attention_required"
  | "expired"
  | "revoked"
  | "disabled";

export interface SocialAccount {
  account_id:            string;
  tenant_id:             TenantId;
  platform:              SocialPlatform;
  display_name:          string | null;
  platform_account_id:   string | null;
  scopes:                string[];
  status:                AccountStatus;
  connected_at:          string | null;
  last_success_at:       string | null;
  last_error:            string | null;
  token_expires_at:      string | null;
  granted_by:            UserId | null;
  created_at:            string;
  updated_at:            string;
  // Encrypted token blobs never travel to the UI. Serialisers strip
  // these fields at the API boundary.
}

// Publish intent · S-VII two-phase idempotency.
export type PublishIntentStatus =
  | "in_flight"
  | "verified_published"
  | "verified_no_op"
  | "failed"
  | "abandoned";

export interface PublishIntent {
  intent_id:        string;
  tenant_id:        TenantId;
  post_id:          string;
  platform:         SocialPlatform;
  account_id:       string;
  retry_epoch:      number;
  status:           PublishIntentStatus;
  provider_marker:  string | null;
  provider_post_id: string | null;
  attempts:         number;
  lease_owner:      string | null;
  lease_expires_at: string | null;
  started_at:       string;
  verified_at:      string | null;
  error:            string | null;
}

// Audit event · append-only. `event_type` is a free-form string but
// callers must use the SocialAuditEventType union below where possible
// so downstream analyses can pivot on a stable vocabulary.
export type SocialAuditEventType =
  | "tenant.created"
  | "tenant.updated"
  | "role.granted"
  | "role.revoked"
  | "account.connected"
  | "account.attention_required"
  | "account.revoked"
  | "controls.global_pause_enabled"
  | "controls.global_pause_disabled"
  | "publish.intent_inserted"
  | "publish.verified"
  | "publish.no_op"
  | "publish.failed"
  | "admin.cross_tenant_read";

export interface SocialAuditEvent {
  audit_id:     string;
  tenant_id:    TenantId;
  event_type:   SocialAuditEventType | (string & { readonly __brand?: "custom" });
  actor:        string;
  subject_kind: string | null;
  subject_id:   string | null;
  details:      Record<string, unknown>;
  created_at:   string;
}

// Global controls · singleton row.
export interface SocialControls {
  global_pause:        boolean;
  global_pause_at:     string | null;
  global_pause_by:     string | null;
  global_pause_reason: string | null;
  updated_at:          string;
}

// Admin-readable resource kinds · must match nex.social_admin_readable_resource enum.
export const ADMIN_READABLE_RESOURCE_KINDS = [
  "account_status_only",
  "audit_event_summary",
  "publish_intent_summary",
] as const;
export type AdminReadableResourceKind = typeof ADMIN_READABLE_RESOURCE_KINDS[number];
