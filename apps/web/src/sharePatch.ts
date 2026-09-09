import { track } from "@vercel/analytics";

type ShareData = {
  puzzle: string;
  score: number;
  headline: string;
  results: boolean[];
  streak: number;
};

const BG = "/share-poster-template.webp";
const W = 900;
const H = 1187;
const PAPER = "#f7f4eb";
const INK = "#111214";
const BLUE = "#2057f5";
const GREEN = "#2fc777";
const RED = "#ff7777";
const YELLOW = "#ffd447";

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function headlineLines(score: number, headline: string) {
  if (score === 5) return ["PERFECTLY", "IN SYNC."];
  if (score === 4) return ["ONE GLITCH IN", "THE TIMELINE."];
  if (score >= 2) return ["TIME GOT", "WEIRD."];
  if (score <= 1) return ["TIME IS A", "FLAT CIRCLE."];
  const words = headline.split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

/**
 * Single source of truth for both on-page preview and saved PNG.
 * The artwork remains untouched. Only true variables are drawn here.
 */
function buildSvg(d: ShareData, bg = BG) {
  const lines = headlineLines(d.score, d.headline);

  // Coordinates are calibrated against the real 900x1187 artwork.
  const scoreX = 126;
  const scoreY = 652;
  const headlineX = 455;
  const headlineY = 574;
  const timelineY = 752;
  const xs = [142, 296, 450, 604, 758];

  const nodes = d.results.slice(0, 5).map((ok, i) => {
    const x = xs[i];
    if (ok) {
      return `<circle cx="${x}" cy="${timelineY}" r="22" fill="${PAPER}" stroke="${INK}" stroke-width="4"/>
        <circle cx="${x}" cy="${timelineY}" r="13" fill="${GREEN}"/>`;
    }
    return `<circle cx="${x}" cy="${timelineY}" r="22" fill="${RED}" stroke="${INK}" stroke-width="4"/>
      <path d="M${x - 8} ${timelineY - 8} L${x + 8} ${timelineY + 8} M${x + 8} ${timelineY - 8} L${x - 8} ${timelineY + 8}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }).join("");

  const streak = d.streak >= 2
    ? `<text x="450" y="711" text-anchor="middle" fill="${BLUE}" font-size="17" font-weight="900" font-family="Arial,sans-serif">🔥 ${d.streak} DAY STREAK</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>

    <!-- Dynamic puzzle number only. The sticky note itself stays in the artwork. -->
    <g transform="rotate(-5 626 128)">
      <text x="626" y="130" text-anchor="middle" fill="${INK}" font-size="58" font-weight="900" font-family="Arial Black,Impact,sans-serif">${esc(d.puzzle)}</text>
      <text x="626" y="163" text-anchor="middle" fill="${INK}" font-size="17" font-weight="800" font-family="Arial,sans-serif">A SMALL GUESS.</text>
      <text x="626" y="185" text-anchor="middle" fill="${INK}" font-size="17" font-weight="800" font-family="Arial,sans-serif">A BIGGER PICTURE.</text>
    </g>

    <!-- Dynamic result only. TODAY'S RESULT and paper texture remain untouched. -->
    <text x="${scoreX}" y="${scoreY}" fill="${BLUE}" font-size="112" font-weight="900" font-family="Arial Black,Impact,sans-serif" letter-spacing="-6">${d.score}/5</text>
    <path d="M${scoreX + 5} ${scoreY + 15} L${scoreX + 245} ${scoreY + 10}" stroke="${BLUE}" stroke-width="7" stroke-linecap="round" opacity=".94"/>

    <g fill="${INK}" font-family="Arial Black,Impact,sans-serif" font-size="43" font-weight="900" letter-spacing="-1.5">
      <text x="${headlineX}" y="${headlineY}">${esc(lines[0] || "")}</text>
      <text x="${headlineX}" y="${headlineY + 48}">${esc(lines[1] || "")}</text>
    </g>
    <path d="M${headlineX} ${headlineY + 75} L${headlineX + 305} ${headlineY + 67}" stroke="${YELLOW}" stroke-width="9" stroke-linecap="round" opacity=".94"/>
    ${streak}

    <!-- The only fixed artwork that must be replaced: the old timeline nodes. -->
    <rect x="92" y="704" width="716" height="112" rx="8" fill="${PAPER}" opacity=".985"/>
    <line x1="142" y1="${timelineY}" x2="758" y2="${timelineY}" stroke="#aaa69d" stroke-width="3"/>
    ${nodes}
    <text x="142" y="797" text-anchor="middle" fill="#77736d" font-size="18" font-weight="800" font-family="Arial,sans-serif">PAST</text>
    <text x="758" y="797" text-anchor="middle" fill="#77736d" font-size="18" font-weight="800" font-family="Arial,sans-serif">NOW</text>
  </svg>`;
}

function readData(anchor: HTMLElement): ShareData | null {
  const puzzle = anchor.querySelector<HTMLElement>(".template-puzzle-note strong")?.textContent?.trim() || anchor.dataset.puzzle;
  const scoreText = anchor.querySelector<HTMLElement>(".template-result-main > strong")?.textContent?.trim() || anchor.dataset.score;
  const headline = anchor.querySelector<HTMLElement>(".template-result-main h2")?.textContent?.trim() || anchor.dataset.headline;
  const nodeElements = [...anchor.querySelectorAll<HTMLElement>(".template-node")];
  const results = nodeElements.length
    ? nodeElements.map((n) => n.classList.contains("hit"))
    : (anchor.dataset.results || "").split("").filter(Boolean).map((v) => v === "1");
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

  // React's old poster layers only provide data. They never remain visible.
  [...anchor.children].forEach((el) => {
    if (!(el as HTMLElement).classList.contains("share-svg-overlay")) {
      (el as HTMLElement).style.visibility = "hidden";
    }
  });

  let overlay = anchor.querySelector<HTMLElement>(".share-svg-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "share-svg-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      lineHeight: "0"
    });
    anchor.appendChild(overlay);
  }

  const signature = JSON.stringify(data);
  if (overlay.dataset.signature !== signature) {
    overlay.innerHTML = buildSvg(data);
    overlay.dataset.signature = signature;
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Export uses the exact same buildSvg() as the preview. */
async function renderPng(data: ShareData) {
  const bgResp = await fetch(BG, { cache: "force-cache" });
  if (!bgResp.ok) throw new Error(`Poster background ${bgResp.status}`);
  const bgData = await blobToDataUrl(await bgResp.blob());
  const svgBlob = new Blob([buildSvg(data, bgData)], { type: "image/svg+xml;charset=utf-8" });
  const src = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(image, 0, 0, W, H);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG render failed")), "image/png", .98)
    );
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function handleShareButton(event: Event) {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".share-actions button");
  if (!button) return;

  const isSave = button.classList.contains("secondary");
  const isNativeShare = button.classList.contains("primary") && /share result|shared/i.test(button.textContent || "");
  if (!isSave && !isNativeShare) return;

  const anchor = document.querySelector<HTMLElement>(".template-poster");
  const data = anchor && readData(anchor);
  if (!data) return;

  event.preventDefault();
  event.stopPropagation();
  (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();

  try {
    track("share_click", { game: "internet-timeline", method: isSave ? "save_card_unified" : "native_image_unified" });
    const blob = await renderPng(data);

    if (isNativeShare) {
      const file = new File([blob], `internet-timeline-${data.puzzle.replace("#", "")}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Internet Timeline ${data.puzzle}`,
          text: `Think you can beat ${data.score}/5? ${location.origin}/?ref=share`
        });
        track("share_success", { game: "internet-timeline", method: "native_image_unified" });
        button.textContent = "Shared";
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `internet-timeline-${data.puzzle.replace("#", "")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track("share_success", { game: "internet-timeline", method: "image_download_unified" });
    button.textContent = "Card saved";
  } catch (err) {
    console.error("share renderer", err);
  }
}

const observer = new MutationObserver(syncPoster);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", handleShareButton, true);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncPoster);
else queueMicrotask(syncPoster);
