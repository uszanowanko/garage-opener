// Per-deployment settings for the web app.
//
// Two ways to set these, mix freely:
//   A) edit the values below and commit, or
//   B) set repo Variables (Settings -> Secrets and variables -> Actions ->
//      Variables) - any that are set override the matching value here at deploy:
//        DEVICE_NAME  ADMIN_NAME  WEB_LANG  NTFY_BASE  CMD_TOPIC  LOG_TOPIC  CF_LOG_URL
//
// Not secret - this file is served publicly. The command topic is only useful
// to someone who also has a valid per-person key (see docs/threat-model.md).

window.GARAGE_CONFIG = {
  // Page title, heading, and the name of the installed app.   [DEVICE_NAME]
  deviceName: "Gate",

  // Fills "the personal link <admin> sent you".               [ADMIN_NAME]
  // "" -> a translated fallback ("the owner" / "właściciel").
  adminName: "",

  // "auto" follows the phone; or pin "en" / "pl" / ...         [WEB_LANG]
  lang: "auto",

  // ntfy base URL - must match firmware.                       [NTFY_BASE]
  ntfy: "https://ntfy.sh",

  // must match firmware/include/config.h                       [CMD_TOPIC] [LOG_TOPIC]
  cmdTopic: "gate-REPLACE_WITH_RANDOM_HEX",
  logTopic: "gate-REPLACE_WITH_OTHER_RANDOM_HEX",

  // Optional: Cloudflare Worker URL for log history beyond ntfy.sh's 12h cap.
  // "" -> read history from ntfy only (original behaviour). Tried first when
  // set; falls back to ntfy automatically if it doesn't answer. See
  // docs/extended-log.md.                                       [CF_LOG_URL]
  cfLog: "",
};
