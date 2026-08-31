# ADR-0100 · NEX Internal Calling Architecture

**Status**: PROPOSED · awaiting review
**Date**: 2026-08-27
**Decision-maker**: Philip
**Author**: Chief Architect
**Constraint**: DO NOT BUILD until reviewed and approved.

## 1. What we are building

A **closed NEX-to-NEX** voice and video calling network. Every participant is a
NEX identity. There is no phone number. There is no PSTN. There is no external
provider.

The primary success metric:

> **Can 10,000 NEX users make voice/video calls to each other without NEX
> paying any per-minute provider?**

Answer: **YES**, using self-hosted WebRTC infrastructure.

## 2. Non-goals (explicitly banned)

| Banned | Why |
|---|---|
| PSTN interconnect | Regulated by BRTI · Kominfo · out of scope |
| Twilio / Agora / Daily / Vonage / any BaaS | Vendor lock · per-minute cost · not needed |
| Phone number dialling | Not a phone service |
| International outbound | Same reason |
| Call recording (default) | Consent-heavy · defer forever unless explicitly requested |
| Group calling (initial) | 1:1 first · group is a distinct architecture (SFU) |
| Screen sharing (initial) | Complexity vs value poor at MVP |
| Video effects/filters | Client concern · defer forever |

## 3. Identity model

A caller is identified by their **NEX user id** (UUID from the existing user
directory). Not a phone number. Not an email. The internal calling protocol
never resolves any external identifier.

Business endpoints are **NEX business ids** with a `calling_config` gate. The
gate is FALSE by default. Only a paid subscription flips it on.

```
Caller identity: {user_id: uuid, display_name, avatar}
Callee identity: {user_id: uuid} OR {business_id: uuid, target_staff_ids: [uuid]}
```

The signalling layer only knows NEX identities. It never touches phone numbers.

## 4. High-level dataflow

```
┌──────────────┐     signaling (WSS · 1-2KB per call)      ┌──────────────┐
│  Caller app  │──────►┌────────────────────┐◄─────────────│  Callee app  │
│  (mobile/web)│       │  NEX Signal server │              │  (mobile/web)│
│              │◄──────│   (Node.js WSS)    │─────────────►│              │
└──────┬───────┘       │  · SDP relay       │              └──────┬───────┘
       │               │  · ICE candidates  │                     │
       │               │  · presence        │                     │
       │               │  · call routing    │                     │
       │               └────────┬───────────┘                     │
       │                        │                                 │
       │                Redis (presence + routing)                │
       │                Postgres (call history + config)          │
       │                                                          │
       │         DIRECT P2P (media flows directly · 70-75%)       │
       ├──────────────────────────────────────────────────────────┤
       │                                                          │
       │                TURN fallback (25-30%)                    │
       │        ┌─────────────────────────────────────┐           │
       └───────►│  NEX TURN (coturn · Singapore VPS)  │◄──────────┘
               └─────────────────────────────────────┘
```

Only signalling touches NEX servers by default. Media stays peer-to-peer unless
NAT/firewall traversal fails.

## 5. Component-by-component

### 5.1 NEX identity → caller lookup

- User taps "Call Alice" · client sends `{callee_id: alice_uuid}` to signalling
- Signalling looks up Alice's online presence in Redis
- If online → forward INVITE via her existing WebSocket
- If offline → send VoIP push to her registered devices → she opens app → WSS
  connects → INVITE delivered
- Business calls resolve to `{business_id → [staff_user_ids]}` and INVITE all
  staff devices simultaneously

Zero phone-number resolution. Zero PSTN. Just NEX id → NEX id.

### 5.2 Online / offline presence

- Redis key per user: `presence:{user_id}` · TTL 60s · refreshed by heartbeat
- Client sends heartbeat every 30s over the persistent WSS
- Signalling reads presence at call-INVITE time
- Presence broadcast (pub/sub) so contacts see status changes

Cost at 10K users: negligible · ~500 concurrent WS connections · single Redis
instance handles millions of ops/sec.

### 5.3 Signalling

**Node.js WebSocket server** (single VPS, 2-4 GB RAM · Hetzner or DO). Handles:

- User registration / auth handshake
- Heartbeat / presence updates
- INVITE / RINGING / ACCEPT / DECLINE / BYE messages
- SDP offer/answer relay
- ICE candidate exchange
- Ends session cleanly on hangup

Traffic per call: **1-2 KB total signalling**. Even at 100K calls/day this is
under 1 GB/day of signalling traffic. Trivial.

Scaling: single node handles 30K concurrent WS. Beyond that, add nodes behind a
sticky-session load balancer. Not needed until well past 10K users.

