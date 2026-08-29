// Copy this file to config.h and fill it in. config.h is gitignored.
//
//   cp firmware/include/config.example.h firmware/include/config.h
//
#pragma once

// ---------------------------------------------------------------------------
// Wi-Fi
// ---------------------------------------------------------------------------
#define WIFI_SSID        "mom-wifi"
#define WIFI_PASS        "change-me"

// Static IP is strongly recommended so the LAN path (http://<ip>/open) and
// OTA are stable. Leave STATIC_IP as "" to use DHCP, but then also add a DHCP
// reservation on the router. If you set a static IP, still reserve it too.
#define STATIC_IP        "192.168.1.50"
#define GATEWAY_IP       "192.168.1.1"
#define SUBNET_MASK      "255.255.255.0"
#define DNS_IP           "192.168.1.1"

// mDNS hostname -> device answers to http://garage.local/
#define MDNS_HOST        "garage"

// ---------------------------------------------------------------------------
// Time zone (POSIX TZ string). Europe/Warsaw shown.
// https://github.com/nayarsystems/posix_tz_db/blob/master/zones.csv
// ---------------------------------------------------------------------------
#define TZ_STRING        "CET-1CEST,M3.5.0,M10.5.0/3"

// ---------------------------------------------------------------------------
// ntfy topics. Generate with:  make topics   (or: openssl rand -hex 24)
// These are NOT secrets (the web page ships CMD_TOPIC in plain sight).
// Actuation is gated by the per-user HMAC below, not by topic secrecy.
// ---------------------------------------------------------------------------
#define NTFY_HOST        "ntfy.sh"
#define NTFY_PORT        443
#define CMD_TOPIC        "garage-REPLACE_WITH_RANDOM_HEX"
#define LOG_TOPIC        "garage-REPLACE_WITH_OTHER_RANDOM_HEX"

// Published web page, no trailing slash. Used by `make invite` to build the
// per-person setup links.
#define WEB_BASE_URL     "https://uszanowanko.github.io/garage-opener"

// ---------------------------------------------------------------------------
// GPIO
// ---------------------------------------------------------------------------
#define RELAY_GPIO             23
#define RELAY_ACTIVE_HIGH      1     // 1 = pin HIGH closes the relay; 0 = active-low board
#define PULSE_MS              500    // how long to hold the opener's button

#define SENSOR_GPIO           22    // reed switch: other leg to GND. -1 to disable.
#define SENSOR_OPEN_WHEN_HIGH  1    // 1 = HIGH means door open (magnet away)

// ---------------------------------------------------------------------------
// Safety limits
// ---------------------------------------------------------------------------
#define MAX_OPENS_PER_MIN      6    // hard cap on actuations in any 60 s window
#define FRESHNESS_WINDOW_S    60    // reject requests whose ts is off by more than this

// ---------------------------------------------------------------------------
// OTA update password (pio run -t upload --upload-port garage.local)
// ---------------------------------------------------------------------------
#define OTA_PASSWORD     "change-me-too"

// ---------------------------------------------------------------------------
// Roster: one row per person.
//   name   : 1..31 chars, printable ASCII, NO ';' and NO ':'
//   k_hex  : that person's 64-hex key. Generate name + link + this line with:
//              make invite NAME="Mama"
//   To revoke someone: delete their row and re-flash (or OTA).
// ---------------------------------------------------------------------------
static const struct RosterEntry {
  const char* name;
  const char* k_hex;
} ROSTER[] = {
  { "Tomek", "0000000000000000000000000000000000000000000000000000000000000000" },
  // { "Mama",  "....64 hex...." },
  // { "Kasia", "....64 hex...." },
};
