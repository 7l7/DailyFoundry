import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { hashSeed, utcDayKey } from "@dailyfoundry/core";
import questions from "../../../games/internet-timeline/questions.json";
import { SHARE_POSTER_TEMPLATE } from "./sharePosterTemplate";
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
const SCHEDULE_VERSION = "schedule-v1";
const RECENT_DAYS_BLOCKED = 7;

function puzzleNumber(day: string) {
  const dayStart = Date.parse(`${day}T00:00:00Z`);
  return Math.max(1, Math.floor((dayStart - LAUNCH_DAY) / DAY_MS) + 1);
}

function eraBucket(year: number) {
  if (year < 1995) return 0;
  if (year < 2005) return 1;
  if (year < 2015) return 2;
  return 3;
}

function candidateScore(question: Question, selected: Question[], dayIndex: number, slot: number) {
  const seed = hashSeed(`${GAME_ID}:${SCHEDULE_VERSION}:${dayIndex}:${slot}:${question.id}`);
  const randomTieBreak = seed / 0xffffffff;
  const eraCount = selected.filter((item) => eraBucket(item.answerYear) === eraBucket(question.answerYear)).length;
  const categoryCount = selected.filter((item) => item.category === question.category).length;
  const minYearDistance = selected.length
    ? Math.min(...selected.map((item) => Math.abs(item.answerYear - question.answerYear)))
    : 50;

  // Lower is better: strongly avoid same-category/era piles, mildly reward year spread,
  // then use a deterministic hash so every player receives the same schedule.
  return categoryCount * 100 + eraCount * 24 - Math.min(minYearDistance, 20) * 0.8 + randomTieBreak;
}

function buildScheduledDay(dayIndex: number, recentDays: Question[][]) {
  const blockedIds = new Set(recentDays.flat().map((question) => question.id));
  const available = questions.filter((question) => !blockedIds.has(question.id));
  const pool = available.length >= CARDS_NEEDED ? available : questions;
  const selected: Question[] = [];

  for (let slot = 0; slot < CARDS_NEEDED; slot += 1) {
    const remaining = pool.filter((question) => !selected.some((item) => item.id === question.id));
    remaining.sort((a, b) => candidateScore(a, selected, dayIndex, slot) - candidateScore(b, selected, dayIndex, slot));
    const next = remaining[0];
    if (!next) throw new Error("Not enough questions to build daily timeline");
    selected.push(next);
  }
  return selected;
}

