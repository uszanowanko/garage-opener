# garage

Standalone opener for one gate/door. No VPS, no domain, no subscription,
nothing to maintain.

```
phone ──► ntfy.sh ──► ESP32 + relay ──► gate opener
      └─► http://<name>.local/open (when on the local Wi-Fi)
```

- **ESP32** at the gate holds a long-lived connection to a random `ntfy.sh`
  topic and pulses a relay across the opener's manual-button terminals.
- Every open is signed with a **per-user HMAC** (a 64-hex key per person, sent to
  them once as a setup link) and is replay-protected.
- A **static web button** (GitHub Pages) replaces the old Next.js app and shows
  who opened it and when. Name / language / topics come from `web/config.js`
  **or** repo Variables (`DEVICE_NAME`, `ADMIN_NAME`, `WEB_LANG`, `NTFY_BASE`,
  `CMD_TOPIC`, `LOG_TOPIC`) that override it at deploy. UI strings are in
  `web/i18n.js` (ships `en` + `pl`).
- Phones can also open it hands-free via Siri / Google Assistant / geofence
  (see `clients/`).

## Layout

| Path | What |
|---|---|
| `firmware/` | ESP32 sketch (PlatformIO), config template, invite + test tools |
| `web/` | `index.html` + `config.js` (name/lang/topics) + `i18n.js`, on GitHub Pages |
| `clients/ios/` | Scriptable script + Shortcut instructions |
| `clients/android/` | HTTP Shortcuts import + instructions |
| `clients/ntfy-app/` | subscribe to the log feed |
| `android-auto/` | **Phase 2, optional** — tappable button on the car screen |
| `docs/` | provisioning runbook, wiring, threat model, self-host escape hatch |

## Start here

1. `docs/provisioning.md` — the full setup runbook.
1. `docs/finalize.md` — step-by-step to go live from a fresh repo + deploy.
2. `docs/wiring.md` — how the ESP32 connects to the opener.
3. `docs/threat-model.md` — what the signing does and does not protect.
4. `docs/extended-log.md` — optional: log history past ntfy.sh's 12h cap (free, no self-host).
5. `docs/smart-home.md` — optional: "Otwórz/Zamknij `<name>`" via Google Home, hands-free in Android Auto.

## Quick commands

```
make topics            # generate the two random ntfy topics
make invite NAME="Mama" # a person's key + roster line + setup link
make build             # compile the firmware
make flash             # compile + upload over USB
make monitor           # serial console
make test-open         # send a signed "open" from the command line
```
