// HTTP Shortcuts -> your shortcut -> Scripting -> "Run before execution".
// Builds the signed payload into the {payload} variable.
//
// Set these two. K is the "k=" part of the personal link Tomek sent you
// (64 hex chars). It's stored only in this app, on this phone.
const NAME = "Tomek";
const K = "your-64-hex-key";

const ts = Math.floor(Date.now() / 1000);

// sig = HMAC-SHA256(key = K, msg = "v1:<ts>:<name>"), hex
const sig = hmac("SHA-256", K, "v1:" + ts + ":" + NAME);

setVariable("payload", "v1;" + ts + ";" + NAME + ";" + sig);

// ---------------------------------------------------------------------------
// If the ESP32 serial log shows "bad-sig" when you test, your HTTP Shortcuts
// version returns hmac() in a form we don't expect. Delete everything above and
// use this self-contained version instead: paste the entire contents of
// clients/lib/hmac-sha256.js here, then add:
//
//   const ts = Math.floor(Date.now() / 1000);
//   const sig = GarageCrypto.hmacSha256Hex(K, "v1:" + ts + ":" + NAME);
//   setVariable("payload", "v1;" + ts + ";" + NAME + ";" + sig);
// ---------------------------------------------------------------------------
