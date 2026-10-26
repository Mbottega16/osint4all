// Export the whole OSINT4ALL board from your own browser.
// 1. Open https://start.me/p/L1rEYQ/osint4all in Chrome.  2. Press Cmd+Option+J (Mac) or Ctrl+Shift+J (PC).
// 3. Paste this whole file into the console and press Enter (Chrome may first ask you to type: allow pasting).
// It brings every panel into view in turn, waits for its links to draw, reads them, and downloads
// osint4all-export.json. Then: node scripts/import-scrape.mjs <that file> <YYYY-MM-DD>
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log("%cOSINT4ALL export", "font-weight:bold;color:#2b63d9", ...a);
  const cls = (e) => (typeof e.className === "string" ? e.className : (e.className && e.className.baseVal) || "");
  const text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const warnings = [];

  // start.me draws a panel's links only while the panel is near the screen. Scrolling "the page" is
  // unreliable (it scrolls an inner area), so each panel is scrolled into view by itself instead.
  const sections = () => [...document.querySelectorAll(".page-section")];
  const slots = () => [...document.querySelectorAll(".page-section__widget")];
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
    return {
      title: text(slot.querySelector(".widget-header__text")), type, items, links,
      text: items.length || links.length ? "" : slot.innerText.trim().slice(0, 400),
    };
  }
  const size = (p) => p.items.length + p.links.length;
  // Read one panel: bring it into view, then wait until its links have drawn and stopped changing.
  async function visit(i, patience) {
    const slot = slots()[i];
    if (!slot) return null;
    slot.scrollIntoView({ block: "center", inline: "nearest" });
    let best = read(slot), same = 0;
    for (let t = 0; t * 150 < patience && same < 2; t++) {
      await wait(150);
      const now = read(slots()[i] || slot);
      same = size(now) > 0 && size(now) === size(best) ? same + 1 : 0;
      if (size(now) >= size(best)) best = now;
      if (best.type && !/bookmark|rss/.test(best.type) && t >= 2) break; // clocks and notes have no links to wait for
    }
    return { ...where(slots()[i] || slot), ...best };
  }

  const total = slots().length;
  log(`reading ${total} panels one by one (about a minute)…`);
  const found = [];
  for (let i = 0; i < total; i++) {
    found[i] = await visit(i, 4000);
    if (i % 10 === 9 || i === total - 1) log(`${i + 1}/${total} panels read, ${found.reduce((n, p) => n + (p ? size(p) : 0), 0)} links so far`);
  }
  // A second, more patient look at any panel that came back empty (unless it's a clock or a note).
  for (let i = 0; i < total; i++) {
    const p = found[i];
    if (p && !size(p) && !(p.type && !/bookmark|rss/.test(p.type))) {
      const again = await visit(i, 8000);
      if (again && size(again)) found[i] = again;
    }
  }
  if (slots()[0]) slots()[0].scrollIntoView({ block: "start" });

  const panels = found.filter(Boolean).sort((a, b) => a.si - b.si || a.ci - b.ci || a.wi - b.wi);
  for (const p of panels) {
    if (size(p)) continue;
    if (/bookmark/.test(p.type)) warnings.push(`panel "${p.title || "(no title)"}" has no links; it may be collapsed on the page (open it and run this again)`);
    else warnings.push(`panel "${p.title || "(no title)"}" is a ${p.type || "non-link"} panel; its text was kept`);
  }

  // Icons, through the browser's own session. If the icon server refuses, the import fills them in.
  const icons = {};
  const iconUrls = [...new Set(panels.flatMap((p) => p.items.map((i) => i.icon)).filter((u) => /^https?:/.test(u)))];
  log("fetching " + iconUrls.length + " icons…");
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
    format: "osint4all-export/2", source: location.href.split(/[?#]/)[0], title: document.title,
    exportedAt: new Date().toISOString(), window: { width: innerWidth, height: innerHeight },
    sections: clean, icons, warnings,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  a.download = "osint4all-export.json";
  document.body.append(a);
  a.click();
  a.remove();
  const nLinks = panels.reduce((n, p) => n + size(p), 0);
  const empty = panels.filter((p) => /bookmark/.test(p.type) && !size(p)).length;
  const nIcons = Object.values(icons).filter((x) => x.b64).length;
  log(`done: ${panels.length} panels, ${nLinks} links, ${nIcons}/${iconUrls.length} icons` + (empty ? `, ${empty} link panels still empty` : ", every link panel read") + ". Saved osint4all-export.json to Downloads.");
  if (warnings.length) console.warn("OSINT4ALL export notes:\n- " + warnings.join("\n- "));
})();
