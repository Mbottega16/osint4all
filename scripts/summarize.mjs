// Write one-line summaries, with a local model (Ollama), for sites that have no description of their own.
//
// Only sites whose page can be read and that have neither an Atlas description nor a description of their
// own get one. The model is given ONLY the page's own text, never asked what it remembers about the site, and
// its answer is thrown away unless every name and number in it appears in that text. Kept summaries go to
// data/summaries.json (shown as "Written by a local AI model"); thrown-away ones are listed in
// data/summaries-rejected.json so a rerun doesn't spend time on them again.
//
// Usage:
//   node scripts/summarize.mjs                    every site that needs one (resumes where it stopped)
//   node scripts/summarize.mjs --limit 5          a quick sample
//   node scripts/summarize.mjs --model qwen3.5:9b --host http://127.0.0.1:11434
//   node scripts/summarize.mjs --retry-rejected   give the thrown-away ones another go
//
// One model at a time: on a 16 GB Mac, qwen3.5:9b crashes if another model is loaded, so anything else that is
// loaded is unloaded first. The model is unloaded again at the end.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const MODEL = opt("--model", "qwen3.5:9b");
const HOST = opt("--host", "http://127.0.0.1:11434");
const LIMIT = Number(opt("--limit", 0));
const STATUS_FILE = opt("--status", path.join(ROOT, "data", "link-status.json"));
const OUT = path.join(ROOT, "data", "summaries.json");
const REJ = path.join(ROOT, "data", "summaries-rejected.json");
const UA = "Mozilla/5.0 (compatible; OSINT4ALLLinkCheck/1.0; +https://github.com/Mbottega16/osint4all)";

function loadData(file, name) {
  const src = fs.readFileSync(path.join(ROOT, "data", file), "utf8");
  const p = `window.${name} = `;
  return JSON.parse(src.slice(src.indexOf(p) + p.length, src.lastIndexOf(";")));
}
const readIf = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const norm = (u) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, ""); } catch { return u; } };

// ---- who needs a summary
const BOARD = loadData("board.js", "BOARD");
const EXTRA = loadData("extra.js", "EXTRA");
const titleOf = new Map();
for (const p of BOARD.columns.flat()) for (const l of p.links) titleOf.set(l.url, l.title);
for (const g of EXTRA.groups) for (const p of g.columns.flat()) for (const l of p.links) titleOf.set(l.url, l.title);
const status = (readIf(STATUS_FILE) || { links: {} }).links;
const atlasFile = [
  path.resolve(ROOT, "..", "..", "..", "projects", "atlas", "app", "backend", "seed", "atlas-seed.json"),
  path.join(os.homedir(), "OneDrive", "Desktop", "Atlas", "backend", "seed", "atlas-seed.json"),
].find((p) => fs.existsSync(p));
const atlas = new Set((atlasFile ? readIf(atlasFile) : []).map((e) => norm(e.link)));
const done = readIf(OUT) || {};
const rejected = readIf(REJ) || {};
let todo = [...titleOf.keys()].filter((u) => {
  const r = status[u];
  if (!r || !["ok", "moved", "bounced"].includes(r.s)) return false; // nothing readable
  if (atlas.has(norm(u)) || (r.m && r.m.length >= 25)) return false; // already described
  if (done[u]) return false;
  return argv.includes("--retry-rejected") || !rejected[u];
});
if (LIMIT) todo = todo.slice(0, LIMIT);
console.log(`${todo.length} sites need a summary (model ${MODEL})`);
if (!todo.length) process.exit(0);

