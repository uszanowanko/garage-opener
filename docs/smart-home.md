# "Otwórz wrota" / "Zamknij wrota" - Google Home + Android Auto

Voice control, including hands-free from Android Auto, via a real Google
Home device (not a Google Assistant "app shortcut" - as of 2025/2026 Gemini
[cannot reliably trigger those](https://support.google.com/gemini/thread/399049872/gemini-cannot-trigger-shortcut-actions-for-our-android-app)
any more, which is what `clients/android/README.md`'s "Hey Google, &lt;phrase&gt;"
trick relied on). Registering the gate as a proper `GARAGE`-type Google Home
device sidesteps that entirely - Assistant/Gemini already controls smart home
devices hands-free in Android Auto with no car-specific work needed.

Geofencing is unaffected by any of this - keep using HTTP Shortcuts' own
Location trigger (`clients/android/README.md`), it doesn't go through
Google Assistant at all.

## How it works

The Worker in `cloudflare/` (same one as `docs/extended-log.md`) gained a
Google Smart Home fulfillment endpoint. Google calls it to ask "what devices
exist" (`SYNC`), "what state are they in" (`QUERY`), and "do this"
(`EXECUTE`). `EXECUTE` just signs and posts the exact same `v1;ts;name;sig`
payload as the web app's Open button, as a roster member named
`GoogleHome` - so from the ESP32's point of view, Google Home is simply
another family member with its own key. Both "Otwórz wrota" and "Zamknij
wrota" send the **identical** command (there's still only one relay pulse,
no separate close command); Google just lets you say two different phrases.

`QUERY` reports a best-effort *guess* (open/closed), reusing the exact same
no-sensor heuristic as the web app's history list - see
`docs/extended-log.md`. It is not, and cannot be, a fact.

## 1. Give "GoogleHome" its own roster key `[YOU]`

Same as adding a family member:

```
make invite NAME="GoogleHome"
```

Paste the printed `{ "GoogleHome", "k" }` line into `ROSTER[]` in
`firmware/include/config.h`, then `make flash` (or OTA). You don't need the
printed setup link - only the `k` value, for step 2.

## 2. Add the new Worker secrets `[YOU]`

On top of `LOG_WRITE_KEY` (already set per `docs/extended-log.md`):

```
cd cloudflare
wrangler secret put GATE_SIGN_KEY           # the GoogleHome k from step 1
openssl rand -hex 32                        # -> TOKEN_SECRET, save it
wrangler secret put TOKEN_SECRET
openssl rand -hex 16                        # -> SMARTHOME_CLIENT_ID, save it
wrangler secret put SMARTHOME_CLIENT_ID
openssl rand -hex 32                        # -> SMARTHOME_CLIENT_SECRET, save it
wrangler secret put SMARTHOME_CLIENT_SECRET
wrangler secret put LINK_PASSWORD           # a password only you will type, once
```

Edit `wrangler.toml`'s `[vars]`: set `CMD_TOPIC` to your real topic
(`firmware/include/config.h`) and `DEVICE_NAME` to whatever you want Google
to call it ("Wrota", "Brama", anything - this is the name both `docs/`
voice phrases will use: "Otwórz `<DEVICE_NAME>`" / "Zamknij `<DEVICE_NAME>`").

```
wrangler deploy
```

## 3. Register the project `[YOU]`

Google Home Developer Console: <https://developers.home.google.com/> ->
sign in -> **Create project** -> pick **Cloud-to-cloud** -> **Develop**.
(This replaced the old "Actions on Google" console in Dec 2024 - if search
results or old tutorials point you at actions.google.com, ignore them.)

Under **Account linking**, set:

| Field | Value |
|---|---|
| Client ID | your `SMARTHOME_CLIENT_ID` from step 2 |
| Client secret | your `SMARTHOME_CLIENT_SECRET` from step 2 |
| Authorization URL | `https://garage-log.<your-subdomain>.workers.dev/oauth/authorize` |
| Token URL | `https://garage-log.<your-subdomain>.workers.dev/oauth/token` |
| Scopes | anything, e.g. `garage` (not enforced - single-user project) |

Under **Actions** / fulfillment, set the fulfillment URL to
`https://garage-log.<your-subdomain>.workers.dev/smarthome`.

Fill in whatever minimal app name / icon the console requires - this project
stays in **Test** mode (not published, not reviewed), which is all a
personal, single-account Home needs.

## 4. Link your account

Google Home app -> **+** -> **Set up device** -> **Works with Google** ->
search for your project's app name -> it opens your `/oauth/authorize`
page -> type the `LINK_PASSWORD` from step 2 -> **Allow**. Google then
calls `SYNC` and a device named `DEVICE_NAME` should appear.

Test:
```
"Hey Google, otwórz <DEVICE_NAME>"
"Hey Google, zamknij <DEVICE_NAME>"
```
Both should click the relay (check `make monitor` - the log line will show
`user=GoogleHome`). Same phrases work from Android Auto once the phone is
connected - no extra setup there.

## Notes

- **Rotating access**: `LINK_PASSWORD` only matters once, at linking time -
  after that, revoke access from the Google Home app (remove the device) or
  rotate `TOKEN_SECRET` (invalidates every issued token at once).
- **Revoking just "GoogleHome"**: delete its roster line in `config.h` like
  any family member, re-flash. The Worker will still *try* to actuate, ESP32
  will just reject it (`unknown-user`).
- **This is additive**: nothing about `CMD_TOPIC`, the web app, or
  `docs/extended-log.md`'s log history changes. If Google ever breaks this
  integration too, delete the three new routes' worth of config and you're
  back to exactly where you started.
- **Android Auto tappable screen button** (an actual icon on the car's
  touchscreen, not just voice) is a separate, much bigger undertaking - a
  native Android app using the
  [Android for Cars App Library](https://developer.android.com/training/cars/apps/iot)'s
  IoT template. Not needed for voice control; only worth it if you want to
  tap instead of talk.
