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

Copy the two values into **two** places:

| Value | `firmware/include/config.h` | `web/config.js` |
|---|---|---|
| `CMD_TOPIC` | `#define CMD_TOPIC` | `cmdTopic` |
| `LOG_TOPIC` | `#define LOG_TOPIC` | `logTopic` |

(The clients also need `CMD_TOPIC` — set later in their own READMEs.)

## 2. Name, language, config  `[YOU]`

**`web/config.js`** — edit in place:

| Field | What |
|---|---|
| `deviceName` | shown as the title, heading, and installed-app name (e.g. `"Wrota"`) |
| `adminName` | fills "the personal link **{name}** sent you" — `""` → a translated fallback |
| `lang` | `"auto"` (follow the phone) or pin `"en"` / `"pl"` / … |

**`firmware/include/config.h`** (`cp` from `config.example.h` first):

- `WIFI_SSID/PASS`, `STATIC_IP` (+ DHCP reservation), `TZ_STRING`, the two
  topics, `OTA_PASSWORD`, `WEB_BASE_URL`, GPIOs.
- `MDNS_HOST` — lowercase hostname → `http://<host>.local/` (e.g. `"wrota"`).
- `DEVICE_NAME` — ASCII name used in the ntfy log-notification title.
- `LOG_ACTION` / `LOG_STATE_*` — the wording of the log line; Polish examples
  are in `config.example.h`.

**Languages**: `web/i18n.js` ships `en` + `pl`. Add one by adding a top-level
key — the switcher and auto-detect pick it up. The iOS `signer.js` has its own
small `MSG` table (`LANG` near the top).

## 3. Invite everyone  `[YOU]`

For each family member:

```
make invite NAME="Mama"
```

It prints:
- a `{ "Mama", "k" }` line — paste into `ROSTER[]` in `config.h` (delete the
  placeholder `Tomek` row).
- a personal link (`.../#n=Mama&k=...`) — **save it**, you'll send it in step 7.

Re-issue a lost link later without touching the roster:
`node firmware/tools/invite.mjs --name "Mama" --key <their 64-hex k>`.

## 4. Flash & bench-test  `[YOU]`

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
# B5 - disable mom's AP 3 min, re-enable: [ntfy] reconnects
# B6 - OTA: pio run -d firmware -t upload --upload-port <static-ip>
```

## 5. Install  `[YOU]`

Wire per `wiring.md`, mount the box, power from the 5 V supply. Run **I7–I14**
from the plan (sensor, cellular open, LAN-with-WAN-unplugged, Siri, geofences,
web page, ntfy push).

## 6. Web page  `[YOU]`

- New GitHub repo, push this monorepo.
- **Settings → Pages → Source: GitHub Actions**. The included
  `.github/workflows/pages.yml` bakes `deviceName` into the static files and
  publishes `web/`.
- The page is at `WEB_BASE_URL` + `/`. Confirm `web/config.js` topics match
  `config.h`.

## 7. Hand out the links  `[YOU]` / family

- **Everyone**: send each person the **personal link** from step 3
  ("tap this, then Add to Home Screen"). That's the whole setup for a
  button-only user — no name or key to type.
- Hands-free (Siri / Assistant / geofence): `clients/ios/README.md`,
  `clients/android/README.md`.
- "Who opened it" push feed: `clients/ntfy-app/README.md`.

## 8. Decommission the old stack  `[YOU]`

Only after I7–I14 pass:

- Stop the Next.js app + the Express/Nest broker on the VPS; archive that repo.
- Wipe / repurpose the VPS.
- Let the `gate.` / `iot-base.` DNS records (or the whole domain) lapse.
- Shelve the Pi 1 B and the Pi Zero.
