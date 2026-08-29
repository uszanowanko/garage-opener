# Protocol

One message opens the door. Everything speaks this exact format.

## Derivation

```
keyword    a memorable string the person picks. Never stored, never sent.
k          = lowercase_hex( SHA-256( utf8(keyword) ) )          # 64 chars
name       the person's roster name: 1..31 chars, printable ASCII, no ';' no ':'
ts         current time, unix seconds (integer, as a decimal string)
canonical  = "v1:" + ts + ":" + name
sig        = lowercase_hex( HMAC-SHA256( key = utf8(k), msg = utf8(canonical) ) )
payload    = "v1;" + ts + ";" + name + ";" + sig
```

Note the HMAC **key is the 64 ASCII bytes of the hex string `k`**, not the 32
raw digest bytes. This is deliberate — every client platform can use a hex
string as an HMAC key; not all can pass raw bytes.

## Transport

- Remote: `POST https://ntfy.sh/<CMD_TOPIC>` with `payload` as the body.
- LAN: `POST http://<esp32>/open` with `payload` as the body.

The ESP32 also holds `GET https://ntfy.sh/<CMD_TOPIC>/raw` open and treats each
non-empty line it receives as a `payload`.

## Acceptance rules (all must hold)

| Check | Rule |
|---|---|
| format | exactly 4 `;`-separated fields, field 0 == `v1`, field 3 is 64 hex |
| name | in the roster |
| clock | ESP32 has NTP time (else everything is rejected) |
| freshness | `abs(now - ts) <= 60` seconds |
| replay | `ts` strictly greater than the last accepted `ts` for that name |
| signature | recomputed `sig` equals the supplied one (constant-time) |
| rate | fewer than `MAX_OPENS_PER_MIN` actuations in the last 60 s |

On success the ESP32 pulses the relay for `PULSE_MS`, reads the door sensor,
and posts a line to `<LOG_TOPIC>`.

## Reference vectors

```
keyword = "hunter2"
k       = f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7
name    = "Tomek"
ts      = 1700000000
canonical = v1:1700000000:Tomek
sig     = 313fe4dfed5bff78afe1bf493eb9bf37237c8457502ab526fa344a03c930a9e4
payload = v1;1700000000;Tomek;313fe4dfed5bff78afe1bf493eb9bf37237c8457502ab526fa344a03c930a9e4
```

Test any implementation against this with:

```
node firmware/tools/send-open.mjs --name Tomek --keyword hunter2 --ts 1700000000
```
