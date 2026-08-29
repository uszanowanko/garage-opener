# Finalisation runbook

Where we are: repo pushed, GitHub Pages deploying, `DEVICE_NAME` / `WEB_LANG` /
`ADMIN_NAME` set as repo Variables. Firmware compiles but nothing is flashed and
no hardware is wired. This is everything left, in order, with a check at the end
of each phase. `[YOU]` = you at a keyboard / with a screwdriver.

Tools you'll need locally: `openssl`, `node` (18+), `make`, and **PlatformIO**
(VS Code extension or `pipx install platformio`).

---

## Phase A — Web app live  `[YOU]`  (~10 min)

### A1. Watch the deploy finish
- Repo → **Actions** → the "Deploy web/ to GitHub Pages" run is green.
- If it's red: open the run, read the failing step. Most likely `apply-config.mjs`
  (a bad value) or Pages not enabled (Settings → Pages → Source = **GitHub Actions**).

### A2. Generate the real topics — **do this now if you haven't**
The deployed page is useless until the topics are real (the placeholder
`gate-REPLACE_...` is a dead ntfy topic).

```
make topics
```

Copy the two values. Then:

```
gh secret set CMD_TOPIC --repo uszanowanko/garage-opener --body 'gate-<cmd value>'
gh secret set LOG_TOPIC --repo uszanowanko/garage-opener --body 'gate-<log value>'
gh workflow run pages.yml --repo uszanowanko/garage-opener
```

Keep both values somewhere safe — you'll paste them into `firmware/config.h`
in Phase B and they're write-only as Secrets.

### A3. Verify the deployed config
```
curl -s https://uszanowanko.github.io/garage-opener/config.js
```
Expect: `deviceName: "Wrota"`, `lang: "pl"`, your `adminName`, and the **real**
`cmdTopic` / `logTopic` (not `REPLACE`).

### A4. Eyeball the page
- Open <https://uszanowanko.github.io/garage-opener/> on your phone.
- Tab title and heading say **Wrota**. Language is Polish (or your `WEB_LANG`).
- The "not set up" screen names **Tomek** (or "właściciel" if `ADMIN_NAME` unset).
- Safari/Chrome → Share → **Add to Home Screen** → the icon is named **Wrota**.

> The **Open** button won't do anything real until the ESP32 is online (Phase C).
> That's expected.

**Phase A done when:** Actions green, `config.js` shows real topics, page opens
and is named Wrota.

---

## Phase B — Build & flash the controller  `[YOU]`  (~1–2 h, mostly waiting on parts)

### B1. Buy (see `docs/wiring.md` for exact specs)
- [ ] ESP32-WROOM-32 dev board
- [ ] 1-channel **opto-isolated** relay module (5 V coil, 3.3 V trigger, `JD-VCC` jumper)
- [ ] Reed / magnetic door switch
- [ ] 5 V / 1 A USB power supply + cable
- [ ] Dupont wires, small project box

### B2. Fill in firmware config
```
cp firmware/include/config.example.h firmware/include/config.h
```
Edit `firmware/include/config.h`:
- [ ] `WIFI_SSID` / `WIFI_PASS` — the gate's network
- [ ] `STATIC_IP` (+ add a **DHCP reservation** for it on the router), `GATEWAY_IP`, `SUBNET_MASK`, `DNS_IP`
- [ ] `MDNS_HOST` = `wrota`, `DEVICE_NAME` = `Wrota`
- [ ] `TZ_STRING` = `CET-1CEST,M3.5.0,M10.5.0/3` (already the default)
- [ ] `CMD_TOPIC` / `LOG_TOPIC` — the exact values from A2
- [ ] `WEB_BASE_URL` = `https://uszanowanko.github.io/garage-opener` (already the default)
- [ ] `OTA_PASSWORD` — pick one
- [ ] `RELAY_GPIO` / `SENSOR_GPIO` — match how you'll wire it (defaults 23 / 22)
- [ ] `LOG_ACTION` / `LOG_STATE_*` — set the Polish strings (examples in the file)

### B3. Enrol everyone
For each person (you, mama, siblings…):
```
make invite NAME="Mama"
```
- [ ] Paste each `{ "Mama", "…" }` line into `ROSTER[]` in `config.h`
- [ ] Delete the placeholder `{ "Tomek", "0000…" }` row (or make it your real one)
- [ ] **Save every printed link** in your password manager — that's how each
      person sets up, and how you re-issue if they lose it

### B4. Flash on the bench (ESP32 on USB, not wired to anything yet)
```
make flash
make monitor
```
Expect in the serial log: `[wifi] up, ip=192.168.1.50`, `[time] epoch=` (a big
number, not 0), `[ntfy] connected`.

