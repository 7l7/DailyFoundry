import { track } from "@vercel/analytics";

type ShareData = { puzzle: string; score: number; headline: string; results: boolean[]; streak: number };

const BG = "/share-poster-template.webp";
const W = 900;
const H = 1187;
const INK = "#111214";
const PAPER = "#f8f6ef";
const BLUE = "#2057f5";
const GREEN = "#2fc777";
const RED = "#ff7777";
const YELLOW = "#ffd447";

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function headlineLines(score: number) {
  if (score === 5) return ["PERFECTLY", "IN SYNC."];
  if (score === 4) return ["ONE GLITCH IN", "THE TIMELINE."];
  if (score >= 2) return ["TIME GOT", "WEIRD."];
  return ["TIME IS A", "FLAT CIRCLE."];
}

function buildSvg(d: ShareData, bg = BG) {
  const lines = headlineLines(d.score);
  const timelineY = 752;
  const xs = [142, 296, 450, 604, 758];
  const nodes = d.results.slice(0, 5).map((ok, i) => {
    const x = xs[i];
    return ok
      ? `<circle cx="${x}" cy="${timelineY}" r="22" fill="${PAPER}" stroke="${INK}" stroke-width="4"/><circle cx="${x}" cy="${timelineY}" r="13" fill="${GREEN}"/>`
      : `<circle cx="${x}" cy="${timelineY}" r="22" fill="${RED}" stroke="${INK}" stroke-width="4"/><path d="M${x-8} ${timelineY-8}L${x+8} ${timelineY+8}M${x+8} ${timelineY-8}L${x-8} ${timelineY+8}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }).join("");
  const streak = d.streak >= 2 ? `<text x="450" y="698" text-anchor="middle" fill="${BLUE}" font-size="16" font-weight="800" font-family="Arial,sans-serif">${d.streak} DAY STREAK</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <defs>
      <filter id="paperNoise" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="noise"/>
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 .62  0 0 0 0 .60  0 0 0 0 .55  0 0 0 .045 0" result="grain"/>
        <feBlend in="SourceGraphic" in2="grain" mode="multiply"/>
      </filter>
    </defs>
    <image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>

    <!-- erase all legacy text inside the existing sticky note, preserving its outer edge/shadow -->
    <g transform="rotate(-5 625 128)" filter="url(#paperNoise)">
      <rect x="528" y="79" width="196" height="116" rx="3" fill="#f7dc63"/>
    </g>
    <g transform="rotate(-5 625 128)">
      <text x="625" y="151" text-anchor="middle" fill="${INK}" font-size="58" font-weight="900" font-family="Arial Black,Impact,sans-serif">${esc(d.puzzle)}</text>
    </g>

    <!-- erase legacy score/headline marks only; keep the torn-paper artwork and TODAY'S RESULT -->
    <rect x="112" y="526" width="294" height="171" rx="8" fill="${PAPER}" filter="url(#paperNoise)"/>
    <rect x="430" y="520" width="372" height="174" rx="8" fill="${PAPER}" filter="url(#paperNoise)"/>

    <g transform="rotate(-1.2 250 620)">
      <text x="126" y="650" fill="${BLUE}" font-size="112" font-weight="900" font-family="Arial Black,Impact,sans-serif" letter-spacing="-6">${d.score}/5</text>
      <path d="M132 670 L368 664" stroke="${BLUE}" stroke-width="7" stroke-linecap="round"/>
    </g>

    <g fill="${INK}" font-family="Arial Black,Impact,sans-serif" font-size="43" font-weight="900" letter-spacing="-1.5">
      <text x="455" y="584">${esc(lines[0])}</text>
      <text x="455" y="632">${esc(lines[1])}</text>
    </g>
    <path d="M455 657 L760 649" stroke="${YELLOW}" stroke-width="9" stroke-linecap="round"/>
    ${streak}

    <!-- timeline is the only static design area replaced as a whole -->
    <rect x="92" y="700" width="716" height="120" rx="8" fill="${PAPER}" filter="url(#paperNoise)"/>
    <line x1="142" y1="${timelineY}" x2="758" y2="${timelineY}" stroke="#aaa69d" stroke-width="3"/>
    ${nodes}
    <text x="142" y="798" text-anchor="middle" fill="#77736d" font-size="18" font-weight="800" font-family="Arial,sans-serif">PAST</text>
    <text x="758" y="798" text-anchor="middle" fill="#77736d" font-size="18" font-weight="800" font-family="Arial,sans-serif">NOW</text>
  </svg>`;
}

function readData(anchor: HTMLElement): ShareData | null {
  const puzzle = anchor.querySelector<HTMLElement>(".template-puzzle-note strong")?.textContent?.trim() || anchor.dataset.puzzle;
  const scoreText = anchor.querySelector<HTMLElement>(".template-result-main > strong")?.textContent?.trim() || anchor.dataset.score;
  const headline = anchor.querySelector<HTMLElement>(".template-result-main h2")?.textContent?.trim() || anchor.dataset.headline;
  const nodeElements = [...anchor.querySelectorAll<HTMLElement>(".template-node")];
  const results = nodeElements.length ? nodeElements.map((n) => n.classList.contains("hit")) : (anchor.dataset.results || "").split("").map((v) => v === "1").slice(0, 5);
  const streakText = anchor.querySelector<HTMLElement>(".template-streak")?.textContent || anchor.dataset.streak || "0";
  const streak = Number(streakText.match(/\d+/)?.[0] || 0);
  const score = Number(scoreText?.match(/\d+/)?.[0] || 0);
  if (!puzzle || !headline || results.length !== 5) return null;
  const data = { puzzle, score, headline, results, streak };
  anchor.dataset.puzzle = puzzle;
  anchor.dataset.score = String(score);
  anchor.dataset.headline = headline;
  anchor.dataset.results = results.map((v) => v ? "1" : "0").join("");
  anchor.dataset.streak = String(streak);
  return data;
}

function syncPoster() {
  const anchor = document.querySelector<HTMLElement>(".template-poster");
  if (!anchor) return;
  const data = readData(anchor);
  if (!data) return;
  [...anchor.children].forEach((el) => { if (!(el as HTMLElement).classList.contains("share-final-overlay")) (el as HTMLElement).style.visibility = "hidden"; });
  let overlay = anchor.querySelector<HTMLElement>(".share-final-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "share-final-overlay";
    Object.assign(overlay.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", lineHeight: "0" });
    anchor.appendChild(overlay);
  }
  const signature = JSON.stringify(data);
  if (overlay.dataset.signature !== signature) {
    overlay.innerHTML = buildSvg(data);
    overlay.dataset.signature = signature;
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
}

async function renderPng(data: ShareData) {
  const resp = await fetch(BG, { cache: "force-cache" });
  if (!resp.ok) throw new Error(`Poster background ${resp.status}`);
  const bg = await blobToDataUrl(await resp.blob());
  const svgBlob = new Blob([buildSvg(data, bg)], { type: "image/svg+xml;charset=utf-8" });
  const src = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
    const canvas = document.createElement("canvas");
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG render failed")), "image/png", 1));
  } finally { URL.revokeObjectURL(src); }
}

async function handleShareButton(event: Event) {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".share-actions button");
  if (!button) return;
  const isSave = button.classList.contains("secondary");
  const isShare = button.classList.contains("primary") && /share result|shared/i.test(button.textContent || "");
  if (!isSave && !isShare) return;
  const anchor = document.querySelector<HTMLElement>(".template-poster");
  const data = anchor && readData(anchor);
  if (!data) return;
  event.preventDefault(); event.stopPropagation(); (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  const blob = await renderPng(data);
  if (isShare) {
    const file = new File([blob], `internet-timeline-${data.puzzle.replace("#", "")}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Internet Timeline ${data.puzzle}`, text: `${location.origin}/?ref=share` });
      track("share_success", { game: "internet-timeline", method: "native_image_final" });
      button.textContent = "Shared";
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `internet-timeline-${data.puzzle.replace("#", "")}.png`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  track("share_success", { game: "internet-timeline", method: "image_download_final" });
  button.textContent = "Card saved";
}

const observer = new MutationObserver(syncPoster);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", handleShareButton, true);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncPoster); else queueMicrotask(syncPoster);
