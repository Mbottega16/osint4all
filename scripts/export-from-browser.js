// Export the whole OSINT4ALL board from your own browser.
// 1. Open https://start.me/p/L1rEYQ/osint4all in Chrome.  2. Press Cmd+Option+J (Mac) or Ctrl+Shift+J (PC).
// 3. Paste this whole file into the console and press Enter (Chrome may first ask you to type: allow pasting).
// It visits every panel, opens any collapsed one, reads its links, closes it again, and downloads
// osint4all-export.json. Then: node scripts/import-scrape.mjs <that file> <YYYY-MM-DD>
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log("%cOSINT4ALL export", "font-weight:bold;color:#2b63d9", ...a);
  const cls = (e) => (typeof e.className === "string" ? e.className : (e.className && e.className.baseVal) || "");
  const text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const warnings = [];

  const sections = () => [...document.querySelectorAll(".page-section")];
  const columns = () => [...document.querySelectorAll(".page-section__column")];
  const slots = () => [...document.querySelectorAll(".page-section__widget")];
  const titleOf = (slot) => text(slot.querySelector(".widget-header__text"));
  function where(slot) {
    const sec = slot.closest(".page-section"), col = slot.closest(".page-section__column");
    return {
      si: sections().indexOf(sec),
      ci: sec ? [...sec.querySelectorAll(".page-section__column")].indexOf(col) : 0,
      wi: col ? [...col.querySelectorAll(".page-section__widget")].indexOf(slot) : 0,
    };
  }
  function read(slot) {
    for (const b of slot.querySelectorAll("button")) if (/^(show|view|see|load) (all|more)/i.test(text(b))) b.click();
    const items = [...slot.querySelectorAll(".bookmark-widget__item-wrapper")].map((li) => {
      const a = li.querySelector("a[href]");
      const img = li.querySelector("img");
      return { title: text(li.querySelector(".bookmark-item__title")) || (a && a.getAttribute("title")) || text(a), href: a ? a.href : "", icon: img ? img.src : "" };
    });
    const links = items.length ? [] : [...slot.querySelectorAll("a[href]")].map((a) => ({ title: text(a) || a.getAttribute("title") || "", href: a.href }));
    const type = [...new Set([...slot.querySelectorAll("[class*='-widget']")].flatMap((e) => cls(e).split(/\s+/)).filter((c) => /-widget$/.test(c)))].join(" ");
    return { title: titleOf(slot), type, items, links, text: items.length || links.length ? "" : slot.innerText.trim().slice(0, 400) };
  }
  const size = (p) => p.items.length + p.links.length;
  const isLinkPanel = (p) => !p.type || /bookmark|rss/.test(p.type); // clocks and notes have no links
  const current = (slot) => (slot.isConnected ? slot : slots().find((s) => titleOf(s) && titleOf(s) === titleOf(slot)) || slot);

  // Wait until a panel's links have drawn and stopped changing.
  async function settle(slot, patience) {
    let best = read(current(slot)), same = 0;
    for (let t = 0; t * 150 < patience && same < 2; t++) {
      await wait(150);
      const now = read(current(slot));
      same = size(now) > 0 && size(now) === size(best) ? same + 1 : 0;
      if (size(now) >= size(best)) best = now;
      if (!isLinkPanel(best) && t >= 2) break;
    }
    return best;
  }

  // Opening a collapsed panel: try the likely controls in its header, remember the one that works.
  const TOGGLES = ["[aria-expanded='false']", ".widget-header__chevron", "[class*='chevron']", "[class*='collapse']", "[class*='expand']", "[class*='toggle']", "[class*='chev']", "svg", ".widget-header"];
  const clickEl = (el) => (typeof el.click === "function" ? el.click() : el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  const RISKY = /menu|delete|remove|edit|setting|share|copy|more-actions/i;
  let opener = null;
  const findControl = (slot, sel) => {
    const head = slot.querySelector(".widget-header") || slot;
    const el = sel === ".widget-header" ? head : head.querySelector(sel);
    return el && !RISKY.test(cls(el) + " " + (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "")) ? el : null;
  };
  async function open(slot) {
    for (const sel of opener ? [opener, ...TOGGLES.filter((s) => s !== opener)] : TOGGLES) {
      const el = findControl(current(slot), sel);
      if (!el) continue;
      clickEl(el);
      const got = await settle(slot, 3000);
      if (size(got)) { opener = sel; return { got, sel }; }
    }
    return null;
  }

  // Reveal every column first (a narrow window can leave the last one off to the side).
  const cols = columns();
  if (cols.length) { cols[cols.length - 1].scrollIntoView({ block: "nearest", inline: "end" }); await wait(800); cols[0].scrollIntoView({ block: "start", inline: "start" }); await wait(600); }
  const debug = { columnsAtStart: columns().length, panelsAtStart: slots().length, opened: 0 };

  const found = new Map(); // slot element -> panel
  let pass = 0;
  while (pass++ < 3) {
    const todo = slots().filter((s) => !found.has(s));
    if (!todo.length) break;
    log(`reading ${todo.length} panels one by one (a minute or two)...`);
    for (let n = 0; n < todo.length; n++) {
      const slot = todo[n];
      slot.scrollIntoView({ block: "center", inline: "nearest" });
      let p = await settle(slot, 1500);
      if (isLinkPanel(p) && !size(p)) {
        const r = await open(slot);
        if (r) {
          p = r.got;
          debug.opened++;
          const back = findControl(current(slot), r.sel); // close it again, as it was
          if (back) { clickEl(back); await wait(250); }
        } else if (!debug.sample) debug.sample = current(slot).outerHTML.slice(0, 2500);
      }
      found.set(slot, { ...where(current(slot)), ...p });
      if (n % 10 === 9 || n === todo.length - 1) log(`${n + 1}/${todo.length} panels read, ${[...found.values()].reduce((s, q) => s + size(q), 0)} links so far`);
    }
  }
  debug.columnsAtEnd = columns().length;
  debug.panelsAtEnd = slots().length;
  debug.opener = opener;
  const firstFull = [...found.keys()].find((s) => size(found.get(s)));
  if (firstFull) debug.sampleFull = current(firstFull).outerHTML.slice(0, 1500);
  if (slots()[0]) slots()[0].scrollIntoView({ block: "start" });

  const panels = [...found.values()].sort((a, b) => a.si - b.si || a.ci - b.ci || a.wi - b.wi);
  for (const p of panels) {
    if (size(p)) continue;
    if (isLinkPanel(p)) warnings.push(`panel "${p.title || "(no title)"}" has no links even after trying to open it`);
    else warnings.push(`panel "${p.title || "(no title)"}" is a ${p.type} panel; its text was kept`);
  }

  // Icons, through the browser's own session. If the icon server refuses, the import fills them in.
  const icons = {};
  const iconUrls = [...new Set(panels.flatMap((p) => p.items.map((i) => i.icon)).filter((u) => /^https?:/.test(u)))];
  log("fetching " + iconUrls.length + " icons...");
  for (let i = 0; i < iconUrls.length; i += 8) {
    await Promise.all(iconUrls.slice(i, i + 8).map(async (u) => {
      try {
        const r = await fetch(u, { credentials: "omit" });
        const type = (r.headers.get("content-type") || "").split(";")[0];
        if (!r.ok || !type.startsWith("image/")) { icons[u] = { error: r.status + " " + type }; return; }
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = "";
        for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
        icons[u] = { type, b64: btoa(bin) };
      } catch (e) { icons[u] = { error: String(e.message || e).slice(0, 80) }; }
    }));
  }

  const out = [];
  for (const p of panels) {
    const s = (out[p.si] = out[p.si] || { title: "", columns: [] });
    (s.columns[p.ci] = s.columns[p.ci] || []).push({ title: p.title, type: p.type, items: p.items, links: p.links, text: p.text });
  }
  const clean = [...out].map((s) => s && { ...s, columns: [...s.columns].map((c) => c || []) }).filter(Boolean);
  const file = {
    format: "osint4all-export/3", source: location.href.split(/[?#]/)[0], title: document.title,
    exportedAt: new Date().toISOString(), window: { width: innerWidth, height: innerHeight },
    sections: clean, icons, warnings, debug,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  a.download = "osint4all-export.json";
  document.body.append(a);
  a.click();
  a.remove();
  const nLinks = panels.reduce((n, p) => n + size(p), 0);
  const empty = panels.filter((p) => isLinkPanel(p) && !size(p)).length;
  const nIcons = Object.values(icons).filter((x) => x.b64).length;
  log(`done: ${panels.length} panels in ${debug.columnsAtEnd} columns, ${nLinks} links (opened ${debug.opened} collapsed panels), ${nIcons}/${iconUrls.length} icons` + (empty ? `, ${empty} link panels still empty` : ", every link panel read") + ". Saved osint4all-export.json to Downloads.");
  if (warnings.length) console.warn("OSINT4ALL export notes:\n- " + warnings.join("\n- "));
})();
