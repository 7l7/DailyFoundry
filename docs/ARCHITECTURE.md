# Architecture

## Product invariant

DailyFoundry separates four concepts:

1. **Core** — deterministic daily/session/scoring primitives.
2. **Mechanic** — how a player interacts with a question.
3. **Game Pack** — niche, content, configuration, presentation metadata.
4. **App** — discovers packs and renders the selected game.

## Dependency direction

```text
games ───────┐
             v
          app/web
             |
             v
mechanics -> core

core must never depend on mechanics, games, or app code.
mechanics must never depend on a specific game pack.
```

## Determinism

Given `gameId + UTC date + game version`, daily selection must be deterministic.

## Static first

M0 does not require a database. Local state lives in the browser; the shared puzzle comes from deterministic selection.

## M0 mechanics

- Timeline: guess/place an event in time.
- Map: choose a geographic location.

## Design rule

Mechanic ≠ Game.

A mechanic should express a reusable interaction model. Game-specific concepts, datasets and presentation belong in game packs instead of core.
