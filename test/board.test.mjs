// Checks the board's data and files. Run: node --test test/   (passing prints "fail 0")
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function loadData(file, name) {
  const prefix = "window." + name + " = ";
  const src = read("data/" + file);
  return JSON.parse(src.slice(src.indexOf(prefix) + prefix.length, src.lastIndexOf(";")));
}
const BOARD = loadData("board.js", "BOARD");
const EXTRA = loadData("extra.js", "EXTRA");
const INFO = loadData("info.js", "INFO");
const STATUS = JSON.parse(read("data/link-status.json")).links;
const panels = BOARD.columns.flat();
const links = panels.flatMap((p) => p.links.map((l) => ({ ...l, panel: p.title })));
// the extra groups (SOCMINT, Atlas library) beside the original
const extraPanels = EXTRA.groups.flatMap((g) => g.columns.flat().map((p) => ({ ...p, group: g.id })));
const extraLinks = extraPanels.flatMap((p) => p.links.map((l) => ({ ...l, panel: p.title, group: p.group })));
const everyLink = [...links.map((l) => ({ ...l, group: "osint4all" })), ...extraLinks];
const normUrl = (u) => { const x = new URL(u); return x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, ""); };

// The original page as of the snapshot. Update this list only when importing a newer snapshot on purpose:
// it is here so an edit can't silently drop a panel or a link.
const ORIGINAL = [
  [
    ["THROWAWAY CONTACT",18], ["ID GENERATOR",33], ["SANDBOX / EMULATOR",7], ["PRODUCTIVITY",57],
    ["FILE UPLOAD",6], ["TOOLSET",37], ["HASH RECOVERY",8], ["DOWNLOADER",9],
    ["PRIVACY / SECURITY",22], ["SECURE COMMUNICATION",20], ["RESOURCES",54], ["WEATHER",4],
    ["THREAT INTEL",17], ["OTHER",2], ["NEWS FROM REDDIT",3], ["IDENTITY RESOLUTION",3],
    ["RESOLVERS",6], ["ANALYTICS",10],
  ],
  [
    ["UNIFIED SEARCH",13], ["PEOPLE",26], ["USERNAME",19], ["EMAIL",26],
    ["PHONE",27], ["SOCIAL MEDIA",15], ["FACEBOOK",16], ["TWITTER",40],
    ["YOUTUBE",17], ["REDDIT",34], ["LINKEDIN",9], ["GOOGLE",4],
    ["DISCORD",13], ["TWITCH",13], ["INSTAGRAM",19], ["TELEGRAM",16],
    ["SNAPCHAT",7], ["MASTODON",2], ["TIKTOK",4], ["STEAM",3],
    ["CLUBHOUSE",3], ["ONLYFANS",6], ["BOT",5], ["BLOG",4],
    ["NEWS",23],
  ],
  [
    ["SEARCH ENGINES",70], ["GOOGLE CSE",19], ["IMAGE / VIDEO / AUDIO / MEDIA",41], ["LICENSE PLATE / VIN / VEHICLE",30],
    ["FLIGHT TRACKER",10], ["MARITIME",19], ["DORKING",8], ["OPEN DIRECTORY",23],
    ["DATASET",14], ["SOURCE CODES",21], ["WHOIS",5], ["DOMAIN / IP / DNS",53],
    ["MALWARE",15], ["IoT",30], ["[CAN] IOT",5], ["RADIO",18],
    ["REAL ESTATE",10],
  ],
  [
    ["MAPS",47], ["GEO",18], ["CRYPTOCURRENCY",11], ["DARKNET",15],
    ["DATA DUMP",16], ["VOTER DATABASES",17], ["EXTREMIST / FAR-RIGHT",24], ["FINANCE",9],
    ["BUSINESS",27], ["POLICE / LE / FED",43], ["[CAN] POLICE",4], ["INFORMANT",3],
    ["SEX OFFENDER",11], ["RESIDENT DATABASE",5], ["PUBLIC RECORDS",46], ["GOVERNMENT",48],
    ["[CAN] GOVERNMENT",23], ["[CAN] CORPORATION",21],
  ],
];

