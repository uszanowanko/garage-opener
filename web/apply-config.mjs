#!/usr/bin/env node
// Deploy-time config for the web app. Two jobs:
//
//   1. Overlay environment variables onto web/config.js (any that are set win;
//      unset ones leave the committed value alone).
//   2. Bake the resulting deviceName into index.html + manifest.webmanifest so
//      the title / home-screen name / manifest are right before JS runs.
//
// Run by .github/workflows/pages.yml (from repo Variables and/or Secrets).
// Safe to run locally:
//   node web/apply-config.mjs                       (no-op unless env is set)
//   DEVICE_NAME=Wrota ADMIN_NAME=Tomek node web/apply-config.mjs
//
// Recognised env vars -> config.js keys:
//   DEVICE_NAME -> deviceName   ADMIN_NAME -> adminName   WEB_LANG -> lang
//   NTFY_BASE   -> ntfy         CMD_TOPIC  -> cmdTopic    LOG_TOPIC -> logTopic
//   CF_LOG_URL  -> cfLog

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const p = (f) => join(here, f);

const MAP = {
  DEVICE_NAME: "deviceName",
  ADMIN_NAME: "adminName",
  WEB_LANG: "lang",
  NTFY_BASE: "ntfy",
  CMD_TOPIC: "cmdTopic",
  LOG_TOPIC: "logTopic",
  CF_LOG_URL: "cfLog",
};

const jsStr = (s) => JSON.stringify(String(s)); // safe quoting/escaping

// --- 1. overlay env onto config.js ---------------------------------------
let cfgText = readFileSync(p("config.js"), "utf8");
const applied = [];
for (const [env, key] of Object.entries(MAP)) {
  const val = process.env[env];
  if (val === undefined || val === "") continue;
  const re = new RegExp(`(\\b${key}\\s*:\\s*)"[^"]*"`);
  if (!re.test(cfgText)) {
    console.warn(`! key '${key}' not found in config.js, skipping ${env}`);
    continue;
  }
  cfgText = cfgText.replace(re, `$1${jsStr(val)}`);
  applied.push(env === "ADMIN_NAME" || env === "CMD_TOPIC" || env === "LOG_TOPIC" ? env : `${env}=${val}`);
}
if (applied.length) {
  writeFileSync(p("config.js"), cfgText);
  console.log(`config.js overrides: ${applied.join(", ")}`);
} else {
  console.log("config.js: no env overrides");
}

// --- 2. bake deviceName into the static files ---------------------------
const name = (cfgText.match(/deviceName:\s*"([^"]*)"/) || [])[1] || "Gate";
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const e = esc(name);

let html = readFileSync(p("index.html"), "utf8");
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${e}</title>`)
  .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(">)/, `$1${e}$2`)
  .replace(/(<h1 id="title">)[^<]*(<\/h1>)/, `$1${e}$2`);
writeFileSync(p("index.html"), html);

const man = JSON.parse(readFileSync(p("manifest.webmanifest"), "utf8"));
man.name = name;
man.short_name = name;
writeFileSync(p("manifest.webmanifest"), JSON.stringify(man, null, 2) + "\n");

console.log(`baked deviceName: ${name}`);
