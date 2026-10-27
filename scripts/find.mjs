// Look up links from the command line, so any project can use the board as a knowledge base.
// Usage: node scripts/find.mjs <word> [more words]   (every word must match; add --json for JSON)
//   Prints: GROUP > PANEL | name | address
// It reads data/board.js, data/almanac.js and data/groups.js. It makes no network calls.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
for (const f of ["board", "almanac", "groups"]) new Function("window", fs.readFileSync(path.join(ROOT, "data", f + ".js"), "utf8"))(win);

const json = process.argv.includes("--json");
const words = process.argv.slice(2).filter((a) => a !== "--json").map((w) => w.toLowerCase());
if (!words.length) {
  console.error("Usage: node scripts/find.mjs <word> [more words] [--json]");
  process.exit(1);
}

const groupOf = new Map(win.GROUPS.flatMap((g) => g.panels.map((p) => [p, g.title])));
const panels = win.BOARD.columns.flat().concat(win.ALMANAC.panels);
const hits = [];
for (const p of panels) {
  const group = groupOf.get(p.title) || "MORE";
  for (const l of p.links) {
    const hay = `${l.title} ${l.url} ${p.title} ${group}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) hits.push({ group, panel: p.title, title: l.title, url: l.url });
  }
}
if (json) console.log(JSON.stringify(hits, null, 2));
else {
  for (const h of hits) console.log(`${h.group} > ${h.panel} | ${h.title} | ${h.url}`);
  console.error(`${hits.length} links`);
}
