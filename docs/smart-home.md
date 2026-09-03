# "Otwórz wrota" / "Zamknij wrota" - Google Home + Android Auto

## Status - pick up here in a new session

Parts A/B/C below are **done** - Worker deployed with all secrets set,
Google Home project registered, account linked, voice control confirmed
working end to end ("otwórz"/"zamknij" both tested, correct name shows up
when the ESP32 is online). Don't repeat them.

Known limitation, left as-is for now: `EXECUTE` reports success back to
Google immediately after posting to ntfy, with no confirmation the ESP32
actually received or acted on it - if the device is offline, Google will
still say it worked. Revisit if this becomes an actual problem in
practice.

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

## Everyone links their own account, so the log shows the real name

Google's Smart Home platform expects exactly this: every household member
who wants voice control performs *their own* account linking with your
fulfillment ([confirmed in Google's own developer docs](https://developers.google.com/assistant/smarthome/concepts/account-linking) -
"your Cloud-to-cloud integration is expected to support multiple Google
users connecting to the same user account"). So each person authenticates
on your consent page with **their own real roster name and k** (the exact
same `k` from their personal setup link) - the OAuth token Google then
attaches to every voice command tells the Worker who to sign as. "Otwórz
wrota" from Tomek's phone (or his Android Auto, which just uses his phone's
Google session) logs `Tomek`, opened it; from Kasia's, `Kasia`. There's no
shared "GoogleHome" identity - Google Home is not a person here, your
family members are, same as their phones or the ntfy app.

Both "Otwórz wrota" and "Zamknij wrota" still send the **identical**
signed command - there's one relay pulse, no separate close action. Google
just lets each person say two different phrases for it.

`QUERY` (Google asking "what state is it in") reports a best-effort
*guess*, reusing the exact same no-sensor heuristic as the web app's
history list - see `docs/extended-log.md`. It is not, and cannot be, a
fact, and it isn't tied to any one person - it's the shared gate state.

## 1. Build the voice roster `[YOU]`

For everyone who should get voice control, you already have their `k` -
it's the same one from their personal setup link / their line in
`ROSTER[]` in `firmware/include/config.h`. No new keys, no firmware
changes. Build one JSON object:

```json
{"Tomek": "f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7",
 "Kasia": "...their 64-hex k..."}
```

## 2. Add the Worker secrets `[YOU]`

On top of `LOG_WRITE_KEY` (already set per `docs/extended-log.md`):

```
cd cloudflare
wrangler secret put VOICE_ROSTER            # paste the JSON from step 1
openssl rand -hex 32                        # -> TOKEN_SECRET, save it
wrangler secret put TOKEN_SECRET
openssl rand -hex 16                        # -> SMARTHOME_CLIENT_ID, save it
wrangler secret put SMARTHOME_CLIENT_ID
openssl rand -hex 32                        # -> SMARTHOME_CLIENT_SECRET, save it
wrangler secret put SMARTHOME_CLIENT_SECRET
```

Edit `wrangler.toml`'s `[vars]`: set `CMD_TOPIC` to your real topic
(`firmware/include/config.h`) and `DEVICE_NAME` to whatever you want Google
to call it ("Wrota", "Brama", anything - this is the name everyone's voice
phrases will use: "Otwórz `<DEVICE_NAME>`" / "Zamknij `<DEVICE_NAME>`").

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
| Scopes | anything, e.g. `garage` (not enforced) |

Under **Actions** / fulfillment, set the fulfillment URL to
`https://garage-log.<your-subdomain>.workers.dev/smarthome`.

Fill in whatever minimal app name / icon the console requires - this project
stays in **Test** mode (not published, not reviewed), which is all a
personal, family-only Home needs.

## 4. Each person links their own account

For every person in `VOICE_ROSTER` (each on their own phone, signed into
their own Google account, ideally already a member of your Google Home
household so they can also *hear* results / use the shared speakers):

Google Home app -> **+** -> **Set up device** -> **Works with Google** ->
search for your project's app name -> it opens your `/oauth/authorize`
page -> enter **their name and their k** (exactly as in
`VOICE_ROSTER`/`ROSTER[]`) -> **Allow**. A device named `DEVICE_NAME`
appears in their Google Home.

Test, from that person's own phone or their Android Auto:
```
"Hey Google, otwórz <DEVICE_NAME>"
"Hey Google, zamknij <DEVICE_NAME>"
```
Check `make monitor` - the log line's `user=` should show *that* person's
name, not a generic identity.

## Notes

- **Adding someone later**: add their `{name, k}` to the `VOICE_ROSTER`
  JSON, `wrangler secret put VOICE_ROSTER` again (no `wrangler deploy`
  needed - secrets update live), have them link per step 4.
- **Revoking one person's voice access without touching their phone/ntfy
  access**: remove them from `VOICE_ROSTER`, `wrangler secret put` again.
  Their EXECUTE calls then fail (`authFailure`) even though their token is
  still "valid" - the Worker just has no key to sign with any more.
- **Revoking someone everywhere** (phone, ntfy, voice, all at once): delete
  their roster line in `config.h` like normal, re-flash. The Worker will
  still try to sign as them, but the ESP32 will reject it
  (`unknown-user`/`bad-sig` once you also change their `k`).
- **If `VOICE_ROSTER` or `TOKEN_SECRET` leak**: `VOICE_ROSTER` leaking is
  exactly as bad as `config.h` leaking (it holds the same real keys) -
  rotate every affected person's key (`make invite` again) and update both
  `config.h` and `VOICE_ROSTER`. `TOKEN_SECRET` leaking lets someone forge
  a fulfillment call for any name already in `VOICE_ROSTER` without
  re-linking - rotate it (`wrangler secret put TOKEN_SECRET` a new value);
  every issued token is invalidated at once, everyone re-links.
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
