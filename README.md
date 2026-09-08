# DailyFoundry

**An open-source engine for creating, playing, and sharing daily games.**

DailyFoundry is a modular framework for building daily web games without rebuilding the same foundations every time. It provides reusable daily-game primitives such as deterministic daily selection, rounds, scoring, results, sharing, and local progress, while each game supplies its own content and mechanic configuration.

> Goal: make creating a new daily game feel closer to authoring a game pack than building a web app from scratch.

## M0

M0 proves three things:

1. Players can return for a shared daily experience.
2. One reusable engine can power very different games.
3. A developer can create a new game mostly by editing data + configuration.

## Development

```bash
pnpm install
pnpm dev
```

## M0 success criteria

- Clone → install → dev works with minimal setup.
- Duplicate a game pack, change manifest/content, and get a new playable game in under **30 minutes**.
- Timeline and Map share the same core runtime.
- At least one experimental game is good enough that we personally want to return the next day.
- Static-first deployment; no database required for the basic engine.

## Contributing

Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md). New game packs and reusable mechanics are especially welcome.

## License

Code: Apache-2.0.

Game content/assets must declare their own provenance and license.
