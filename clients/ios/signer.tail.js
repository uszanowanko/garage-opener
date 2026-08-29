// ^^^  end generated crypto  ^^^

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
  if (!name || !k) return "Garage is not set up on this phone";

  const ts = Math.floor(Date.now() / 1000);
  const sig = GarageCrypto.hmacSha256Hex(k, "v1:" + ts + ":" + name);
  const body = "v1;" + ts + ";" + name + ";" + sig;

  // Try the LAN path first: instant on mom's Wi-Fi and works with her
  // internet down. Fails fast elsewhere, then we fall back to ntfy.
  try {
    const code = await post(LAN_URL, body, LAN_TIMEOUT_S);
    return code >= 200 && code < 300 ? "Garage opening" : "Garage rejected it (" + code + ")";
  } catch (e) { /* not on the LAN */ }

  try {
    const code = await post(NTFY + "/" + CMD_TOPIC, body);
    return code >= 200 && code < 300 ? "Garage opening" : "Garage rejected it (" + code + ")";
  } catch (e) {
    return "Garage: could not reach it";
  }
}

const message = await run();
try { Script.setShortcutOutput(message); } catch (e) {}

if (config.runsInApp || config.runsFromHomeScreen) {
  const n = new Notification();
  n.title = "Garage";
  n.body = message;
  await n.schedule();
}
Script.complete();
