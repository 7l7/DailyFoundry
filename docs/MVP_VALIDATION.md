# MVP Validation

DailyFoundry is frozen at MVP until **Internet Timeline** produces enough real-player data to decide whether this project deserves more investment.

## What Vercel already measures

Use Vercel Web Analytics for traffic-level questions only:

- visitors
- page views
- referrers
- countries
- devices / browsers
- performance / Web Vitals

Do not duplicate those metrics in product analytics.

## Product events

The web app sends only the events needed for the go / no-go decision:

| Event | Purpose |
| --- | --- |
| `game_start` | player began today's puzzle |
| `round_complete` | round funnel and difficulty |
| `game_complete` | completion, score and duration |
| `share_click` | intent to share |
| `share_success` | completed native/copy share action |
| `referral_open` | visit opened from a shared challenge URL |
| `daily_return` | returning player; includes `days_since_last_play`, `d1` and `d7` properties |

The app intentionally does **not** add session replay, autocapture, hover tracking, scroll tracking, per-slot click tracking, or duplicate page-view tracking.

## First decision window

Do not judge the project on friends or a handful of sessions. Wait until there are at least **300 reasonably independent players** or enough traffic to form a stable seven-day cohort.

Primary decision metrics:

1. **Completion rate** = `game_complete / game_start`
2. **D1 return** = `daily_return[d1=true] / eligible prior-day starters`
3. **D7 return signal** = returning players within seven days, using `daily_return` and daily cohorts
4. **Share intent** = `share_click / game_complete`
5. **Share success** = `share_success / game_complete`
6. **Referral yield** = `referral_open / share_success`
7. **Round funnel** = completion counts for rounds 1 → 5
8. **Difficulty** = score distribution from `game_complete.score`

## Go / no-go thresholds

### Strong continue

Continue investing when most of these are true after the initial cohort:

- completion rate **>= 60%**
- D1 return **>= 20%**
- D7 return **>= 8–10%**
- share click rate **>= 8%**
- successful shares produce measurable referral traffic
- a visible group of players completes 3+ different daily puzzles

### Yellow light

Keep the project alive only for one focused gameplay iteration when:

- completion is strong but D1 is **10–20%**: the game is playable but not yet habit-forming
- D1 is strong but share rate is **< 5%**: retention may work, but the viral loop does not
- drop-off concentrates in one round: fix pacing/difficulty before judging the concept

### Stop / move to the next project

Do not build Creator, Workshop, accounts, leaderboards or monetization if the player game itself cannot pass validation.

Stop DailyFoundry as a platform bet if, after testing up to **2–3 meaningfully different game/mechanic variants**, the project repeatedly shows:

- D1 **< 10%**
- weak completion
- weak sharing
- no meaningful organic/direct return traffic

At that point the engine may still be useful internally, but it does not justify continued platform investment.

## MVP freeze

Until this validation finishes, do **not** add:

- accounts
- global leaderboard
- Creator Studio
- Workshop / marketplace
- payments
- comments / likes / follows
- archive / unlimited mode unless player demand explicitly asks for it
- additional infrastructure that does not improve the seven metrics above

The next product decision should come from player data, not more platform construction.
