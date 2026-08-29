# Wiring

## ⚠️ Safety

- You are only ever touching the opener's **low-voltage button terminals** (the
  two screws the wall button connects to — typically 12–24 V, dry contact).
- **Never** wire the relay, the ESP32, or yourself to mains / the 230 V side of
  the opener. If your opener has no separate low-voltage button terminals, stop
  and use a plug-in relay rated for the motor instead.
- Test with the door disconnected / in a safe position first.

## Parts

| Part | Notes |
|---|---|
| ESP32-WROOM-32 dev board | DevKitC or NodeMCU-32S |
| 1-channel relay module | opto-isolated, 5 V coil, separate `JD-VCC` jumper, control works at 3.3 V. Or an IRLZ44N MOSFET + 1N4148 flyback diode. |
| Reed switch | door-position sensor; NO or NC both fine |
| 5 V / 1 A USB supply | powers ESP32 (`VIN`/`5V`) and the relay coil |

## Connections

```
ESP32                     Relay module
-----                     ------------
5V / VIN  ───────────────  VCC   (and JD-VCC if the board has that jumper split)
GND       ───────────────  GND
GPIO23    ───────────────  IN            (RELAY_GPIO in config.h)

Relay COM  ─────┐
Relay NO   ─────┴──────────  opener button terminal 1
                             opener button terminal 2   (the relay just shorts
                                                          these two for PULSE_MS,
                                                          exactly like the wall
                                                          button)

ESP32                     Reed switch
-----                     -----------
GPIO22    ───────────────  one leg          (SENSOR_GPIO in config.h)
GND       ───────────────  other leg
```

- Reed switch mounted so the magnet is **aligned (contact made) when the door
  is CLOSED**. With `SENSOR_OPEN_WHEN_HIGH = 1` and the internal pull-up:
  closed → GPIO low → reported `closed`; door open → GPIO high → `open`.
  Flip `SENSOR_OPEN_WHEN_HIGH` if it reads backwards.
- Set `SENSOR_GPIO -1` to run without a sensor (log will say `unknown`).

## Boot glitch

Some relay boards click once during the ESP32's ~100 ms power-on before the
firmware drives the pin. Prefer a board that idles open with a floating input,
or add a 10 kΩ resistor from `RELAY_GPIO` to the inactive level
(GND for an active-high board). The firmware drives the pin inactive as its
very first action, so any glitch is sub-second — usually harmless for a garage
opener that needs a ~0.5 s pulse, but verify on the bench.

## Avoid these GPIOs

Strapping / boot pins: 0, 2, 5, 12, 15. Input-only (no output): 34–39.
Defaults 23 (relay) and 22 (sensor) are safe.