### 5.4 WebRTC negotiation

Standard WebRTC handshake:

1. Caller creates RTCPeerConnection with STUN + TURN configuration
2. Caller creates SDP offer · sends via signalling
3. Callee creates SDP answer · sends back via signalling
4. Both sides gather ICE candidates · exchange via signalling
5. ICE finds the best path: `host` (direct LAN) → `srflx` (NAT-traversed via STUN)
   → `relay` (through TURN) — winner selected automatically
6. DTLS-SRTP handshake · media flows

The client library (browser native or `react-native-webrtc`) does all of this.
NEX's signalling server is just a message relay during handshake.

### 5.5 Direct P2P path

**The goal**: media never touches NEX servers.

Success rate expectations:
- Both on same Wi-Fi network: ~99% direct P2P
- Both on home broadband (different networks): ~80% direct
- Both on Indonesian mobile carriers (CGNAT symmetric NAT): ~30-50% direct
- Mixed home/mobile: ~60-70% direct

**Blended expectation for Indonesian users: ~70% of calls are pure P2P**. Zero
NEX bandwidth cost for those.

### 5.6 TURN fallback

When ICE can't establish direct path, media relays through NEX TURN.

**Software**: `coturn` (open source · widely deployed · rock solid).
**Deployment**: 1 × 4-8 GB VPS in Singapore (closest low-latency point to
Indonesia). Adds Jakarta TURN when concurrent relayed calls > 100.

**Bandwidth cost is the ONE real variable cost**:
- Voice-relay: ~64 kbps × 2 directions = 128 kbps per relayed call · ~1 MB per
  2-min call
- Video-relay: ~1000 kbps × 2 = 2 Mbps per relayed call · ~30 MB per 2-min call

TURN capacity: coturn on a 4 GB VPS handles ~500 concurrent relayed calls
comfortably. At 10K users we expect ~5-15 concurrent relayed calls at peak.
Massive headroom.

### 5.7 Voice

- **Codec**: Opus at 24-32 kbps (adaptive)
- **DTX** (discontinuous transmission): silence not sent · cuts real bandwidth 40%
- **Effective bandwidth**: 20-30 kbps per direction typical
- **Latency budget**: <150ms end-to-end (single-region TURN in Singapore achieves this)
- **Quality on 3G**: still crisp (Opus is that good)

### 5.8 Video

- **Codec**: VP8 primary (universal · efficient at low bitrate), H.264 fallback
  (mobile hardware acceleration)
- **Resolution ladder**: 640×360 default · 1280×720 on Wi-Fi · 320×240 on 3G
- **Bandwidth budget**: 400-1000 kbps per direction
- **Simulcast**: send low + medium streams · receiver picks based on downlink
- **Voice-only auto-fallback**: if measured downlink < 150 kbps for 5 sec →
  video pauses, voice continues, UI shows "Video paused · poor connection"
- **Wi-Fi ↔ mobile handover**: ICE restart · 3-5 sec blip · call survives

### 5.9 Call history

- One row per call in `nex.call_record`:
  - id, caller_user_id, callee_user_id (or callee_business_id + staff)
  - started_at, answered_at, ended_at, duration_sec
  - media_type (voice/video), quality_mos (client-reported)
  - route (p2p / turn_relayed)
  - end_reason (bye / no_answer / busy / decline / failed)
- Postgres · millions of rows fit fine on the existing NEX database

### 5.10 Missed calls

- Callee offline OR unanswered after N seconds → row is written with
  `end_reason='no_answer'`
- Push notification sent to callee's devices with "Missed call from Alice"
- Callee sees missed call in call history · can tap to call back
- Business missed calls surface in the business dashboard

### 5.11 Blocking / reporting

- `nex.call_block` table: `{blocker_user_id, blocked_user_id, blocked_at, reason}`
- Signalling checks block relationship before ringing
- Blocked caller sees "Call failed" · no signal of why (privacy)
- Report abuse in-call: freezes user pending review · captured in
  `nex.abuse_report`

### 5.12 Authentication

- Reuse existing NEX user auth (session cookie or token)
- Signalling accepts WSS connections only with valid NEX session
- Every call is server-signed (signalling adds `{caller: {id, name, avatar}}`
  to INVITE) so callee can't be spoofed
- TURN uses short-lived credentials (per-call · 5-min lifetime) generated by
  signalling · TURN never accepts random clients

### 5.13 Abuse protection

