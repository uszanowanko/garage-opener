# Self-hosting ntfy (the escape hatch)

You never have to do this. It's here so the project outlives `ntfy.sh` if that
service ever disappears, rate-limits you, or you just want auth + long history.

`ntfy` is a single Go binary, Apache-2 licensed: <https://ntfy.sh/docs/install/>

## Minimal server

On any always-on box with a public name (a $3 VPS, the box that replaces the old
VPS, a friend's server, a home server with a port forward + DuckDNS):

```
# /etc/ntfy/server.yml
base-url: "https://ntfy.example.net"
listen-http: ":80"
behind-proxy: true
cache-file: "/var/lib/ntfy/cache.db"
cache-duration: "720h"        # 30 days of history instead of 12 h
auth-file: "/var/lib/ntfy/auth.db"
auth-default-access: "deny-all"
```

```
ntfy user add garage
ntfy access garage 'garage-*' rw
ntfy token add garage         # -> tk_xxx
```

Put it behind Caddy/nginx for TLS, or use ntfy's built-in Let's Encrypt.

## Point the project at it

Change the base URL (and add the token) in these places, then re-flash / redeploy:

| File | Change |
|---|---|
| `firmware/include/config.h` | `NTFY_HOST` → `ntfy.example.net`; add an `Authorization: Bearer tk_xxx` header in `streamConnect()` and `postLog()` in `main.cpp` |
| `firmware/include/certs.h` | swap in your server's CA if it isn't Let's Encrypt |
| `web/index.html` | `const NTFY = "https://ntfy.example.net"`; add `headers: { Authorization: "Bearer tk_xxx" }` to both `fetch`es |
| `clients/ios/signer.js` | `const NTFY = ...`; add the header to `post()` |
| `clients/android/prepare-request.js` + shortcut | new URL + `Authorization` header |

The wire format (`v1;ts;name;sig`) does not change. Nothing else moves.
