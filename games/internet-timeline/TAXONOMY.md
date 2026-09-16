# Internet Timeline question taxonomy

The question bank is curated for playability, not for encyclopedic completeness.

## Core tags

- `category`: subject area such as Culture, Social, Gaming, Web, AI, Commerce, Security.
- `difficulty`: initial editorial estimate: `easy`, `medium`, `hard`.
- `appeal`: how likely a general internet user is to recognize the event.
  - `mainstream`: widely recognizable.
  - `known`: familiar to many internet/tech users.
  - `niche`: specialist or archaeology-style knowledge.
- `entity`: canonical brand/platform/person/event family used to avoid repetitive daily decks.

Older questions without explicit `appeal` or `entity` receive deterministic defaults in the scheduler so the full legacy bank remains usable.

## Daily deck recipe

Each puzzle contains 6 cards: 1 visible anchor plus 5 rounds. The scheduler gives the slots different jobs:

1. `anchor` — familiar, easy-to-place reference point.
2. `warmup` — accessible first decision; no obscure hard trivia.
3. `memory` — recognizable event with a genuinely uncertain year.
4. `surprise` — prefers culture, gaming, social or other memorable events that can create an “oh, really?” reveal.
5. `tension` — medium difficulty and closer judgement.
6. `stretch` — the hardest slot; ordinary modes still avoid pure obscurity.

Global quality rules:

- Exact question IDs are blocked for the recent 14-day window when the pool allows it.
- Repeated entities are softly penalized for 7 days and heavily penalized within the same deck.
- Same-year cards are strongly avoided.
- Normal modes aim for at most one niche card.
- Normal modes aim for roughly 2 easy, 3 medium, 1 hard across all 6 cards.
- Hard Mode may use two hard cards, but should still prefer recognizable events over obscure facts.
- At least one memorable/culture-oriented card is preferred through the `surprise` slot.
- Challenge profiles may change the topic or year range, but should not override the core playability rules.

## Editorial standard

A good question is usually something the player has heard of but may not know the exact year. Difficulty should come from timeline judgement, not from obscurity.

Prefer: major products, viral moments, memes, internet culture, games, creator moments, familiar companies, famous launches, surprising firsts and memorable failures.

Use niche infrastructure/history sparingly and mainly as stretch material.

## Data feedback

Runtime analytics records difficulty, appeal, entity, challenge profile and deck composition. Editorial difficulty can later be recalibrated from real per-question correctness and abandonment data.