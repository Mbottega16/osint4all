// Add the extra link groups to the board: SOCMINT (the sibling start.me board, from the vault's Atlas
// osint-board scrape) and the Atlas library (the owner's curated list of sites). The original OSINT4ALL
// copy in data/board.js is never touched; these live in data/extra.js so the test can keep guarding it.
//
// Usage (paths default to this computer's layout; pass them to override):
//   node scripts/import-extra.mjs [--socmint <socmint.json>] [--icons <icons.json>] [--atlas <atlas-seed.json>] [YYYY-MM-DD]
//
// Writes data/extra.js and icons-extra/ (one favicon per new site, fetched once from start.me's own
// favicon service, the same one the original board uses; files already there are kept). A site that is
// already on the original board is not added again; it only gets the description (see build-info.mjs).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv.splice(i, 2)[1] : null; };
const flags = { socmint: opt("--socmint"), icons: opt("--icons"), atlas: opt("--atlas") };
const snapshot = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);

// Mac: the vault holds the repos under projects/<name>/app. PC: the Atlas folder is beside the vault.
const home = os.homedir();
const firstExisting = (list) => list.find((p) => fs.existsSync(p));
const vaultMac = path.resolve(ROOT, "..", "..", "..");
const vaultPc = path.join(home, "OneDrive", "Desktop", "AI Projects", "my-brain");
const socmintFile = flags.socmint || firstExisting([
  path.join(vaultMac, "projects", "atlas", "osint-board", "source", "socmint.json"),
  path.join(vaultPc, "projects", "atlas", "osint-board", "source", "socmint.json"),
]);
const iconsFile = flags.icons || firstExisting([
  path.join(vaultMac, "projects", "atlas", "osint-board", "source", "icons.json"),
  path.join(vaultPc, "projects", "atlas", "osint-board", "source", "icons.json"),
]);
const atlasFile = flags.atlas || firstExisting([
  path.join(vaultMac, "projects", "atlas", "app", "backend", "seed", "atlas-seed.json"),
  path.join(home, "OneDrive", "Desktop", "Atlas", "backend", "seed", "atlas-seed.json"),
]);
for (const [what, f] of [["SOCMINT file", socmintFile], ["icons file", iconsFile], ["Atlas seed", atlasFile]]) {
  if (!f || !fs.existsSync(f)) { console.error(`Can't find the ${what}. Pass it with --socmint / --icons / --atlas.`); process.exit(1); }
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const PREFIX = "window.BOARD = ";
const boardSrc = fs.readFileSync(path.join(ROOT, "data", "board.js"), "utf8");
const BOARD = JSON.parse(boardSrc.slice(boardSrc.indexOf(PREFIX) + PREFIX.length, boardSrc.lastIndexOf(";")));
const EXT = { "image/webp": "webp", "image/png": "png", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "image/svg+xml": "svg", "image/jpeg": "jpg", "image/gif": "gif" };

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const norm = (u) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, ""); } catch { return u; } };

// ---- what's already on the board (the original), and which icon each site has
const seen = new Set();
const iconOfHost = new Map(); // host -> "icons/<file>"
for (const p of BOARD.columns.flat()) for (const l of p.links) {
  seen.add(norm(l.url));
  if (l.icon && !iconOfHost.has(host(l.url))) iconOfHost.set(host(l.url), "icons/" + l.icon);
}

// ---- SOCMINT: same shape as the original export (columns of panels of items)
const socmint = readJson(socmintFile);
const scrapedIcons = readJson(iconsFile);
const need = new Map(); // host -> { bytes?: {type,b64}, tried: false } still to be written to icons-extra/
const dupes = { socmint: 0, atlas: 0 };
function iconRef(h, scraped) {
  if (iconOfHost.has(h)) return iconOfHost.get(h);
  if (!need.has(h)) need.set(h, { scraped: scraped && scraped.b64 && EXT[scraped.type] ? scraped : null });
  else if (!need.get(h).scraped && scraped && scraped.b64 && EXT[scraped.type]) need.get(h).scraped = scraped;
  return "pending:" + h;
}
const socCols = socmint.map((col) =>
  col.map((p) => ({
    title: p.title.trim(),
    links: p.items.flatMap((it) => {
      const url = it.href;
      if (!/^https?:/.test(url)) return [];
      if (seen.has(norm(url))) { dupes.socmint++; return []; }
      seen.add(norm(url));
      return [{ title: it.title.trim(), url, icon: iconRef(host(url), scrapedIcons[it.icon]) }];
    }),
  })).filter((p) => p.links.length)
);

// ---- Atlas: one panel per category, links A to Z, panels spread over 4 columns by size
const atlas = readJson(atlasFile);
const byCat = new Map();
for (const e of atlas) {
  if (!/^https?:/.test(e.link)) continue;
  if (seen.has(norm(e.link))) { dupes.atlas++; continue; }
  seen.add(norm(e.link));
  const cat = (e.category || "other").trim().toUpperCase();
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push({ title: e.title.trim(), url: e.link, icon: iconRef(host(e.link)) });
}
for (const links of byCat.values()) links.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
const atlasPanels = [...byCat].map(([title, links]) => ({ title, links })).sort((a, b) => b.links.length - a.links.length);
const atlasCols = [[], [], [], []];
const load = [0, 0, 0, 0];
for (const p of atlasPanels) { const i = load.indexOf(Math.min(...load)); atlasCols[i].push(p); load[i] += p.links.length + 2; }
for (const col of atlasCols) col.sort((a, b) => a.title.localeCompare(b.title, "en"));

