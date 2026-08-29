# Provisioning runbook

Everything you (the human) do, in order. ~1 hour. `[YOU]` = you, `[auto]` = a
command does it.

## 0. Prerequisites  `[YOU]`

- Buy the parts in `wiring.md`.
- Install **PlatformIO**: the VS Code extension, or `pipx install platformio`.
- Have `node` (18+), `openssl`, `make`.
- A GitHub account (for the web page). Nothing else — no ntfy account, no
  domain, no VPS.

## 1. Topics  `[auto]` → `[YOU]`

```
make topics
```

`CMD_TOPIC` / `LOG_TOPIC` go into `firmware/include/config.h` (`#define`s) and
into the web app (step 2). The clients also need `CMD_TOPIC` — set later in
their own READMEs.

## 2. Web app: name, language, topics  `[YOU]`

Six settings. Set each **either** by editing `web/config.js` and committing,
**or** by adding a repo Variable (Settings → Secrets and variables → Actions →
Variables) — a set Variable wins at deploy, an unset one keeps `config.js`.

| `config.js` key | Variable | What |
|---|---|---|
| `deviceName` | `DEVICE_NAME` | title, heading, installed-app name (e.g. `Wrota`) |
| `adminName` | `ADMIN_NAME` | fills "the link **{name}** sent you"; empty → translated fallback |
| `lang` | `WEB_LANG` | `auto`, or pin `en` / `pl` / … |
| `ntfy` | `NTFY_BASE` | ntfy base URL (default `https://ntfy.sh`) |
| `cmdTopic` | `CMD_TOPIC` | must match `config.h` |
| `logTopic` | `LOG_TOPIC` | must match `config.h` |

`web/apply-config.mjs` (run by `pages.yml`) applies the overrides and bakes
`deviceName` into the static HTML/manifest. Locally: `node web/apply-config.mjs`
is a no-op unless you export the same vars.

## 3. Firmware config  `[YOU]`

`cp firmware/include/config.example.h firmware/include/config.h`, then fill in:

- `WIFI_SSID/PASS`, `STATIC_IP` (+ DHCP reservation), `TZ_STRING`, the two
  topics, `OTA_PASSWORD`, `WEB_BASE_URL`, GPIOs.
- `MDNS_HOST` — lowercase hostname → `http://<host>.local/` (e.g. `"wrota"`).
- `DEVICE_NAME` — ASCII name used in the ntfy log-notification title.
- `LOG_ACTION` / `LOG_STATE_*` — the wording of the log line; Polish examples
  are in `config.example.h`.

**Languages**: `web/i18n.js` ships `en` + `pl`. Add one by adding a top-level
key — the switcher and auto-detect pick it up. The iOS `signer.js` has its own
small `MSG` table (`LANG` near the top).

## 4. Invite everyone  `[YOU]`

For each family member:

```
make invite NAME="Mama"
```

It prints:
- a `{ "Mama", "k" }` line — paste into `ROSTER[]` in `config.h` (delete the
  placeholder `Tomek` row).
- a personal link (`.../#n=Mama&k=...`) — **save it**, you'll send it in step 8.

Re-issue a lost link later without touching the roster:
`node firmware/tools/invite.mjs --name "Mama" --key <their 64-hex k>`.

## 5. Flash & bench-test  `[YOU]`

USB-connect the ESP32:

```
make flash
make monitor
```

Expect: `[wifi] up`, `[time] epoch=...` (non-zero), `[ntfy] connected`.

Then run bench tests **B1–B6** from the project plan's Verification section:

```
# K = Tomek's 64-hex key (from his invite / config.h)

# B1 - remote open
make test-open NAME=Tomek KEY=$K
#   -> relay clicks; a line appears in the ntfy app on LOG_TOPIC

# B2 - LAN open
make test-lan  NAME=Tomek KEY=$K

# B3 - rejections (each should print a [reject] reason, no relay)
node firmware/tools/send-open.mjs --name Tomek --key $(printf %064d 0)      # bad-sig
node firmware/tools/send-open.mjs --name Tomek --key $K --ts 1             # stale
node firmware/tools/send-open.mjs --name Nobody --key $K                   # unknown-user
#   replay: run "--ts <fixed>" twice with a valid key

# B4 - flood: run test-open ~10x fast, actuations stop at MAX_OPENS_PER_MIN
# B5 - disable the local AP 3 min, re-enable: [ntfy] reconnects
# B6 - OTA: pio run -d firmware -t upload --upload-port <static-ip>
```

## 6. Install  `[YOU]`

Wire per `wiring.md`, mount the box, power from the 5 V supply. Run **I7–I14**
from the plan (sensor, cellular open, LAN-with-WAN-unplugged, Siri, geofences,
web page, ntfy push).

## 7. Web page  `[YOU]`

- New GitHub repo, push this monorepo.
- **Settings → Pages → Source: GitHub Actions**. The included
  `.github/workflows/pages.yml` bakes `deviceName` into the static files and
  publishes `web/`.
- The page is at `WEB_BASE_URL` + `/`. Confirm `web/config.js` topics match
  `config.h`.

## 8. Hand out the links  `[YOU]` / family

- **Everyone**: send each person the **personal link** from step 4
  ("tap this, then Add to Home Screen"). That's the whole setup for a
  button-only user — no name or key to type.
- Hands-free (Siri / Assistant / geofence): `clients/ios/README.md`,
  `clients/android/README.md`.
- "Who opened it" push feed: `clients/ntfy-app/README.md`.

## 9. Decommission the old stack  `[YOU]`

Only after I7–I14 pass:

- Stop the Next.js app + the Express/Nest broker on the VPS; archive that repo.
- Wipe / repurpose the VPS.
- Let the `gate.` / `iot-base.` DNS records (or the whole domain) lapse.
- Shelve the Pi 1 B and the Pi Zero.
