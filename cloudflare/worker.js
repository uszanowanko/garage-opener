// Cloudflare Worker: two things bolted onto one small script.
// See ../docs/extended-log.md and ../docs/smart-home.md for setup.
//
// 1. Log history longer than ntfy.sh's 12h public cache (unchanged - see
//    extended-log.md):
//      POST /log   Authorization: Bearer <LOG_WRITE_KEY>
//                  body: {"name","time","state"}
//      GET  /log?limit=10
//                  -> [{"name","time","state"}, ...] newest first, CORS-open
//
// 2. A Google Smart Home ("Otwórz <name>" / "Zamknij <name>", incl. hands-free
//    from Android Auto) fulfillment, backed by the exact same roster
//    mechanism every phone already uses - see smart-home.md for the Google
//    Home Developer Console side of this:
//      GET|POST /oauth/authorize   OAuth consent screen (password-gated)
//      POST     /oauth/token       OAuth token exchange
//      POST     /smarthome         SYNC / QUERY / EXECUTE fulfillment
//
// Bindings this Worker needs:
//   GARAGE_LOGS   KV namespace  - shared by both halves (log entries)
//   LOG_WRITE_KEY secret        - shared with the ESP32's CF_LOG_KEY
//   GATE_SIGN_KEY secret        - a roster member's 64-hex k (`make invite
//                                 NAME="GoogleHome"`), lets this Worker sign
//                                 its own open/close commands
//   TOKEN_SECRET  secret        - signs this Worker's own OAuth tokens
//   SMARTHOME_CLIENT_ID/SECRET  secret - chosen by you, entered verbatim into
//                                 the Google Home Developer Console
//   LINK_PASSWORD secret        - gates the OAuth consent screen so only you
//                                 can link your Google account
//   GATE_SIGN_NAME, CMD_TOPIC, NTFY_BASE, DEVICE_NAME, AGENT_USER_ID - plain
//                                 vars, see wrangler.toml

const MAX_ENTRIES = 200;
const KV_KEY = "logs";
const STATES = new Set(["open", "closed", "unknown"]);

// --------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function nowS() {
  return Math.floor(Date.now() / 1000);
}

