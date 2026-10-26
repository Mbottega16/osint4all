// Checks the board's data and files. Run: node --test test/   (passing prints "fail 0")
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const PREFIX = "window.BOARD = ";
const src = read("data/board.js");
const BOARD = JSON.parse(src.slice(src.indexOf(PREFIX) + PREFIX.length, src.lastIndexOf(";")));
const panels = BOARD.columns.flat();
const links = panels.flatMap((p) => p.links.map((l) => ({ ...l, panel: p.title })));

// The original page as of the snapshot. Update this list only when importing a newer snapshot on purpose:
// it is here so an edit can't silently drop a panel or a link.
const ORIGINAL = [
  [["THROWAWAY CONTACT", 18], ["ID GENERATOR", 33]],
  [["UNIFIED SEARCH", 13], ["PEOPLE", 26], ["USERNAME", 19], ["EMAIL", 26], ["PHONE", 27], ["SOCIAL MEDIA", 15], ["FACEBOOK", 16], ["TWITTER", 40]],
  [["SEARCH ENGINES", 70], ["GOOGLE CSE", 19]],
  [["MAPS", 47], ["GEO", 18]],
];

test("the board matches the original page: 4 columns, 14 panels, 387 links, same order", () => {
  assert.deepEqual(BOARD.columns.map((col) => col.map((p) => [p.title, p.links.length])), ORIGINAL);
  assert.equal(links.length, 387);
  assert.match(BOARD.snapshot, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(BOARD.source, /^https:\/\/start\.me\/p\//);
});

test("every link has a name and a real web address", () => {
  for (const l of links) {
    assert.ok(l.title && l.title.trim() === l.title, `${l.panel}: a link has a blank or padded name (${l.url})`);
    const u = new URL(l.url);
    assert.ok(u.protocol === "https:" || u.protocol === "http:", `${l.panel}: ${l.title} is not a web address`);
    assert.ok(u.hostname.includes("."), `${l.panel}: ${l.title} has no real host`);
  }
});

test("panel names are unique (the page remembers collapsed panels by name)", () => {
  const names = panels.map((p) => p.title);
  assert.equal(new Set(names).size, names.length);
});

test("every icon a link names is in icons/, and icons/ holds nothing unused", () => {
  const named = new Set(links.map((l) => l.icon).filter(Boolean));
  const files = new Set(fs.readdirSync(path.join(ROOT, "icons")));
  for (const f of named) assert.ok(files.has(f), `icons/${f} is missing`);
  for (const f of files) assert.ok(named.has(f), `icons/${f} is not used by any link`);
});

test("the page loads only its own files and sends no referrer", () => {
  const html = read("index.html");
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  for (const [, ref] of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^[a-z]+:|^\/\//i.test(ref), `index.html loads ${ref} from outside the repo`);
    assert.ok(fs.existsSync(path.join(ROOT, ref)), `index.html loads ${ref}, which doesn't exist`);
  }
  const app = read("app.js");
  assert.doesNotMatch(app, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/, "app.js must not call out to the network");
  assert.deepEqual([...app.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => m[0]), ["http://www.w3.org/2000/svg"], "app.js names no web address except the SVG namespace");
  assert.match(app, /a\.rel = "noopener noreferrer"/);
});

test("the launchers come in a pair, one per computer", () => {
  assert.match(read("Open OSINT4ALL.command"), /open "\$\(dirname "\$0"\)\/index\.html"/);
  assert.match(read("Open OSINT4ALL.bat"), /start "" "%~dp0index\.html"/);
  assert.ok(fs.statSync(path.join(ROOT, "Open OSINT4ALL.command")).mode & 0o100, "the Mac launcher must be executable");
});
