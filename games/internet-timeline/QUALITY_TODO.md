# Internet Timeline quality roadmap

Core target: players should mostly recognize the events, genuinely hesitate about their order, get at least one memorable reveal, and feel that the result is worth replaying or sharing.

## P0 — experience blockers

- [x] Import `questions-fun.json` into the live pool.
- [x] Preserve historical #1–#9 scheduling while new rules evolve.
- [x] Add familiarity / entity / slot-role-aware scheduling.
- [x] Add explicit curation states: `core`, `specialist`, `retire`.
- [x] Create a 60-day schedule validator.
- [ ] Wire curation states into the live scheduler: normal Daily = core only; Hard Mode may use specialist; retired never active.
- [ ] Calibrate validator thresholds against the actual generated 60-day schedule, then restore it as a build gate.
- [ ] Audit all currently active questions for factual date, prompt ambiguity, source quality, and game value.
- [ ] Repair or retire every weak-source question before it can enter normal Daily.

## P1 — daily deck quality

- [ ] Re-label active pool by game role: `anchor`, `confusion`, `surprise`, `stretch` (multi-role allowed).
- [ ] Require normal Daily to contain a familiar anchor, at least two confusion candidates, and at least one surprise/relatable card.
- [ ] Keep ordinary Daily to at most one hard card and at most one niche card.
- [ ] Evaluate deck relationships, not only individual cards: reward meaningful comparisons and avoid trivial year gaps.
- [ ] Add comparison groups / related-event clusters for naturally interesting sequences.
- [ ] Generate and manually review the next 30 Daily decks after each major scheduler change.

## P1 — reveal quality

- [ ] Rewrite weak encyclopedic explanations into relative-time reveals where possible.
- [ ] Add a result-page “biggest timeline surprise” / strongest comparison.
- [ ] Use that reveal as optional share copy, not score alone.

## P2 — data calibration

- [ ] Confirm GA4 receives `game_start`, all five `round_complete`, `game_complete`, and share events in production.
- [ ] Track per-question correct rate, abandonment after reveal, appeal, entity, and profile.
- [ ] Re-grade difficulty from observed data once sample size is meaningful.
- [ ] Promote/demote questions between core / specialist / retire based on data plus editorial review.

## P2 — pool growth

- [ ] Expand only after curation rules are stable.
- [ ] Grow toward 200–250 strong questions, prioritizing familiar-but-confusable events, memes, product milestones, social/gaming/creator culture, and high-surprise comparisons.
- [ ] Keep truly obscure questions a small minority and mostly out of normal Daily.
