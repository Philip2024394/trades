# ADR-0100a · NEX Internal Calling · Minimum-Cost Doctrine (Amendment)

**Status**: PROPOSED · awaiting review
**Amends**: ADR-0100 · sections 6 (cost model) and 12 (phased plan)
**Date**: 2026-08-27
**Author**: Chief Architect at Philip's direction
**Constraint**: DO NOT BUILD until reviewed and approved.

---

## Why this amendment exists

ADR-0100 proposed a "$40-60/month for 10,000 users" self-hosted stack. Philip's
correction: **that number is a target, not a starting point.** We do not
deploy $40-60/month of infrastructure on day one. We deploy the smallest
possible thing, measure real usage, and only scale when the data demands it.

This amendment locks the minimum-cost doctrine and rewrites the staging plan.

---

## 1. Locked principles (final · these are constitutional)

1. **NEX → NEX only.** NEX account/UUID → NEX account/UUID. Nothing else.
2. **No phone numbers.**
3. **No PSTN.** Ever.
4. **No external calling provider.** No Twilio, no Agora, no Daily, no Vonage,
   no per-minute API charges.
5. **Media goes directly between users whenever possible.** WebRTC P2P first.
6. **NEX signalling server only handles connection setup.** Never carries media
   when P2P works.
7. **TURN is added later, only when measurement proves it is required.** Not on
   day one.
8. **Reuse existing NEX infrastructure**: auth, database, presence, monitoring.
9. **Users' devices pay the normal mobile/Wi-Fi data cost.** NEX pays only the
   infrastructure needed to broker connections.
10. **Measure before buying.** Deploy nothing on speculation.
11. **Voice + video are the same system.** One WebRTC connection, video track
    is toggleable. Not two implementations.
12. **Paid NEX businesses become NEX calling endpoints via the same system.**
    No separate business calling stack.
13. **Free/unclaimed businesses never ring.** Callback-request only until they
    upgrade.

Constitutional rule: **`voice_enabled` and `video_enabled` are FALSE by default
on every business row.** Only subscription upgrade flips them.

---

## 2. What this amendment supersedes in ADR-0100

- Section 6 (Cost model at scale) — REPLACED by staged model in section 5 below
- Section 12 (Phased implementation plan) — REPLACED by Stage 1/2/3 in section 4
- Section 13 (Success criteria) — REPLACED per stage in section 6

All other sections of ADR-0100 remain in force (identity model · signalling
shape · WebRTC negotiation · voice codec · video codec · abuse protection ·
authentication · business calling gate · callback-request feature).

---

## 3. What "minimum NEX infrastructure cost" actually means

| Cost item | Who pays | Fixed or variable? |
|---|---|---|
| Signalling server VPS | NEX | Fixed (tiny) |
| TURN server VPS | NEX (Stage 2+) | Fixed base + variable bandwidth |
| Postgres storage of call records | NEX | Fixed (reused from existing NEX DB) |
| Redis presence tracking | NEX | Fixed (reused from existing NEX Redis if present) |
| Push notifications (FCM/APNS) | NEX | $0 |
| P2P media bandwidth | Users (own data plans) | N/A to NEX |
| TURN relay bandwidth | NEX (when relayed) | Variable · only bill when TURN used |
| Software (WebRTC libs, coturn, Node.js) | Open source | $0 |
| App development time | Development team | Not infrastructure cost |

