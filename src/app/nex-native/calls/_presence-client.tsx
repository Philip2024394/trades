"use client";

// src/app/nex-native/calls/_presence-client.tsx
//
// Thin React wrapper around people-presence.ts. Mounts at the top of
// the Calls page client tree, maintains two sets (online + inCall),
// and exposes them via usePresence() + a context so avatars can
// paint the right rim colour.

import * as React from "react";
import {
  joinPeoplePresence,
  type PresenceSets,
} from "@/lib/nex-native/realtime/people-presence";

const PresenceContext = React.createContext<PresenceSets>({
  online: new Set<string>(),
  inCall: new Set<string>(),
});

export function PresenceProvider({
  viewerId,
  children,
}: {
  viewerId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [sets, setSets] = React.useState<PresenceSets>({
    online: new Set(),
    inCall: new Set(),
  });

  React.useEffect(() => {
    const dispose = joinPeoplePresence({
      accountId: viewerId,
      onChange: (next) => setSets(next),
    });
    return dispose;
  }, [viewerId]);

  return (
    <PresenceContext.Provider value={sets}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): PresenceSets {
  return React.useContext(PresenceContext);
}

export type PresenceKind = "online" | "busy" | "offline";

export function presenceFor(id: string, sets: PresenceSets): PresenceKind {
  if (sets.inCall.has(id)) return "busy";
  if (sets.online.has(id)) return "online";
  return "offline";
}
