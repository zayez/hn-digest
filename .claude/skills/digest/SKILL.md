---
name: digest
description: Digest a Hacker Newsletter issue into the site — pick and tier the stories worth the reader's time, then summarize each article and its HN thread. Use when the user names or pastes a newsletter issue, asks for the next issue, asks to change an issue's picks, or asks to redo a post.
---

The user names a Hacker Newsletter issue by number, pastes it whole, or asks for the next one. You scan every story in it, rank them against the reader's profile (`data/profile.md`, private and gitignored) into three tiers plus a near-miss list, digest the picks, and ship the issue end to end without stopping for approval: the user reviews it on the live site and asks for changes afterwards. Each pick becomes a post (`src/content/posts/<hnId>.json`); the issue becomes `src/content/issues/<number>.json`. The schema in `src/content.config.ts` is the contract; `npm run build` enforces it. Tier names and caps live in `src/lib/tiers.ts`.

Read `data/profile.md` first. If it is missing, stop and tell the user: every pick depends on it.

## Steps

1. **Get the issue.** The next issue is the highest number in `src/content/issues/` plus one. Given a number, run `npm run fetch-issue -- <n>` (it downloads the Buttondown archive page). Given a paste, write it verbatim to `data/raw/paste.txt`. Done when `data/raw/paste.txt` holds the whole issue, links and all.

2. **Ingest everything.** `npm run ingest -- data/raw/paste.txt --all`. If the number or date is missing from the paste, pass `--number`/`--date` (ask the user if you cannot tell). Sponsor and Classifieds blocks are skipped by the parser. Done when the report lists every item; items under "No HN thread" are near-miss material only.

3. **Scan, with Haiku.** Split the ingested ids into batches of 5 and dispatch one subagent per batch with `model: "haiku"`, all in a single message. Each gets this prompt, with the issue number and ids filled in:

   > Write scan cards for Hacker Newsletter issue `<n>`, stories `<id>, <id>, …`. Read `.claude/skills/digest/scan-guide.md` and follow it exactly. Reply with the ids you wrote.

   Done when `npm run scan-sheet -- <n>` ends without a "Missing scan cards" line.

4. **Rank.** Read `.claude/skills/digest/rank-guide.md`, then the whole scan sheet (`npm run scan-sheet -- <n>`), and write `data/raw/issues/<n>/selection.json`. Done when every item on the sheet has been weighed against the profile and the selection obeys the caps and the profile's selection rules.

5. **Fix missing articles** for picks whose ingest line says `ARTICLE: …`: try WebFetch on the URL and, if it yields the real article, write the text to `data/raw/posts/<id>/article.txt`. Otherwise accept a comments-only digest with an `articleNote`. Done when every pick has article text or a decided note.

6. **Digest, one subagent per pick** that the scan sheet does not mark ALREADY DIGESTED, all dispatched in a single message on the session model. Each gets this prompt, with the id filled in:

   > Digest HN story `<id>` for the HN Digest site. Read `.claude/skills/digest/post-guide.md` and follow it exactly. Raw data is in `data/raw/posts/<id>/`. Write `src/content/posts/<id>.json`, then run `npm run verify -- <id>` and fix any quote it rejects. Reply with the TL;DR and the verify result.

   Done when every pick has a JSON file and a clean verify.

7. **Write the issue.** `npm run write-issue -- <n>`. It rejects a selection that breaks the caps or names items outside the issue. Done when it reports no undigested picks.

8. **Build.** `npm run build`. A schema error names the file and field: fix the JSON (or send it back to that post's subagent) and rebuild. Done when the build is green.

9. **Ship.** Commit only the issue and its new posts (`src/content/issues/<n>.json`, `src/content/posts/*.json`) as `Digest issue #<n> (<date>)`, then `git push` to `main`; `.github/workflows/deploy.yml` publishes the site to GitHub Pages on every push. Done when the push lands on the remote.

10. **Report** to the user: the tiers with each pick's TL;DR (wildcards marked), the near-misses, anything that came out degraded (comments-only, replaced quotes), the commit, and the profile diff if Calibration changed.

## Other requests

- **Change an issue's picks**: edit `data/raw/issues/<n>/selection.json`, record the lesson in Calibration, digest any new pick (step 6), then steps 7–10, committing as `Change picks for issue #<n>`.
- **Redo a post**: `npm run ingest -- data/raw/issues/<n>/paste.txt <id> --refresh`, then digest it again (step 6), rebuild, and ship (steps 8–9).
