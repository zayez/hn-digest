---
name: digest
description: Digest a Hacker Newsletter issue into the site — pick and tier the stories worth the reader's time, then summarize each article and its HN thread. Use when the user names or pastes a newsletter issue, asks to change an issue's picks, or asks to redo a post.
---

The user names a Hacker Newsletter issue by number, or pastes it whole. You scan every story in it, rank them against the reader's profile (`data/profile.md`, private and gitignored) into three tiers plus a near-miss list, get the user's approval, and digest the picks. Each pick becomes a post (`src/content/posts/<hnId>.json`); the issue becomes `src/content/issues/<number>.json`. The schema in `src/content.config.ts` is the contract; `npm run build` enforces it. Tier names and caps live in `src/lib/tiers.ts`.

Read `data/profile.md` first. If it is missing, stop and tell the user: every pick depends on it.

## Steps

1. **Get the issue.** Given a number, run `npm run fetch-issue -- <n>` (it downloads the Buttondown archive page). Given a paste, write it verbatim to `data/raw/paste.txt`. Done when `data/raw/paste.txt` holds the whole issue, links and all.

2. **Ingest everything.** `npm run ingest -- data/raw/paste.txt --all`. If the number or date is missing from the paste, pass `--number`/`--date` (ask the user if you cannot tell). Sponsor and Classifieds blocks are skipped by the parser. Done when the report lists every item; items under "No HN thread" are near-miss material only.

3. **Scan, with Haiku.** Split the ingested ids into batches of 5 and dispatch one subagent per batch with `model: "haiku"`, all in a single message. Each gets this prompt, with the issue number and ids filled in:

   > Write scan cards for Hacker Newsletter issue `<n>`, stories `<id>, <id>, …`. Read `.claude/skills/digest/scan-guide.md` and follow it exactly. Reply with the ids you wrote.

   Done when `npm run scan-sheet -- <n>` ends without a "Missing scan cards" line.

4. **Rank.** Read `.claude/skills/digest/rank-guide.md`, then the whole scan sheet (`npm run scan-sheet -- <n>`), and write `data/raw/issues/<n>/selection.json`. Done when every item on the sheet has been weighed against the profile and the selection obeys the caps and the profile's selection rules.

5. **Propose.** Show the user the picks as the rank guide describes and wait for approval. Skip the wait only when the user said "just go" for this issue. Apply their edits to `selection.json`, and record each lesson in the profile's Calibration section. Done when the user approves.

6. **Fix missing articles** for picks whose ingest line says `ARTICLE: …`: try WebFetch on the URL and, if it yields the real article, write the text to `data/raw/posts/<id>/article.txt`. Otherwise accept a comments-only digest with an `articleNote`. Done when every pick has article text or a decided note.

7. **Digest, one subagent per pick** that the scan sheet does not mark ALREADY DIGESTED, all dispatched in a single message on the session model. Each gets this prompt, with the id filled in:

   > Digest HN story `<id>` for the HN Digest site. Read `.claude/skills/digest/post-guide.md` and follow it exactly. Raw data is in `data/raw/posts/<id>/`. Write `src/content/posts/<id>.json`, then run `npm run verify -- <id>` and fix any quote it rejects. Reply with the TL;DR and the verify result.

   Done when every pick has a JSON file and a clean verify.

8. **Write the issue.** `npm run write-issue -- <n>`. It rejects a selection that breaks the caps or names items outside the issue. Done when it reports no undigested picks.

9. **Build.** `npm run build`. A schema error names the file and field: fix the JSON (or send it back to that post's subagent) and rebuild. Done when the build is green.

10. **Report** to the user: the tiers with each pick's TL;DR, the near-misses, anything that came out degraded (comments-only, replaced quotes), and the profile diff if Calibration changed.

## Other requests

- **Change an issue's picks**: edit `data/raw/issues/<n>/selection.json`, record the lesson in Calibration, digest any new pick (step 7), then steps 8–10.
- **Redo a post**: `npm run ingest -- data/raw/issues/<n>/paste.txt <id> --refresh`, then digest it again (step 7) and rebuild.
