# NEX Internal Calling · Stage 1 Experiment Runbook

**Purpose**: prove two NEX identities can voice + video call each other with
WebRTC direct P2P, using only Google's public STUN and a tiny local signalling
server. Zero paid API. Zero VPS. Zero TURN.

**Stage 1 exit criterion**:

> Two NEX identities establish a real voice + video call directly, where
> NEX signalling carries ONLY the connection-setup messages (SDP + ICE)
> and media flows peer-to-peer. Measurement proves `path = p2p` or `srflx`.

If this passes, the incremental NEX infrastructure cost for calling is
essentially zero at any usage volume where P2P is achievable. TURN comes
later, only if measurements demand it.

---

## What's built

| File | Purpose |
|---|---|
| `scripts/nex-calling/signal.mjs` | HTTP + SSE signalling server · zero dependencies · port 8090 |
| `src/app/nex-calling/experiment/page.tsx` | Web client · identity picker · dial UI · live stats · event log |
| `src/lib/nex-calling/webrtc-client.ts` | RTCPeerConnection wrapper · public STUN only · no TURN |
| `src/lib/nex-calling/measurement.ts` | Browser stats collector · classifies media path |
| `scripts/nex-calling/report-experiment.mjs` | Aggregates the JSONL log · reports Stage 1 pass/fail |
| `data/nex-calling/call_events.jsonl` | Append-only event log · created on first hello |

No new npm dependencies. Two ephemeral dev identities (`alice-dev-uuid`,
`bob-dev-uuid`) hardcoded in the client. This is a technical experiment, not a
product launch.

---

## Running the experiment · step by step

### 1. Start the signalling server

In one terminal:

```bash
node scripts/nex-calling/signal.mjs
```

Expected output:
```
[nex-calling/signal] listening on http://localhost:8090
[nex-calling/signal] events → C:\...\data\nex-calling\call_events.jsonl
```

Verify it's up:
```bash
curl http://localhost:8090/health
```

### 2. Ensure the Next.js dev server is running

Already running on port 3008 in this session. If not:

```bash
npm run dev
```

### 3. Open TWO browser windows

- **Window A** (regular tab or one browser): `http://localhost:3008/nex-calling/experiment`
- **Window B** (incognito tab or a different browser): `http://localhost:3008/nex-calling/experiment`

Chrome + Firefox both work. Safari works too if you enable "Develop → WebRTC".

### 4. Pick identities

- In Window A → click **"I'm Alice"**
- In Window B → click **"I'm Bob"**

