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

Copy the two values into **three** places:

| Value | `firmware/include/config.h` | `web/index.html` | clients |
|---|---|---|---|
| `CMD_TOPIC` | `#define CMD_TOPIC` | `const CMD_TOPIC` | `signer.js`, Android shortcut URL |
| `LOG_TOPIC` | `#define LOG_TOPIC` | `const LOG_TOPIC` | ntfy app subscription |

## 2. Config  `[YOU]`

```
cp firmware/include/config.example.h firmware/include/config.h
```

Fill in: `WIFI_SSID/PASS`, `STATIC_IP` (+ matching DHCP reservation on mom's
router), `TZ_STRING`, the two topics, `OTA_PASSWORD`, and check the GPIOs match
your wiring.

## 3. Enrol everyone  `[YOU]`

For each family member, ask them for a keyword, then:

```
make enroll
```

Paste each printed `{ "Name", "k" }` line into `ROSTER[]` in `config.h`.
Delete the placeholder `Tomek` row.

## 4. Flash & bench-test  `[YOU]`

USB-connect the ESP32:

```
make flash
make monitor
```

Expect: `[wifi] up`, `[time] epoch=...` (non-zero), `[ntfy] connected`.

Then run bench tests **B1–B6** from the project plan's Verification section:

```
# B1 - remote open
make test-open NAME=Tomek KEYWORD=<tomek's keyword>
#   -> relay clicks; a line appears in the ntfy app on LOG_TOPIC

# B2 - LAN open
make test-lan  NAME=Tomek KEYWORD=<tomek's keyword>

# B3 - rejections (each should print a [reject] reason, no relay)
node firmware/tools/send-open.mjs --name Tomek --keyword wrong
node firmware/tools/send-open.mjs --name Tomek --keyword <ok> --ts 1
node firmware/tools/send-open.mjs --name Nobody --keyword x
#   replay: run the same --ts twice

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
  `.github/workflows/pages.yml` publishes `web/`.
- The page is at `https://<user>.github.io/<repo>/`. Send everyone the link;
  each person enters their name + keyword once and can "Add to Home Screen".

## 7. Phone clients  `[YOU]` / family

- Minimum for everyone: the web page PWA.
- Hands-free: `clients/ios/README.md`, `clients/android/README.md`.
- Log feed: `clients/ntfy-app/README.md`.

## 8. Decommission the old stack  `[YOU]`

Only after I7–I14 pass:

- Stop the Next.js app + the Express/Nest broker on the VPS; archive that repo.
- Wipe / repurpose the VPS.
- Let the `gate.` / `iot-base.` DNS records (or the whole domain) lapse.
- Shelve the Pi 1 B and the Pi Zero.
