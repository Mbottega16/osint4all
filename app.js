// OSINT4ALL board: draws window.BOARD (data/board.js), then handles search, collapsing and columns.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const board = $("board"), q = $("q"), count = $("count"), empty = $("empty"), toggleAll = $("toggle-all");
  const B = window.BOARD;
  if (!B || !Array.isArray(B.columns)) {
    empty.textContent = "The link data (data/board.js) didn't load.";
    empty.hidden = false;
    return;
  }

  // Which panels the viewer collapsed, kept per browser. Storage can be blocked; the board works without it.
  const STORE = "osint4all:closed";
  let closed;
  try { closed = new Set(JSON.parse(localStorage.getItem(STORE) || "[]")); } catch (e) { closed = new Set(); }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify([...closed])); } catch (e) { /* not kept */ } };

  const SVG = "http://www.w3.org/2000/svg";
  function svg(viewBox, size, paths) {
    const s = document.createElementNS(SVG, "svg");
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of paths) {
      const el = document.createElementNS(SVG, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      s.append(el);
    }
    return s;
  }
  const line = { fill: "none", stroke: "currentColor", "stroke-width": "1.4" };
  const globe = () => {
    const g = svg("0 0 16 16", 16, [
      ["circle", { cx: 8, cy: 8, r: 6.3, ...line }],
      ["path", { d: "M1.7 8h12.6M8 1.7c2.1 2.1 2.1 10.5 0 12.6M8 1.7c-2.1 2.1-2.1 10.5 0 12.6", ...line }],
    ]);
    g.setAttribute("class", "globe");
    return g;
  };
  const chevron = () => {
    const c = svg("0 0 16 16", 14, [["path", { d: "M4 6l4 4 4-4", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" }]]);
    c.setAttribute("class", "chev");
    return c;
  };

  // Build every panel once; layout() only moves them between columns.
  const panels = [];
  B.columns.forEach((col, ci) =>
    col.forEach((p) => {
      const n = panels.length;
      const el = document.createElement("section");
      el.className = "panel";
      const h2 = document.createElement("h2");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "panel-head";
      btn.setAttribute("aria-controls", "panel-" + n);
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = p.title;
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = p.links.length;
      btn.append(name, num, chevron());
      h2.append(btn);

      const ul = document.createElement("ul");
      ul.className = "links";
      ul.id = "panel-" + n;
      const links = p.links.map((l) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = l.url;
        if (l.icon) {
          const img = document.createElement("img");
          img.src = "icons/" + l.icon;
          img.alt = "";
          img.width = img.height = 16;
          img.loading = "lazy";
          img.addEventListener("error", () => img.replaceWith(globe()), { once: true });
          a.append(img);
        } else a.append(globe());
        const t = document.createElement("span");
        t.className = "t";
        t.textContent = l.title;
        a.append(t);
        li.append(a);
        ul.append(li);
        return { li, hay: (l.title + " " + l.url + " " + p.title).toLowerCase() };
      });
      el.append(h2, ul);

      const panel = { el, btn, num, title: p.title, col: ci, links, weight: p.links.length + 3 };
      btn.addEventListener("click", () => {
        if (board.classList.contains("searching")) return; // every match stays visible while searching
        setClosed(panel, !closed.has(panel.title));
        save();
        syncToggle();
      });
      setClosed(panel, closed.has(p.title));
      panels.push(panel);
    })
  );
  const total = panels.reduce((n, p) => n + p.links.length, 0);

  function setClosed(p, isClosed) {
    if (isClosed) closed.add(p.title); else closed.delete(p.title);
    p.el.classList.toggle("closed", isClosed);
    p.btn.setAttribute("aria-expanded", String(!isClosed));
  }
  function syncToggle() {
    toggleAll.textContent = panels.some((p) => !closed.has(p.title)) ? "Collapse all" : "Expand all";
  }
  toggleAll.addEventListener("click", () => {
    const close = panels.some((p) => !closed.has(p.title));
    panels.forEach((p) => setClosed(p, close));
    save();
    syncToggle();
  });

  // Columns: the original page's four on wide screens; narrower screens get fewer,
  // filled in reading order, each panel going to the shortest column so far.
  const WIDTHS = [[1200, 4], [880, 3], [600, 2], [0, 1]];
  let cols = 0;
  function layout() {
    const w = window.innerWidth;
    const n = WIDTHS.find(([min]) => w >= min)[1];
    if (n === cols) return;
    cols = n;
    board.style.setProperty("--cols", n);
    const boxes = Array.from({ length: n }, () => {
      const d = document.createElement("div");
      d.className = "col";
      return d;
    });
    if (n === B.columns.length) panels.forEach((p) => boxes[p.col].append(p.el));
    else {
      const height = new Array(n).fill(0);
      panels.forEach((p) => {
        const i = height.indexOf(Math.min(...height));
        boxes[i].append(p.el);
        height[i] += p.weight;
      });
    }
    board.replaceChildren(...boxes);
  }
  window.addEventListener("resize", layout);

  // Search: every word must appear in the link's name, its address, or its panel's name.
  function filter() {
    const raw = q.value.trim();
    const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const searching = words.length > 0;
    board.classList.toggle("searching", searching);
    let shown = 0;
    for (const p of panels) {
      let n = 0;
      for (const l of p.links) {
        const hit = words.every((w) => l.hay.includes(w));
        l.li.hidden = !hit;
        if (hit) n++;
      }
      p.el.hidden = n === 0;
      p.num.textContent = searching ? n + " / " + p.links.length : p.links.length;
      p.btn.setAttribute("aria-expanded", String(searching || !closed.has(p.title)));
      shown += n;
    }
    count.textContent = searching ? shown + " of " + total + " links" : total + " links";
    empty.hidden = shown > 0;
    empty.textContent = "No links match “" + raw + "”.";
  }
  q.addEventListener("input", filter);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      q.value = "";
      filter();
      q.blur();
    }
  });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      q.focus();
    }
  });

  const when = /^\d{4}-\d{2}-\d{2}$/.test(B.snapshot || "")
    ? new Date(B.snapshot + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";
  $("meta").textContent = total + " links in " + panels.length + " panels" + (when ? " · snapshot " + when : "");
  if (when) $("snapshot").textContent = "on " + when;
  if (B.source) $("source").href = B.source;
  q.placeholder = "Search " + total + " links";

  layout();
  filter();
  syncToggle();
})();
