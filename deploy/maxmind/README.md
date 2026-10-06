# NEX GeoIP · MaxMind GeoLite2

**Founder sealed 2026-10-06** · Self-hosted approximate location lookup for sign-in events and active sessions. IP addresses never leave NEX infrastructure.

## Why MaxMind GeoLite2

- Free for commercial + non-commercial use with attribution.
- Industry-standard database (used by Netflix, Cloudflare, GitHub).
- Monthly refresh cadence (database updated twice weekly upstream).
- No per-request API fees · unlimited lookups once the file is on disk.

## License

The GeoLite2 databases are licensed under the MaxMind GeoLite End User License Agreement: https://www.maxmind.com/en/geolite/eula

**Attribution requirement:** When NEX displays city/country derived from GeoLite2, we must credit MaxMind. The sealed attribution line is rendered on the Security activity page footer and in the `/rights` document:

> This product includes GeoLite2 Data created by MaxMind, available from https://www.maxmind.com

A commercial redistribution license is NOT required for in-app lookups behind our own API. See https://support.maxmind.com/hc/en-us/articles/4408928143643

## Setup (ops · one-time)

1. **Create a free MaxMind account** at https://www.maxmind.com/en/geolite2/signup
2. **Generate a license key** under Account → Manage License Keys
3. **Download `GeoLite2-City.mmdb`** either:
   - directly via the account dashboard, OR
   - via the official `geoipupdate` tool: https://github.com/maxmind/geoipupdate
4. **Place the file at** `deploy/maxmind/GeoLite2-City.mmdb` (this directory). It is **gitignored** — the file never enters the repo.
5. Alternatively, point `NEX_MAXMIND_DB_PATH` at wherever the file lives on this machine.

## Monthly refresh

MaxMind publishes GeoLite2-City updates **twice weekly (Tuesday + Friday)**. Our policy is to refresh **monthly** which is well within the EULA's 30-day data-freshness window.

### Via `geoipupdate` (recommended)

```bash
# /etc/GeoIP.conf
AccountID YOUR_ACCOUNT_ID
LicenseKey YOUR_LICENSE_KEY
EditionIDs GeoLite2-City
DatabaseDirectory /path/to/deploy/maxmind
```

Then run monthly:

```bash
geoipupdate
```

### Manual download

Replace the `.mmdb` file in this directory and restart the Node server to pick up the new reader. The reader caches the file at module load; a restart is required.

## Verification

```bash
# Read current DB build date (via nodejs maxmind package)
node -e "
const { open } = require('maxmind');
(async () => {
  const r = await open('deploy/maxmind/GeoLite2-City.mmdb');
  console.log('Build epoch:', r.metadata.buildEpoch);
  console.log('Database type:', r.metadata.databaseType);
  console.log('IP version:', r.metadata.ipVersion);
  console.log('Record size:', r.metadata.recordSize);
})();
"
```

Expected: `databaseType: 'GeoLite2-City'` and a recent `buildEpoch`.

## Graceful degradation

NEX never blocks sign-in on a missing / outdated GeoLite2 DB. When the file is absent, the code in `src/lib/nex-native/geo/geoip-lookup.ts` returns `UNKNOWN_LOCATION` and the UI shows "Unknown location". Operations can replace the file at any time and new lookups will succeed after a server restart.

## Privacy posture

- The IP address **never leaves NEX servers**. All lookups happen locally against the on-disk `.mmdb`.
- Only **approximate city + country** is persisted (`nex_session.approx_city`, `nex_session.approx_country`, `nex_sign_in_event.approx_city`, `nex_sign_in_event.approx_country`).
- The raw IP is stored in the `ip_address inet` column for audit purposes only · the consumer UI (`/settings/security/devices`, `/settings/security/activity`) never displays raw IPs.
- Private / loopback IPs (10.0.0.0/8, 192.168.0.0/16, 127.0.0.0/8, IPv6 fc00:/fe80:/fd00:) short-circuit to `UNKNOWN_LOCATION` without consulting the DB.