// ---- page text: what the page itself says, without scripts, styles and markup
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const c = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " "; }
  return ENT[e.toLowerCase()] ?? " ";
});
function visibleText(html) {
  return decode(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}
async function pageText(url, redirectUrl) {
  const res = await fetch(redirectUrl || url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en" } });
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
  const reader = res.body.getReader();
  const chunks = []; let n = 0;
  while (n < 262144) { const { done: d, value } = await reader.read(); if (d) break; chunks.push(value); n += value.length; }
  reader.cancel().catch(() => {});
  const html = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  return visibleText(html);
}

// ---- the model
const SYSTEM = [
  "You write one-sentence descriptions for a directory of websites.",
  "Use ONLY the text you are given. Say what the site is or does, in plain words, in at most 25 words.",
  "Start with a noun phrase or a verb. Do not start with 'This site', 'The website' or the site's own name.",
  "Do not add any name, number or fact that is not in the text. Do not mention the text itself.",
  "If the text does not make clear what the site is, reply with exactly: UNKNOWN",
].join(" ");
async function ollama(path_, body) {
  const r = await fetch(HOST + path_, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error("Ollama " + r.status + " " + (await r.text()).slice(0, 120));
  return r.json();
}
async function unloadOthers() {
  const ps = await (await fetch(HOST + "/api/ps")).json().catch(() => ({ models: [] }));
  for (const m of ps.models || []) if (m.name !== MODEL) { await ollama("/api/generate", { model: m.name, keep_alive: 0 }); console.log("unloaded " + m.name); }
}
async function ask(site, pageTitle, host, text) {
  const j = await ollama("/api/chat", {
    model: MODEL, stream: false, think: false,
    options: { temperature: 0.2, num_predict: 90 },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Name on the board: ${site}\nPage title: ${pageTitle || "(none)"}\nAddress: ${host}\n\nPage text:\n${text}` },
    ],
  });
  return (j.message && j.message.content) || "";
}

// An answer is kept only if it is short, one or two sentences, and every number and every capitalised word
// after the first appears in the text the model was given (the usual shape of an invented fact).
function check(answer, source) {
  let s = answer.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
  if (!s || /^unknown\b/i.test(s)) return { why: "model said it could not tell" };
  if (s.length < 15 || s.length > 220) return { why: "length " + s.length };
  if (/https?:|www\.|\.com\b/i.test(s)) return { why: "contains an address" };
  if ((s.match(/[.!?](\s|$)/g) || []).length > 2) return { why: "more than two sentences" };
  if (/^(i |as an ai|sorry|this (site|website|page))/i.test(s)) return { why: "talks about itself or the page" };
  const src = source.toLowerCase();
  let starts = true;
  for (const raw of s.split(/\s+/)) {
    const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const atStart = starts;
    starts = /[.!?]$/.test(raw);
    if (!w) continue;
    const isNumber = /\d/.test(w);
    const isName = !atStart && /^\p{Lu}/u.test(w);
    if ((isNumber || isName) && !src.includes(w.toLowerCase())) return { why: `"${w}" is not in the page text` };
  }
  return { ok: s };
}

// ---- run
await unloadOthers();
let kept = 0, thrown = 0, unreadable = 0;
const save = () => { fs.writeFileSync(OUT, JSON.stringify(done, null, 1)); fs.writeFileSync(REJ, JSON.stringify(rejected, null, 1)); };
for (let i = 0; i < todo.length; i++) {
  const url = todo[i], r = status[url], site = titleOf.get(url);
  try {
    const text = (await pageText(url, r.u)).slice(0, 1500);
    if (text.length < 120) { rejected[url] = "page has almost no text (needs JavaScript?)"; unreadable++; continue; }
    const host = new URL(url).hostname;
    const answer = await ask(site, r.t || "", host, text);
    const res = check(answer, `${site} ${r.t || ""} ${host} ${text}`);
    if (res.ok) { done[url] = res.ok; delete rejected[url]; kept++; } else { rejected[url] = res.why; thrown++; }
  } catch (e) {
    rejected[url] = "could not read the page: " + String(e.message || e).slice(0, 60);
    unreadable++;
  }
  if ((i + 1) % 10 === 0) { save(); console.log(`  ${i + 1}/${todo.length} · kept ${kept} · thrown away ${thrown} · no text ${unreadable}`); }
}
save();
await ollama("/api/generate", { model: MODEL, keep_alive: 0 }).catch(() => {});
console.log(`done: kept ${kept}, thrown away ${thrown}, page unreadable ${unreadable}`);
