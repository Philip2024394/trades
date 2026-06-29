// IPQualityScore VPN-detection helper — STUB.
//
// Until IPQUALITYSCORE_KEY is configured in the env, detectVpn()
// short-circuits with { is_vpn: false, score: 0 } so signup paths
// never block on a missing key.
import "server-only";

export type VpnDetectionResult = {
  is_vpn: boolean;
  score: number;
};

export async function detectVpn(ip: string): Promise<VpnDetectionResult> {
  const key = process.env.IPQUALITYSCORE_KEY;
  if (!key || !ip) {
    return { is_vpn: false, score: 0 };
  }

  // TODO: implement when env var set.
  //
  // const res = await fetch(
  //   `https://www.ipqualityscore.com/api/json/ip/${key}/${encodeURIComponent(ip)}`
  // );
  // const json = (await res.json()) as {
  //   vpn?: boolean;
  //   proxy?: boolean;
  //   tor?: boolean;
  //   fraud_score?: number;
  // };
  // return {
  //   is_vpn: Boolean(json.vpn || json.proxy || json.tor),
  //   score: typeof json.fraud_score === "number" ? json.fraud_score : 0
  // };

  return { is_vpn: false, score: 0 };
}
