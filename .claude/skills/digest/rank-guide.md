# Ranking an issue for the reader

You pick, from one issue's scan sheet, the stories most beneficial to the reader described in `data/profile.md`: their career direction, their craft and their life as a person. A pick costs the reader real time, so it has to earn it.

## Tiers

Tier names and caps are in `src/lib/tiers.ts`. The caps are ceilings: a weak issue gets fewer picks, and the top tier may be empty.

- **Don't skip** (`dontSkip`): directly advances a goal in the profile, with depth or an argument that will change how the reader thinks or works.
- **Worth your time** (`worthYourTime`): clearly relevant and substantial, but one notch less central or less deep.
- **If you have a minute** (`ifYouHaveAMinute`): relevant enough to skim; a good thread on a near topic, a short piece with one good idea.
- **Near-miss**: interesting for the reader but left out of the tiers by the caps or by the profile's rules. Shown by title only, so pick ones whose title makes the reader curious. The cap is `NEAR_MISS_CAP` in `src/lib/tiers.ts`.

Apply the profile's **Out** list and **Selection rules** strictly; they encode decisions the reader already made. Weigh depth and the quality of the discussion as well as topic. An item already digested for another issue may be picked; it is reused, not redone.

## `data/raw/issues/<n>/selection.json`

```json
{
  "number": 0,
  "picks": [
    { "hnId": 0, "tier": "dontSkip", "reason": "…", "why": "…" },
    { "hnId": 0, "tier": "ifYouHaveAMinute", "reason": "…", "why": "…", "wildcard": true }
  ],
  "nearMisses": [
    { "hnId": 0 },
    { "title": "exact newsletter title, for items without an HN thread" }
  ]
}
```

Picks are best first.

- `reason` is **public**: it appears on the site under the post's TL;DR. Write one sentence on why the piece is worth the time (its angle, depth, evidence, or what the thread adds), in terms that fit any reader. Keep the reader's goals out of it, and add to the TL;DR rather than restate it. Every claim in it must be backed by the scan card.
- `why` is **private**: how it serves this reader's profile, naming the goal. Stays in `data/raw/`.
- `wildcard: true` marks the picks taken under the profile's wildcard rule.

## Calibration

When the user changes a pick after an issue ships, demotes, promotes or swaps one, work out the lesson behind it: a preference the profile did not capture. Add it to the profile's Calibration section, newest first, tagged with the issue number (e.g. "Prefers practical type-level TypeScript over type-theory papers (#807)"). When a lesson contradicts a line elsewhere in the profile, update that line instead. Show the diff in the final report.
