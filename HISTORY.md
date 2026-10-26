# OSINT4ALL — history

Every session's log, **newest first**. Read on demand, not at startup. The current
snapshot is the Session Handoff at the bottom of `CLAUDE.md`.

**Adding an entry:** at the end of a session, move the old handoff here as a new entry
at the top, then overwrite the handoff. One entry per session, 5–10 lines:

```
## YYYY-MM-DD — <what, in a few words>
*<machine: Mac | PC> · <agent: Claude | Antigravity> · commits `abc1234`*
- **Changed:** what is different now, for the player/user and in the code.
- **Why:** the ask or the problem, and any decision made (with its reason).
- **Verified:** what was run and what it said; what was NOT checked.
- **Left open:** anything unfinished or waiting on the owner.
```

---

## 2026-10-26 — repo created
*Mac · Claude · first commit*
- **Changed:** new repo. A static board with all 387 OSINT4ALL links in the original 14 panels and 4 columns, search, collapsible panels, light and dark, local favicons, no referrer, and Mac/PC launchers.
- **Why:** the owner asked for a complete recreation of start.me/p/L1rEYQ/osint4all as its own GitHub repo. It was created private, because public or Pages needs the owner's yes. It is kept apart from Atlas's mixed osint-board.
- **Data:** imported from the vault's `projects/atlas/osint-board/source` scrape (data.json and icons.json, taken 2026-10-26 00:17). A fresh scrape this session wasn't possible: start.me returns 403 to plain fetches and doesn't render for a default headless browser, and getting past that was declined as bot-check circumvention.
- **Verified:** `node --test test/` 6/6. Dropping a link, deleting an icon and adding an external script each made the right test fail. In Chromium from `file://`: 387 links, 386 icons plus 1 globe fallback, 0 broken images, 0 console errors, 0 network requests. Search, `/` and `Esc`, collapse-all and remembered state all work, at 4, 3 and 1 columns with no sideways scroll.
- **Then:** the owner said to make it public. The page got ready for that: the header now says "Unofficial copy" so a public page can't pass for OSINT4ALL's own, and a `.nojekyll` was added for Pages. Auto mode refused the visibility change ("create public surface"), so the repo is still private until the owner runs the switch.
- **Left open:** PC clone, Safari/Firefox, and the `.bat` on Windows.
