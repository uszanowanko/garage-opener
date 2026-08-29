// HTTP Shortcuts -> your shortcut -> Scripting -> "Run before execution".
// Builds the signed payload into the {payload} variable.
//
// Set these two. KEYWORD is stored only in this app, on this phone.
const NAME = "Tomek";
const KEYWORD = "your-keyword";

const ts = Math.floor(Date.now() / 1000);

// k   = SHA-256(keyword), hex
// sig = HMAC-SHA256(key = k, msg = "v1:<ts>:<name>"), hex
const k = hash("SHA-256", KEYWORD);
const sig = hmac("SHA-256", k, "v1:" + ts + ":" + NAME);

setVariable("payload", "v1;" + ts + ";" + NAME + ";" + sig);

// ---------------------------------------------------------------------------
// If the ESP32 serial log shows "bad-sig" when you test, your HTTP Shortcuts
// version returns hmac()/hash() in a form we don't expect. Delete everything
// above and use this self-contained version instead: paste the entire contents
// of clients/lib/hmac-sha256.js here, then add:
//
//   const ts = Math.floor(Date.now() / 1000);
//   const k = GarageCrypto.sha256Hex(KEYWORD);
//   const sig = GarageCrypto.hmacSha256Hex(k, "v1:" + ts + ":" + NAME);
//   setVariable("payload", "v1;" + ts + ";" + NAME + ";" + sig);
// ---------------------------------------------------------------------------
