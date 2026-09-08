import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
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

function shareText(day: string, rounds: PlayedRound[], streak: number) {
  const score = rounds.filter((round) => round.correct).length;
  const marks = rounds.map((round) => (round.correct ? "🟩" : "⬛")).join("");
  const streakLine = streak > 1 ? `\n🔥 ${streak}` : "";
  return `Internet Timeline #${puzzleNumber(day)}\n${marks}\n${score}/${GUESSES}${streakLine}\nBuilt with DailyFoundry`;
}

function sortChronologically(items: Question[]) {
  return [...items].sort((a, b) => a.answerYear - b.answerYear);
}

function correctInsertionIndex(timeline: Question[], card: Question) {
  return timeline.filter((item) => item.answerYear < card.answerYear).length;
}

function InternetTimeline() {
  const day = utcDayKey();
  const deck = useMemo(
    () => selectDaily(questions, CARDS_NEEDED, dailySeed(GAME_ID, day)),
    [day],
  );
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
  const [copied, setCopied] = useState(false);

  const complete = roundIndex >= challengeCards.length;
  const current = complete ? null : challengeCards[roundIndex];
  const correctIndex = current ? correctInsertionIndex(timeline, current) : -1;
  const currentCorrect = selectedSlot === correctIndex;

  useEffect(() => {
    if (!complete || played.length !== challengeCards.length || history[day]) return;
    const nextHistory = {
      ...history,
      [day]: { day, rounds: played, completedAt: new Date().toISOString() },
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setHistory(nextHistory);
  }, [challengeCards.length, complete, day, history, played]);

  const streak = consecutiveStreak(history, day);

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
    setRevealed(true);
  }

  function nextRound() {
    setRoundIndex((value) => value + 1);
    setSelectedSlot(null);
    setRevealed(false);
  }

  async function copyResult() {
    await navigator.clipboard.writeText(shareText(day, played, streak));
    setCopied(true);
  }

  if (complete) {
    const score = played.filter((round) => round.correct).length;
    const verdict = score === 5 ? "Perfect timeline." : score >= 4 ? "Internet historian." : score >= 3 ? "Pretty online." : "Time is weird.";
    return (
      <main>
        <header className="topbar">
          <strong>Internet Timeline</strong>
          <span>#{puzzleNumber(day)}</span>
        </header>
        <section className="result-card">
          <p className="eyebrow">Today’s score</p>
          <h1>{score}<small>/{GUESSES}</small></h1>
          <p className="verdict">{verdict}</p>
          <div className="round-dots" aria-label="Round results">
            {played.map((round) => <span key={round.question.id}>{round.correct ? "🟩" : "⬛"}</span>)}
          </div>
          {streak > 0 && <p className="streak">🔥 {streak} day streak</p>}
          <button className="primary" onClick={copyResult}>{copied ? "Copied!" : "Share result"}</button>
          <p className="quiet">A new timeline drops tomorrow.</p>
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
          <p className="instruction">Where does it belong in internet history?</p>
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
  <React.StrictMode><InternetTimeline /></React.StrictMode>,
);
