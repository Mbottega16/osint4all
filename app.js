// Atlas board: draws window.BOARD (data/board.js), window.ALMANAC (data/almanac.js) and window.GROUPS
// (data/groups.js), then handles search, collapsing, A-Z order and the column count.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const board = $("board"), q = $("q"), count = $("count"), empty = $("empty"), toggleAll = $("toggle-all"), azBtn = $("az");
  const B = window.BOARD;
  if (!B || !Array.isArray(B.columns)) {
    empty.textContent = "The link data (data/board.js) didn't load.";
    empty.hidden = false;
    return;
  }

  // What the viewer chose, kept per browser. Storage can be blocked; the board works without it.
  // Nothing saved yet (a first visit, or storage blocked) means every panel starts closed.
  const STORE = "osint4all:closed:v2", STORE_AZ = "osint4all:az";
  let closed, firstVisit = true, az = false;
  try {
    const saved = localStorage.getItem(STORE);
    firstVisit = saved === null;
    closed = new Set(JSON.parse(saved || "[]"));
    az = localStorage.getItem(STORE_AZ) === "1";
  } catch (e) { closed = new Set(); }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify([...closed])); } catch (e) { /* not kept */ } };
  const saveAz = () => { try { localStorage.setItem(STORE_AZ, az ? "1" : "0"); } catch (e) { /* not kept */ } };

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

  // The panels in data order: the original's, then the owner's Almanac panels (data/almanac.js).
  const source = B.columns.flat().concat((window.ALMANAC && window.ALMANAC.panels) || []);

  // Which group each panel belongs to (data/groups.js). A panel nobody listed goes to MORE.
  const groupDefs = ((window.GROUPS || []).map((g) => ({ title: g.title, names: g.panels })));
  const groupOf = new Map();
  groupDefs.forEach((g, i) => g.names.forEach((n) => groupOf.set(n, i)));
  if (source.some((p) => !groupOf.has(p.title))) groupDefs.push({ title: "MORE", names: [] });
  const groups = groupDefs.map((g) => ({ title: g.title, panels: [] }));

  // Build every panel once; layout() only moves them around.
  const panels = [];
  const byName = new Map();
  source.forEach((p) => {
    const n = panels.length;
    const el = document.createElement("section");
    el.className = "panel";
    const h3 = document.createElement("h3");
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
    h3.append(btn);

    const ul = document.createElement("ul");
    ul.className = "links";
    ul.id = "panel-" + n;
    const gi = groupOf.has(p.title) ? groupOf.get(p.title) : groups.length - 1;
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
      return { li, hay: (l.title + " " + l.url + " " + p.title + " " + groups[gi].title).toLowerCase() };
    });
    el.append(h3, ul);

    const panel = { el, btn, num, title: p.title, links, group: gi };
    btn.addEventListener("click", () => {
      if (board.classList.contains("searching")) return; // every match stays visible while searching
      setClosed(panel, !closed.has(panel.title));
      save();
      syncToggle();
    });
    setClosed(panel, firstVisit || closed.has(p.title));
    panels.push(panel);
    groups[gi].panels.push(panel);
  });
  // Inside a group, panels follow the order data/groups.js gives; unlisted ones keep data order at the end.
  groups.forEach((g, gi) => {
    const rank = (p) => { const i = groupDefs[gi].names.indexOf(p.title); return i < 0 ? 1e6 : i; };
    g.panels.sort((a, b) => rank(a) - rank(b));
  });
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

  // Layout: one section per group (or a single A-Z section), each split into columns that fit the
  // window. Panels go to the columns in turn, so a group reads left to right, then down. Opening a
  // panel only lengthens its own column.
  const MIN_COL = 300, GAP = 12;
  const sortKey = (t) => t.replace(/^[^A-Za-z0-9]+/, "").toLowerCase();
  let cols = 0, sections = [];
  function section(title, list) {
    const el = document.createElement("section");
    el.className = "group";
    const h2 = document.createElement("h2");
    h2.className = "group-head";
    const gname = document.createElement("span");
    gname.textContent = title;
    const gnum = document.createElement("span");
    gnum.className = "gnum";
    h2.append(gname, gnum);
    const body = document.createElement("div");
    body.className = "group-panels";
    const boxes = Array.from({ length: cols }, () => {
      const d = document.createElement("div");
      d.className = "col";
      return d;
    });
    list.forEach((p, i) => boxes[i % cols].append(p.el));
    body.append(...boxes);
    el.append(h2, body);
    return { el, gnum, panels: list };
  }
  function layout(force) {
    const pad = getComputedStyle(board);
    const room = board.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    const n = Math.max(1, Math.floor((room + GAP) / (MIN_COL + GAP)));
    if (n === cols && !force) return;
    cols = n;
    board.style.setProperty("--cols", n);
    sections = az
      ? [section("ALL PANELS, A TO Z", panels.slice().sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title))))]
      : groups.filter((g) => g.panels.length).map((g) => section(g.title, g.panels));
    board.replaceChildren(...sections.map((s) => s.el));
    filter();
  }
  window.addEventListener("resize", () => layout(false));

  azBtn.addEventListener("click", () => {
    az = !az;
    azBtn.setAttribute("aria-pressed", String(az));
    saveAz();
    layout(true);
  });

  // Search: every word must appear in the link's name, its address, its panel's name or its group's name.
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
    for (const s of sections) {
      const open = s.panels.filter((p) => !p.el.hidden);
      s.el.hidden = open.length === 0;
      const nLinks = open.reduce((n, p) => n + p.links.filter((l) => !l.li.hidden).length, 0);
      s.gnum.textContent = open.length + (open.length === 1 ? " panel" : " panels") + " · " + nLinks + (nLinks === 1 ? " link" : " links");
    }
    count.textContent = searching ? shown + " of " + total + " links" : "";
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

  // Snapshot code: a short fingerprint of every panel name and link address, in order. It changes
  // whenever a link or panel is added, removed or renamed, so two copies with the same code match.
  function snapshotCode() {
    let h = 0x811c9dc5;
    const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
    source.forEach((p) => { mix(p.title); p.links.forEach((l) => mix(l.url)); });
    return h.toString(16).padStart(8, "0").slice(0, 6).toUpperCase();
  }
  const when = /^\d{4}-\d{2}-\d{2}$/.test(B.snapshot || "")
    ? new Date(B.snapshot + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";
  $("meta").textContent = total.toLocaleString("en-US") + " links · " + panels.length + " panels" + (when ? " · snapshot " + when : "") + " · code " + snapshotCode();
  if (when) $("snapshot").textContent = "on " + when;
  if (B.source) $("source").href = B.source;
  q.placeholder = "Search " + total.toLocaleString("en-US") + " links";
  azBtn.setAttribute("aria-pressed", String(az));

  layout(true);
  syncToggle();
})();
