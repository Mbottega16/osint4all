// Check every link on the board and write data/link-status.json.
// It also reads each live page's own <title> and description, which the preview panel shows.
//
// Usage:
//   node scripts/check-links.mjs                run everything (skips links already checked today, so a stopped run resumes)
//   node scripts/check-links.mjs --only-failed  re-check just the links that failed last time (the second look)
//   node scripts/check-links.mjs --limit 40     a quick sample
//   node scripts/check-links.mjs --force        ignore today's results and check everything again
//   node scripts/check-links.mjs --errors A,B   re-check only the links whose last error was A or B (for example UNABLE_TO_GET_ISSUER_CERT_LOCALLY)
//   --workers N                                 how many sites at once (default 12)
//
// Run it as:  NODE_USE_SYSTEM_CA=1 UV_THREADPOOL_SIZE=64 node scripts/check-links.mjs ...
// NODE_USE_SYSTEM_CA=1 makes Node trust the same certificate authorities the computer's browsers do. Without it,
// sites whose certificate chain runs through a locally trusted authority (some government sites) look unreachable.
// Node looks addresses up on a pool of 4 threads; with many sites at once the lookups queue, and live sites
// time out (the first full run on 2026-10-26 reported 393 live sites unreachable that way). 64 avoids it.
//
// Same rules as Atlas's check_links.py, in plain Node:
//   ok          the page answered 2xx on the same site
//   blocked     the site answered but refused a script (401/403/405/429/999): alive, can't be read
//   moved       it ended up on a different site (final address recorded)
//   bounced     a deep link that now lands on the site's bare front page
//   dead        404, 410 or another 4xx/5xx
//   unreachable DNS, timeout or TLS trouble from here: NOT proof it's dead on its own
//   skipped     not a web address a script can check (.onion, .i2p, ...)
// A link counts as possibly dead only after it has failed twice in a row (fails >= 2), so one bad moment
// on this computer's side never flags a live site.
//
// This is the one script that contacts the listed sites (one request each, with an honest user agent, a few
// at a time per site). The page itself never does.

import fs from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const num = (n, d) => (argv.includes(n) ? Number(argv[argv.indexOf(n) + 1]) : d);
const TIMEOUT = num("--timeout", 15) * 1000;
const LIMIT = num("--limit", 0);
const WORKERS = num("--workers", 12);
const today = new Date().toISOString().slice(0, 10);
const UA = "Mozilla/5.0 (compatible; OSINT4ALLLinkCheck/1.0; +https://github.com/Mbottega16/osint4all)";
const STATUS_FILE = path.join(ROOT, "data", "link-status.json");

function loadData(file, name) {
  const src = fs.readFileSync(path.join(ROOT, "data", file), "utf8");
  const p = `window.${name} = `;
  return JSON.parse(src.slice(src.indexOf(p) + p.length, src.lastIndexOf(";")));
}
const BOARD = loadData("board.js", "BOARD");
const EXTRA = loadData("extra.js", "EXTRA");
const urls = [...new Set([
  ...BOARD.columns.flat().flatMap((p) => p.links.map((l) => l.url)),
  ...EXTRA.groups.flatMap((g) => g.columns.flat().flatMap((p) => p.links.map((l) => l.url))),
])];

const prev = fs.existsSync(STATUS_FILE) ? JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")).links || {} : {};
const results = { ...prev };
const FAILING = new Set(["dead", "unreachable"]); // moved and bounced links still open, so they never count as failing

// ---- small helpers
const domainOf = (u) => { const l = (new URL(u).hostname || "").toLowerCase().split("."); return l.slice(-2).join("."); };
const isCheckable = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && !/\.(onion|i2p)$/.test(x.hostname) && x.hostname !== "localhost"; } catch { return false; } };
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const c = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; }
  return ENT[e.toLowerCase()] ?? m;
});
const clean = (s, n) => { const t = decode(String(s || "")).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "..." : t; };
const WALL = /just a moment|attention required|access denied|verify you are|are you a robot|robot or human|enable javascript|403 forbidden|security check|checking your browser|ddos|captcha|page not found|404 not found|not found$/i;

