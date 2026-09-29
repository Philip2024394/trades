"use client";

// src/app/nex-native/chat/peer/[accountId]/_device-key-hub.tsx
//
// Bridge 74 · Ensure this device has a keypair + its public key is
// registered on the server. Mounted once on the peer chat page so it
// runs opportunistically whenever the user opens a conversation.
//
// Design:
//   · Fire-and-forget on mount · never blocks the chat UI
//   · Idempotent · ensureDeviceKey() reads the existing IDB record
//     on subsequent calls · the server upsert refreshes last_seen_at
//   · Ships nothing user-visible · this is invisible plumbing that
//     Bridges 75-78 will consume to encrypt/decrypt messages
//
// Not scoped to peer chat conceptually — every nex-native page could
// mount this. For B74 first cut we mount only on peer chat because
// that's where E2E will land. A global mount can move up to the app
// shell in a follow-up.

import * as React from "react";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "@/lib/nex-native/crypto/device-key";
import { upsertDeviceKeyAction } from "../../../_actions";

export interface DeviceKeyHubProps {
  /** Skip if the caller is unauthenticated · avoids a wasted
   *  action call that would just error with not_signed_in. */
  disabled?: boolean;
}

export function DeviceKeyHub(props: DeviceKeyHubProps): null {
  React.useEffect(() => {
    if (props.disabled) return;
    let cancelled = false;
    (async () => {
      try {
        const dev = await ensureDeviceKey();
        if (cancelled) return;
        const fd = new FormData();
        fd.set("device_id", dev.deviceId);
        fd.set("public_key", publicKeyBase64(dev.publicKey));
        const res = await upsertDeviceKeyAction(fd);
        if (!res.ok) {
          // Log-only · not user-facing. E2E isn't yet wired to
          // send/receive, so a failure to register the key is invisible
          // to the buyer today. Once Bridge 76 lands, we'll surface a
          // "secure chat unavailable" banner when this fails.
          // eslint-disable-next-line no-console
          console.warn("[nex device-key]", res.error);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          "[nex device-key] ensure failed:",
          (e as Error).message,
        );
      }
    })();
    return () => { cancelled = true; };
  }, [props.disabled]);

  return null;
}