### B5. Bench tests  (watch `make monitor`; a multimeter or LED on the relay output)
```
# K = your own 64-hex key from B3
make test-open NAME=Tomek KEY=$K          # relay clicks; line shows on LOG_TOPIC in the ntfy app
make test-lan  NAME=Tomek KEY=$K          # same, via http://192.168.1.50/open

# each of these must be REJECTED (serial prints a [reject] reason, no click):
node firmware/tools/send-open.mjs --name Tomek --key $(printf %064d 0)   # bad-sig
node firmware/tools/send-open.mjs --name Tomek --key $K --ts 1           # stale
node firmware/tools/send-open.mjs --name Ghost --key $K                  # unknown-user
make test-open NAME=Tomek KEY=$K ; make test-open NAME=Tomek KEY=$K      # 2nd within 1s: replay

# flood: run test-open ~8× quickly → clicks stop at MAX_OPENS_PER_MIN (6)
# wifi drop: disable the AP ~3 min, re-enable → serial shows backoff then [ntfy] connected
# OTA: pio run -d firmware -t upload --upload-port 192.168.1.50   (uses OTA_PASSWORD)
```

**Phase B done when:** every line above behaves as noted.

---

## Phase C — Install at the gate  `[YOU]`  (~1 h)

### C1. Wire it (power OFF, see `docs/wiring.md`)
- [ ] Relay **COM+NO across the opener's manual-button terminals** — the low-voltage
      pair the wall button uses. **Never the mains / motor side.**
- [ ] Reed switch on the gate + frame, magnet touching when **closed**
- [ ] 5 V supply to the ESP32 and the relay coil
- [ ] Box mounted, strain-relieved

### C2. Power on, confirm it joined
- `curl http://192.168.1.50/state` → `{"door":"closed"|"open","ntfy":"connected",…}`
- Move the gate by hand → `/state` flips `closed`↔`open`

### C3. In-place tests
- [ ] **I7** sensor reads correctly (C2)
- [ ] **I8** phone on **mobile data** (Wi-Fi off) → web **Open** button → gate moves in ~1–2 s
- [ ] **I9** phone on the gate's Wi-Fi, **unplug the router's internet** → an
      iOS Shortcut / Android HTTP-Shortcut still opens it (LAN path)
- [ ] **I10** "Hey Siri, Otwórz wrota" from the car → opens
- [ ] **I11 / I12** geofence: drive away and back (or set a test location) → auto-opens
- [ ] **I13** the web page "Recent" list shows the opens with names + times
- [ ] **I14** each phone subscribed to `LOG_TOPIC` in the **ntfy app** gets a push per open

**Phase C done when:** I7–I14 pass. The system is now live.

---

## Phase D — Roll out to the family  `[YOU]` + each person  (~10 min/person)

For each person:
1. Send them **their personal link** (from B3) — one message: *"Tap this, then
   Share → Add to Home Screen."*
2. That's the whole setup for a tap-only user.
3. Optional hands-free:
   - iPhone → `clients/ios/README.md` (Scriptable + a Shortcut named in Polish;
     the Shortcut name is the Siri phrase)
   - Android → `clients/android/README.md` (HTTP Shortcuts app + widget/geofence)
4. Optional "who opened it" feed → `clients/ntfy-app/README.md` (subscribe to `LOG_TOPIC`)

The one person without CarPlay/Android Auto just uses the home-screen icon.

---

## Phase E — Decommission the old stack  `[YOU]`  (only after Phase C passes)

- [ ] Stop the Next.js app and the Express/Nest broker on the VPS
- [ ] Archive (don't delete) the old repo — reference for a while
- [ ] Wipe / repurpose the VPS
- [ ] Remove the `gate.` / `iot-base.` DNS records; let the domain lapse if nothing else needs it
- [ ] Unplug and shelve the Raspberry Pi 1 B and the Pi Zero

---

## Done criteria

- Family opens the gate from the home-screen icon, by voice, and on approach.
- The old VPS is off; nothing renews; nothing needs patching.
- You can rebuild the whole thing from the repo + your saved topics + links.

## Keep for future-you (in your password manager)

- `CMD_TOPIC`, `LOG_TOPIC`
- `OTA_PASSWORD`
- every person's setup link (each contains their `k`)
- the ESP32's static IP

## Quick reference — change something later

| Task | Do |
|---|---|
| Add a person | `make invite NAME="X"` → add roster line → `make flash` (or OTA) → send link |
| Remove a person | delete their roster line → `make flash` / OTA |
| Person lost their link | `node firmware/tools/invite.mjs --name "X" --key <their k>` (same link) |
| Suspected leak (one person) | `make invite NAME="X"` for a fresh `k` → replace roster line → OTA → send new link |
| Rename the device | change `DEVICE_NAME` Variable + `MDNS_HOST`/`DEVICE_NAME` in `config.h` → redeploy + reflash |
| ntfy.sh problems | `docs/self-host-ntfy.md` (change one base URL in 4 places) |
| Firmware update | edit, `pio run -d firmware -t upload --upload-port wrota.local` |
