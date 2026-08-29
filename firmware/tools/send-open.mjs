#!/usr/bin/env node
// Build a signed "open" payload and POST it - to ntfy (default) or the LAN
// endpoint (--lan). Topics/host are read from firmware/include/config.h so
// there is one source of truth.
//
//   node firmware/tools/send-open.mjs --name Tomek --key <64 hex>
//   node firmware/tools/send-open.mjs --name Tomek --key <64 hex> --lan
//   node firmware/tools/send-open.mjs --name Tomek --key <64 hex> --ts 1000   (stale, for testing)

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { argv, exit } from "node:process";

const args = {};
for (let i = 2; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith("--") ? (i++, next) : true;
  }
}

if (!args.name || !args.key || args.name === true || args.key === true) {
  console.error("usage: send-open.mjs --name NAME --key <64 hex> [--lan] [--ts N] [--sig BADHEX]");
  exit(2);
}
const kHex = String(args.key).toLowerCase();
if (!/^[0-9a-f]{64}$/.test(kHex)) {
  console.error("! --key must be exactly 64 hex characters");
  exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = join(here, "..", "include", "config.h");
let cfg;
try {
  cfg = readFileSync(cfgPath, "utf8");
} catch {
  console.error(`cannot read ${cfgPath}\n  cp firmware/include/config.example.h firmware/include/config.h`);
  exit(1);
}
const grab = (k) => (cfg.match(new RegExp(`#define\\s+${k}\\s+"([^"]*)"`)) || [])[1] ?? null;

const CMD_TOPIC = grab("CMD_TOPIC");
const NTFY_HOST = grab("NTFY_HOST") || "ntfy.sh";
const MDNS_HOST = grab("MDNS_HOST") || "garage";
const STATIC_IP = grab("STATIC_IP");

const ts = args.ts && args.ts !== true ? String(parseInt(args.ts, 10)) : String(Math.floor(Date.now() / 1000));
const sig =
  args.sig && args.sig !== true
    ? args.sig
    : createHmac("sha256", kHex).update(`v1:${ts}:${args.name}`, "utf8").digest("hex");
const payload = `v1;${ts};${args.name};${sig}`;

const url = args.lan
  ? `http://${STATIC_IP && STATIC_IP.length ? STATIC_IP : MDNS_HOST + ".local"}/open`
  : `https://${NTFY_HOST}/${CMD_TOPIC}`;

console.log(`POST ${url}`);
console.log(`body ${payload}`);

const res = await fetch(url, {
  method: "POST",
  body: payload,
  headers: { "Content-Type": "text/plain" },
});
console.log(`->   ${res.status} ${res.statusText}`);
const text = (await res.text()).trim();
if (text) console.log(text);
exit(res.ok ? 0 : 1);
