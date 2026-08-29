#!/usr/bin/env node
// Bake GARAGE_CONFIG.deviceName from config.js into the static files so the
// page title, the apple home-screen title, the <h1>, and the web manifest are
// correct even before JS runs. The runtime JS does the same (and handles
// language), so this is belt-and-suspenders for first paint + PWA install.
//
// Run by .github/workflows/pages.yml on deploy. Safe to run locally too.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const p = (f) => join(here, f);

const cfg = readFileSync(p("config.js"), "utf8");
const name = (cfg.match(/deviceName:\s*"([^"]*)"/) || [])[1] || "Gate";
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

console.log(`applied deviceName: ${name}`);
