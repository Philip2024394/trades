// src/lib/nex-native/ip-range-check.ts
//
// NEX · IP range validation for SSRF-safe URL fetching.
// Sealed 2026-10-02 · Phase 1 link previews.
// -----------------------------------------------------------------------------
// Determines whether an IPv4 or IPv6 address is globally routable.
// Used by link-preview-fetcher.ts to reject URLs whose hostname
// resolves to loopback / private / link-local / documentation /
// reserved ranges before any TCP connection is attempted.
//
// Implementation:
//   · IPv4: BigInt CIDR containment check against the complete
//     IANA-reserved non-routable set
//   · IPv6: BigInt CIDR containment including IPv4-mapped IPv6
//     (::ffff:0:0/96) which is unmapped and re-checked as IPv4
//   · No external dependencies · all logic inline so the security
//     helper is fully auditable in-tree
//
// Rejection ranges are documented at the call site so a code
// reviewer can verify against RFC 1918 / 6598 / 5737 / etc without
// cross-referencing external docs.

// ---------------------------------------------------------------------------
// IPv4 CIDR containment
// ---------------------------------------------------------------------------

/** Parse a dotted-quad IPv4 into a BigInt. Throws on malformed input. */
function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error(`invalid ipv4: ${ip}`);
  let n = 0n;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) {
      throw new Error(`invalid ipv4 octet: ${ip}`);
    }
    n = (n << 8n) | BigInt(b);
  }
  return n;
}

/** Check whether an IPv4 address falls within a CIDR (e.g. 10.0.0.0/8). */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
    throw new Error(`invalid cidr: ${cidr}`);
  }
  const mask = bits === 0 ? 0n : (0xFFFFFFFFn << BigInt(32 - bits)) & 0xFFFFFFFFn;
  const net = ipv4ToBigInt(network);
  const addr = ipv4ToBigInt(ip);
  return (addr & mask) === (net & mask);
}

/** Rejection list for IPv4 · every range here is NOT globally routable.
 *  Sources: RFC 1918 (private), 6598 (CGNAT), 3927 (link-local),
 *  5736 (IETF reserved), 5737 (TEST-NET), 2544 (benchmarking),
 *  3068 (6to4 anycast), 5771 (multicast), 1112 (reserved). */
const IPV4_NON_ROUTABLE: readonly string[] = [
  "0.0.0.0/8",          // "This network" (RFC 1122)
  "10.0.0.0/8",         // Private (RFC 1918)
  "100.64.0.0/10",      // CGNAT (RFC 6598)
  "127.0.0.0/8",        // Loopback (RFC 1122)
  "169.254.0.0/16",     // Link-local · includes 169.254.169.254 (AWS/GCP metadata)
  "172.16.0.0/12",      // Private (RFC 1918)
  "192.0.0.0/24",       // IETF protocol assignments (RFC 5736)
  "192.0.2.0/24",       // TEST-NET-1 (RFC 5737)
  "192.88.99.0/24",     // 6to4 relay anycast (RFC 3068 · deprecated)
  "192.168.0.0/16",     // Private (RFC 1918)
  "198.18.0.0/15",      // Benchmarking (RFC 2544)
  "198.51.100.0/24",    // TEST-NET-2 (RFC 5737)
  "203.0.113.0/24",     // TEST-NET-3 (RFC 5737)
  "224.0.0.0/4",        // Multicast (RFC 5771)
  "240.0.0.0/4",        // Reserved (RFC 1112)
  "255.255.255.255/32", // Limited broadcast
];

