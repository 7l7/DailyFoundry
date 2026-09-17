import { track } from "@vercel/analytics";

type ShareContext = {
  puzzle: string;
  score: number;
  url: string;
  text: string;
};

const GAME = "internet-timeline";
const PANEL_CLASS = "share-destinations";

function readContext(): ShareContext | null {
  const poster = document.querySelector<HTMLAnchorElement>("a.template-poster");
  if (!poster) return null;
  const puzzle = poster.dataset.puzzle || poster.querySelector<HTMLElement>(".template-puzzle-note strong")?.textContent?.trim() || "";
  const scoreRaw = poster.dataset.score || poster.querySelector<HTMLElement>(".template-result-main > strong")?.textContent || "0";
  const score = Number(scoreRaw.match(/\d+/)?.[0] || 0);
  const url = poster.href || `${location.origin}/?ref=share`;
  if (!puzzle) return null;
  const reaction = score === 5
    ? "I got a perfect timeline."
    : score === 4
      ? "One moment got me."
      : score >= 2
        ? "This broke my sense of internet time."
        : "Apparently I remember the internet very badly.";
  return {
    puzzle,
    score,
    url,
    text: `${reaction} I scored ${score}/5 on Internet Timeline ${puzzle}. Think you can beat me?`,
  };
}

function popup(url: string) {
  window.open(url, "share", "popup=yes,width=720,height=640,noopener,noreferrer");
}

function shareUrl(platform: string, ctx: ShareContext) {
  const u = encodeURIComponent(ctx.url);
  const t = encodeURIComponent(ctx.text);
  switch (platform) {
    case "x": return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case "whatsapp": return `https://wa.me/?text=${encodeURIComponent(`${ctx.text} ${ctx.url}`)}`;
    case "telegram": return `https://t.me/share/url?url=${u}&text=${t}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "reddit": return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    default: return ctx.url;
  }
}

function trackShare(name: string, ctx: ShareContext, success = false) {
  track(success ? "share_success" : "share_click", {
    game: GAME,
    puzzle: ctx.puzzle,
    score: ctx.score,
    method: name,
  });
}

async function nativeShare(ctx: ShareContext) {
  if (!navigator.share) return false;
  try {
    trackShare("native", ctx);
    await navigator.share({
      title: `Internet Timeline ${ctx.puzzle}`,
      text: ctx.text,
      url: ctx.url,
    });
    trackShare("native", ctx, true);
    return true;
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") return true;
    return false;
  }
}

async function copyLink(ctx: ShareContext, button: HTMLButtonElement) {
  trackShare("copy_link", ctx);
  try {
    await navigator.clipboard.writeText(`${ctx.text}\n${ctx.url}`);
    button.textContent = "Copied";
    trackShare("copy_link", ctx, true);
    setTimeout(() => { button.textContent = "Copy link"; }, 1600);
  } catch {
    window.prompt("Copy this challenge:", `${ctx.text}\n${ctx.url}`);
  }
}

function openDestination(platform: string, ctx: ShareContext) {
  trackShare(platform, ctx);
  popup(shareUrl(platform, ctx));
  trackShare(platform, ctx, true);
}

function injectStyles() {
  if (document.getElementById("direct-share-styles")) return;
  const style = document.createElement("style");
  style.id = "direct-share-styles";
  style.textContent = `
    .${PANEL_CLASS}{margin:14px 0 4px;padding:14px;border:1px solid rgba(17,18,20,.12);border-radius:16px;background:rgba(255,255,255,.72)}
    .${PANEL_CLASS} .share-label{display:block;margin:0 0 10px;font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#77736d}
    .${PANEL_CLASS} .share-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
    .${PANEL_CLASS} button{min-width:0;padding:10px 7px;border:1px solid rgba(17,18,20,.13);border-radius:12px;background:#fff;color:#171717;font:800 12px/1.1 system-ui,sans-serif;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
    .${PANEL_CLASS} button:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(17,18,20,.08)}
    .${PANEL_CLASS} button:focus-visible{outline:3px solid #2057f5;outline-offset:2px}
    @media(max-width:680px){.${PANEL_CLASS} .share-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.${PANEL_CLASS}{padding:12px}}
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  const actions = document.querySelector<HTMLElement>(".share-actions");
  if (!actions) return;
  const primary = actions.querySelector<HTMLButtonElement>("button.primary");
  if (primary && !/shared/i.test(primary.textContent || "")) primary.textContent = "Share result";
  if (actions.parentElement?.querySelector(`:scope > .${PANEL_CLASS}`)) return;

  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.innerHTML = `<span class="share-label">Share directly</span><div class="share-grid">
    <button type="button" data-share-to="x" aria-label="Share on X">X</button>
    <button type="button" data-share-to="whatsapp">WhatsApp</button>
    <button type="button" data-share-to="telegram">Telegram</button>
    <button type="button" data-share-to="facebook">Facebook</button>
    <button type="button" data-share-to="reddit">Reddit</button>
    <button type="button" data-share-to="copy">Copy link</button>
  </div>`;
  actions.insertAdjacentElement("afterend", panel);
}

async function handleClick(event: Event) {
  const target = event.target as HTMLElement | null;
  const social = target?.closest<HTMLButtonElement>("[data-share-to]");
  if (social) {
    const ctx = readContext();
    if (!ctx) return;
    event.preventDefault();
    event.stopPropagation();
    const platform = social.dataset.shareTo || "";
    if (platform === "copy") await copyLink(ctx, social);
    else openDestination(platform, ctx);
    return;
  }

  const primary = target?.closest<HTMLButtonElement>(".share-actions button.primary");
  if (!primary) return;
  const ctx = readContext();
  if (!ctx) return;

  // Touch devices already get the richer image-file share flow from shareFinal.ts.
  // On desktop, replace the old clipboard-only action with native share where available,
  // otherwise keep the direct destination buttons in view.
  if (navigator.maxTouchPoints > 0) return;

  event.preventDefault();
  event.stopPropagation();
  (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  const shared = await nativeShare(ctx);
  if (!shared) {
    document.querySelector(`.${PANEL_CLASS}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    trackShare("destination_menu", ctx);
  } else {
    primary.textContent = "Shared";
  }
}

injectStyles();
const observer = new MutationObserver(ensurePanel);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", handleClick, true);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensurePanel); else queueMicrotask(ensurePanel);

export {};