function meta(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const tag = (re) => { for (const m of html.matchAll(/<meta\b[^>]*>/gi)) { const t = m[0]; if (re.test(t)) { const c = t.match(/\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i); if (c) return c[2] ?? c[3]; } } return ""; };
  const desc = tag(/\b(name|property)\s*=\s*["']?(description|og:description|twitter:description)["']?/i);
  const t = clean(title, 120), d = clean(desc, 260);
  return { title: WALL.test(t) ? "" : t, desc: WALL.test(d) ? "" : d };
}

async function readHead(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = []; let n = 0;
  while (n < maxBytes) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; }
  reader.cancel().catch(() => {});
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const cs = (res.headers.get("content-type") || "").match(/charset=([\w-]+)/i);
  try { return new TextDecoder(cs ? cs[1] : "utf-8", { fatal: false }).decode(buf); } catch { return buf.toString("utf8"); }
}

// Node can't follow a missing intermediate certificate the way the computer's browsers and curl do, so a site
// whose certificate chain is merely incomplete fails here but opens fine for a person. For those errors only,
// curl (which uses the computer's own trust) gives the second opinion. Expired or mismatched certificates are
// real problems a browser would warn about, so they stay failures.
const CHAIN = new Set(["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT"]);
const curlCheck = (url) => new Promise((resolve) =>
  execFile("curl", ["-sS", "-L", "--max-redirs", "5", "-o", "/dev/null", "-m", "20", "-A", UA, "-w", "%{http_code}|%{url_effective}", url], { timeout: 30000 },
    (err, out) => resolve(String(out || "").includes("|") ? String(out).split("|") : null)));
function curlVerdict(url, r) {
  const code = Number(r[0]);
  if ([401, 403, 405, 429, 999].includes(code)) return { s: "blocked", c: code };
  if (!(code >= 200 && code < 400)) return null; // curl failed too, or the site answered with an error: not rescued
  let s = "ok", u = r[1];
  try {
    const to = new URL(r[1]), from = new URL(url);
    if (domainOf(r[1]) !== domainOf(url)) s = "moved";
    else if (from.pathname.replace(/\/+$/, "") !== "" && to.pathname.replace(/\/+$/, "") === "" && !to.search) s = "bounced";
    if (u === url) u = undefined;
  } catch { u = undefined; }
  return { s, c: code, u, via: "curl" };
}

async function checkOne(url) {
  if (!isCheckable(url)) return { s: "skipped" };
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT), headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en" } });
      const code = res.status, finalUrl = res.url || url;
      let page = { title: "", desc: "" };
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (code >= 200 && code < 300 && res.body && /html|xml|text/.test(type)) page = meta(await readHead(res, 131072));
      else res.body && res.body.cancel().catch(() => {});
      if (code >= 500 && attempt < 2) { last = { s: "dead", c: code }; continue; }
      if ([401, 403, 405, 429, 999].includes(code)) return { s: "blocked", c: code, u: finalUrl !== url ? finalUrl : undefined };
      if (code >= 400) return { s: "dead", c: code };
      const u = (() => { try { return new URL(finalUrl); } catch { return null; } })();
      const from = new URL(url);
      let s = "ok";
      if (u && domainOf(finalUrl) !== domainOf(url)) s = "moved";
      else if (u && from.pathname.replace(/\/+$/, "") !== "" && u.pathname.replace(/\/+$/, "") === "" && !u.search) s = "bounced";
      return { s, c: code, u: finalUrl !== url ? finalUrl : undefined, t: page.title || undefined, m: page.desc || undefined };
    } catch (e) {
      const why = (e.cause && (e.cause.code || e.cause.message)) || e.name || String(e.message);
      if (CHAIN.has(why)) { const r = await curlCheck(url); const v = r && curlVerdict(url, r); if (v) return v; }
      last = { s: "unreachable", e: String(why).slice(0, 60) };
    }
  }
  return last;
}

// ---- which links to check
let todo = urls.filter((u) => {
  const r = prev[u];
  if (flag("--only-failed")) return r && FAILING.has(r.s);
  if (argv.includes("--errors")) return r && r.e && argv[argv.indexOf("--errors") + 1].split(",").includes(r.e);
  if (flag("--force")) return true;
  return !(r && r.d === today);
});
if (LIMIT) todo = todo.slice(0, LIMIT);
console.log(`${urls.length} links on the board · ${todo.length} to check${flag("--only-failed") ? " (second look at the failures)" : ""}`);

// ---- run: hosts in parallel, a few at a time per host with a short gap, so no site is hammered
const byHost = new Map();
for (const u of todo) { let h = "x"; try { h = new URL(u).hostname; } catch {} if (!byHost.has(h)) byHost.set(h, []); byHost.get(h).push(u); }
const lanes = [];
for (const list of byHost.values()) {
  const n = Math.min(3, Math.ceil(list.length / 60));
  for (let i = 0; i < n; i++) lanes.push(list.filter((_, k) => k % n === i));
}
lanes.sort((a, b) => b.length - a.length);
let done = 0, nextLane = 0, lastSave = Date.now();
const save = () => { fs.writeFileSync(STATUS_FILE, JSON.stringify({ checked: today, links: results })); lastSave = Date.now(); };
async function runLane(list) {
  for (const url of list) {
    const r = await checkOne(url);
    const was = prev[url];
    const fails = FAILING.has(r.s) ? (was && FAILING.has(was.s) ? (was.f || 0) + 1 : 1) : 0; // each run that fails again adds one
    results[url] = { ...r, d: today, f: fails };
    if (++done % 200 === 0) console.log(`  ${done}/${todo.length}`);
    if (Date.now() - lastSave > 20000) save();
    await new Promise((res) => setTimeout(res, 300));
  }
}
await Promise.all(Array.from({ length: WORKERS }, async () => { while (nextLane < lanes.length) await runLane(lanes[nextLane++]); }));
save();

const counts = {};
for (const u of urls) { const s = (results[u] || { s: "unchecked" }).s; counts[s] = (counts[s] || 0) + 1; }
console.log("\nresult:", JSON.stringify(counts));
const bad = urls.filter((u) => results[u] && FAILING.has(results[u].s));
console.log(`failing now: ${bad.length} (possibly dead, failed twice: ${bad.filter((u) => results[u].f >= 2).length})`);