test("the board matches the original page: 4 columns, 78 panels, 1459 links, same order", () => {
  assert.deepEqual(BOARD.columns.map((col) => col.map((p) => [p.title, p.links.length])), ORIGINAL);
  assert.equal(links.length, 1459);
  assert.match(BOARD.snapshot, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(BOARD.source, /^https:\/\/start\.me\/p\//);
});

test("every link, in every group, has a name and a real web address", () => {
  for (const l of everyLink) {
    assert.ok(l.title && l.title.trim() === l.title, `${l.panel}: a link has a blank or padded name (${l.url})`);
    assert.ok(/^https?:\/\//.test(l.url), `${l.panel}: ${l.title} is not a web address`);
    const u = new URL(l.url);
    assert.ok(u.protocol === "https:" || u.protocol === "http:", `${l.panel}: ${l.title} is not a web address`);
    assert.ok(u.hostname.includes("."), `${l.panel}: ${l.title} has no real host`);
  }
});

test("panel names are unique within each group (the same name in two groups is fine: the group heading tells them apart)", () => {
  const names = (ps) => ps.map((p) => p.title);
  assert.equal(new Set(names(panels)).size, panels.length);
  for (const g of EXTRA.groups) { const ps = g.columns.flat(); assert.equal(new Set(names(ps)).size, ps.length, g.id); }
});

// The extra groups, pinned like the original: an edit can't silently drop a panel or a link.
const EXTRA_EXPECTED = { socmint: [18, 152], atlas: [20, 1228] };
test("the extra groups are SOCMINT and the Atlas library, with every panel and link in them", () => {
  assert.deepEqual(EXTRA.groups.map((g) => g.id), ["socmint", "atlas"]);
  for (const g of EXTRA.groups) {
    const ps = g.columns.flat();
    assert.deepEqual([ps.length, ps.flatMap((p) => p.links).length], EXTRA_EXPECTED[g.id], g.id);
    assert.ok(g.title && g.note && /^https:\/\//.test(g.source), g.id + " needs a title, a note saying where it comes from, and a source");
  }
});

test("a site is listed once across the extra groups, and never repeats one on the original board", () => {
  const onBoard = new Set(links.map((l) => normUrl(l.url)));
  const seen = new Set();
  for (const l of extraLinks) {
    const k = normUrl(l.url);
    assert.ok(!onBoard.has(k), `${l.group}: ${l.title} is already on the original board (${l.url})`);
    assert.ok(!seen.has(k), `${l.group}: ${l.title} is listed twice (${l.url})`);
    seen.add(k);
  }
});

// An icon is a bare file name in icons/ (the original board) or a path such as icons-extra/x.webp (the extra groups).
const iconPath = (i) => (i.includes("/") ? i : "icons/" + i);
test("every icon a link names exists, and icons/ and icons-extra/ hold nothing unused", () => {
  const named = new Set(everyLink.map((l) => l.icon).filter(Boolean).map(iconPath));
  for (const f of named) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} is missing`);
  for (const dir of ["icons", "icons-extra"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) assert.ok(named.has(dir + "/" + f), `${dir}/${f} is not used by any link`);
  }
});

const STATES = new Set(["ok", "blocked", "moved", "bounced", "dead", "unreachable", "skipped"]);
test("every link has been checked, and the details the page shows are well formed", () => {
  for (const l of everyLink) assert.ok(STATES.has((STATUS[l.url] || {}).s), `${l.title} (${l.url}) has no link-check result: run scripts/check-links.mjs`);
  const urls = new Set(everyLink.map((l) => l.url));
  for (const [u, o] of Object.entries(INFO)) {
    assert.ok(urls.has(u), `info.js describes ${u}, which is not on the board`);
    assert.ok(!o.st || STATES.has(o.st), u + ": unknown status " + o.st);
    assert.ok(!o.s || (o.s.length <= 300 && ["atlas", "qwen", "page", "title"].includes(o.ss)), u + ": summary too long or with no source");
    assert.ok(!o.t || (Array.isArray(o.t) && o.t.every((x) => typeof x === "string")), u + ": tags must be a list of words");
  }
  for (const [u, s] of Object.entries(STATUS)) assert.ok(urls.has(u), `link-status.json has ${u}, which is not on the board`);
});

test("a link is marked possibly dead only after failing two checks in a row", () => {
  for (const l of everyLink) {
    const o = INFO[l.url];
    if (o && (o.st === "dead" || o.st === "unreachable")) assert.ok((o.f || 0) >= 1, `${l.url} is dead but has no failure count`);
  }
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
