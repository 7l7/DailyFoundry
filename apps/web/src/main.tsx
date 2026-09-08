import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { dailySeed, selectDaily, utcDayKey } from "@dailyfoundry/core";
import { scoreTimeline } from "@dailyfoundry/mechanics";
import questions from "../../../games/internet-timeline/questions.json";
import "./styles.css";

type Question = (typeof questions)[number];

type PlayedRound = {
  question: Question;
  guess: number;
  score: number;
};

const GAME_ID = "internet-timeline";
const MIN_YEAR = 1990;
const MAX_YEAR = 2026;
const ROUNDS = 5;

function shareText(day: string, rounds: PlayedRound[]) {
  const total = rounds.reduce((sum, round) => sum + round.score, 0);
  const marks = rounds
    .map(({ score }) => (score >= 900 ? "🟢" : score >= 700 ? "🟡" : "🔴"))
    .join("");
  return `Internet Timeline · ${day}\n${marks}\n${total.toLocaleString()} / ${ROUNDS * 1000}\nBuilt with DailyFoundry`;
}

function InternetTimeline() {
  const day = utcDayKey();
  const todaysQuestions = useMemo(
    () => selectDaily(questions, Math.min(ROUNDS, questions.length), dailySeed(GAME_ID, day)),
    [day],
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState(2008);
  const [submitted, setSubmitted] = useState(false);
  const [played, setPlayed] = useState<PlayedRound[]>([]);
  const [copied, setCopied] = useState(false);

  const complete = roundIndex >= todaysQuestions.length;
  const current = complete ? null : todaysQuestions[roundIndex];
  const currentScore = current
    ? scoreTimeline(guess, current.answerYear, {
        minYear: MIN_YEAR,
        maxYear: MAX_YEAR,
        maxScore: 1000,
      })
    : 0;

  function submitGuess() {
    if (!current || submitted) return;
    setPlayed((previous) => [...previous, { question: current, guess, score: currentScore }]);
    setSubmitted(true);
  }

  function nextRound() {
    setRoundIndex((value) => value + 1);
    setGuess(2008);
    setSubmitted(false);
  }

  async function copyResult() {
    const text = shareText(day, played);
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  if (complete) {
    const total = played.reduce((sum, round) => sum + round.score, 0);
    return (
      <main>
        <header className="topbar">
          <strong>DailyFoundry</strong>
          <span>Internet Timeline</span>
        </header>
        <section className="result-card">
          <p className="eyebrow">Today’s result</p>
          <h1>{total.toLocaleString()}</h1>
          <p className="score-max">out of {ROUNDS * 1000}</p>
          <div className="round-dots" aria-label="Round scores">
            {played.map((round) => (
              <span key={round.question.id} title={`${round.score} points`}>
                {round.score >= 900 ? "🟢" : round.score >= 700 ? "🟡" : "🔴"}
              </span>
            ))}
          </div>
          <button className="primary" onClick={copyResult}>
            {copied ? "Copied!" : "Share result"}
          </button>
          <p className="quiet">Same five moments for everyone today. Come back tomorrow.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <strong>DailyFoundry</strong>
        <span>{day}</span>
      </header>

      <section className="game-shell">
        <div className="game-meta">
          <span>Internet Timeline</span>
          <span>Round {roundIndex + 1}/{todaysQuestions.length}</span>
        </div>

        <h1 className="question">{current?.prompt}</h1>
        <p className="instruction">When did this happen?</p>

        <div className="year-readout">{guess}</div>
        <input
          className="timeline"
          type="range"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={guess}
          disabled={submitted}
          onChange={(event) => setGuess(Number(event.target.value))}
          aria-label="Guess the year"
        />
        <div className="timeline-labels">
          <span>{MIN_YEAR}</span>
          <span>{MAX_YEAR}</span>
        </div>

        {!submitted ? (
          <button className="primary" onClick={submitGuess}>Lock in {guess}</button>
        ) : (
          <div className="reveal">
            <p>The answer was <strong>{current?.answerYear}</strong>.</p>
            <div className="points">+{currentScore}</div>
            <button className="primary" onClick={nextRound}>
              {roundIndex + 1 === todaysQuestions.length ? "See result" : "Next moment"}
            </button>
          </div>
        )}
      </section>

      <footer>Open source · one engine, many daily games</footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><InternetTimeline /></React.StrictMode>,
);
