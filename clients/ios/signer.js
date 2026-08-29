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
// Self-contained SHA-256 + HMAC-SHA256. No dependencies, no WebCrypto.
// Runs in browsers, Scriptable, the HTTP Shortcuts JS sandbox, and Node.
//
// This is the fallback used where a platform has no native crypto. It is
// deliberately small and frozen. Keep it byte-for-byte identical everywhere
// it is pasted (clients/ios/signer.js embeds a copy).
//
//   GarageCrypto.hmacSha256Hex(k, "v1:<ts>:<name>")  -> sig (64 hex chars)
//   GarageCrypto.sha256Hex(str)                      -> hex (only if you want a
//                                                        passphrase-derived k)
//
// Protocol (docs/protocol.md):
//   k    = the person's 64-hex key
//   sig  = hmacSha256(key = utf8(k), msg = utf8("v1:" + ts + ":" + name))

var GarageCrypto = (function () {
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }

  function sha256Bytes(bytes) {
    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    var l = bytes.length;
    var withOne = l + 1;
    var pad = (56 - (withOne % 64) + 64) % 64;
    var total = withOne + pad + 8;
    var m = new Uint8Array(total);
    m.set(bytes);
    m[l] = 0x80;
    var bitLen = l * 8;
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    m[total - 8] = (hi >>> 24) & 0xff; m[total - 7] = (hi >>> 16) & 0xff;
    m[total - 6] = (hi >>> 8) & 0xff;  m[total - 5] = hi & 0xff;
    m[total - 4] = (lo >>> 24) & 0xff; m[total - 3] = (lo >>> 16) & 0xff;
    m[total - 2] = (lo >>> 8) & 0xff;  m[total - 1] = lo & 0xff;

    var w = new Int32Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (m[off + 4 * t] << 24) | (m[off + 4 * t + 1] << 16) |
               (m[off + 4 * t + 2] << 8) | m[off + 4 * t + 3];
      }
      for (t = 16; t < 64; t++) {
        var x15 = w[t - 15], x2 = w[t - 2];
        var s0 = rotr(7, x15) ^ rotr(18, x15) ^ (x15 >>> 3);
        var s1 = rotr(17, x2) ^ rotr(19, x2) ^ (x2 >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3],
          e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = new Uint8Array(32);
    for (var i = 0; i < 8; i++) {
      out[4 * i] = (H[i] >>> 24) & 0xff;
      out[4 * i + 1] = (H[i] >>> 16) & 0xff;
      out[4 * i + 2] = (H[i] >>> 8) & 0xff;
      out[4 * i + 3] = H[i] & 0xff;
    }
    return out;
  }

  function utf8(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str));
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
  }

  function bytesToHex(b) {
    var s = "";
    for (var i = 0; i < b.length; i++) {
      s += (b[i] >>> 4).toString(16) + (b[i] & 0x0f).toString(16);
    }
    return s;
  }

  function concat(a, b) {
    var c = new Uint8Array(a.length + b.length);
    c.set(a); c.set(b, a.length);
    return c;
  }

  function hmac(keyBytes, msgBytes) {
    if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes);
    var block = new Uint8Array(64);
    block.set(keyBytes);
    var ipad = new Uint8Array(64), opad = new Uint8Array(64);
    for (var i = 0; i < 64; i++) {
      ipad[i] = block[i] ^ 0x36;
      opad[i] = block[i] ^ 0x5c;
    }
    return sha256Bytes(concat(opad, sha256Bytes(concat(ipad, msgBytes))));
  }

  return {
    sha256Hex: function (str) { return bytesToHex(sha256Bytes(utf8(str))); },
    hmacSha256Hex: function (keyStr, message) {
      return bytesToHex(hmac(utf8(keyStr), utf8(message)));
    },
  };
})();

// ^^^  end generated crypto  ^^^

const MSG = {
  en: {
    opening: "{name} opening",
    rejected: "{name} rejected the request ({code})",
    unreachable: "Can't reach {name}",
    notset: "{name} isn't set up on this phone",
  },
  pl: {
    opening: "Otwieram: {name}",
    rejected: "{name}: żądanie odrzucone ({code})",
    unreachable: "Brak połączenia z: {name}",
    notset: "{name} nie jest skonfigurowane na tym telefonie",
  },
};
const M = MSG[LANG] || MSG.en;
const say = (key, vars) => {
  let s = M[key];
  const all = Object.assign({ name: DEVICE_NAME }, vars || {});
  for (const k in all) s = s.split("{" + k + "}").join(all[k]);
  return s;
};

async function post(url, body, timeoutS) {
  const r = new Request(url);
  r.method = "POST";
  r.headers = { "Content-Type": "text/plain" };
  r.body = body;
  if (timeoutS) r.timeoutInterval = timeoutS;
  await r.loadString();
  return r.response.statusCode;
}

async function run() {
  const name = Keychain.contains("garage_name") ? Keychain.get("garage_name") : null;
  const k = Keychain.contains("garage_k") ? Keychain.get("garage_k") : null;
  if (!name || !k) return say("notset");

  const ts = Math.floor(Date.now() / 1000);
  const sig = GarageCrypto.hmacSha256Hex(k, "v1:" + ts + ":" + name);
  const body = "v1;" + ts + ";" + name + ";" + sig;

  // LAN first: instant on Wi-Fi and works with the house internet down.
  try {
    const code = await post(LAN_URL, body, LAN_TIMEOUT_S);
    return code >= 200 && code < 300 ? say("opening") : say("rejected", { code });
  } catch (e) { /* not on the LAN */ }

  try {
    const code = await post(NTFY + "/" + CMD_TOPIC, body);
    return code >= 200 && code < 300 ? say("opening") : say("rejected", { code });
  } catch (e) {
    return say("unreachable");
  }
}

const message = await run();
try { Script.setShortcutOutput(message); } catch (e) {}

if (config.runsInApp || config.runsFromHomeScreen) {
  const n = new Notification();
  n.title = DEVICE_NAME;
  n.body = message;
  await n.schedule();
}
Script.complete();
