#!/usr/bin/env node
// Turn a person's keyword into a roster line for firmware/include/config.h.
// The keyword itself is never written anywhere - only k = SHA-256(keyword).
//
//   node firmware/tools/enroll.mjs                 (interactive)
//   printf 'Tomek\nhunter2\n' | node .../enroll.mjs (piped)

import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { stdin, stdout, exit } from "node:process";

const rl = createInterface({ input: stdin, terminal: false });
const lines = [];
stdout.write("Name (1..31 chars, no ';' or ':'): ");
for await (const line of rl) {
  lines.push(line);
  if (lines.length === 1) stdout.write("Keyword (they pick it; not stored anywhere): ");
  else break;
}
rl.close();

const name = (lines[0] ?? "").trim();
const keyword = lines[1] ?? "";

if (!name || name.length > 31 || /[;:]/.test(name) || /[\x00-\x1f\x7f]/.test(name)) {
  console.error("\n! invalid name");
  exit(1);
}
if (!keyword) {
  console.error("\n! empty keyword");
  exit(1);
}

const k = createHash("sha256").update(keyword, "utf8").digest("hex");

console.log("\n\nPaste into ROSTER[] in firmware/include/config.h:\n");
console.log(`  { "${name}", "${k}" },`);
console.log("\nThe person types their keyword once into the web page / Shortcut /");
console.log("Android app. They never need to see k.\n");
