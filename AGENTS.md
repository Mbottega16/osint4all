# OSINT4ALL — rules & map (read this first)

An offline, self-contained link board: the OSINT4ALL board on start.me copied as it was, plus SOCMINT and the owner's Atlas library as separate, labelled groups. 2,839 links in 116 panels, as one static page with no dependencies.

**History:** `HISTORY.md`, newest first — read it when a task touches
past work or the reason behind a decision. **Business side** (who it's for, money,
goals): the my-brain vault, `projects/osint4all/context.md`.

## What this is
- **What:** three groups, picked with chips. **OSINT4ALL** is every link on https://start.me/p/L1rEYQ/osint4all (1,459 in 78 panels, the original's 4 columns and order). **SOCMINT** (152 links, 18 panels) is the same curator's sibling board, via Atlas. **Atlas library** (1,228 links, 20 panels, by Atlas's categories) is the owner's own list of sites. Every panel starts closed. Search also reads descriptions. An **i** button beside each link opens a preview: a description, a front-page link, and the link check's verdict.
- **For:** the owner, as a personal OSINT toolkit that keeps working if start.me changes or goes down.
- **Platform / stack:** plain HTML, CSS and JS. Node (no packages) only for the scripts and the tests.
- **Money:** none. No hosting, no services.
- **What "done" looks like:** a double-click opens the board on either computer; the OSINT4ALL group matches the original's links exactly; every link has been checked.
- **Direction:** refresh from a new snapshot when the original changes.

## Settled decisions (don't re-argue)
- **Public, on GitHub Pages (owner, 2026-10-26)** at https://mbottega16.github.io/osint4all/, served from `main` at the repo root. A push to `main` publishes it. Auto mode won't flip a repo public, so the owner runs that step.
- **The data is copied, the page is not.** Link names, addresses, panel names and order follow the original. The design and code are this repo's own. The header says "Unofficial copy" and the footer credits OSINT4ALL and disclaims any affiliation. Keep both now that it's public, and don't copy start.me's markup, styles or branding.
- **SOCMINT and Atlas are separate groups (owner, 2026-10-26: "add the links from Atlas").** They live in `data/extra.js`, never in `data/board.js`, and the page labels them, so the OSINT4ALL group stays an exact copy the test can guard. This replaces the earlier "keep it separate from Atlas" rule. The vault's `projects/atlas/osint-board` is still Atlas's own mixed board; don't merge the two. A site already on the original is not repeated in an extra group (the test enforces it).
- **Panels start closed (owner, 2026-10-26),** and the page doesn't remember which were opened. A panel's links are drawn the first time it opens, so 2,800 links cost nothing at load.
- **Possibly dead links are hidden by default and never deleted.** "Possibly dead" means the link failed at least two link checks in a row (one bad moment on this computer's side must not flag a live site). The switch under the header shows them again, marked.
- **The preview says where its words came from.** Order: Atlas's own description, then a local-model one-liner, then the site's own description, then its page title. The model sees only the page's own text and is never asked what it remembers; an answer is thrown away unless every name and number in it appears in that text.
- **No network calls of its own.** Favicons are files (`icons/`, `icons-extra/`), the page sends no referrer, links open with `noopener noreferrer`, and the preview is plain links (no iframe, no fetch). The tests enforce this. An OSINT board shouldn't tell the sites on it that you opened it.
- **Two scripts do contact the listed sites, on purpose:** `check-links.mjs` (one request per link, an honest user agent, a few at a time per site) and `summarize.mjs` (reads a page to summarize it). The page never does.
- **No build step.** The data files are scripts the page loads, so `index.html` works straight from disk (`file://`) on both computers.
- **The original's 4 columns are kept at 1200 px and wider.** Narrower screens reflow to 3, 2 or 1 columns in reading order.

## How it's built
- `index.html` — the page shell: header, search, group chips, board, the preview panel, credit footer.
- `style.css` — colour tokens with a dark set that follows the system setting, plus the layout.
- `app.js` — draws the groups from `window.BOARD`, `window.EXTRA` and `window.INFO`; handles chips, closed-by-default panels (links built on first open), search, the preview panel, link marks and the hide-dead switch.
- `data/board.js` — the original: `window.BOARD = {title, source, snapshot, columns: [[{title, links: [{title, url, icon}]}]]};`, one link per line.
- `data/extra.js` — `window.EXTRA = {snapshot, groups: [{id, title, note, source, columns}]}` for SOCMINT and Atlas.
- `data/info.js` — `window.INFO = {"<url>": {s summary, ss its source, st status, d checked, f fails, fu final address, cd code, u good-for, t tags, c category, w warning}}`. Built, not edited.
- `data/link-status.json` — what each link check found, plus each page's own title and description. `data/summaries.json` / `summaries-rejected.json` — the local model's one-liners, and the ones thrown away.
- `icons/` — one favicon per original site, a bare file name in the data. `icons-extra/` — the same for the extra groups, a path such as `icons-extra/x.webp` in the data.
- `scripts/import-scrape.mjs` — a scrape or export → `data/board.js` + `icons/`. `scripts/export-from-browser.js` — pasted into Chrome's console on the start.me page; downloads `osint4all-export.json`.
- `scripts/import-extra.mjs` — the vault's SOCMINT scrape and Atlas seed → `data/extra.js` + `icons-extra/`.
- `scripts/check-links.mjs` — checks every link → `data/link-status.json`. `scripts/summarize.mjs` — local-model summaries. `scripts/build-info.mjs` — merges everything → `data/info.js`.
- `test/board.test.mjs` — the original pinned panel by panel, the extra groups pinned, link sanity, icons in both folders, every link checked, info well formed, no external loads, launcher pair.
- `Open OSINT4ALL.command` (Mac) / `Open OSINT4ALL.bat` (PC) — open the board in the default browser.

## Commands & Verification
- **Where it lives:** Mac `~/Desktop/my-brain/projects/osint4all/app` · PC `~/OneDrive/Desktop/OSINT4ALL` · GitHub `Mbottega16/osint4all` (public) · live at https://mbottega16.github.io/osint4all/
- **Deploy check:** `gh api repos/Mbottega16/osint4all/pages/builds/latest -q .status` should say `built` a minute or so after a push.
- **Open:** double-click the launcher for the computer you're on, or open `index.html`.
- **Test, Mac:** `node --test test/`. Passing prints `fail 0` (10 tests).
- **Test, PC:** `node --test test/board.test.mjs`. Node 22 on Windows fails on the bare `test/` folder. The launcher test also fails there (1 of 10): Windows does not report the executable flag. That is not a defect.
- **PC Playwright:** `~/OneDrive/Desktop/EloBotAscent/node_modules/playwright`. Run it headless; do not open windows in front of the owner.
- **After any visual change:** load the page from disk in Playwright at 1440, 1000 and 390 px wide, in light and dark, and look at the screenshots. Check for no console errors and no non-`file:` requests, panels all closed at load, a panel opening on click, search, the preview, the hide-dead switch. Mac Playwright: `~/.mosaic-crew/node_modules`.
- **Refresh the original:** the owner pastes `scripts/export-from-browser.js` into Chrome's console on the start.me page (paste the file's contents, not its path); it downloads `osint4all-export.json`. Then `node scripts/import-scrape.mjs <osint4all-export.json> YYYY-MM-DD`, and update `ORIGINAL` in the test to the new panel counts, on purpose.
- **Refresh the extras:** `node scripts/import-extra.mjs YYYY-MM-DD`, then update `EXTRA_EXPECTED` in the test on purpose.
- **Check the links:** `NODE_USE_SYSTEM_CA=1 UV_THREADPOOL_SIZE=64 node scripts/check-links.mjs`, then the same with `--only-failed` a while later, and again. Then `node scripts/summarize.mjs` if wanted, then `node scripts/build-info.mjs`.

