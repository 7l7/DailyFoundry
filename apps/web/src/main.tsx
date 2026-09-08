import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { dailySeed, selectDaily, utcDayKey } from "@dailyfoundry/core";
import questions from "../../../games/internet-timeline/questions.json";
import "./styles.css";

type Question = (typeof questions)[number];

type PlayedRound = {
  question: Question;
  correct: boolean;
  chosenIndex: number;
  correctIndex: number;
};

type SavedResult = {
  day: string;
  rounds: PlayedRound[];
  completedAt: string;
};

type History = Record<string, SavedResult>;

const GAME_ID = "internet-timeline";
const GUESSES = 5;
const CARDS_NEEDED = GUESSES + 1;
const HISTORY_KEY = `dailyfoundry:${GAME_ID}:history:v2`;
const DAY_MS = 86_400_000;
const LAUNCH_DAY = Date.UTC(2026, 8, 8);

function puzzleNumber(day: string) {
  const dayStart = Date.parse(`${day}T00:00:00Z`);
  return Math.max(1, Math.floor((dayStart - LAUNCH_DAY) / DAY_MS) + 1);
}

function dailyDeck(day: string) {
  const dayIndex = puzzleNumber(day) - 1;
  const daysPerCycle = Math.max(1, Math.floor(questions.length / CARDS_NEEDED));
  const cycle = Math.floor(dayIndex / daysPerCycle);
  const slot = dayIndex % daysPerCycle;
  const shuffled = selectDaily(
    questions,
    questions.length,
    dailySeed(`${GAME_ID}:cycle:${cycle}`, "deck"),
  );
  return shuffled.slice(slot * CARDS_NEEDED, slot * CARDS_NEEDED + CARDS_NEEDED);
}

function readHistory(): History {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}") as History;
  } catch {
    return {};
  }
}

function consecutiveStreak(history: History, today: string) {
  let streak = 0;
  let cursor = Date.parse(`${today}T00:00:00Z`);
  while (true) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    if (!history[day]) break;
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function bestStreak(history: History) {
  const days = Object.keys(history).sort();
  let best = 0;
  let current = 0;
  let previous = 0;

  for (const day of days) {
    const cursor = Date.parse(`${day}T00:00:00Z`);
    current = previous && cursor - previous === DAY_MS ? current + 1 : 1;
    best = Math.max(best, current);
    previous = cursor;
  }

  return best;
}

function daysSinceLastPlay(history: History, today: string) {
  const previousDays = Object.keys(history).filter((day) => day < today).sort();
  const latest = previousDays.at(-1);
  if (!latest) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / DAY_MS);
}

function captureOnce(key: string, event: string, properties?: Record<string, string | number | boolean>) {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage restrictions; analytics should never block gameplay.
  }
  track(event, properties);
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function msUntilNextUtcDay() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}

function shareText(day: string, rounds: PlayedRound[], streak: number, url: string) {
  const score = rounds.filter((round) => round.correct).length;
  const marks = rounds.map((round) => (round.correct ? "🟩" : "⬛")).join(" ");
  const streakLine = streak >= 3 ? `\n🔥 ${streak} day streak` : "";
  const challenge = score === GUESSES ? "Perfect. Can you match it?" : `I got ${score}/${GUESSES}. Can you beat me?`;
  return `⏳ Internet Timeline #${puzzleNumber(day)}\n${marks}\n${challenge}${streakLine}\n${url}`;
}

function sortChronologically(items: Question[]) {
  return [...items].sort((a, b) => a.answerYear - b.answerYear);
}

function correctInsertionIndex(timeline: Question[], card: Question) {
  return timeline.filter((item) => item.answerYear < card.answerYear).length;
}

