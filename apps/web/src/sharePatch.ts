import { track } from "@vercel/analytics";

type ShareData = { puzzle: string; score: number; headline: string; results: boolean[]; streak: number; host: string };

const BG = "/share-poster-template.webp";
const W = 1080;
const H = 1424;

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function splitHeadline(score: number, headline: string) {
  if (score === 5) return ["PERFECTLY", "IN SYNC."];
  if (score === 4) return ["ONE GLITCH IN", "THE TIMELINE."];
  if (score >= 2) return ["TIME GOT", "WEIRD."];
  if (score <= 1) return ["TIME IS A", "FLAT CIRCLE."];
  const words = headline.split(/\s+/); const mid = Math.ceil(words.length / 2); return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function buildSvg(d: ShareData, bg = BG) {
  const lines = splitHeadline(d.score, d.headline);
  const xs = [165, 347.5, 530, 712.5, 895];
  const nodes = d.results.slice(0, 5).map((ok, i) => {
    const x = xs[i];
    return ok
      ? `<circle cx="${x}" cy="900" r="25" fill="#f7f4eb" stroke="#111214" stroke-width="5"/><circle cx="${x}" cy="900" r="14" fill="#2fc777"/>`
      : `<circle cx="${x}" cy="900" r="25" fill="#ff7b7b" stroke="#111214" stroke-width="5"/><path d="M${x - 9} 891 L${x + 9} 909 M${x + 9} 891 L${x - 9} 909" stroke="#111214" stroke-width="6" stroke-linecap="round"/>`;
  }).join("");
  const streak = d.streak >= 2 ? `<text x="145" y="992" fill="#3157ff" font-size="22" font-weight="900" font-family="Arial,sans-serif">🔥 ${d.streak} DAY STREAK</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>

    <!-- Clean + redraw puzzle note as one unit so angle and position cannot drift. -->
    <g transform="translate(690 58) rotate(-5 142 89)">
      <rect width="300" height="182" rx="3" fill="#ffe66f"/>
      <text x="150" y="82" text-anchor="middle" fill="#101114" font-size="67" font-weight="900" font-family="Arial Black,Impact,sans-serif">${esc(d.puzzle)}</text>
      <text x="150" y="124" text-anchor="middle" fill="#101114" font-size="21" font-weight="800" font-family="Arial,sans-serif">A SMALL GUESS.</text>
      <text x="150" y="151" text-anchor="middle" fill="#101114" font-size="21" font-weight="800" font-family="Arial,sans-serif">A BIGGER PICTURE.</text>
    </g>

    <!-- Clean the complete variable result zone first; no fixed text can show through. -->
    <rect x="118" y="540" width="806" height="435" fill="#f7f4eb" fill-opacity="0.99"/>
    <text x="145" y="620" fill="#101114" font-size="31" font-weight="900" font-family="Arial Black,Arial,sans-serif">TODAY'S RESULT</text>
    <rect x="145" y="637" width="218" height="7" fill="#3157ff"/>
    <text x="145" y="790" fill="#3157ff" font-size="132" font-weight="900" font-family="Arial Black,Impact,sans-serif" letter-spacing="-8">${d.score}/5</text>
    <text x="505" y="700" fill="#101114" font-size="50" font-weight="900" font-family="Arial Black,Arial,sans-serif" letter-spacing="-2">
      <tspan x="505" dy="0">${esc(lines[0] || "")}</tspan><tspan x="505" dy="56">${esc(lines[1] || "")}</tspan>
    </text>
    <rect x="505" y="785" width="365" height="9" fill="#ffd447" transform="rotate(-2 505 785)"/>
    <line x1="165" y1="900" x2="895" y2="900" stroke="#aaa69d" stroke-width="4"/>
    ${nodes}
    <text x="142" y="950" fill="#77736d" font-size="21" font-weight="800" font-family="Arial,sans-serif">PAST</text>
    <text x="858" y="950" fill="#77736d" font-size="21" font-weight="800" font-family="Arial,sans-serif">NOW</text>
    ${streak}

    <!-- URL is also variable. -->
    <rect x="355" y="1190" width="540" height="84" rx="42" fill="#101114"/>
    <text x="625" y="1243" text-anchor="middle" fill="#fff" font-size="25" font-weight="850" font-family="Arial,sans-serif">${esc(d.host)}  ↗</text>
  </svg>`;
}

function readData(anchor: HTMLElement): ShareData | null {
  const puzzle = anchor.querySelector<HTMLElement>(".template-puzzle-note strong")?.textContent?.trim() || anchor.dataset.puzzle;
  const scoreText = anchor.querySelector<HTMLElement>(".template-result-main > strong")?.textContent?.trim() || anchor.dataset.score;
  const headline = anchor.querySelector<HTMLElement>(".template-result-main h2")?.textContent?.trim() || anchor.dataset.headline;
  const nodes = [...anchor.querySelectorAll<HTMLElement>(".template-node")];
  const results = nodes.length ? nodes.map((n) => n.classList.contains("hit")) : (anchor.dataset.results || "").split("").filter(Boolean).map((v) => v === "1");
  const streakText = anchor.querySelector<HTMLElement>(".template-streak")?.textContent || anchor.dataset.streak || "0";
  const streak = Number(streakText.match(/\d+/)?.[0] || 0);
  const score = Number(scoreText?.match(/\d+/)?.[0] || 0);
  if (!puzzle || !headline || results.length !== 5) return null;
  const data = { puzzle, score, headline, results, streak, host: window.location.host };
  anchor.dataset.puzzle = puzzle; anchor.dataset.score = String(score); anchor.dataset.headline = headline; anchor.dataset.results = results.map(Boolean).map((v) => v ? "1" : "0").join(""); anchor.dataset.streak = String(streak);
  return data;
}

function syncPoster() {
  const anchor = document.querySelector<HTMLElement>(".template-poster");
  if (!anchor) return;
  const data = readData(anchor); if (!data) return;
  [...anchor.children].forEach((el) => { if (!(el as HTMLElement).classList.contains("share-svg-overlay")) (el as HTMLElement).style.visibility = "hidden"; });
  let overlay = anchor.querySelector<HTMLElement>(".share-svg-overlay");
  if (!overlay) {
    overlay = document.createElement("div"); overlay.className = "share-svg-overlay";
    Object.assign(overlay.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", lineHeight: "0" });
    anchor.appendChild(overlay);
  }
  const signature = JSON.stringify(data);
  if (overlay.dataset.signature !== signature) { overlay.innerHTML = buildSvg(data); overlay.dataset.signature = signature; }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
}

async function renderPng(data: ShareData) {
  const bgResp = await fetch(BG, { cache: "force-cache" }); if (!bgResp.ok) throw new Error(`Poster background ${bgResp.status}`);
  const bgData = await blobToDataUrl(await bgResp.blob());
  const svgBlob = new Blob([buildSvg(data, bgData)], { type: "image/svg+xml;charset=utf-8" });
  const src = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable"); ctx.drawImage(image, 0, 0, W, H);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG render failed")), "image/png", .96));
  } finally { URL.revokeObjectURL(src); }
}

