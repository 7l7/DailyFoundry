import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { dailySeed, selectDaily, utcDayKey } from "@dailyfoundry/core";
import questions from "../../../games/internet-timeline/questions.json";
import "./styles.css";

type Question = (typeof questions)[number];
type PlayedRound = { question: Question; correct: boolean; chosenIndex: number; correctIndex: number };
type SavedResult = { day: string; rounds: PlayedRound[]; completedAt: string };
type History = Record<string, SavedResult>;
type ShareState = "idle" | "copied" | "saved" | "shared";

const GAME_ID = "internet-timeline";
const GUESSES = 5;
const CARDS_NEEDED = 6;
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
  const shuffled = selectDaily(questions, questions.length, dailySeed(`${GAME_ID}:cycle:${cycle}`, "deck"));
  return shuffled.slice(slot * CARDS_NEEDED, slot * CARDS_NEEDED + CARDS_NEEDED);
}

function readHistory(): History {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}") as History; }
  catch { return {}; }
}

function consecutiveStreak(history: History, today: string) {
  let streak = 0;
  let cursor = Date.parse(`${today}T00:00:00Z`);
  while (history[new Date(cursor).toISOString().slice(0, 10)]) { streak += 1; cursor -= DAY_MS; }
  return streak;
}

function bestStreak(history: History) {
  const days = Object.keys(history).sort();
  let best = 0, current = 0, previous = 0;
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
  } catch { /* analytics never blocks gameplay */ }
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

function shareTone(score: number) {
  if (score === 5) return { headline: "PERFECTLY IN SYNC.", short: "Perfect timeline.", prompt: "Can you match it?" };
  if (score === 4) return { headline: "ONE GLITCH IN THE TIMELINE.", short: "One glitch in the timeline.", prompt: "Can you go perfect?" };
  if (score >= 2) return { headline: "TIME GOT WEIRD.", short: "Time got weird.", prompt: "Think you know what came first?" };
  return { headline: "TIME IS A FLAT CIRCLE.", short: "Apparently I have no sense of internet time.", prompt: "Your turn." };
}

function shareText(day: string, rounds: PlayedRound[], streak: number, url: string) {
  const score = rounds.filter((round) => round.correct).length;
  const marks = rounds.map((round) => round.correct ? "●" : "○").join("  ");
  const tone = shareTone(score);
  const streakLine = streak >= 3 ? `\n🔥 ${streak} day streak` : "";
  return `Internet Timeline #${puzzleNumber(day)}\n${marks}\n${score}/5 — ${tone.short}${streakLine}\n${tone.prompt}\n${url}`;
}

