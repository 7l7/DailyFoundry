# Contributing to DailyFoundry

DailyFoundry is early. The fastest useful contribution is usually one of:

- a new game pack using an existing mechanic
- better sample content
- a mechanic improvement required by a real game
- tests around core deterministic behavior
- documentation that reduces creator setup time

## Principle

**Mechanic ≠ Game.**

Do not add niche-specific concepts to core. Core knows `Game`, `Round`, `Answer`, `Score`, and `Result`; it should not know NBA, movies, memes, or geography.

## Adding a game

1. Copy an existing folder under `games/`.
2. Change `game.json`.
3. Replace content data.
4. Run validation/typecheck.
5. Open a PR explaining the audience, mechanic, and content provenance.

## Content and copyright

Do not submit copyrighted images, audio, film screenshots, proprietary datasets, or copied question banks unless you have the right to redistribute them.

Every game pack should declare:

- author
- content license
- sources/provenance
- third-party asset licenses where applicable

## M0 rule

Prefer the smallest change that proves a product hypothesis. Avoid platform infrastructure until real usage requires it.
