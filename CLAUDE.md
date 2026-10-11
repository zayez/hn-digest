# HN Digest

Static Astro site of digested Hacker Newsletter issues: issues → posts, each post an article summary plus a comment-thread summary. Content is produced in Claude sessions with the `digest` skill (`.claude/skills/digest/`); there is no server and no runtime API calls.

## Content

- `src/content.config.ts` is the contract for `src/content/{issues,posts}/*.json`; `npm run build` (astro check + build) fails on any drift.
- Quotes in posts must be verbatim from the cited comment: `npm run verify` checks them against `data/raw/` (gitignored, refetchable with `npm run ingest`).
- Summaries are always in English.

## CSS: CSS Modules organized by SMACSS + OOCSS

No Tailwind, no Astro `<style>` blocks. Every style lives in a layer:

| Layer (SMACSS)  | Where                                                                      | Holds                                                                                                     |
| --------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Base            | `src/styles/base.css` (global)                                             | resets, element defaults; no classes                                                                      |
| Theme           | `src/styles/theme.css` (global)                                            | design tokens as custom properties, dark mode via `prefers-color-scheme`                                  |
| Objects (OOCSS) | `src/styles/objects/*.module.css`                                          | structure only (`stack`, `cluster`, `center`, `box`, `grid`); variants as modifier classes (`stack.gapL`) |
| Layout          | `src/styles/layout/*.module.css`                                           | the page frame                                                                                            |
| Modules         | `src/components/<Name>/<Name>.module.css`, `src/styles/pages/*.module.css` | skin: color, borders, type — all from theme tokens                                                        |
| State           | inside the module                                                          | `aria-*`/`data-*` selectors when the state has real semantics (`aria-current`), `is*` classes otherwise   |

Compose by putting several classes on the element — `class:list={[stack.stack, stack.gapXs, styles.card]}` — rather than `composes:`. Objects carry structure, modules carry skin; a module that needs layout reaches for an object first. Class names are camelCase so they read as `styles.fooBar`.

## Commands

`npm test` covers the pure logic in `scripts/lib` and `src/lib` (issue parser, story matching, comment flattening, quote checking, slugs).
