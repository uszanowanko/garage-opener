// Per-deployment settings for the web app.
//
// Not secret - this file is served publicly. The command topic is only useful
// to someone who also has a valid per-person key (see docs/threat-model.md).

window.GARAGE_CONFIG = {
  // Page title, heading, and the name of the installed app on the home screen.
  deviceName: "Wrota",

  // Used in "Open the personal link <admin> sent you".
  // Leave "" to fall back to a translated word ("the owner" / "właściciel").
  adminName: "",

  // "auto" follows the browser/phone language. Or pin one: "en", "pl", ...
  // (must be a key present in i18n.js)
  lang: "auto",

  // ntfy - must match firmware/include/config.h
  ntfy: "https://ntfy.sh",
  cmdTopic: "gate-REPLACE_WITH_RANDOM_HEX",
  logTopic: "gate-REPLACE_WITH_OTHER_RANDOM_HEX",
};
