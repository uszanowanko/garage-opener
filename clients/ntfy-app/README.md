# ntfy app — the "who opened it" feed

Every time the door opens, the ESP32 posts a line to `<LOG_TOPIC>`:

```
Tomek opened the garage @ 2026-08-29 18:04 — door now open
```

Anyone who wants a running feed of that on their phone:

1. Install **ntfy** (free): App Store / Play Store, or <https://ntfy.sh>.
2. **Subscribe to topic** → enter your `<LOG_TOPIC>` (the second string from
   `make topics`). Leave server as `ntfy.sh`, no login.
3. Done. Each open arrives as a normal push notification, with history in the app.

The web page shows the same list (last ~12 h) without installing anything.

> `<LOG_TOPIC>` is separate from `<CMD_TOPIC>`. Reading the log gives no ability
> to open the door — see `docs/threat-model.md`.
