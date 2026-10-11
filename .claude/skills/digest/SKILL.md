---
name: digest
description: Digest a Hacker Newsletter issue into the site — article and comment summaries per HN story. Use when the user pastes a newsletter issue with HN links to digest, adds links to an issue already digested, or asks to redo a post.
---

The user pastes a Hacker Newsletter issue, then the HN item links they want from it. Each link becomes a post (`src/content/posts/<hnId>.json`); the issue becomes `src/content/issues/<number>.json`. The schema in `src/content.config.ts` is the contract; `npm run build` enforces it.

## Steps

1. **Save the paste.** Write the issue text verbatim to `data/raw/paste.txt`. Done when the file holds the whole paste, links and all.

2. **Ingest.** `npm run ingest -- data/raw/paste.txt <link-or-id>...`. Add `--refresh` only for posts being redone. If the number or date is missing from the paste, pass `--number`/`--date` (ask the user if you cannot tell). Done when every link has a line in the report.

3. **Resolve the flags** in the report, each one:
   - `EXISTS`: skip that post, unless the user said "redo <id>" — then rerun ingest for it with `--refresh` and summarize it again.
   - `UNSURE MATCH` / `NOT IN ISSUE`: the story landed in `Extra`. If the guessed newsletter item is right (compare titles and domains in the paste), set that post's `section` and `order` in `data/raw/issues/<n>/plan.json` (order = the item's position; copy a neighbour's). Ask the user only when the paste really does not tell.
   - `ARTICLE: …` (`unavailable` kind): try WebFetch on the URL and, if it yields the real article, write the text to `data/raw/posts/<id>/article.txt`. Otherwise ask the user to paste the article, or accept a comments-only digest with an `articleNote`.

   Done when every post is either cleanly matched or its section is a decision you or the user made.

4. **Summarize, one subagent per post**, all dispatched in a single message so they run in parallel. Each gets this prompt, with the id filled in:

   > Digest HN story `<id>` for the HN Digest site. Read `.claude/skills/digest/post-guide.md` and follow it exactly. Raw data is in `data/raw/posts/<id>/`. Write `src/content/posts/<id>.json`, then run `npm run verify -- <id>` and fix any quote it rejects. Reply with the TL;DR and the verify result.

   Done when every post has a JSON file and a clean verify.

5. **Write the issue.** `npm run write-issue -- <number>`. It merges with an existing issue entry and leaves out posts without a JSON file. Done when it reports no undigested posts (or only ones the user chose to drop).

6. **Build.** `npm run build`. A schema error names the file and field: fix the JSON (or send it back to that post's subagent) and rebuild. Done when the build is green.

7. **Report** to the user: the issue, each post's TL;DR, and anything that came out degraded (comments-only, unsure section, quotes that had to be replaced).