function InternetTimeline() {
  const day = utcDayKey();
  const deck = useMemo(() => dailyDeck(day), [day]);
  const anchor = deck[0];
  const challengeCards = deck.slice(1);

  const [history, setHistory] = useState<History>(() => readHistory());
  const savedToday = history[day];
  const [roundIndex, setRoundIndex] = useState(savedToday ? challengeCards.length : 0);
  const [timeline, setTimeline] = useState<Question[]>(() =>
    savedToday ? sortChronologically([anchor, ...savedToday.rounds.map((round) => round.question)]) : [anchor],
  );
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [played, setPlayed] = useState<PlayedRound[]>(savedToday?.rounds ?? []);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const [countdown, setCountdown] = useState(msUntilNextUtcDay());
  const startedAt = useRef(Date.now());

  const complete = roundIndex >= challengeCards.length;
  const current = complete ? null : challengeCards[roundIndex];
  const correctIndex = current ? correctInsertionIndex(timeline, current) : -1;
  const currentCorrect = selectedSlot === correctIndex;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ref") === "share") {
      captureOnce(`df:referral:${day}`, "referral_open", {
        game: GAME_ID,
        puzzle: puzzleNumber(day),
      });
    }

    if (!savedToday) {
      captureOnce(`df:start:${day}`, "game_start", {
        game: GAME_ID,
        puzzle: puzzleNumber(day),
      });

      const gap = daysSinceLastPlay(history, day);
      if (gap !== null) {
        captureOnce(`df:return:${day}`, "daily_return", {
          game: GAME_ID,
          days_since_last_play: gap,
          completed_days: Object.keys(history).length,
          d1: gap === 1,
          d7: gap <= 7,
        });
      }
    }
  }, [day, history, savedToday]);

  useEffect(() => {
    if (!complete || played.length !== challengeCards.length || history[day]) return;
    const score = played.filter((round) => round.correct).length;
    const nextHistory = {
      ...history,
      [day]: { day, rounds: played, completedAt: new Date().toISOString() },
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setHistory(nextHistory);
    track("game_complete", {
      game: GAME_ID,
      puzzle: puzzleNumber(day),
      score,
      perfect: score === GUESSES,
      duration_seconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
    });
  }, [challengeCards.length, complete, day, history, played]);

  useEffect(() => {
    if (!complete) return;
    const timer = window.setInterval(() => setCountdown(msUntilNextUtcDay()), 1000);
    return () => window.clearInterval(timer);
  }, [complete]);

  const streak = consecutiveStreak(history, day);
  const maxStreak = bestStreak(history);

  function lockChoice() {
    if (!current || selectedSlot === null || revealed) return;
    const result: PlayedRound = {
      question: current,
      correct: currentCorrect,
      chosenIndex: selectedSlot,
      correctIndex,
    };
    setPlayed((previous) => [...previous, result]);
    setTimeline((previous) => {
      const next = [...previous];
      next.splice(correctIndex, 0, current);
      return next;
    });
    track("round_complete", {
      game: GAME_ID,
      puzzle: puzzleNumber(day),
      round: roundIndex + 1,
      correct: currentCorrect,
      timeline_size: timeline.length,
    });
    setRevealed(true);
  }

  function nextRound() {
    setRoundIndex((value) => value + 1);
    setSelectedSlot(null);
    setRevealed(false);
  }

  async function shareResult() {
    const shareUrl = `${window.location.origin}/?ref=share`;
    const text = shareText(day, played, streak, shareUrl);
    const score = played.filter((round) => round.correct).length;

    track("share_click", {
      game: GAME_ID,
      puzzle: puzzleNumber(day),
      score,
      streak,
    });

    if (navigator.share) {
      try {
        await navigator.share({ title: `Internet Timeline #${puzzleNumber(day)}`, text, url: shareUrl });
        track("share_success", { game: GAME_ID, method: "native", score });
        setShareState("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      track("share_success", { game: GAME_ID, method: "clipboard", score });
      setShareState("copied");
    } catch {
      track("share_success", { game: GAME_ID, method: "prompt", score });
      window.prompt("Copy your challenge:", text);
    }
  }

  if (complete) {
    const score = played.filter((round) => round.correct).length;
    const verdict = score === 5 ? "Perfect timeline." : score >= 4 ? "Internet historian." : score >= 3 ? "Pretty online." : "Time is weird.";
    const gamesPlayed = Object.keys(history).length;
    const perfectGames = Object.values(history).filter((result) => result.rounds.every((round) => round.correct)).length;
    const finalTimeline = sortChronologically([anchor, ...played.map((round) => round.question)]);

    return (
      <main>
        <header className="topbar">
          <strong>Internet Timeline</strong>
          <span>#{puzzleNumber(day)}</span>
        </header>

        <section className="result-card">
          <p className="eyebrow">Today’s timeline</p>
          <div className="score-lockup">
            <h1>{score}<small>/{GUESSES}</small></h1>
            <p className="verdict">{verdict}</p>
          </div>

          <div className="share-preview" aria-label="Share preview">
            <div className="share-preview-top">
              <span>⏳ Internet Timeline #{puzzleNumber(day)}</span>
              <strong>{score}/{GUESSES}</strong>
            </div>
            <div className="round-dots">
              {played.map((round) => <span key={round.question.id}>{round.correct ? "🟩" : "⬛"}</span>)}
            </div>
            <p>{score === GUESSES ? "Perfect. Can you match it?" : `Can you beat ${score}/${GUESSES}?`}</p>
          </div>

          <button className="primary share-button" onClick={shareResult}>
            {shareState === "copied" ? "Challenge copied" : shareState === "shared" ? "Shared" : "Challenge a friend"}
          </button>

          <div className="stats-grid">
            <div><strong>{gamesPlayed}</strong><span>Played</span></div>
            <div><strong>{streak}</strong><span>Current streak</span></div>
            <div><strong>{maxStreak}</strong><span>Best streak</span></div>
            <div><strong>{perfectGames}</strong><span>Perfect days</span></div>
          </div>

          <div className="next-drop">
            <span>Next timeline in</span>
            <strong>{formatCountdown(countdown)}</strong>
          </div>
        </section>

        <section className="recap-card">
          <div className="recap-heading">
            <div>
              <p className="eyebrow">Today’s answer</p>
              <h2>The full timeline</h2>
            </div>
            <span>{finalTimeline[0]?.answerYear}–{finalTimeline[finalTimeline.length - 1]?.answerYear}</span>
          </div>
          <div className="recap-list">
            {finalTimeline.map((item) => (
              <article key={item.id} className="recap-row">
                <strong>{item.answerYear}</strong>
                <div><span>{item.category}</span><p>{item.prompt}</p></div>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <strong>Internet Timeline</strong>
        <span>#{puzzleNumber(day)}</span>
      </header>

      <section className="game-shell">
        <div className="game-meta">
          <span>Place the moment</span>
          <span>{roundIndex + 1}/{GUESSES}</span>
        </div>

        <div className="challenge-card">
          <span className="category">{current?.category}</span>
          <h1 className="question">{current?.prompt}</h1>
          <p className="instruction">Tap the gap where this moment belongs.</p>
        </div>

        <div className="timeline-stack">
          {timeline.map((item, index) => (
            <React.Fragment key={item.id}>
              <button
                className={`slot ${selectedSlot === index ? "selected" : ""} ${revealed && correctIndex === index ? "correct-slot" : ""}`}
                onClick={() => !revealed && setSelectedSlot(index)}
                aria-label={`Place before ${item.prompt}`}
              >
                <span>{revealed && correctIndex === index ? "Correct spot" : selectedSlot === index ? "Place here" : "+"}</span>
              </button>
              <article className="event-card">
                <div>
                  <span className="event-year">{item.answerYear}</span>
                  <span className="event-category">{item.category}</span>
                </div>
                <p>{item.prompt}</p>
              </article>
              {index === timeline.length - 1 && (
                <button
                  className={`slot ${selectedSlot === timeline.length ? "selected" : ""} ${revealed && correctIndex === timeline.length ? "correct-slot" : ""}`}
                  onClick={() => !revealed && setSelectedSlot(timeline.length)}
                  aria-label="Place after the last event"
                >
                  <span>{revealed && correctIndex === timeline.length ? "Correct spot" : selectedSlot === timeline.length ? "Place here" : "+"}</span>
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {!revealed ? (
          <button className="primary" disabled={selectedSlot === null} onClick={lockChoice}>Lock it in</button>
        ) : (
          <div className={`reveal ${currentCorrect ? "good" : "miss"}`}>
            <p>{currentCorrect ? "Nailed it." : `It was ${current?.answerYear}.`}</p>
            <button className="primary" onClick={nextRound}>{roundIndex + 1 === GUESSES ? "See result" : "Next moment"}</button>
          </div>
        )}
      </section>

      <footer>Built with DailyFoundry</footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <InternetTimeline />
    <Analytics />
  </React.StrictMode>,
);
