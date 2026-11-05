# OSINT4ALL board

An offline copy of the [OSINT4ALL](https://start.me/p/L1rEYQ/osint4all) link board on start.me, with two
extra groups beside it. 2,839 links in 116 panels.

**Live:** https://mbottega16.github.io/osint4all/

## What's in it

Three groups, picked with the chips at the top:

| Group | Links | What it is |
|---|---|---|
| **OSINT4ALL** | 1,459 in 78 panels | The original board, in the same columns and order. |
| **SOCMINT** | 152 in 18 panels | The same curator's sibling board, collected through Atlas. |
| **Atlas library** | 1,228 in 20 panels | The owner's own curated list of useful sites, grouped by Atlas's categories. |

## Using it

- **Open it offline:** double-click `Open OSINT4ALL.command` (Mac) or `Open OSINT4ALL.bat` (Windows),
  or open `index.html` in any browser. No install and no server.
- **Panels start closed.** Click a panel's heading to open it. **Expand all** opens everything.
- **Search:** press `/`, type a few words. A word matches a link's name, its address, its panel,
  its group, or its description. Panels with matches open by themselves. `Esc` clears.
- **Preview:** the **i** button beside a link opens a panel with a short description of the site, a
  button to the site's front page, and how its last link check went.
- **Link checks:** every link was checked. Links that failed every check are hidden (the switch under the
  header shows them again, marked "may be dead"). Nothing is deleted. "Moved" means the site now
  redirects elsewhere; "front page" means a deep link now lands on the site's front page.
- **Private by design:** favicons are stored in `icons/` and `icons-extra/`, so the page makes no
  network requests of its own. Links open in a new tab and send no referrer.

The OSINT4ALL panels are links curated by OSINT4ALL. This copy was taken on 2026-10-26 and is not
affiliated with start.me or OSINT4ALL.

## For maintainers

- Data: `data/board.js` (the original, one link per line), `data/extra.js` (SOCMINT and Atlas),
  `data/info.js` (descriptions and link status, built by a script). Icons: `icons/`, `icons-extra/`.
- Check: `node --test test/` (Node 18 or newer, no packages).
- Refresh the original from a new scrape: paste `scripts/export-from-browser.js` into Chrome's console on the
  start.me page (it downloads `osint4all-export.json`), then
  `node scripts/import-scrape.mjs <osint4all-export.json> YYYY-MM-DD`.
- Refresh SOCMINT and Atlas: `node scripts/import-extra.mjs YYYY-MM-DD` (reads the vault's Atlas files).
- Check the links, in this order (each step is safe to rerun; run the second look a while after the first):
  `NODE_USE_SYSTEM_CA=1 UV_THREADPOOL_SIZE=64 node scripts/check-links.mjs`, then the same with `--only-failed`
  twice more. A link is "possibly dead" after failing two checks in a row.
- Descriptions: `node scripts/summarize.mjs` writes short summaries with a local model (Ollama, qwen3.5:9b) for
  sites that have no description of their own, from the page's own text only.
- Then `node scripts/build-info.mjs` rebuilds `data/info.js`.
