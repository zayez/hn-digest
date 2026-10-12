# Scanning HN stories

You write a scan card for each story you were given. Another reader ranks about 50 cards per issue to decide which stories get a full digest, so a card has one job: say plainly what the story is and how substantial it is. Describe; leave judging whether it is worth reading to the ranker.

## Read

For each id, in `data/raw/posts/<id>/`:

- `meta.json`: title, URL, kind, points, comment count, `storyText` (Ask/Tell HN body), `error`.
- `article.txt`: the article text, when there is one. Read **all** of it, in chunks when large (Read with offset/limit, ~400 lines at a time).
- `comments.txt`: the thread, top-level threads in HN rank order. Read the first 150 lines: enough to tell what the discussion is about and how substantive it is.

## Write `data/raw/issues/<n>/scan/<id>.md`

Exactly these lines, in English:

```markdown
**What:** One or two sentences on what the story says or shows: its claim, finding or content, specific enough to tell it apart from similar stories.
**Form:** essay | tutorial | deep dive | research | news | announcement | product | show-and-tell | question | video | other
**Depth:** shallow | moderate | deep — a phrase on why (e.g. "worked examples and benchmarks", "short opinion, no evidence").
**Topics:** 3 to 6 comma-separated topics, most specific first (e.g. "React Server Components, streaming, front-end performance").
**Discussion:** One sentence on what the thread argues about and whether it adds substance (first-hand experience, expert corrections) or mostly noise.
```

When there is no article text (video, paywall, fetch error), write `**What:**` from the title, `storyText` and comments, and start it with "Article unavailable;".

Done when every id you were given has a card with all five lines.
