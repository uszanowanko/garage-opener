# Android

Two ways, pick per person:

| Want | Do |
|---|---|
| Just a button | Tap your **personal link** (from `make invite`), then Chrome → ⋮ → **Add to Home screen**. Done. |
| "Hey Google, <your phrase>" / open on arrival / a home-screen widget | **HTTP Shortcuts** (below). |

## HTTP Shortcuts

Free & open source: <https://http-shortcuts.rmy.ch> (Play Store: "HTTP Shortcuts").

### 1. Create the shortcut

- **＋** → **New Shortcut** → name it in your language (e.g. **Otwórz wrota**).
- Method **POST**, URL `https://ntfy.sh/<CMD_TOPIC>` (your real topic — same as
  `firmware/include/config.h` and the web page).
- **Request Body** → **Custom text**, content type `text/plain`, body:

  ```
  {payload}
  ```

  (Insert a **Variable** named `payload`, type *Constant / plain*.)

### 2. Add the signing script

Shortcut → **Scripting** → **Run before execution** → paste
`prepare-request.js` from this folder. Set `NAME` and `K` (the `k=` part of your
personal link) at the top.

### 3. LAN fast path (optional, works with the local internet down)

Duplicate the shortcut as **<your shortcut> (LAN)** with URL
`http://<esp32-static-ip>/open`. Either add it to a folder, or in the main
shortcut's script check Wi-Fi and change the URL:

```js
if (getWifiSSID() === "mom-wifi") changeUrl("http://192.168.1.50/open");
```

### 4. Triggers

- **Widget**: long-press home screen → Widgets → HTTP Shortcuts → place
  your shortcut. One tap.
- **Geofence**: shortcut → **Trigger & Scheduling** → **Add trigger** →
  **Location** → the gate's address. Opens automatically on arrival.
- **"Hey Google, <your phrase>"**: HTTP Shortcuts registers shortcuts with
  Google Assistant / the system. Say the phrase, or add it as a routine
  (Google Home app → Routines → *add action* → *Try adding your own* → the
  shortcut). Also works from Android Auto by voice.

## Notes

- If opens fail, check the phone clock is automatic — skew over 60 s is rejected.
- `hmac()` is built into HTTP Shortcuts' scripting. If your version behaves
  differently (`bad-sig` in the ESP32 log), `prepare-request.js` has a drop-in
  self-contained fallback.