| Layer | Protection |
|---|---|
| Signup | Verified NEX identity required |
| Signalling | Rate limit: 10 calls/hour/user · Redis counter |
| Signalling | Rejected-call cooldown: 5 rejections in 30 min → 1h calling ban |
| Client | Rapid-dial CAPTCHA: 5+ calls in 60s |
| Business config | Optional whitelist: business can require prior message before call |
| Signalling | End-to-end DTLS-SRTP · no cleartext audio in transit |
| Client | Report-in-call button · immediate account freeze pending review |

### 5.14 Bandwidth monitoring

- Client reports connection stats every 5 sec during call:
  - measured downlink · uplink · packet loss · jitter · RTT
  - current codec + bitrate
  - route (p2p / turn)
- Server aggregates for analytics · trigger auto-degrade rules
- Data written to `nex.call_stats` (rolling · aggregated after 24h)

### 5.15 Infrastructure requirements

| Component | Size | Cost/mo |
|---|---|---|
| Signalling server (Node.js WSS) | 2 GB VPS · Hetzner | $8 |
| TURN server (coturn · Singapore) | 4 GB VPS + bandwidth | $15 base + bandwidth |
| Redis (presence + routing) | Shared with existing NEX Redis | $0 (reuse) |
| Postgres (call history) | Existing `nex_dev` database | $0 (reuse) |
| Push (FCM Android · APNS iOS) | Google · Apple free tiers | $0 |
| Domain + TLS certificates | Existing NEX domain + Let's Encrypt | $0 |

Base infrastructure: **~$25/month** (before TURN bandwidth · which is the only
usage-driven cost).

## 6. Cost model at scale

### Bandwidth assumptions
- 30% of calls are TURN-relayed (conservative for Indonesian carriers)
- Average voice call: 2 minutes · ~2 MB relayed per call
- Average video call: 2 minutes · ~60 MB relayed per call
- Video calls are 10-20% of total calls (voice dominates)

### 100 users
- ~5 calls/day (early adopters)
- 30% TURN = 1.5 relayed calls/day
- Bandwidth: <100 MB/month
- **Total: $25/month** (base only · TURN bandwidth negligible)

### 1,000 users
- ~200 calls/day (~5% daily active x 4 calls each)
- 30% TURN = 60 relayed calls/day
- Bandwidth: ~5 GB/month voice + ~15 GB video = 20 GB/mo
- Hetzner bandwidth: ~$2/mo
- **Total: $27/month**

### 10,000 users
- ~2,000 calls/day
- 30% TURN = 600 relayed calls/day
- Bandwidth: ~50 GB voice + ~150 GB video = 200 GB/mo
- Hetzner bandwidth: ~$20/mo
- **Total: $45/month**

### 100,000 users (design headroom)
- ~20,000 calls/day
- Same relay ratio
- Bandwidth: ~2 TB/month
- Additional TURN node in Jakarta (add $15/mo · reduces latency)
- Additional signalling node (add $8/mo)
- **Total: ~$100/month**

### The per-user cost table

| Scale | NEX infra $/mo | User count | Per-user $/mo |
|---|---|---|---|
| 100 | $25 | 100 | $0.25 |
| 1,000 | $27 | 1,000 | $0.027 |
| 10,000 | $45 | 10,000 | $0.0045 |
| 100,000 | $100 | 100,000 | $0.001 |

Compare to BaaS (Agora at ~$0.001/min voice + $0.005/min video):
- 10K users: BaaS ~$255/mo · self-hosted $45/mo. **Self-hosted 5.7x cheaper.**
- 100K users: BaaS ~$2,550/mo · self-hosted $100/mo. **Self-hosted 25x cheaper.**

**At any realistic scale, self-hosted wins by a factor of 5-25x.**

### The only variable NEX pays for
- **TURN bandwidth**. Everything else is fixed.
- User pays their own mobile/Wi-Fi data (on both sides · P2P or relayed)

## 7. What the business calling gate looks like

Schema sketch (**DO NOT CREATE**):

```
nex.business_calling_config
├── business_type (poly · services/food/accommodation/marketplace)
├── business_ref  (poly key into the target table)
├── voice_enabled BOOL default false     -- unlocked by subscription tier
├── video_enabled BOOL default false     -- unlocked by higher tier
├── opening_hours JSONB                  -- {mon:{start,end}, tue: ...}
├── staff_user_ids UUID[]                -- who receives calls · empty = nobody
├── require_prior_message BOOL default true  -- spam gate
├── monthly_voice_minutes_used INT
├── monthly_video_minutes_used INT
├── subscription_tier TEXT               -- FK to subscription table
```

Rule: `voice_enabled=false` and `video_enabled=false` are the default on every
row. Only subscription upgrade flips these to true. Discovery ≠ Calling.