/** Return true iff the IPv4 is a globally routable public address. */
export function isGloballyRoutableIpv4(ip: string): boolean {
  try {
    for (const cidr of IPV4_NON_ROUTABLE) {
      if (ipv4InCidr(ip, cidr)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IPv6 CIDR containment
// ---------------------------------------------------------------------------

/** Parse an IPv6 address into a BigInt (128-bit value). Accepts the
 *  common forms: full `::1`, zero-collapsed `2001:db8::1`, and
 *  IPv4-mapped `::ffff:192.168.1.1`. Throws on malformed input. */
function ipv6ToBigInt(ip: string): bigint {
  const lower = ip.toLowerCase();
  // Handle IPv4-mapped form embedded as dotted-quad in the last segment.
  const parts = lower.split(":");
  const lastPart = parts[parts.length - 1] ?? "";
  if (lastPart.includes(".")) {
    const v4 = ipv4ToBigInt(lastPart);
    const highHex = (v4 >> 16n).toString(16);
    const lowHex = (v4 & 0xFFFFn).toString(16);
    parts.splice(-1, 1, highHex, lowHex);
  }
  // Expand :: into zeroed groups.
  const collapsedIdx = parts.indexOf("");
  let groups: string[];
  if (collapsedIdx !== -1) {
    // There can be at most one `::`. Count non-empty groups and
    // insert enough zero-groups to reach 8 total.
    const nonEmpty = parts.filter((p) => p !== "");
    const zerosNeeded = 8 - nonEmpty.length;
    groups = [];
    let placed = false;
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i] === "" && !placed) {
        for (let z = 0; z < zerosNeeded; z += 1) groups.push("0");
        placed = true;
        // Skip adjacent empty entries that result from leading/trailing ::
        while (i + 1 < parts.length && parts[i + 1] === "") i += 1;
      } else if (parts[i] !== "") {
        groups.push(parts[i]!);
      }
    }
  } else {
    groups = parts;
  }
  if (groups.length !== 8) throw new Error(`invalid ipv6: ${ip}`);
  let n = 0n;
  for (const g of groups) {
    const v = parseInt(g, 16);
    if (!Number.isInteger(v) || v < 0 || v > 0xFFFF) {
      throw new Error(`invalid ipv6 group: ${ip}`);
    }
    n = (n << 16n) | BigInt(v);
  }
  return n;
}

function ipv6InCidr(ip: string, cidr: string): boolean {
  const [network, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 128) {
    throw new Error(`invalid cidr: ${cidr}`);
  }
  const full = (1n << 128n) - 1n;
  const mask = bits === 0 ? 0n : (full << BigInt(128 - bits)) & full;
  const net = ipv6ToBigInt(network);
  const addr = ipv6ToBigInt(ip);
  return (addr & mask) === (net & mask);
}

/** IPv4-mapped IPv6 (::ffff:a.b.c.d) → extract the embedded IPv4
 *  as a dotted-quad string. Returns null if the input isn't a
 *  mapped address. */
function unmapIpv4MappedIpv6(ip: string): string | null {
  let value: bigint;
  try {
    value = ipv6ToBigInt(ip);
  } catch {
    return null;
  }
  // ::ffff:0:0/96 → upper 96 bits are 0x...ffff, lower 32 bits are the IPv4
  const upper = value >> 32n;
  const marker = 0xFFFFn;
  if (upper !== marker) return null;
  const v4 = value & 0xFFFFFFFFn;
  const a = Number((v4 >> 24n) & 0xFFn);
  const b = Number((v4 >> 16n) & 0xFFn);
  const c = Number((v4 >> 8n) & 0xFFn);
  const d = Number(v4 & 0xFFn);
  return `${a}.${b}.${c}.${d}`;
}

/** Rejection list for IPv6. Sources: RFC 4291 (unspecified, loopback,
 *  multicast), 6052 (NAT64), 6666 (discard), 4380 (Teredo), 7343
 *  (ORCHIDv2), 3849 (documentation), 4193 (ULA), 4291 (link-local). */
const IPV6_NON_ROUTABLE: readonly string[] = [
  "::/128",       // Unspecified
  "::1/128",      // Loopback
  "64:ff9b::/96", // NAT64 well-known
  "100::/64",     // Discard-only
  "2001::/32",    // Teredo
  "2001:20::/28", // ORCHIDv2
  "2001:db8::/32",// Documentation
  "fc00::/7",     // Unique local (ULA private)
  "fe80::/10",    // Link-local
  "ff00::/8",     // Multicast
];

/** Return true iff the IPv6 is globally routable. IPv4-mapped IPv6
 *  is unmapped and re-checked against the IPv4 rules — a mapped
 *  loopback (::ffff:127.0.0.1) is rejected the same way as a bare
 *  127.0.0.1. */
export function isGloballyRoutableIpv6(ip: string): boolean {
  try {
    // IPv4-mapped: unmap and defer to IPv4 check.
    const unmapped = unmapIpv4MappedIpv6(ip);
    if (unmapped) return isGloballyRoutableIpv4(unmapped);
    // ::ffff:0:0/96 catch-all for other mapped forms we didn't catch.
    if (ipv6InCidr(ip, "::ffff:0:0/96")) return false;
    for (const cidr of IPV6_NON_ROUTABLE) {
      if (ipv6InCidr(ip, cidr)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Family-agnostic entry point
// ---------------------------------------------------------------------------

/** Return true iff the given address (any family) is a globally
 *  routable public internet address. Returns false for any
 *  malformed input (safe default). */
export function isGloballyRoutable(ip: string, family: 4 | 6): boolean {
  if (family === 4) return isGloballyRoutableIpv4(ip);
  if (family === 6) return isGloballyRoutableIpv6(ip);
  return false;
}