// ---- icons: reuse, take from the scrape, or fetch once from start.me's favicon service
const iconDir = path.join(ROOT, "icons-extra");
fs.mkdirSync(iconDir, { recursive: true });
const existing = new Map(fs.readdirSync(iconDir).map((f) => [f.replace(/\.[a-z0-9]+$/, ""), f]));
const safe = (h) => h.replace(/[^a-z0-9.-]+/g, "_");
const resolved = new Map(); // host -> "icons-extra/<file>" | null
let fetched = 0, reused = 0, fromScrape = 0, failed = 0;
const queue = [];
for (const [h, info] of need) {
  const key = safe(h);
  if (existing.has(key)) { resolved.set(h, "icons-extra/" + existing.get(key)); reused++; continue; }
  if (info.scraped) {
    const name = key + "." + EXT[info.scraped.type];
    fs.writeFileSync(path.join(iconDir, name), Buffer.from(info.scraped.b64, "base64"));
    resolved.set(h, "icons-extra/" + name); fromScrape++; continue;
  }
  queue.push(h);
}
async function fetchIcon(h) {
  try {
    const r = await fetch("https://f.start.me/" + h, { signal: AbortSignal.timeout(12000) });
    const type = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.ok || !EXT[type]) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 200000) return null;
    const name = safe(h) + "." + EXT[type];
    fs.writeFileSync(path.join(iconDir, name), buf);
    return "icons-extra/" + name;
  } catch { return null; }
}
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < queue.length) {
    const h = queue[next++];
    const ref = await fetchIcon(h);
    resolved.set(h, ref);
    ref ? fetched++ : failed++;
    if ((fetched + failed) % 200 === 0) console.error(`  icons: ${fetched + failed}/${queue.length}`);
    await new Promise((r) => setTimeout(r, 60));
  }
}));

const fix = (links) => links.map((l) => ({ ...l, icon: l.icon.startsWith("pending:") ? resolved.get(l.icon.slice(8)) || "" : l.icon }));
const groups = [
  { id: "socmint", title: "SOCMINT", note: "From the sibling start.me board by the same curator, collected through Atlas.", source: "https://start.me/p/Wp1kpe/socmint", columns: socCols },
  { id: "atlas", title: "Atlas library", note: "The owner's curated list of useful sites and tools (Atlas), grouped by Atlas's categories. Not part of the original OSINT4ALL board.", source: "https://atlas-library-znte.onrender.com", columns: atlasCols },
].map((g) => ({ ...g, columns: g.columns.map((col) => col.map((p) => ({ title: p.title, links: fix(p.links) }))) }));

// icons-extra/ holds only what a link uses
const used = new Set(groups.flatMap((g) => g.columns.flat().flatMap((p) => p.links.map((l) => l.icon))).filter((i) => i.startsWith("icons-extra/")).map((i) => i.slice(12)));
for (const f of fs.readdirSync(iconDir)) if (!used.has(f)) fs.unlinkSync(path.join(iconDir, f));

const j = JSON.stringify;
const out = [
  "// Extra links beside the original OSINT4ALL copy: SOCMINT and the Atlas library.",
  "// Generated by scripts/import-extra.mjs; test/board.test.mjs checks this file.",
  "window.EXTRA = {",
  `"snapshot": ${j(snapshot)},`,
  `"groups": [`,
  groups.map((g) =>
    `{"id": ${j(g.id)}, "title": ${j(g.title)}, "note": ${j(g.note)}, "source": ${j(g.source)}, "columns": [\n` +
    g.columns.map((col) => "[\n" + col.map((p) => `{"title": ${j(p.title)}, "links": [\n` + p.links.map((l) => "  " + j(l)).join(",\n") + "\n]}").join(",\n") + "\n]").join(",\n") +
    "\n]}").join(",\n"),
  "]",
  "};",
  "",
].join("\n");
fs.writeFileSync(path.join(ROOT, "data", "extra.js"), out);

for (const g of groups) {
  const panels = g.columns.flat();
  console.log(`${g.title}: ${g.columns.length} columns (${g.columns.map((c) => c.length).join(" + ")} panels) · ${panels.length} panels · ${panels.reduce((n, p) => n + p.links.length, 0)} links · without an icon ${panels.flatMap((p) => p.links).filter((l) => !l.icon).length}`);
}
console.log(`left out as already on the board: SOCMINT ${dupes.socmint}, Atlas ${dupes.atlas}`);
console.log(`icons-extra: ${used.size} files (reused ${reused}, from the scrape ${fromScrape}, fetched ${fetched}, failed ${failed})`);