## Never Read / Noise Zones (Do Not Scan)
- `icons/` and `icons-extra/` — about 2,300 binary favicons (11 MB).
- `data/extra.js`, `data/info.js`, `data/link-status.json`, `data/summaries*.json` — big generated data. `data/board.js` is about 165 KB. Grep them for a link instead of reading them whole.

## Rules & Gotchas
- **start.me blocks scripted access.** Plain fetches get a 403, and a default headless browser never renders the board. Don't try to get past its bot check. A refresh needs the owner's own Chrome and `scripts/export-from-browser.js`.
- **The link check needs two settings.** `UV_THREADPOOL_SIZE=64`: Node looks addresses up on 4 threads, and with many sites at once the lookups queue and live sites time out (the first full run reported 393 live sites unreachable that way). `NODE_USE_SYSTEM_CA=1`: otherwise sites whose certificate chain runs through a locally trusted authority look unreachable.
- **A bot wall is not a dead site.** 401/403/405/429/999 are "blocked" (alive, page not readable). "Moved" and "bounced" links still open. Only "dead" and "unreachable" count toward possibly dead.
- **hs3x.com appears twice** in THROWAWAY CONTACT under two names. The original lists it twice, so keep both.
- **SOCMINT and GEOINT** (panels on the original) link to sibling start.me boards. They are kept as on the original. The SOCMINT group is a different thing: that board's own links.
- **Panel names are unique within a group,** not across groups (SOCMINT has its own REDDIT, DISCORD and so on).
- **An icon is a bare file name (in `icons/`) or a path with a slash (from the repo root).** `icons/` is generated by `import-scrape.mjs` and wiped each run; `icons-extra/` belongs to `import-extra.mjs`.
- **Line endings:** the `.bat` must keep CRLF and the `.command` must stay executable. `.gitattributes` and the test cover both.
- **`.nojekyll`** stops GitHub Pages from running Jekyll over the files. Keep it.

## Session Handoff (Last Worked On · Current State · Next Up)
- **Last Worked On (2026-10-26, Mac):** the owner asked for Atlas's links, a link check, closed panels and a preview panel. Added SOCMINT (152) and the Atlas library (1,228) as separate groups; checked all 2,829 links; made every panel start closed; added the preview panel; wrote one-line summaries with the local model.
- **Current State:** not yet pushed. See the newest `HISTORY.md` entry for the numbers.
- **Next Up:**
  1. The owner's go to push; then check Pages says `built` and the live page shows 2,839 links with panels closed.
  2. Check the Windows `.bat` with a real double-click, and Firefox and Safari.
  3. Refresh when the original board changes (the owner reruns the Chrome export).
