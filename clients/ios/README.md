# iPhone

Two ways, pick per person:

| Want | Do |
|---|---|
| Just a button | Tap your **personal link** (from `make invite`), then Safari → Share → **Add to Home Screen**. Done. Nothing below needed. |
| "Hey Siri, <your phrase>" / open on arrival / open when I join the local Wi-Fi | Set up **Scriptable + a Shortcut** (below). |

## Scriptable + Shortcut

### 1. Install Scriptable

Free, from the App Store: <https://scriptable.app>

### 2. Add the script

- Open Scriptable → **＋** (new script) → name it `Garage`.
- Open `signer.js` from this folder, copy **everything**, paste it in, replacing
  the empty script.
- Near the top set: `CMD_TOPIC` (same as `config.h` / `web/config.js`),
  `DEVICE_NAME`, `LANG` (`"en"` / `"pl"`), and `LAN_URL` — use
  `http://<static-ip>/open` if you set one, it never fails to resolve.

### 3. Store your name + key (once)

Your key is the `k=` part of your personal link (64 hex chars), or the value
next to your name in `firmware/include/config.h`.

At the very top of the script, temporarily add these two lines, run the script
once (▶), then delete them and Save:

```js
Keychain.set("garage_name", "Tomek")     // your roster name
Keychain.set("garage_k", "….64 hex….")   // the k= part of your link
```

They go into the iOS Keychain, not the script file.

### 4. Make the Shortcut

Shortcuts app → **＋** → Add Action → **Run Script** (Scriptable) → choose your
script. Turn on **Run Script In App** = off if offered. **Name the Shortcut in
your language** — that name becomes the Siri phrase (e.g. "Otwórz wrota").

- **Siri / CarPlay**: the Shortcut name *is* the phrase — say
  "Hey Siri, &lt;that name&gt;" from the car.
- Add to Home Screen / Lock Screen / Action Button as you like.

### 5. Automations (optional, hands-free)

Shortcuts → **Automation** → **＋**:

- **Arrive** → the gate's address, radius small → Run your shortcut →
  **Ask Before Running: Off**.
- **Wi-Fi** → When I join the local Wi-Fi → same. (Fires closer in but is rock
  solid and works even if the local internet is down — the script tries the LAN
  path first.)

## Notes

- If opens start failing, check your **phone clock** is set to automatic — a
  skew over 60 s is rejected.
- `signer.js` is generated: `clients/build-signer.sh` = `signer.head.js` +
  `clients/lib/hmac-sha256.js` + `signer.tail.js`.
