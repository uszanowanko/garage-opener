// Cloudflare Worker: log history longer than ntfy.sh's 12h public cache.
// See ../docs/extended-log.md for how to deploy this.
//
// Bindings this Worker needs (set in wrangler.toml / dashboard):
//   LOGS          KV namespace  - stores the log entries
//   LOG_WRITE_KEY secret        - shared with the ESP32's CF_LOG_KEY
//
// Routes:
//   POST /log   Authorization: Bearer <LOG_WRITE_KEY>
//               body: {"message": "...", "time": 1234567890}
//               -> 204, appends one entry (newest MAX_ENTRIES kept)
//   GET  /log?limit=10
//               -> 200 application/json, CORS-open: [{"message","time"}, ...]
//               newest first. No auth - same posture as ntfy's LOG_TOPIC,
//               which is already readable/writable by anyone who knows it.

const MAX_ENTRIES = 200;
const KV_KEY = "logs";

function respond(body, status, extraHeaders) {
  return new Response(body, {
    status,
    headers: { "Access-Control-Allow-Origin": "*", ...extraHeaders },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/log") return respond("not found", 404);

    if (request.method === "OPTIONS") {
      return respond(null, 204, {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
    }

    if (request.method === "GET") {
      const raw = await env.LOGS.get(KV_KEY);
      const all = raw ? JSON.parse(raw) : [];
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
      const message = String(entry.message || "").slice(0, 300);
      const time = Number.isFinite(entry.time) ? entry.time : Math.floor(Date.now() / 1000);
      if (!message) return respond("empty message", 400);

      const raw = await env.LOGS.get(KV_KEY);
      const all = raw ? JSON.parse(raw) : [];
      all.unshift({ message, time });
      await env.LOGS.put(KV_KEY, JSON.stringify(all.slice(0, MAX_ENTRIES)));
      return respond(null, 204);
    }

    return respond("method not allowed", 405);
  },
};
