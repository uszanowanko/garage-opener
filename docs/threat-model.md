# Threat model

Small residential garage. The goal is "no easier to open than the physical
remote", with no ongoing maintenance.

## What is secret, what is not

| Thing | Secret? | If leaked |
|---|---|---|
| `k` (per person, 64 hex) | **yes** — on the ESP32 flash, in that person's clients, and in their setup link | opens *this door* as that person, until you rotate their roster line. It's random, so it reveals nothing else (no password reuse). |
| the **setup link** (`#n=..&k=..`) | **yes** — it carries `k` | same as `k`. Lives in whatever you sent it through and the recipient's messages. |
| `CMD_TOPIC` | **no** — it ships in the public web page | someone can publish junk to it; the ESP32 rejects anything without a valid signature. Worst case: noise in the ESP32 serial log. |
| `LOG_TOPIC` | **no** | someone can read "who opened it when", or publish fake log lines. No door access. |
| `CF_LOG_KEY` (optional, `extended-log.md`) | **yes** | write-only access to the extended log store — same class of risk as `LOG_TOPIC` (fake entries), plus it's a standing key rather than a public topic name. If leaked: `wrangler secret put LOG_WRITE_KEY` a new value, update `CF_LOG_HOST`'s firmware config, re-flash. Reading that store is public by design, same as `LOG_TOPIC`. |

## What stops an attacker who knows `CMD_TOPIC`

They still need a valid `payload`, which requires a roster `name` **and** that
person's `k`. Without it:

- forging `sig` = breaking HMAC-SHA256.
- replaying a captured `payload` = blocked: `ts` must be within 60 s of now and
  strictly newer than the last one the ESP32 accepted for that user.
- flooding = capped at `MAX_OPENS_PER_MIN` actuations/minute.

`ntfy.sh` operators can see every `payload` in transit. A captured one is
useless after 60 s, and useless immediately once a newer one lands.

## Residual risks (accepted)

- **Physical access to the ESP32** → pull the flash, read every user's `k`,
  open this door. Mitigation if you care: enable ESP32 flash encryption
  (`board_build.flash_mode`/`platformio` secure-boot docs). An attacker with
  hands on the box is next to the door anyway.
- **`ntfy.sh` goes rogue / is compromised** → could suppress opens (annoying,
  not dangerous) or replay within the 60 s window. Fix: self-host
  (`self-host-ntfy.md`).
- **`CMD_TOPIC` spam** → if someone floods the topic, the ESP32 wastes cycles
  rejecting it and `ntfy.sh` may rate-limit the topic. Fix: rotate the topic
  (edit 3 files, re-flash), or self-host ntfy with an auth token.
- **A stolen unlocked phone** → has that person's client. Same as a stolen
  physical remote; revoke by removing their roster line + re-flash.
- **Setup link in a chat history** → someone with access to that conversation
  (a shared iCloud, a nosy relative, a leaked backup) gets that person's `k`.
  Send links over a reasonably private channel; the page strips the link from
  the URL after first use; rotating one person is cheap (below).

## Rotating / revoking

- One person: `make invite NAME="Mama"` for a fresh `k`, replace their
  `{ "Name", "k" }` line in `config.h`, `make flash` (or OTA), send the new
  link. Their old link/key stops working immediately.
- Everything: `make topics`, update `config.h` + `web/index.html` + the client
  configs, re-flash, re-send links.
