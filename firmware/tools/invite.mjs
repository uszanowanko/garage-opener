#!/usr/bin/env node
// Generate one person's key, their roster line, and a personal setup link.
//
//   make invite NAME="Mama"
//   node firmware/tools/invite.mjs --name "Mama"
//   node firmware/tools/invite.mjs --name "Mama" --key <existing 64 hex>   (re-issue a lost link)

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { argv, stdin, stdout, exit } from "node:process";

const args = {};
for (let i = 2; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const key = argv[i].slice(2);
    const nx = argv[i + 1];
    args[key] = nx && !nx.startsWith("--") ? (i++, nx) : true;
  }
}

let name = args.name && args.name !== true ? args.name.trim() : null;
if (!name) {
  const rl = createInterface({ input: stdin, terminal: false });
  stdout.write("Name (1..31 chars, no ';' or ':'): ");
  for await (const l of rl) { name = l.trim(); break; }
  rl.close();
}
if (!name || name.length > 31 || /[;:]/.test(name) || /[\x00-\x1f\x7f]/.test(name)) {
  console.error("! invalid name");
  exit(1);
}

const k = (args.key && args.key !== true ? String(args.key) : randomBytes(32).toString("hex")).toLowerCase();
if (!/^[0-9a-f]{64}$/.test(k)) {
  console.error("! --key must be exactly 64 hex characters");
  exit(1);
}

let base = "https://YOUR-USER.github.io/YOUR-REPO";
try {
  const cfg = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "include", "config.h"),
    "utf8",
  );
  const m = cfg.match(/#define\s+WEB_BASE_URL\s+"([^"]*)"/);
  if (m && m[1]) base = m[1].replace(/\/+$/, "");
} catch { /* config.h not created yet - link uses a placeholder base */ }

const link = `${base}/#n=${encodeURIComponent(name)}&k=${k}`;

console.log(`\nRoster line  ->  firmware/include/config.h  ->  ROSTER[]:\n`);
console.log(`  { "${name}", "${k}" },\n`);
console.log(`Personal link for ${name}  (send once; they tap it, then Add to Home Screen):\n`);
console.log(`  ${link}\n`);
console.log(`Save this link. To re-issue it later without changing the roster:`);
console.log(`  node firmware/tools/invite.mjs --name "${name}" --key ${k}\n`);