function isTouchShareDevice() {
  return window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth <= 720;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

async function createShareCardBlob(day: string, rounds: PlayedRound[], streak: number, url: string) {
  const width = 1080, height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const score = rounds.filter((round) => round.correct).length;
  const tone = shareTone(score);
  const number = puzzleNumber(day);
  const ink = "#171A23", paper = "#FFFDF6", blue = "#3157FF", muted = "#85878D", line = "#D9D4C8";

  ctx.fillStyle = "#EAE6DC"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = paper; roundRect(ctx, 54, 54, 972, 1242, 48);
  ctx.strokeStyle = "#D3CEC2"; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = ink; ctx.font = "800 48px system-ui, sans-serif"; ctx.fillText("INTERNET", 118, 160);
  ctx.fillStyle = blue; ctx.fillText("TIMELINE", 118, 212);

  ctx.fillStyle = "#EEF0FF"; roundRect(ctx, 770, 116, 192, 72, 36);
  ctx.fillStyle = blue; ctx.font = "750 28px system-ui, sans-serif"; ctx.fillText(`#${number}`, 826, 162);

  ctx.fillStyle = muted; ctx.font = "650 24px system-ui, sans-serif"; ctx.fillText("TODAY'S RESULT", 118, 330);
  ctx.fillStyle = ink; ctx.font = "850 82px system-ui, sans-serif";
  const headlineLines = tone.headline.length > 22 ? tone.headline.split(" IN THE ") : [tone.headline];
  if (headlineLines.length === 2) {
    ctx.fillText(headlineLines[0], 118, 430);
    ctx.fillText("IN THE", 118, 518);
    ctx.fillText(headlineLines[1], 118, 606);
  } else {
    ctx.fillText(headlineLines[0], 118, 455);
  }

  ctx.fillStyle = blue; ctx.font = "850 86px system-ui, sans-serif"; ctx.fillText(`${score}/5`, 118, 730);
  if (streak >= 2) {
    ctx.fillStyle = ink; ctx.font = "650 28px system-ui, sans-serif"; ctx.fillText(`${streak} DAY STREAK`, 330, 715);
  }

  const y = 858, x1 = 138, x2 = 942;
  ctx.strokeStyle = line; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.fillStyle = muted; ctx.font = "650 22px system-ui, sans-serif"; ctx.fillText("PAST", 118, 920); ctx.fillText("NOW", 894, 920);
  rounds.forEach((round, index) => {
    const x = x1 + index * ((x2 - x1) / 4);
    ctx.fillStyle = paper; ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = round.correct ? blue : ink; ctx.lineWidth = round.correct ? 12 : 5; ctx.stroke();
    if (!round.correct) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
  });

  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(118, 1002); ctx.lineTo(962, 1002); ctx.stroke();
  ctx.fillStyle = ink; ctx.font = "800 42px system-ui, sans-serif"; ctx.fillText(tone.prompt, 118, 1084);
  ctx.fillStyle = muted; ctx.font = "500 28px system-ui, sans-serif"; ctx.fillText("Place five moments into internet history.", 118, 1134);
  ctx.fillStyle = blue; ctx.font = "750 28px system-ui, sans-serif";
  const displayUrl = url.replace(/^https?:\/\//, "").replace(/\/?\?ref=share$/, "").replace(/\/$/, "");
  ctx.fillText(displayUrl, 118, 1220);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render share card")), "image/png", 0.95));
}

function sortChronologically(items: Question[]) { return [...items].sort((a, b) => a.answerYear - b.answerYear); }
function correctInsertionIndex(timeline: Question[], card: Question) { return timeline.filter((item) => item.answerYear < card.answerYear).length; }

function InternetTimeline() {
  const day = utcDayKey();
  const deck = useMemo(() => dailyDeck(day), [day]);
  const anchor = deck[0];
  const challengeCards = deck.slice(1);
  const [history, setHistory] = useState<History>(() => readHistory());
  const savedToday = history[day];
  const [roundIndex, setRoundIndex] = useState(savedToday ? challengeCards.length : 0);
  const [timeline, setTimeline] = useState<Question[]>(() => savedToday ? sortChronologically([anchor, ...savedToday.rounds.map((round) => round.question)]) : [anchor]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [played, setPlayed] = useState<PlayedRound[]>(savedToday?.rounds ?? []);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [countdown, setCountdown] = useState(msUntilNextUtcDay());
  const [touchShare, setTouchShare] = useState(false);
  const startedAt = useRef(Date.now());

  const complete = roundIndex >= challengeCards.length;
  const current = complete ? null : challengeCards[roundIndex];
  const correctIndex = current ? correctInsertionIndex(timeline, current) : -1;
  const currentCorrect = selectedSlot === correctIndex;

  useEffect(() => {
    setTouchShare(isTouchShareDevice());
    const params = new URLSearchParams(window.location.search);
    if (params.get("ref") === "share") captureOnce(`df:referral:${day}`, "referral_open", { game: GAME_ID, puzzle: puzzleNumber(day) });
    if (!savedToday) {
      captureOnce(`df:start:${day}`, "game_start", { game: GAME_ID, puzzle: puzzleNumber(day) });
      const gap = daysSinceLastPlay(history, day);
      if (gap !== null) captureOnce(`df:return:${day}`, "daily_return", { game: GAME_ID, days_since_last_play: gap, completed_days: Object.keys(history).length, d1: gap === 1, d7: gap <= 7 });
    }
  }, [day, history, savedToday]);

  useEffect(() => {
    if (!complete || played.length !== challengeCards.length || history[day]) return;
    const score = played.filter((round) => round.correct).length;
    const nextHistory = { ...history, [day]: { day, rounds: played, completedAt: new Date().toISOString() } };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setHistory(nextHistory);
    track("game_complete", { game: GAME_ID, puzzle: puzzleNumber(day), score, perfect: score === GUESSES, duration_seconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)) });
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
    setPlayed((previous) => [...previous, { question: current, correct: currentCorrect, chosenIndex: selectedSlot, correctIndex }]);
    setTimeline((previous) => { const next = [...previous]; next.splice(correctIndex, 0, current); return next; });
    track("round_complete", { game: GAME_ID, puzzle: puzzleNumber(day), round: roundIndex + 1, correct: currentCorrect, timeline_size: timeline.length });
    setRevealed(true);
  }

  function nextRound() { setRoundIndex((value) => value + 1); setSelectedSlot(null); setRevealed(false); }

  async function copyChallenge() {
    const shareUrl = `${window.location.origin}/?ref=share`;
    track("share_click", { game: GAME_ID, puzzle: puzzleNumber(day), method: "copy" });
    const text = shareText(day, played, streak, shareUrl);
    try { await navigator.clipboard.writeText(text); track("share_success", { game: GAME_ID, method: "clipboard" }); setShareState("copied"); }
    catch { window.prompt("Copy your challenge:", text); }
  }

  async function saveShareCard() {
    const shareUrl = `${window.location.origin}/?ref=share`;
    const blob = await createShareCardBlob(day, played, streak, shareUrl);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = objectUrl; link.download = `internet-timeline-${puzzleNumber(day)}.png`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
    track("share_success", { game: GAME_ID, method: "image_download" }); setShareState("saved");
  }

  async function shareChallengeImage() {
    const shareUrl = `${window.location.origin}/?ref=share`;
    const score = played.filter((round) => round.correct).length;
    track("share_click", { game: GAME_ID, puzzle: puzzleNumber(day), score, method: "image" });
    try {
      const blob = await createShareCardBlob(day, played, streak, shareUrl);
      const file = new File([blob], `internet-timeline-${puzzleNumber(day)}.png`, { type: "image/png" });
      if (touchShare && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Internet Timeline #${puzzleNumber(day)}`, text: `${shareTone(score).prompt} ${shareUrl}` });
        track("share_success", { game: GAME_ID, method: "native_image", score }); setShareState("shared"); return;
      }
      await saveShareCard();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyChallenge();
    }
  }

  if (complete) {
    const score = played.filter((round) => round.correct).length;
    const tone = shareTone(score);
    const gamesPlayed = Object.keys(history).length;
    const perfectGames = Object.values(history).filter((result) => result.rounds.every((round) => round.correct)).length;
    const finalTimeline = sortChronologically([anchor, ...played.map((round) => round.question)]);
    return (
      <main>
        <header className="topbar"><strong>Internet Timeline</strong><span>#{puzzleNumber(day)}</span></header>
        <section className="result-card">
          <div className="result-heading"><div><p className="eyebrow">Today’s result</p><h1>{score}<small>/5</small></h1></div><p className="verdict">{tone.short}</p></div>

          <div className="share-poster" aria-label="Share card preview">
            <div className="poster-header"><div className="poster-brand"><strong>INTERNET</strong><strong>TIMELINE</strong></div><span>#{puzzleNumber(day)}</span></div>
            <div className="poster-body"><small>TODAY'S RESULT</small><h2>{tone.headline}</h2><div className="poster-score"><strong>{score}/5</strong>{streak >= 2 && <span>{streak} DAY STREAK</span>}</div></div>
            <div className="poster-track"><div className="poster-line" />{played.map((round, i) => <span key={round.question.id} className={round.correct ? "poster-node hit" : "poster-node miss"} style={{ left: `${i * 25}%` }} />)}<small className="past">PAST</small><small className="now">NOW</small></div>
            <div className="poster-footer"><strong>{tone.prompt}</strong><span>Place five moments into internet history.</span></div>
          </div>

          <div className="share-actions">
            <button className="primary" onClick={touchShare ? shareChallengeImage : copyChallenge}>{touchShare ? (shareState === "shared" ? "Shared" : "Share result") : (shareState === "copied" ? "Result copied" : "Copy result")}</button>
            <button className="secondary" onClick={saveShareCard}>{shareState === "saved" ? "Card saved" : "Save poster"}</button>
          </div>

          <div className="stats-grid"><div><strong>{gamesPlayed}</strong><span>Played</span></div><div><strong>{streak}</strong><span>Current streak</span></div><div><strong>{maxStreak}</strong><span>Best streak</span></div><div><strong>{perfectGames}</strong><span>Perfect days</span></div></div>
          <div className="next-drop"><span>Next timeline in</span><strong>{formatCountdown(countdown)}</strong></div>
        </section>

        <section className="recap-card"><div className="recap-heading"><div><p className="eyebrow">Today’s answer</p><h2>The full timeline</h2></div><span>{finalTimeline[0]?.answerYear}–{finalTimeline[finalTimeline.length - 1]?.answerYear}</span></div><div className="recap-list">{finalTimeline.map((item) => <article key={item.id} className="recap-row"><strong>{item.answerYear}</strong><div><span>{item.category}</span><p>{item.prompt}</p></div></article>)}</div></section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar"><strong>Internet Timeline</strong><span>#{puzzleNumber(day)}</span></header>
      <section className="game-shell">
        <div className="game-meta"><span>Place the moment</span><span>{roundIndex + 1}/{GUESSES}</span></div>
        <div className="challenge-card"><span className="category">{current?.category}</span><h1 className="question">{current?.prompt}</h1><p className="instruction">Tap the gap where this moment belongs.</p></div>
        <div className="timeline-stack">{timeline.map((item, index) => <React.Fragment key={item.id}><button className={`slot ${selectedSlot === index ? "selected" : ""} ${revealed && correctIndex === index ? "correct-slot" : ""}`} onClick={() => !revealed && setSelectedSlot(index)}><span>{revealed && correctIndex === index ? "Correct spot" : selectedSlot === index ? "Place here" : "+"}</span></button><article className="event-card"><div><span className="event-year">{item.answerYear}</span><span className="event-category">{item.category}</span></div><p>{item.prompt}</p></article>{index === timeline.length - 1 && <button className={`slot ${selectedSlot === timeline.length ? "selected" : ""} ${revealed && correctIndex === timeline.length ? "correct-slot" : ""}`} onClick={() => !revealed && setSelectedSlot(timeline.length)}><span>{revealed && correctIndex === timeline.length ? "Correct spot" : selectedSlot === timeline.length ? "Place here" : "+"}</span></button>}</React.Fragment>)}</div>
        {!revealed ? <button className="primary" disabled={selectedSlot === null} onClick={lockChoice}>Lock it in</button> : <div className={`reveal ${currentCorrect ? "good" : "miss"}`}><p>{currentCorrect ? "Nailed it." : `It was ${current?.answerYear}.`}</p>{current?.explanation && <small>{current.explanation}</small>}<button className="primary" onClick={nextRound}>{roundIndex + 1 === GUESSES ? "See result" : "Next moment"}</button></div>}
      </section>
      <footer>Built with DailyFoundry</footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><InternetTimeline /><Analytics /></React.StrictMode>);
