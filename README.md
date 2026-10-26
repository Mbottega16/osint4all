# OSINT4ALL board

An offline copy of the [OSINT4ALL](https://start.me/p/L1rEYQ/osint4all) link board on start.me:
387 open-source intelligence tools in 14 panels, in the same columns and order as the original.

**Live:** https://mbottega16.github.io/osint4all/

- **Open it offline:** double-click `Open OSINT4ALL.command` (Mac) or `Open OSINT4ALL.bat` (Windows),
  or open `index.html` in any browser. No install and no server.
- **Search:** press `/`, type a few words. A word matches a link's name, its address or its panel.
  `Esc` clears.
- **Collapse:** click a panel's heading. Your browser remembers which panels you collapsed.
- **Private by design:** favicons are stored in `icons/`, so the page makes no network requests of
  its own. Links open in a new tab and send no referrer.

Links curated by OSINT4ALL. This copy was taken on 2026-10-26 and is not affiliated with start.me
or OSINT4ALL.

## For maintainers

- Data: `data/board.js` (one link per line). Icons: `icons/`.
- Check: `node --test test/` (Node 18 or newer, no packages).
- Refresh from a new scrape: `node scripts/import-scrape.mjs <data.json> <icons.json> YYYY-MM-DD`.