**The only variable NEX pays is TURN relay bandwidth.** Everything else is either
fixed (VPS · reused infra) or paid by users (their own devices' data).

Stage 1 has no TURN. Therefore Stage 1's variable NEX cost is **zero**.

---

## 4. Staging plan (replaces ADR-0100 section 12)

### Stage 1 · Near-zero-cost prototype

**Goal**: prove two real NEX identities can voice + video call each other with
minimum possible infrastructure.

**What NEX deploys**:
- ONE signalling server on the cheapest practical VPS (Hetzner CX11 or
  equivalent · $4-8/month)
- Uses Google's public STUN (`stun:stun.l.google.com:19302`) — free
- **NO TURN server** — if a call can't establish P2P, it fails and we record
  the failure for measurement
- Reuses existing NEX Postgres for call history table
- Reuses existing NEX Redis for presence (if NEX has Redis; otherwise
  in-memory presence in the signalling process until real load requires Redis)
- Reuses existing NEX auth session for signalling handshake

**Client work**:
- Web client (browser WebRTC)
- Voice + video toggle on the same call surface
- Standard controls: mute · camera on/off · speaker · end · connection
  quality indicator · reconnect
- All UI stubs on the business cards (`📞 Call` / `🎥 Video`) that were shipped
  in the previous UI turn become live buttons dialling into this system

**What is instrumented from day one**:
- Every call attempt → row in `nex.call_record`
- Result: `p2p_success` / `p2p_failed_would_need_turn` / `signalling_error` /
  `authentication_error` / `callee_offline` / `callee_declined` / `user_ended`
- Per-call stats: measured downlink/uplink, packet loss, jitter, codec, resolution
- Per-network-type stats: what kind of network was each side on (Wi-Fi, cellular)

**What we defer explicitly**:
- TURN server (Stage 2)
- Mobile apps (Stage 3 or later · web first)
- Multi-staff business routing (v2 feature)
- Callback-request for unclaimed businesses (small · could ship late Stage 1)

**Stage 1 monthly NEX cost**: **$4-8** (one small VPS).

**Stage 1 exit criteria** (all must pass before Stage 2):
1. At least 100 real calls placed between real NEX identities
2. P2P success rate measured across at least 3 different networks
3. Call-record data reveals the true failure modes
4. UI/UX friction points identified from real user feedback

If P2P success rate is above ~80%, Stage 2 (TURN) may not even be necessary
yet. Continue measuring.

---

### Stage 2 · TURN reliability layer

**Trigger**: measured P2P failure rate high enough to hurt real users (rule of
thumb · >20% of attempted calls fail because P2P can't establish). NOT a
calendar date. Data drives this.

**What NEX deploys**:
- ONE `coturn` instance on a small VPS in Singapore (Hetzner CX21 · 4 GB ·
  $9/month base · plus bandwidth)
- Signalling server gets updated to include NEX TURN in the ICE server list
- Short-lived TURN credentials issued by signalling (5-min lifetime per call)
- Client-side ICE gathers TURN candidates as fallback

**What is instrumented**:
- Per-call route: `p2p` / `turn_relay`
- TURN bytes transferred per call
- TURN success rate (of the calls that couldn't do P2P, did TURN save them?)
- Monthly TURN bandwidth aggregate

**Stage 2 monthly NEX cost**: **$4-8 (signalling) + $9-15 (TURN base) + TURN
bandwidth**. TURN bandwidth is directly proportional to relayed-call minutes.
At 100 relayed voice calls/day of 2 min each: ~6 GB/month · ~$0.60. Video
increases this: 100 relayed video calls/day of 2 min each: ~180 GB/month · ~$18.

Realistic Stage 2 cost floor: **$15-25/month** when TURN is genuinely being used.

---

### Stage 3 · Scale on measured demand

**Trigger**: measurable, sustained load approaching current capacity. Not
speculation.

**What we might add**:
- Second TURN instance in Jakarta (cuts latency for Java Island users)
- Second signalling node behind a sticky-session load balancer
- Redis (if we hadn't already needed it) for cross-signalling-node routing
- Regional TURN when we have users outside Indonesia

**None of this happens until measurement shows it's required.** Stage 3 is
open-ended · we iterate as usage grows.

**Never** in Stage 3:
- SFU · MCU · BaaS · PSTN · vendor lock

---

## 5. Cost model per stage (replaces ADR-0100 section 6)

| Stage | Trigger | Signalling | TURN | NEX cost/mo (est.) |
|---|---|---|---|---|
| **Stage 1** | Day 1 · prototype | 1 tiny VPS ($4-8) | none · Google STUN only | **$4-8** |
| **Stage 2** | Measured >20% P2P failure | Same | +1 coturn Singapore ($9-15 base + bandwidth) | **$15-25** |
| **Stage 3** | Sustained load near capacity | +1 signalling node | +1 TURN Jakarta | **grows with real load** |

**Not** "$40-60/month for 10K users." Stage 1 is 100 or 1,000 or 10,000 users
depending on when we hit Stage 2's trigger. If P2P works well enough for our
users, we may never leave Stage 1's cost floor.

---

## 6. Success criteria per stage (replaces ADR-0100 section 13)

**Stage 1 success** (must reach before Stage 2):
- Two real NEX identities have completed at least one voice + one video call
- Web client works on Chrome + Safari on desktop and mobile browsers
- P2P success rate measured across at least 3 network combinations
- Signalling latency < 500ms
- At least 100 calls recorded with full stats

**Stage 2 success**:
- P2P failure calls now succeed via TURN
- TURN relay adds < 100ms to end-to-end latency
- TURN bandwidth measured and within predicted range
- Call quality metrics (MOS) stable

**Stage 3 success**:
- Concurrent-call capacity scales with real user growth
- No calls fail because of NEX-side capacity limits
- Regional latency improvements measurable when TURN nodes added

---

## 7. What we STILL don't build (reaffirmed)

Unchanged from ADR-0100 · listed here to prevent scope creep in the smaller
Stage 1:

- No PSTN
- No BaaS (Twilio · Agora · Daily · Vonage · anything per-minute)
- No group calls at MVP
- No SFU / MCU
- No screen sharing
- No call recording default
- No PSTN interconnect
- No mobile-native apps at Stage 1 (web first)
- No always-on background service (VoIP push comes at Stage 3 with mobile apps)
- No custom TURN implementation (use `coturn`)
- No custom STUN (use Google's public STUN)
- No voicemail

---

## 8. Response to Philip's principles (verbatim mapping)

Philip's message → what changes in this doctrine:

| Philip's principle | Implementation |
|---|---|
| "NEX → NEX only" | Locked. Section 1 principle 1. |
| "No phone numbers" | Locked. Section 1 principle 2. |
| "No PSTN" | Locked. Section 1 principle 3. |
| "No Twilio/Agora/etc." | Locked. Section 1 principle 4. |
| "No paid per-minute calling service" | Locked. Enforced by refusing any BaaS. |
| "NEX identity/UUID is the only destination" | Locked. Signalling never resolves phone numbers. |
| "Voice + video are both core NEX features" | Locked. Same WebRTC connection · video is a toggleable track. |
| "WebRTC handles the actual media" | Locked. NEX signalling never touches media. |
| "NEX owns the signalling layer" | Locked. Self-hosted Node.js WSS. |
| "Self-host TURN only when P2P cannot connect" | Locked. Stage 2 trigger is measured P2P failure. Stage 1 has no TURN. |
| "Users' phones carry the normal call bandwidth/data cost" | Locked. P2P calls consume users' own data on both sides. |
| "NEX pays only the infrastructure needed to make the connection work" | Locked. Signalling + optional TURN. Nothing more. |
| "Start extremely small and measure actual usage before adding infrastructure" | Locked. Stage 1 is one tiny VPS. Nothing else deployed. |
| "Reuse existing NEX infrastructure" | Locked. Postgres · auth · (Redis if available). |

---

## 9. Constitutional check

- **Discovery ≠ Outreach**: unchanged · calling gate is `voice_enabled` /
  `video_enabled` = FALSE by default on every business row
- **Provider-independent-not-provider-evasive**: fully compliant · zero external
  providers to depend on
- **Discovery ≠ Calling permission**: enforced by business subscription tier
  check before UI shows call buttons on business cards
- **Never fake activity**: every call is a real DB row · every failure is
  categorised · no simulated calls · no fabricated stats
- **Cutover 5 acquisition freeze**: not affected · calling is a new subsystem ·
  doesn't touch acquisition
- **Minimum-cost doctrine**: replaces speculative capacity planning · every
  infrastructure decision waits for measurement

---

## 10. What "not building yet" means concretely for THIS session

- No code committed for signalling
- No VPS provisioned
- No TURN configuration
- No coturn binary installed anywhere
- No `nex.call_record` migration
- No `business_calling_config` migration
- No push notification credentials registered
- No changes to production auth or existing tables

The only calling-adjacent code that HAS shipped is the placeholder UI:
`📞 Call` / `🎥 Video` buttons on business cards with a slider that says
"NEX Internal Calling · coming soon." Those buttons are cosmetic hooks · they
do not call anything.

---

## 11. Open questions requiring your decision

The 6 questions from ADR-0100 section 14 still stand:

1. **Voice-first or voice+video simultaneous MVP?**
   Philip's revised guidance: build them together (same WebRTC connection ·
   video toggleable). ADR-0100a **adopts this** unless overridden.

2. **Web-first or mobile-first?**
   Philip's Stage 1 is implicitly web-first (browser WebRTC · no push
   infrastructure needed at Stage 1). Confirmed?

3. **Callback-request for unclaimed businesses · at Stage 1 or later?**

4. **Pricing tier ladder — approved shape?**

5. **Multi-staff routing at MVP or v2?**

6. **Recording posture — permanent no, or leave the door open?**

Plus **new questions specific to this amendment**:

7. **What defines the Stage 1 → Stage 2 trigger precisely?** I proposed
   "measured >20% P2P failure rate over 100+ calls." Philip picks the exact
   threshold.

8. **Reuse of existing NEX Redis?** Do we have a NEX Redis instance today, or
   does Stage 1 signalling use in-process presence until real load demands
   external state?

9. **Which NEX auth do we hook into for the signalling WSS handshake?** The
   directory pages use `getFoodDbPool()` and don't seem to require user login
   today · calling requires a real NEX user identity. Is there an existing
   NEX user table + session mechanism, or does calling require us to design
   the user auth first?

Answer these before Stage 1 begins.

---

## 12. Ship recommendation

**Approve this amendment in principle**. Answer the 9 questions in section 11.
Then Stage 1 becomes a discrete work package (one small VPS · signalling
server + web client) that we can scope precisely once the reuse questions
are settled.

Do NOT proceed to Stage 1 until:
- ADR-0100 + ADR-0100a are approved
- Questions 1-9 are answered
- We agree on the Stage 1 measurement dashboard shape

Total work in this session: two ADR documents (0100 + 0100a) + placeholder UI
buttons on business cards. Nothing else touched. No infrastructure spun up.
No database changes.

---

## 13. Contractual promises to Philip

By adopting this doctrine, NEX commits to:

- Never deploy TURN before measurement demands it
- Never sign a BaaS contract for calling · ever
- Never route media through NEX servers when P2P is possible
- Never bill users for calls · they pay their own data · we pay only the
  infrastructure needed to broker connections
- Measure every call · every failure · every network combination · publish
  the numbers · scale infrastructure only when the numbers warrant it
- Grow costs proportionally to real usage · never speculatively

The primary success metric restated in Philip's own words:

> **Make the first 10,000 NEX users cost almost nothing in incremental calling
> infrastructure, with costs growing only when actual usage requires it.**