function dailyDeck(day: string) {
  const targetDayIndex = puzzleNumber(day) - 1;
  const scheduled: Question[][] = [];

  // Generate from the fixed launch epoch so the result is deterministic and independent
  // of a visitor's local history. With the current pool, a card cannot reappear within
  // the previous seven daily decks (48 distinct cards across any eight-day window).
  for (let dayIndex = 0; dayIndex <= targetDayIndex; dayIndex += 1) {
    const recent = scheduled.slice(Math.max(0, scheduled.length - RECENT_DAYS_BLOCKED));
    scheduled.push(buildScheduledDay(dayIndex, recent));
  }
  return scheduled[targetDayIndex];
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
  if (score === 5) return { headline: "PERFECTLY IN SYNC.", short: "Perfect timeline.", prompt: "Can you match it?", sticker: "Internet historian unlocked." };
  if (score === 4) return { headline: "ONE GLITCH IN THE TIMELINE.", short: "One glitch in the timeline.", prompt: "Can you go perfect?", sticker: "One wrong turn. Still dangerous." };
  if (score >= 2) return { headline: "TIME GOT WEIRD.", short: "Time got weird.", prompt: "Think you know what came first?", sticker: "Confidence: unstable." };
  return { headline: "TIME IS A FLAT CIRCLE.", short: "Apparently I have no sense of internet time.", prompt: "Think you can do better?", sticker: "Legendary fails still count." };
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

async function createShareCardBlob(day: string, rounds: PlayedRound[], streak: number, url: string) {
  const width = 1080;
  const height = 1424;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const template = await loadImage(SHARE_POSTER_TEMPLATE);
  ctx.drawImage(template, 0, 0, width, height);

  const score = rounds.filter((round) => round.correct).length;
  const tone = shareTone(score);
  const paper = "#f7f4eb";
  const ink = "#101114";
  const blue = "#3157ff";
  const yellow = "#ffe979";
  const pink = "#ffc0cf";

  ctx.save();
  ctx.translate(730, 74);
  ctx.rotate(-0.09);
  ctx.fillStyle = yellow;
  ctx.fillRect(0, 0, 245, 154);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.font = "900 66px system-ui, sans-serif";
  ctx.fillText(`#${puzzleNumber(day)}`, 122, 72);
  ctx.font = "700 21px system-ui, sans-serif";
  ctx.fillText("A SMALL GUESS.", 122, 111);
  ctx.fillText("A BIGGER PICTURE.", 122, 137);
  ctx.restore();

  ctx.fillStyle = paper;
  ctx.fillRect(120, 600, 790, 285);
  ctx.fillStyle = ink;
  ctx.font = "800 29px system-ui, sans-serif";
  ctx.fillText("TODAY'S RESULT", 145, 650);
  ctx.fillStyle = blue;
  ctx.fillRect(145, 665, 210, 7);
  ctx.font = "900 132px system-ui, sans-serif";
  ctx.fillText(`${score}/5`, 145, 810);

  ctx.fillStyle = ink;
  ctx.font = "900 51px system-ui, sans-serif";
  drawWrappedText(ctx, tone.headline, 505, 718, 390, 56, 3);

  const lineY = 900;
  const startX = 165;
  const endX = 895;
  ctx.strokeStyle = "#aaa69d";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(startX, lineY); ctx.lineTo(endX, lineY); ctx.stroke();
  rounds.forEach((round, index) => {
    const x = startX + index * ((endX - startX) / 4);
    ctx.fillStyle = round.correct ? blue : paper;
    ctx.beginPath(); ctx.arc(x, lineY, 25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = round.correct ? blue : "#202124";
    ctx.lineWidth = 5;
    ctx.stroke();
    if (!round.correct) {
      ctx.fillStyle = "#202124";
      ctx.beginPath(); ctx.arc(x, lineY, 8, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.fillStyle = "#66635f";
  ctx.font = "700 21px system-ui, sans-serif";
  ctx.fillText("PAST", 142, 949);
  ctx.fillText("NOW", 857, 949);

  ctx.save();
  ctx.translate(130, 1005);
  ctx.rotate(-0.035);
  ctx.fillStyle = pink;
  ctx.beginPath(); ctx.roundRect(0, 0, 270, 92, 28); ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = "800 21px system-ui, sans-serif";
  ctx.textAlign = "center";
  drawWrappedText(ctx, tone.sticker, 135, 37, 215, 27, 2);
  ctx.restore();

  ctx.fillStyle = paper;
  ctx.fillRect(392, 1022, 500, 160);
  ctx.fillStyle = ink;
  ctx.font = "900 48px system-ui, sans-serif";
  ctx.fillText("YOUR TURN.", 418, 1080);
  ctx.fillStyle = "#ffd94a";
  ctx.fillRect(418, 1094, 200, 8);
  ctx.fillStyle = ink;
  ctx.font = "600 25px system-ui, sans-serif";
  drawWrappedText(ctx, tone.prompt, 418, 1140, 430, 31, 2);

  if (streak >= 2) {
    ctx.fillStyle = blue;
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.fillText(`🔥 ${streak} DAY STREAK`, 145, 990);
  }

  const displayUrl = url.replace(/^https?:\/\//, "").replace(/\/?\?ref=share$/, "").replace(/\/$/, "");
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.roundRect(370, 1195, 505, 76, 38); ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillText(displayUrl, 407, 1243);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render share card")), "image/png", 0.95));
}

function sortChronologically(items: Question[]) { return [...items].sort((a, b) => a.answerYear - b.answerYear); }
function correctInsertionIndex(timeline: Question[], card: Question) { return timeline.filter((item) => item.answerYear < card.answerYear).length; }

function SharePoster({ day, played, streak, shareUrl }: { day: string; played: PlayedRound[]; streak: number; shareUrl: string }) {
  const score = played.filter((round) => round.correct).length;
  const tone = shareTone(score);
  return (
    <a className="template-poster" href={shareUrl} aria-label="Play today's Internet Timeline challenge">
      <img className="template-poster-bg" src={SHARE_POSTER_TEMPLATE} alt="" />
      <div className="template-puzzle-note"><strong>#{puzzleNumber(day)}</strong><span>A SMALL GUESS.<br />A BIGGER PICTURE.</span></div>
      <div className="template-result-panel">
        <div className="template-result-kicker">TODAY'S RESULT</div>
        <div className="template-result-main"><strong>{score}/5</strong><h2>{tone.headline}</h2></div>
        <div className="template-result-track"><div className="template-track-line" />{played.map((round, index) => <span key={round.question.id} className={round.correct ? "template-node hit" : "template-node miss"} style={{ left: `${index * 25}%` }} />)}<small className="template-past">PAST</small><small className="template-now">NOW</small></div>
        {streak >= 2 && <div className="template-streak">🔥 {streak} DAY STREAK</div>}
      </div>
      <div className="template-sticker">{tone.sticker}</div>
      <div className="template-cta"><strong>Your turn.</strong><span>{tone.prompt}</span></div>
      <div className="template-url">{window.location.host}<span>↗</span></div>
    </a>
  );
}

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
    track("share_click", { game: GAME_ID, puzzle: puzzleNumber(day), method: "save_card" });
    const blob = await createShareCardBlob(day, played, streak, shareUrl);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `internet-timeline-${puzzleNumber(day)}.png`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
    track("share_success", { game: GAME_ID, method: "image_download" });
    setShareState("saved");
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
        track("share_success", { game: GAME_ID, method: "native_image", score });
        setShareState("shared");
        return;
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
    const shareUrl = `${window.location.origin}/?ref=share`;
    return (
      <main>
        <header className="topbar"><strong>Internet Timeline</strong><span>#{puzzleNumber(day)}</span></header>
        <section className="result-card">
          <div className="result-heading"><div><p className="eyebrow">Today’s result</p><h1>{score}<small>/5</small></h1></div><p className="verdict">{tone.short}</p></div>
          <SharePoster day={day} played={played} streak={streak} shareUrl={shareUrl} />
          <p className="poster-hint">Tap the card to open today’s challenge.</p>
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