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