Both windows should now show:
- `alice-dev-uuid` (or `bob-dev-uuid`) as the current identity
- `2 online` in the top-right corner
- A green **"📞 Call bob-dev-uuid"** button (in Alice's window) and vice versa
- Local video preview showing your camera feed

Grant microphone + camera permission when prompted.

### 5. Make the call

- In Window A → click **"📞 Call bob-dev-uuid"**
- Window B → banner appears: **"Incoming call from alice-dev-uuid"**
- Window B → click **Accept**

Within 1-3 seconds:
- Both remote video panes should show the other side's camera
- Both should hear the other side's audio (headphones recommended to avoid feedback)
- The live stats panel should populate with:
  - `path: p2p` (green) OR `path: srflx` (cyan)
  - `state: connected`
  - Non-zero `bytes sent` / `bytes received` growing every 3 seconds

### 6. Verify the path

The green line to watch:

```
path: p2p      ← media flowed direct · STAGE 1 SUCCESS
path: srflx    ← media flowed via STUN-discovered address · still direct · SUCCESS
path: relay    ← media went through a TURN server · FAILURE (or would be Stage 2)
```

In Stage 1 you should ALWAYS see `p2p` or `srflx` because we've deployed no
TURN server. If media somehow ended up `relay`, that would be a bug (there's
no relay to relay through).

### 7. End the call

Either side clicks the red **"End call"** button. Both panes clear cleanly.

### 8. Read the aggregate report

In a terminal:

```bash
node scripts/nex-calling/report-experiment.mjs
```

Expected output when Stage 1 passes:

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  NEX Internal Calling · Stage 1 experiment report                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

Events file:          ...\data\nex-calling\call_events.jsonl
Total events:         48
Hello events:         2
Send events:          22 · of which bye: 1
Measurement events:   14
Distinct identities:  2 · [alice-dev-uuid, bob-dev-uuid]
Distinct calls:       1

── Path distribution (across measurement samples) ──
  p2p:     8
  srflx:   6
  relay:   0
  unknown: 0
  Relay share: 0.0% · NO TURN required so far

── Connection states seen ──
  new: 2
  connecting: 4
  connected: 8

── Per-call medians ──
  Bytes sent:     1,842,391
  Bytes received: 1,845,203
  Packets lost:   0
  Jitter (ms):    3
  RTT (ms):       12

═══════════════════════════════════════════════════════════════════════════
  ✓ STAGE 1 EXIT CRITERION MET
    1 call reached connectionState='connected'
    with path ∈ {p2p, srflx} · media bypassed NEX signalling.
    NEX transported ONLY signalling (SDP + ICE), not media.
═══════════════════════════════════════════════════════════════════════════
```

---

## Troubleshooting

### "Waiting for another NEX identity to come online…" and it never changes
- Second browser window didn't pick the other identity
- Signalling server not running (check `curl localhost:8090/health`)
- Firewall blocking `localhost:8090`
- Try refreshing both windows and picking identities fresh

### `path: unknown` in the stats panel
- Stats collector needs a fully-connected call · wait a few seconds
- If it stays `unknown` after `connected`, check the browser console for
  `getStats()` errors

### `connectionState: failed`
- ICE gathering failed · likely because both browsers are on the same NAT
  with a hairpin issue (uncommon on localhost)
- Restart both browser windows and retry
- If this happens repeatedly across networks, note it · it's exactly the data
  Stage 2 needs to decide TURN necessity

### `path: relay` — impossible in Stage 1
- Should never happen because no TURN server is configured
- If it does, check the ICE_SERVERS list in `webrtc-client.ts` — should be
  STUN-only

### No audio or video visible but path=p2p / connected
- Check browser mic/camera permission in the address bar
- Refresh, pick identity again, allow permissions
- Check that `getUserMedia({ audio: true, video: true })` succeeded (browser
  console)

---

## What this experiment measures

Every measurement snapshot (posted to the signalling server every 3-5s during
a call) is one line in the JSONL log with:

- `path`: p2p / srflx / relay / unknown · **the critical field**
- `connectionState`: RTCPeerConnection state
- `iceLocalType` · `iceRemoteType`: raw ICE candidate types (host/srflx/prflx/relay)
- `bytesSent` · `bytesReceived`: growing during the call · shows bandwidth
- `packetsLost` · `jitterMs` · `roundTripMs`: call quality
- `networkType`: wifi / cellular / ethernet / ... (when browser reports it)
- `audioCodec` · `videoCodec` · `videoResolution`: what WebRTC negotiated

The report script aggregates these into medians + a pass/fail verdict.

---

## What's NOT built (per Philip's Stage 1 scope lock)

- No TURN server
- No production VPS
- No BaaS
- No PSTN
- No business calling
- No subscription checks
- No callback requests
- No multi-staff routing
- No recording
- No Redis
- No user auth (dev identities hardcoded)
- No new database migrations
- No native mobile app
- No SFU
- No push notifications
- No production HTTPS (localhost only)

Stage 2 (add TURN) and beyond require measurement evidence to trigger · not
calendar time · not speculation.

---

## Success verdict

Stage 1 passes when the report script prints:

```
  ✓ STAGE 1 EXIT CRITERION MET
```

If it does, we've proven the fundamental claim: **NEX-to-NEX voice + video
calling costs NEX essentially zero infrastructure at any usage volume where
P2P works**. TURN becomes a purely reactive addition, only when real
measurement demands it.

If it doesn't · read the report carefully · the failure mode tells us
exactly what to fix. Do NOT jump to adding TURN. Diagnose the P2P failure
first.
