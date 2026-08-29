# Threat model

Small residential garage. The goal is "no easier to open than the physical
remote", with no ongoing maintenance.

## What is secret, what is not

| Thing | Secret? | If leaked |
|---|---|---|
| `keyword` (per person) | **yes** | that person's access until you rotate their roster line |
| `k = SHA-256(keyword)` | **yes-ish** — it's on the ESP32 flash and in each of that person's clients | same as the keyword for *this door*; does **not** reveal the keyword (so no password-reuse blast radius) |
| `CMD_TOPIC` | **no** — it ships in the public web page | someone can publish junk to it; the ESP32 rejects anything without a valid signature. Worst case: noise in the ESP32 serial log. |
| `LOG_TOPIC` | **no** | someone can read "who opened it when", or publish fake log lines. No door access. |

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

## Rotating / revoking

- One person: delete or change their `{ "Name", "k" }` line in `config.h`,
  `make flash` (or OTA). Their old keyword stops working immediately.
- Everything: `make topics`, update `config.h` + `web/index.html` + the client
  configs, re-flash, re-enter keywords.