// HMAC key = the ASCII bytes of the hex string k (see docs/protocol.md) -
// identical scheme to the firmware and web/index.html's hmacHex().
async function hmacHex(keyAscii, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(keyAscii), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

// Minimal self-contained bearer tokens (payload.sig, both HMAC'd with
// TOKEN_SECRET) - no session storage needed, matches the ntfy payload's own
// "signed, not stored" approach.
async function signToken(secret, payload) {
  const body = b64url(JSON.stringify(payload));
  return body + "." + (await hmacHex(secret, body));
}
async function verifyToken(secret, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  if ((await hmacHex(secret, body)) !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && nowS() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Log storage (POST/GET /log) - see docs/extended-log.md
// --------------------------------------------------------------------------
function respond(body, status, extraHeaders) {
  return new Response(body, {
    status,
    headers: { "Access-Control-Allow-Origin": "*", ...extraHeaders },
  });
}

// A deliberate open->close cycle takes ~20-25s; two actuations closer
// together than BURST_GAP_S are the same person re-clicking, not a new
// action. After a silence of at least LONG_GAP_S, assume the gate is closed
// and the next actuation is a fresh open regardless of plain alternation.
// Keep this in sync with the identical function in web/index.html.
const BURST_GAP_S = 20;
const LONG_GAP_S = 120;

function classify(rows) {
  const asc = [...rows].sort((a, b) => a.time - b.time);
  let lastRealTime = -Infinity;
  let lastGuess = "closed";
  for (const row of asc) {
    const gap = row.time - lastRealTime;
    if (gap < BURST_GAP_S) {
      row.burst = true;
      continue;
    }
    const known = row.state === "open" || row.state === "closed";
    row.guess = known ? row.state
      : gap >= LONG_GAP_S ? "open"
      : (lastGuess === "open" ? "closed" : "open");
    lastRealTime = row.time;
    lastGuess = row.guess;
  }
  return rows;
}

async function readLogs(env) {
  const raw = await env.GARAGE_LOGS.get(KV_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function handleLog(request, url, env) {
  if (request.method === "OPTIONS") {
    return respond(null, 204, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
  }

  if (request.method === "GET") {
    const all = await readLogs(env);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10) || 10));
    return respond(JSON.stringify(all.slice(0, limit)), 200, { "Content-Type": "application/json" });
  }

  if (request.method === "POST") {
    if (request.headers.get("Authorization") !== `Bearer ${env.LOG_WRITE_KEY}`)
      return respond("unauthorized", 401);

    let entry;
    try {
      entry = await request.json();
    } catch {
      return respond("bad json", 400);
    }
    const name = String(entry.name || "").slice(0, 40);
    const time = Number.isFinite(entry.time) ? entry.time : nowS();
    const state = STATES.has(entry.state) ? entry.state : "unknown";
    if (!name) return respond("empty name", 400);

    const all = await readLogs(env);
    all.unshift({ name, time, state });
    await env.GARAGE_LOGS.put(KV_KEY, JSON.stringify(all.slice(0, MAX_ENTRIES)));
    return respond(null, 204);
  }

  return respond("method not allowed", 405);
}

// --------------------------------------------------------------------------
// Google Smart Home fulfillment
// --------------------------------------------------------------------------
const GATE_DEVICE_ID = "gate";

// Best-effort guess at the current state, reusing the same log entries and
// heuristic the web app's history list uses - see docs/extended-log.md for
// why this can never be a fact (no door sensor).
async function guessOpenPercent(env) {
  const rows = await readLogs(env);
  if (!rows.length) return 0;
  classify(rows);
  const withGuess = [...rows].sort((a, b) => a.time - b.time).filter((r) => r.guess);
  const last = withGuess[withGuess.length - 1];
  return last && last.guess === "open" ? 100 : 0;
}

// Fire-and-forget, same wire format as web/index.html's Open button and the
// firmware's roster check - GATE_SIGN_NAME must be a real roster entry
// (`make invite NAME="GoogleHome"`).
async function actuateGate(env) {
  const ts = nowS();
  const name = env.GATE_SIGN_NAME || "GoogleHome";
  const sig = await hmacHex(env.GATE_SIGN_KEY, `v1:${ts}:${name}`);
  const body = `v1;${ts};${name};${sig}`;
  try {
    await fetch(`${env.NTFY_BASE || "https://ntfy.sh"}/${env.CMD_TOPIC}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
  } catch {
    // best-effort, same as the firmware's own ntfy posts
  }
}

async function handleSmartHome(request, env) {
  const auth = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const token = await verifyToken(env.TOKEN_SECRET, auth);
  if (!token || token.typ !== "access") return json({ error: "auth failed" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const input = body.inputs && body.inputs[0];
  const requestId = body.requestId;

  if (!input) return json({ requestId, payload: { errorCode: "protocolError" } }, 400);

  if (input.intent === "action.devices.SYNC") {
    return json({
      requestId,
      payload: {
        agentUserId: env.AGENT_USER_ID || "owner",
        devices: [{
          id: GATE_DEVICE_ID,
          type: "action.devices.types.GARAGE",
          traits: ["action.devices.traits.OpenClose"],
          name: { name: env.DEVICE_NAME || "Gate" },
          willReportState: false,
          attributes: { discreteOnlyOpenClose: true },
          deviceInfo: {
            manufacturer: "garage-opener", model: "esp32", hwVersion: "1.0", swVersion: "1.0",
          },
        }],
      },
    });
  }

  if (input.intent === "action.devices.QUERY") {
    const openPercent = await guessOpenPercent(env);
    return json({
      requestId,
      payload: { devices: { [GATE_DEVICE_ID]: { status: "SUCCESS", online: true, openPercent } } },
    });
  }

  if (input.intent === "action.devices.EXECUTE") {
    let openPercent = 100;
    let actuated = false;
    for (const cmd of input.payload.commands) {
      for (const exec of cmd.execution) {
        if (exec.command === "action.devices.commands.OpenClose") {
          openPercent = exec.params.openPercent;
          if (!actuated) { await actuateGate(env); actuated = true; }
        }
      }
    }
    return json({
      requestId,
      payload: {
        commands: [{ ids: [GATE_DEVICE_ID], status: "SUCCESS", states: { openPercent, online: true } }],
      },
    });
  }

  if (input.intent === "action.devices.DISCONNECT") return json({});

  return json({ requestId, payload: { errorCode: "notSupported" } }, 501);
}

// --------------------------------------------------------------------------
// OAuth account linking - single-user, password-gated, no session storage
// (the "code"/"access_token"/"refresh_token" are self-verifying signed
// tokens - see signToken/verifyToken above).
// --------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderAuthorizeForm(params, error) {
  return `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<title>Link account</title>
<style>
body{font:16px system-ui,sans-serif;max-width:360px;margin:48px auto;padding:0 16px}
input{width:100%;padding:10px;margin:8px 0;box-sizing:border-box;font:inherit}
button{width:100%;padding:10px;font:inherit;margin-top:8px}
</style>
<h2>Link this account</h2>
<form method="POST">
<input type="hidden" name="client_id" value="${escapeHtml(params.client_id || "")}">
<input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri || "")}">
<input type="hidden" name="state" value="${escapeHtml(params.state || "")}">
<input type="hidden" name="scope" value="${escapeHtml(params.scope || "")}">
<label>Password<input type="password" name="password" autofocus autocomplete="current-password"></label>
${error ? `<p style="color:#c00">${escapeHtml(error)}</p>` : ""}
<button type="submit">Allow</button>
</form>`;
}

async function handleAuthorize(request, url, env) {
  if (request.method === "GET") {
    const params = Object.fromEntries(url.searchParams);
    if (params.client_id !== env.SMARTHOME_CLIENT_ID)
      return new Response("unknown client_id", { status: 400 });
    return new Response(renderAuthorizeForm(params), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (request.method === "POST") {
    const form = new URLSearchParams(await request.text());
    const params = Object.fromEntries(form);
    if (params.client_id !== env.SMARTHOME_CLIENT_ID)
      return new Response("unknown client_id", { status: 400 });
    if (params.password !== env.LINK_PASSWORD) {
      return new Response(renderAuthorizeForm(params, "Wrong password"), {
        status: 401, headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const code = await signToken(env.TOKEN_SECRET, { sub: env.AGENT_USER_ID || "owner", typ: "code", exp: nowS() + 60 });
    let redirect;
    try {
      redirect = new URL(params.redirect_uri);
    } catch {
      return new Response("bad redirect_uri", { status: 400 });
    }
    redirect.searchParams.set("code", code);
    if (params.state) redirect.searchParams.set("state", params.state);
    return Response.redirect(redirect.toString(), 302);
  }

  return new Response("method not allowed", { status: 405 });
}

async function handleToken(request, env) {
  const form = new URLSearchParams(await request.text());
  if (form.get("client_id") !== env.SMARTHOME_CLIENT_ID || form.get("client_secret") !== env.SMARTHOME_CLIENT_SECRET)
    return json({ error: "invalid_client" }, 401);

  const grantType = form.get("grant_type");
  let sub;
  if (grantType === "authorization_code") {
    const payload = await verifyToken(env.TOKEN_SECRET, form.get("code"));
    if (!payload || payload.typ !== "code") return json({ error: "invalid_grant" }, 400);
    sub = payload.sub;
  } else if (grantType === "refresh_token") {
    const payload = await verifyToken(env.TOKEN_SECRET, form.get("refresh_token"));
    if (!payload || payload.typ !== "refresh") return json({ error: "invalid_grant" }, 400);
    sub = payload.sub;
  } else {
    return json({ error: "unsupported_grant_type" }, 400);
  }

  const access_token = await signToken(env.TOKEN_SECRET, { sub, typ: "access", exp: nowS() + 3600 });
  const refresh_token = await signToken(env.TOKEN_SECRET, { sub, typ: "refresh", exp: nowS() + 3600 * 24 * 365 * 10 });
  return json({ token_type: "Bearer", access_token, refresh_token, expires_in: 3600 });
}

// --------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/log") return handleLog(request, url, env);
    if (url.pathname === "/oauth/authorize") return handleAuthorize(request, url, env);
    if (url.pathname === "/oauth/token" && request.method === "POST") return handleToken(request, env);
    if (url.pathname === "/smarthome" && request.method === "POST") return handleSmartHome(request, env);

    return new Response("not found", { status: 404 });
  },
};
