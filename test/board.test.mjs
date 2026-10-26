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
