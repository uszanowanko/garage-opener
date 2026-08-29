// ===========================================================================
// Scriptable script  -  https://scriptable.app  (free)
//
// Opens the gate. Run it from a Shortcut, Siri, the home screen, or an
// automation (Arrive / Join Wi-Fi).
//
// ---- ONE-TIME SETUP (run this once, then delete these 2 lines) --------------
//   Keychain.set("garage_name", "Tomek")   // your roster name
//   Keychain.set("garage_k", "….64 hex…")  // the k= part of your personal link
// ---------------------------------------------------------------------------
//
// CONFIG - match firmware + web:
const DEVICE_NAME = "Wrota";
const LANG = "pl";                             // "en" | "pl" (see MSG below)
const NTFY = "https://ntfy.sh";
const CMD_TOPIC = "gate-REPLACE_WITH_RANDOM_HEX";
const LAN_URL = "http://wrota.local/open";     // or http://192.168.1.50/open
const LAN_TIMEOUT_S = 2.5;
// ---------------------------------------------------------------------------

// vvv  self-contained SHA-256 / HMAC (generated from
//      clients/lib/hmac-sha256.js - do not edit here)  vvv
