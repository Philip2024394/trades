// src/lib/nex/social/social-store.test.ts
//
// NEX Social · state helpers tests · Phase Social

import { describe, it, expect, beforeEach } from "vitest";
import {
  readSaved, saveProfile, unsaveProfile, isSaved,
  readPending, sendInvite, findPendingByProfile, resolveInvite,
  readFriends, isFriend,
  readDiscoveryCategory, writeDiscoveryCategory,
  SOCIAL_STORAGE_KEYS,
  type SocialProfileRef,
} from "./social-store";

beforeEach(() => {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  (globalThis as unknown as { window?: { localStorage: typeof stub } }).window = { localStorage: stub };
});

const alex: SocialProfileRef = {
  id: "u_alex", first_name: "Alex", city: "Yogyakarta",
  photo_url: null, business_info: "Motorcycle Workshop",
};
const river: SocialProfileRef = {
  id: "u_river", first_name: "River", city: "Bali",
  photo_url: null, business_info: null,
};

describe("social-store · storage keys stable + namespaced", () => {
  it("all keys share nex.social. prefix · never collide", () => {
    for (const key of Object.values(SOCIAL_STORAGE_KEYS)) {
      expect(key).toMatch(/^nex\.social\./);
    }
    const unique = new Set(Object.values(SOCIAL_STORAGE_KEYS));
    expect(unique.size).toBe(Object.values(SOCIAL_STORAGE_KEYS).length);
  });
});

describe("social-store · saved profiles (§14 · private · idempotent)", () => {
  it("empty on fresh install", () => {
    expect(readSaved()).toEqual([]);
    expect(isSaved(alex.id)).toBe(false);
  });
  it("saveProfile is idempotent · saving twice does not duplicate", () => {
    saveProfile(alex);
    saveProfile(alex);
    expect(readSaved()).toHaveLength(1);
  });
  it("unsaveProfile removes only the target · leaves others intact", () => {
    saveProfile(alex);
    saveProfile(river);
    unsaveProfile(alex.id);
    expect(isSaved(alex.id)).toBe(false);
    expect(isSaved(river.id)).toBe(true);
  });
  it("saved entry carries saved_at_iso timestamp", () => {
    saveProfile(alex);
    const [entry] = readSaved();
    expect(entry.ref.id).toBe(alex.id);
    expect(entry.saved_at_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("social-store · invitations (§16 · pending)", () => {
  it("sendInvite creates a pending record with the meeting_pref", () => {
    const p = sendInvite(alex, "drink");
    expect(p.ref.id).toBe(alex.id);
    expect(p.meeting_pref).toBe("drink");
    expect(p.response).toBe("pending");
    expect(p.responded_at_iso).toBeNull();
  });
  it("findPendingByProfile locates the invite by id", () => {
    sendInvite(alex, "coffee");
    expect(findPendingByProfile(alex.id)?.meeting_pref).toBe("coffee");
    expect(findPendingByProfile(river.id)).toBeNull();
  });
  it("re-inviting the same profile replaces the prior invite · never duplicates", () => {
    sendInvite(alex, "drink");
    sendInvite(alex, "walk");
    expect(readPending().filter((p) => p.ref.id === alex.id)).toHaveLength(1);
    expect(findPendingByProfile(alex.id)?.meeting_pref).toBe("walk");
  });
});

describe("social-store · accept (§17 · creates Friend)", () => {
  it("resolveInvite('accepted') creates a FriendConnection", () => {
    sendInvite(alex, "coffee");
    const friend = resolveInvite(alex.id, "accepted");
    expect(friend).not.toBeNull();
    expect(friend?.ref.id).toBe(alex.id);
    expect(friend?.meeting_pref).toBe("coffee");
    expect(isFriend(alex.id)).toBe(true);
  });
  it("accepting twice does not duplicate the friend record", () => {
    sendInvite(alex, "drink");
    resolveInvite(alex.id, "accepted");
    resolveInvite(alex.id, "accepted");
    expect(readFriends()).toHaveLength(1);
  });
});

describe("social-store · decline (§18 · silent · no friend)", () => {
  it("resolveInvite('declined') returns null and never creates a friend", () => {
    sendInvite(river, "walk");
    const r = resolveInvite(river.id, "declined");
    expect(r).toBeNull();
    expect(isFriend(river.id)).toBe(false);
  });
  it("declined invitations are preserved for observability · never permanently destroyed", () => {
    sendInvite(river, "walk");
    resolveInvite(river.id, "declined");
    // Declined list is stored under its own key — direct read via window
    // to prove nothing was silently wiped.
    const declinedRaw = window.localStorage.getItem(SOCIAL_STORAGE_KEYS.declined);
    expect(declinedRaw).toBeTruthy();
  });
});

describe("social-store · Save vs Invite separation (§21 no unsolicited contact)", () => {
  it("saveProfile never creates a Friend", () => {
    saveProfile(alex);
    expect(isFriend(alex.id)).toBe(false);
  });
  it("saveProfile never creates a pending invitation", () => {
    saveProfile(alex);
    expect(findPendingByProfile(alex.id)).toBeNull();
  });
});

describe("social-store · discovery category (§23 · persist preference)", () => {
  it("defaults to 'everyone' when nothing stored", () => {
    expect(readDiscoveryCategory()).toBe("everyone");
  });
  it("round-trips female / male / everyone", () => {
    writeDiscoveryCategory("female");
    expect(readDiscoveryCategory()).toBe("female");
    writeDiscoveryCategory("male");
    expect(readDiscoveryCategory()).toBe("male");
    writeDiscoveryCategory("everyone");
    expect(readDiscoveryCategory()).toBe("everyone");
  });
  it("rejects garbage · falls back to 'everyone'", () => {
    window.localStorage.setItem(SOCIAL_STORAGE_KEYS.discoveryCategory, JSON.stringify("nonbinary-hacker"));
    expect(readDiscoveryCategory()).toBe("everyone");
  });
});
