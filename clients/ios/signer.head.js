// ===========================================================================
// Scriptable script: "Garage"  -  https://scriptable.app  (free)
//
// Opens mom's garage. Run it from a Shortcut, Siri ("open mom's garage"),
// the home screen, or an automation (Arrive / Join Wi-Fi).
//
// ---- ONE-TIME SETUP (run this once, then delete these 3 lines) --------------
//   Keychain.set("garage_name", "Tomek")        // your roster name
//   Keychain.set("garage_keyword", "hunter2")   // your keyword
//   // then remove the 3 lines and keep the rest
// ---------------------------------------------------------------------------
//
// CONFIG - fill from `make topics` (same values as firmware + web):
const NTFY = "https://ntfy.sh";
const CMD_TOPIC = "garage-REPLACE_WITH_RANDOM_HEX";
const LAN_URL = "http://garage.local/open";   // or http://192.168.1.50/open
const LAN_TIMEOUT_S = 2.5;
// ---------------------------------------------------------------------------

// vvv  self-contained SHA-256 / HMAC (generated from
//      clients/lib/hmac-sha256.js - do not edit here)  vvv