## 8. Unclaimed-business callback requests (novel idea)

For unclaimed business listings, tapping "Call" opens a callback-request flow:

- User types a short message: "I want to book a dental appointment"
- Row inserted into `nex.callback_request` with `{business_ref, from_user_id, message, created_at}`
- Business owner discovers requests when they claim + upgrade
- Dashboard shows: "You have 15 potential customers waiting"
- Upgrade to reply unlocks messaging → converts to voice → converts to video

This turns the Call button on unclaimed listings into a **conversion driver**
rather than a dead end.

## 9. Poor-Indonesian-network strategy

Already handled by the standard WebRTC stack, with these tuning choices:

- Opus at 24 kbps floor for voice · works on 2.5G if needed
- Video codec: VP8 (best low-bitrate quality) · H.264 fallback for iOS hardware
- Simulcast enabled: sender emits low + medium streams
- Automatic voice-only fallback: downlink < 150 kbps for 5 sec → video pauses
- Aggressive TURN geo-location: Singapore for latency <80ms to Jakarta/Bandung/Bali
- ICE restart on network change (Wi-Fi ↔ mobile handover): 3-5 sec blip · call survives

## 10. Client platform priority

Ship order (my recommendation):

1. **Web** (Chrome / Safari / Firefox on desktop and mobile browsers) — proof of stack
2. **Android** (React Native · ConnectionService + FCM high-priority push)
3. **iOS** (React Native · CallKit + PushKit + APNS VoIP topic)

Rationale: web is the fastest signalling proof. Android second because push is simpler than iOS. iOS third because CallKit+PushKit approval process eats calendar time.

## 11. What NOT to build

Explicit reminders:

- **No PSTN.** Ever.
- **No BaaS.** Ever.
- **No group calls (initial).** 1:1 first.
- **No screen sharing.** Defer forever if we can.
- **No call recording default.** Consent complexity. Defer.
- **No video effects/filters.** Client concern · defer.
- **No custom TURN implementation.** Use `coturn`.
- **No custom STUN.** Use Google's public STUN.
- **No always-on background service.** Battery hostile · use VoIP push.
- **No SIP/RTP interop.** WebRTC only.
- **No voicemail (MVP).** Text message + callback request cover it.

## 12. Phased implementation plan (post-approval)

| Milestone | Scope | Weeks |
|---|---|---|
| M0 | Approve architecture (this document) | 0 |
| M1 | Signalling server + web client · voice · user↔user | 2 |
| M2 | Video added · adaptive bitrate · voice-only fallback | 1 |
| M3 | Android app · VoIP push · CallKit-alternative UI | 3 |
| M4 | iOS app · PushKit + CallKit · APNS VoIP topic | 4 |
| M5 | Business calling gate · subscription check · dashboard | 2 |
| M6 | Multi-staff routing · business hours · callback requests | 2 |
| M7 | Analytics · MOS scoring · abuse detection · block list | 1 |
| **Total** | | **~15 weeks with 1 focused developer** |

## 13. Success criteria

- 10K users can make voice + video calls to each other with no per-minute cost
  to NEX beyond a Hetzner VPS
- Median call setup time < 2 seconds
- Median voice quality > 4.0 MOS
- Video calls succeed on Indonesian 4G (>80% completion rate)
- Business subscription gate is auditable · never fires for a business without
  paid tier
- Zero PSTN / third-party dependency

## 14. Open questions requiring your decision before M1

1. **Voice-first or voice+video simultaneous MVP?**
2. **Web-first or mobile-first?**
3. **Callback-request for unclaimed businesses · ship at MVP or v2?**
4. **Pricing tier ladder · use my proposed shape or different?**
5. **Multi-staff routing at MVP or v2?**
6. **Recording posture · permanent no · or leave door open?**

## 15. Constitutional checks

- Discovery ≠ Outreach: **calling gate is FALSE by default** on every business
  row · only paid subscription unlocks
- Provider-independent-not-provider-evasive: **fully self-hosted stack** · no
  external providers to be independent of
- Discovery ≠ Calling permission: **enforced by `voice_enabled` / `video_enabled`
  boolean flags** on `business_calling_config`
- Never fake activity: all call records are real DB rows · presence is real
  Redis state · no simulated calls

## 16. Recommendation

**Approve this architecture in principle**. Answer the 6 open questions.

Then proceed to M1 (2 weeks) which produces a working web-based voice-calling
prototype between two NEX users. Everything after M1 is incremental and
reversible.

No code is being written until approval. This document is the entire deliverable.
