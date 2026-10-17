# Digesting one HN story

You are writing one post for HN Digest: a reader opens it to decide what a story says and what Hacker News made of it, without reading either in full. Write in English, plainly, in your own words — except quotes, which are exact.

## Read the raw data

In `data/raw/posts/<id>/`:

- `meta.json`: title, URL, points, comment count, `kind`, `storyText` (Ask/Tell HN body), `article.readingMinutes`, `error`.
- `article.txt`: the extracted article or PDF text. May be absent (`video`, `discussion`, `unavailable`).
- `comments.txt`: every comment, grouped into top-level threads in HN rank order (thread 1 is what HN shows first). Each comment starts `[c:<commentId>] @<author>`; indentation is reply depth.
- `comments.json`: the same comments as data — `verify` checks your quotes against it.

Read **all** of `article.txt` and **all** of `comments.txt`, in chunks when large (Read with offset/limit, ~400 lines at a time) — a big thread is a dozen reads, and that is the job. Done when you have read the last line of each — themes buried in thread 80 count, and the top threads are not the whole story.

## Write `src/content/posts/<id>.json`

Copy these fields from `meta.json` as they are: `hnId` (= `id`), `title`, `url`, `domain`, `kind`, `author`, `postedAt`, `points`, `commentCount`, and `readingMinutes` (= `article.readingMinutes`, when present). Set `digestedAt` to now (ISO). Leave out fields `meta.json` lacks (an Ask HN has no `url`, `domain` or `readingMinutes`).

Then the summary fields:

- `tldr` — one or two sentences on what the story _says_ (its claim or finding), standing alone: it is shown in listings without the title context. For a `discussion`, the question and the headline answer.
- `article` — present when there is text making a case (`article`, `pdf`, or a `discussion` whose `storyText` argues something, like a Tell HN essay). Leave it out for a `discussion` whose body only asks a question — the tldr carries the question.
  - `keyPoints` — 3 to 6 points, each a full sentence carrying a specific claim, number or argument from the text. Ordered as the author builds the case.
  - `whyItMatters` — who should read the original and what they get from it that the summary lacks.
- `articleNote` — present when the article summary is missing or degraded: "Video (~25 min); not summarized — digest covers the discussion.", "Paywalled; summarized from the HN discussion.", "Landing page; key points describe the product as presented."
- `comments` — present when the thread has substantive discussion:
  - `overview` — two or three sentences on the thread's dynamics: its temperature and what it mostly argued about. Build on the tldr; for a `discussion` the tldr already gives the headline answer.
  - `themes` — 3 to 5 (fewer only for small threads), ordered by how much of the _substantive_ discussion they take: a hundred one-line "use X" replies weigh as one vote tally, folded into a theme's synthesis. Each: a short `title`; a `synthesis` of 2–4 sentences giving the positions and the reasoning behind them, including disagreement within the theme; and 1–2 `quotes` that best represent it.
  - `consensus` — what most commenters agreed on. `dissent` — the main pushback or minority view.
  - `contrarian` — the most insightful comment that cuts against the thread's grain, judged on substance (HN does not expose comment scores). A quote plus `why`: one sentence on what it sees that others missed. Leave it out when nothing earns it.

### Quotes

A quote is `{ "author", "text", "commentId" }`, copied from one comment in `comments.txt`: `commentId` from its `[c:…]` marker, `author` without the `@`. `text` is a verbatim excerpt — exact words and characters, one to three sentences, trimmed to the point. Elide inside it with `…`. Quote a commenter's own words: lines starting with `>` are them quoting someone else, so credit those words to the comment they came from. Pick quotes that carry an argument or a firsthand experience; a quote is evidence for the synthesis beside it.

### Shape

```json
{
  "hnId": 0,
  "title": "…",
  "url": "…",
  "domain": "…",
  "kind": "article",
  "author": "…",
  "postedAt": "…",
  "points": 0,
  "commentCount": 0,
  "readingMinutes": 0,
  "tldr": "…",
  "article": { "keyPoints": ["…", "…", "…"], "whyItMatters": "…" },
  "comments": {
    "overview": "…",
    "themes": [
      { "title": "…", "synthesis": "…", "quotes": [{ "author": "…", "text": "…", "commentId": 0 }] }
    ],
    "consensus": "…",
    "dissent": "…",
    "contrarian": { "author": "…", "text": "…", "commentId": 0, "why": "…" }
  },
  "digestedAt": "…"
}
```

## Plain sentences

The reader may be reading in a second language, so borrow three rules from ASD-STE100 Simplified Technical English for every field you wrote:

- Sentences of 25 words or fewer.
- One claim per sentence in `tldr` and `keyPoints`. Split a sentence that joins two claims with "so", "but" or "while": each claim then stands where you can check it against the source, and two that contradict each other show.
- One name for each person or thing across the whole post. Once a post calls someone "the sender", it never calls them "the prompter".

Prefer a plain verb to an idiom or phrasal verb ("ends" over "winds down") when it costs no meaning; a thread synthesis may keep a vivid verb that carries how the thread felt. Done when every field passes the three rules.

## Unslop the prose

Read `~/.claude/skills/unslop/SKILL.md` and apply it to every field you wrote: `tldr`, `keyPoints`, `whyItMatters`, `articleNote`, `overview`, theme `title` and `synthesis`, `consensus`, `dissent`, `contrarian.why`. A summary reports what others said, so skip its "use I" and "have opinions" advice. Leave `quote.text`, `title` and the other fields copied from `meta.json` exactly as they are, curly quotes and dashes included: verify compares them byte for byte. Done when the self-audit finds no tells.

## Verify

`npm run verify -- <id>` checks the copied metadata against `meta.json` and every quote against its comment (`npm run build` checks the shape). Fix any mismatched field. For every rejected quote, find the exact wording in `comments.txt` and fix the text, author or id — or pick a different quote. Done when verify reports all good.
