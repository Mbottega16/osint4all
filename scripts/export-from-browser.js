// Export the whole OSINT4ALL board from your own browser.
// 1. Open https://start.me/p/L1rEYQ/osint4all in Chrome.  2. Press Cmd+Option+J (Mac) or Ctrl+Shift+J (PC).
// 3. Paste this whole file into the console and press Enter (Chrome may first ask you to type: allow pasting).
// It scrolls the board so every section draws, reads every panel and link, and downloads
// osint4all-export.json. Then: node scripts/import-scrape.mjs <that file> <YYYY-MM-DD>
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log("%cOSINT4ALL export", "font-weight:bold;color:#2b63d9", ...a);
  const cls = (e) => (typeof e.className === "string" ? e.className : (e.className && e.className.baseVal) || "");
  const text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const warnings = [];

  // start.me scrolls an inner panel rather than the window: use the tallest scrollable element.
  const scroller = [document.scrollingElement, ...document.querySelectorAll("*")]
    .filter((e) => e && e.scrollHeight > e.clientHeight + 50 && (e === document.scrollingElement || /(auto|scroll)/.test(getComputedStyle(e).overflowY)))
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement;

  // Panels can be drawn only near the screen (and dropped again further away), so every panel is
  // recorded as soon as it appears, keyed by its place on the page, keeping its fullest reading.
  const found = new Map();
  const sectionTitles = [];
  function collect() {
    document.querySelectorAll(".page-section").forEach((sec, si) => {
      const head = sec.querySelector("[class*='section__title'], [class*='section-title'], [class*='section__header'], [class*='section-header']");
      if (head && !head.closest(".page-section__widget") && text(head)) sectionTitles[si] = text(head);
      sec.querySelectorAll(".page-section__column").forEach((col, ci) => {
        col.querySelectorAll(".page-section__widget").forEach((slot, wi) => {
          for (const b of slot.querySelectorAll("button")) if (/^(show|view|see|load) (all|more)/i.test(text(b))) b.click();
          const items = [...slot.querySelectorAll(".bookmark-widget__item-wrapper")].map((li) => {
            const a = li.querySelector("a[href]");
            const img = li.querySelector("img");
            return { title: text(li.querySelector(".bookmark-item__title")) || (a && a.getAttribute("title")) || text(a), href: a ? a.href : "", icon: img ? img.src : "" };
          });
          const links = items.length ? [] : [...slot.querySelectorAll("a[href]")].map((a) => ({ title: text(a) || a.getAttribute("title") || "", href: a.href }));
          const panel = {
            si, ci, wi,
            title: text(slot.querySelector(".widget-header__text")),
            type: [...new Set([...slot.querySelectorAll("[class*='-widget']")].flatMap((e) => cls(e).split(/\s+/)).filter((c) => /-widget$/.test(c)))].join(" "),
            items, links,
            text: items.length || links.length ? "" : slot.innerText.trim().slice(0, 400),
          };
          const size = (p) => p.items.length * 2 + p.links.length * 2 + (p.title ? 1 : 0) + (p.text ? 1 : 0);
          const key = si + "/" + ci + "/" + wi;
          if (!found.has(key) || size(panel) > size(found.get(key))) found.set(key, panel);
        });
      });
    });
  }

  log("scrolling the board so every section draws…");
  scroller.scrollTop = 0;
  await wait(1200);
  collect();
  let lastHeight = -1, still = 0;
  for (let step = 0; step < 600 && still < 4; step++) {
    scroller.scrollTop += Math.max(200, Math.round(scroller.clientHeight * 0.6));
    await wait(350);
    collect();
    const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    still = atEnd && scroller.scrollHeight === lastHeight ? still + 1 : 0;
    lastHeight = scroller.scrollHeight;
    if (step % 8 === 0) log(found.size + " panels so far…");
  }
  if (scroller.scrollWidth > scroller.clientWidth + 50) warnings.push("the board is wider than the window; widen the window and run this again");
  scroller.scrollTop = 0;

  const panels = [...found.values()].sort((a, b) => a.si - b.si || a.ci - b.ci || a.wi - b.wi);
  for (const p of panels) {
    if (p.items.length || p.links.length) continue;
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

  const sections = [];
  for (const p of panels) {
    const s = (sections[p.si] = sections[p.si] || { title: sectionTitles[p.si] || "", columns: [] });
    (s.columns[p.ci] = s.columns[p.ci] || []).push({ title: p.title, type: p.type, items: p.items, links: p.links, text: p.text });
  }
  const clean = [...sections].map((s) => s && { ...s, columns: [...s.columns].map((c) => c || []) }).filter(Boolean);
  const out = {
    format: "osint4all-export/1", source: location.href.split(/[?#]/)[0], title: document.title,
    exportedAt: new Date().toISOString(), window: { width: innerWidth, height: innerHeight },
    sections: clean, icons, warnings,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: "application/json" }));
  a.download = "osint4all-export.json";
  document.body.append(a);
  a.click();
  a.remove();
  const nLinks = panels.reduce((n, p) => n + p.items.length + p.links.length, 0);
  const nIcons = Object.values(icons).filter((x) => x.b64).length;
  log(`done: ${clean.length} section(s), ${panels.length} panels, ${nLinks} links, ${nIcons}/${iconUrls.length} icons. Saved osint4all-export.json to Downloads.`);
  if (warnings.length) console.warn("OSINT4ALL export notes:\n- " + warnings.join("\n- "));
})();