async function handleShareButton(event: Event) {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".share-actions button"); if (!button) return;
  const isSave = button.classList.contains("secondary");
  const isNativeShare = button.classList.contains("primary") && /share result|shared/i.test(button.textContent || "");
  if (!isSave && !isNativeShare) return;
  const anchor = document.querySelector<HTMLElement>(".template-poster"); const data = anchor && readData(anchor); if (!data) return;
  event.preventDefault(); event.stopPropagation(); (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  try {
    track("share_click", { game: "internet-timeline", method: isSave ? "save_card_v2" : "native_image_v2" });
    const blob = await renderPng(data);
    if (isNativeShare) {
      const file = new File([blob], `internet-timeline-${data.puzzle.replace("#", "")}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Internet Timeline ${data.puzzle}`, text: `Think you can beat ${data.score}/5? ${location.origin}/?ref=share` });
        track("share_success", { game: "internet-timeline", method: "native_image_v2" }); button.textContent = "Shared"; return;
      }
    }
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `internet-timeline-${data.puzzle.replace("#", "")}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    track("share_success", { game: "internet-timeline", method: "image_download_v2" }); button.textContent = "Card saved";
  } catch (err) { console.error("share renderer", err); }
}

const observer = new MutationObserver(syncPoster);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", handleShareButton, true);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncPoster); else queueMicrotask(syncPoster);
