# Extended log history (the 12h escape hatch)

The public `ntfy.sh` server only keeps message history for **12 hours**
(`docs/self-host-ntfy.md` shows the setting: `cache-duration: "720h"` to get
30 days on a self-hosted server instead). That's why the web app's history
list asks ntfy for `since=12h` — anything older simply isn't there any more.

This adds a second, always-written log store with no such cap, using
**Cloudflare Workers + Workers KV** — free indefinitely, no credit card, one
small script, nothing to patch or renew. It's purely additive: if you never
set it up, everything works exactly as before (ntfy only, 12h history).
Self-hosting `ntfy` itself (`self-host-ntfy.md`) is still the fallback if you
ever want to leave free public services behind entirely — this is not that.

## How it fits in

- The ESP32 writes every open to **both** `LOG_TOPIC` (ntfy) and the Worker,
  always, independently. Either one failing never blocks the other or the
  actuation itself.
- The web app tries the Worker first. If it answers, that's the whole
  history list — ntfy isn't even queried. If it doesn't answer (not
  configured, network hiccup, Worker down), the app falls back to ntfy's
  12h window and says so under the list.
- Nothing about `CMD_TOPIC` / signing / actuation changes. This is
  logging-only.

## 1. Deploy the Worker `[YOU]`

Needs a free Cloudflare account and `wrangler` (`npm install -g wrangler`,
or `npx wrangler ...` without installing globally).

```
cd cloudflare
wrangler login
wrangler kv namespace create LOGS
```

Copy the printed `id` into `wrangler.toml`'s `kv_namespaces` entry (replacing
`REPLACE_WITH_KV_NAMESPACE_ID`).

```
openssl rand -hex 32                 # -> your LOG_WRITE_KEY, save it
wrangler secret put LOG_WRITE_KEY    # paste the value above
wrangler deploy
```

Note the URL `wrangler deploy` prints, e.g.
`https://garage-log.<your-subdomain>.workers.dev`.

## 2. Verify it works

```
W=https://garage-log.<your-subdomain>.workers.dev
K=<the LOG_WRITE_KEY you generated>

curl -i -X POST "$W/log" \
  -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -d '{"message":"test entry","time":1700000000}'
# expect: HTTP/1.1 204

curl -s "$W/log?limit=5"
# expect: [{"message":"test entry","time":1700000000}]
```

## 3. Point the firmware at it

In `firmware/include/config.h`:

```
#define CF_LOG_HOST   "garage-log.<your-subdomain>.workers.dev"
#define CF_LOG_KEY    "<the same LOG_WRITE_KEY>"
```

`make flash` (or OTA). Watch `make monitor` after the next open — no
`[log-cf] connect failed` line means it worked; a real entry should show up
via `curl "$W/log?limit=5"`.

### About the TLS connection

`postLogCF()` in `main.cpp` currently connects with `c.setInsecure()`
instead of a pinned CA — `*.workers.dev`'s certificate chain isn't fixed in
this repo because it couldn't be verified from the environment this feature
was built in. The channel only carries a non-secret log line plus the write
key, and a forged/fake log entry is already an accepted risk for `LOG_TOPIC`
(`docs/threat-model.md`) — but an on-path attacker could also capture
`CF_LOG_KEY` in transit this way, which is a bit worse (a standing ability to
write fake entries, not just a one-off). To close that, pin the real chain:

```
openssl s_client -connect garage-log.<your-subdomain>.workers.dev:443 -showcerts </dev/null
```

Take the last (root) certificate's PEM block, add it to
`firmware/include/certs.h` as `CF_ROOT_CA_BUNDLE` (same shape as
`NTFY_ROOT_CA_BUNDLE` above it), then swap `c.setInsecure()` for
`c.setCACert(CF_ROOT_CA_BUNDLE)` in `postLogCF()`. Re-flash after.

## 4. Point the web app at it

In `web/config.js` (or the `CF_LOG_URL` repo Variable, like the other
settings):

```
cfLog: "https://garage-log.<your-subdomain>.workers.dev/log",
```

Redeploy the page (push, or re-run the Pages workflow). Open the web app —
"Recent" now comes from the Worker; opening the gate should show up
immediately and stay in the list past 12h.

## Notes

- **Free tier**: Cloudflare's free plan (Workers + Workers KV) is generous
  enough for this — a household opening a gate a few times a day is nowhere
  close to its daily request limits. Check
  `https://developers.cloudflare.com/workers/platform/pricing/` for current
  numbers if you're curious.
- **Not a secret**: like `LOG_TOPIC`, the read side (`GET /log`) is public by
  design — same "who opened it, no door access" posture. Only writing
  requires `LOG_WRITE_KEY`.
- **Rotating the key**: `wrangler secret put LOG_WRITE_KEY` a new value,
  update `CF_LOG_KEY` in `config.h`, re-flash/OTA.
- **Removing this**: set `CF_LOG_HOST` back to `""` and `cfLog` back to `""`.
  The Worker and KV namespace can stay deployed unused, or
  `wrangler delete`.
