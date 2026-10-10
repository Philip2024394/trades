// src/app/nex-native/settings/world-intro/_world-intro.test.ts
//
// NEX Phase 1.0 · World Intro settings + peer-chat gate parity.
// Sealed 2026-10-06.
//
// Source-grep only. Confirms that the Phase 1.0 upgrade from scaffold
// to real toggle is live and that the peer-chat mount gate honours the
// owner's preference.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const PAGE_FILE = path.join(
  REPO_ROOT,
  "src/app/nex-native/settings/world-intro/page.tsx",
);
const PEER_CHAT_FILE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat/peer/[accountId]/page.tsx",
);

function readPage(): string {
  return fs.readFileSync(PAGE_FILE, "utf8");
}

function readPeerChat(): string {
  return fs.readFileSync(PEER_CHAT_FILE, "utf8");
}

// ─── A · page reads world_intro_enabled ──────────────────────────────

describe("A · page.tsx reads session.account.world_intro_enabled", () => {
  test("source references session.account.world_intro_enabled", () => {
    const src = readPage();
    expect(src).toContain("session.account.world_intro_enabled");
  });
});

// ─── B · page mounts the server action ──────────────────────────────

describe("B · page.tsx mounts <form action={setWorldIntroEnabledAction}", () => {
  test("source mounts the form with the sealed action", () => {
    const src = readPage();
    expect(src).toContain("<form");
    expect(src).toContain("action={setWorldIntroEnabledAction}");
  });
});

// ─── C · scaffold phrasing is gone ──────────────────────────────────

describe("C · old scaffold phrasing has been removed", () => {
  test("does NOT contain 'Message NEX1 to change'", () => {
    const src = readPage();
    expect(src).not.toContain("Message NEX1 to change");
  });

  test("does NOT contain 'Switch coming soon'", () => {
    const src = readPage();
    expect(src).not.toContain("Switch coming soon");
  });
});

// ─── D · peer-chat page honours the preference ──────────────────────

describe("D · peer-chat mount gate honours world_intro_enabled", () => {
  test("peer-chat page reads peer.world_intro_enabled", () => {
    const src = readPeerChat();
    expect(src).toContain("peer.world_intro_enabled");
  });

  test("peer-chat page sources getActiveCustomIntroForOwner", () => {
    const src = readPeerChat();
    expect(src).toContain("getActiveCustomIntroForOwner");
  });
});
