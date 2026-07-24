# ES-04 · Security & Compliance Deep-Dive · Outline

**Draft outline · 2026-07-23**
**Purpose:** engineering + compliance blueprint for the security surface that gates Workforce V0 launch. Full document to be produced Week 2 of Phase 0 Preparation.

**Relationship to prior docs:** ES-01 §8 covered security at architectural level. ES-04 goes to implementation depth. ADR-0016 (Memory Privacy), ADR-0019 (Workforce Trust), ADR-0020 (Honesty Framework) inform the compliance surface.

---

## Sections planned

### Section 1 · Authentication + Identity
- Supabase Auth baseline (email · magic link · OAuth)
- MFA policy per tier (2FA required Business+; optional Starter/Professional)
- Session token rotation (7d refresh, 24h access)
- SSO strategy for enterprise (SAML · SCIM deferred to Y2 per ES-10)
- API tokens (PATs) for merchant server-to-server integrations · 90d rotation policy

### Section 2 · Authorization + RBAC
- 3-role model for V0 (Owner · Manager · Member) per ES-01 correction #13
- Permission matrix per module × action × scope
- RLS policy templates for tenant tables
- Application-layer double-check pattern
- Custom roles at Business tier (V1+)
- Impersonation for admin (per Pre-Launch Implementation Plan C-17)

### Section 3 · Data Encryption
- Transit: TLS 1.3 minimum
- At rest: Supabase default AES-256
- Application-layer encryption for PII columns (customer names · addresses · phones · financial memory)
- Key management via Supabase Vault
- Rotation policy per key type

### Section 4 · Secrets Management
- Vercel + Supabase secrets stores
- Rotation schedules (90d API keys · 24h temp tokens · annual encryption keys)
- Access audit
- Emergency rotation procedures

### Section 5 · API Security
- Rate limiting (per tier per endpoint class · Redis sliding window)
- CORS + CSRF protection
- Input validation via Zod at every boundary
- Output sanitisation
- OWASP Top 10 checklist per critical/high risk slice ship

### Section 6 · Tenant Isolation
- RLS policies mandatory on every tenant table
- Application-layer scope check (belt + braces)
- Cross-tenant read exceptions (Memory rollups) K-anonymity gated per ADR-0016
- Automated tests verify tenant isolation

### Section 7 · Prompt Injection Protection
- Merchant text sanitisation before LLM injection
- Structured prompt templates keep user text in slots
- System instructions compiled-in
- Prompt injection attempts logged + rate-limited
- Adversarial evaluation quarterly (500+ red-team prompts per ES-01 §14.8)

### Section 8 · GDPR + Regional Privacy
- Data portability (structured export · signed URL · 7d expiry) — Phase 0 deliverable
- Right to be forgotten (cascade delete · rollup regen · legal retention floor) — Phase 0 deliverable
- Consent management (opt-in per memory category per ADR-0016)
- Cross-tenant contribution consent recorded + revocable
- Cross-jurisdiction handling (UK DPA · GDPR · IE DPA · AU Privacy Act · US state laws Y2+)

### Section 9 · Audit Logs
- Immutable per-merchant audit log (`hammerex_nex_platform_audit_log`)
- Retention per jurisdiction (24 months hot · 10 years cold typical)
- Exportable in JSON/CSV
- Legally admissible

### Section 10 · SOC2 Readiness
- Type 1 target: end Y2
- Type 2 target: end Y3
- Structured logs · principle of least privilege · encryption everywhere
- Annual penetration test
- Vendor management (Anthropic · OpenAI · Supabase · Vercel)

### Section 11 · AI Safety
- Model outage graceful degradation (per ES-01 correction #14) — Phase 0 deliverable
- Content safety filter on outward-facing AI drafts
- Confidence threshold + human approval for high stakes
- Model cost cap per merchant per day
- Adversarial evaluation of Trade Brains (quarterly)

### Section 12 · Construction-Specific Compliance
- 6-12 year data retention for construction contracts (Twin data)
- Insurance-safe evidence chain (Twin events immutable timestamps)
- Building Control audit export
- Regulator-safe data export patterns

### Section 13 · Backup + Disaster Recovery
- Supabase PITR (24h default · 90d extended for Business+)
- Daily full snapshots cross-region
- Weekly encrypted exports to independent provider
- Quarterly restore test
- RTO 4h · RPO 15 min

### Section 14 · Incident Response
- Sev-1/Sev-2 blameless post-mortem within 48h
- Runbook per service
- On-call rotation (Y1 in-hours · Y2 rotating · Y3+ dedicated SRE)

### Section 15 · Sign-off Requirements
- CTO
- Legal Counsel
- Data Protection Officer (if appointed)
- CEO for critical-risk slices

---

## Immediate deliverables that ES-04 will produce

1. RBAC permission matrix concrete
2. RLS policy templates for every new tenant table
3. GDPR portability + RTBF workflow specifications
4. Model outage fallback ladder per capability
5. Consent management schema + UI flows
6. Terms of Use draft (Legal Counsel · not engineering)
7. Adversarial evaluation prompt bank (initial 500+ prompts)

---

**Full ES-04 document to be written Week 2 of Phase 0 Preparation with Legal Counsel input.**
