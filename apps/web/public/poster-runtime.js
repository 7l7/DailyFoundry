(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const POSTER_SELECTOR = '.template-poster';
  const PAPER = '#f7f4eb';
  const INK = '#111216';
  const BLUE = '#2057f5';
  const GREEN = '#22b56d';
  const RED = '#ff6969';
  const YELLOW = '#ffd329';

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function readPosterData(poster) {
    const score = poster.querySelector('.template-result-main > strong')?.textContent?.trim() || '0/5';
    const headline = poster.querySelector('.template-result-main h2')?.textContent?.trim() || '';
    const puzzle = poster.querySelector('.template-puzzle-note strong')?.textContent?.trim() || '#1';
    const nodes = [...poster.querySelectorAll('.template-node')].map((node) => node.classList.contains('hit'));
    const streak = poster.querySelector('.template-streak')?.textContent?.trim() || '';
    const bg = poster.querySelector('.template-poster-bg')?.getAttribute('src') || '/share-poster-template.webp';
    const href = poster.getAttribute('href') || '/?ref=share';
    return { score, headline, puzzle, nodes, streak, bg, href };
  }

  function wrapHeadline(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > 20 && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  function svgMarkup(data, w, h) {
    const headlineLines = wrapHeadline(data.headline);
    const timelineY = h * 0.615;
    const startX = w * 0.18;
    const endX = w * 0.82;
    const gap = (endX - startX) / 4;
    const bandY = h * 0.565;
    const bandH = h * 0.105;
    const scoreX = w * 0.17;
    const scoreY = h * 0.535;
    const headlineX = w * 0.49;
    const headlineY = h * 0.485;
    const headlineSize = Math.round(w * 0.046);
    const noteCX = w * 0.645;
    const noteCY = h * 0.105;

    const headlineSvg = headlineLines.map((line, i) =>
      `<text x="${headlineX}" y="${headlineY + i * headlineSize * 1.02}" fill="${INK}" font-family="Arial Black,Impact,sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-1">${esc(line)}</text>`
    ).join('');

    const nodes = Array.from({ length: 5 }, (_, i) => {
      const hit = data.nodes[i] !== false;
      const x = startX + gap * i;
      if (hit) {
        return `<circle cx="${x}" cy="${timelineY}" r="${w * 0.022}" fill="${PAPER}" stroke="${INK}" stroke-width="${w * 0.004}"/><circle cx="${x}" cy="${timelineY}" r="${w * 0.0135}" fill="${GREEN}"/>`;
      }
      const r = w * 0.022;
      const d = w * 0.009;
      return `<circle cx="${x}" cy="${timelineY}" r="${r}" fill="${RED}" stroke="${INK}" stroke-width="${w * 0.004}"/><path d="M ${x-d} ${timelineY-d} L ${x+d} ${timelineY+d} M ${x+d} ${timelineY-d} L ${x-d} ${timelineY+d}" stroke="${INK}" stroke-width="${w * 0.0048}" stroke-linecap="round"/>`;
    }).join('');

    const streak = data.streak ? `<text x="${w*0.5}" y="${h*0.555}" text-anchor="middle" fill="${BLUE}" font-family="Arial,sans-serif" font-size="${w*0.019}" font-weight="800">${esc(data.streak)}</text>` : '';

    return `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" width="100%" height="100%" role="img" aria-label="Internet Timeline result ${esc(data.score)}" preserveAspectRatio="xMidYMid meet">
      <image href="${esc(data.bg)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>

      <!-- puzzle number: text only, preserve the artwork's sticky-note angle -->
      <g transform="translate(${noteCX} ${noteCY}) rotate(-6)">
        <text x="0" y="0" text-anchor="middle" fill="${INK}" font-family="Arial Black,Impact,sans-serif" font-size="${w*0.058}" font-weight="900">${esc(data.puzzle)}</text>
        <text x="0" y="${h*0.038}" text-anchor="middle" fill="${INK}" font-family="Arial,sans-serif" font-size="${w*0.016}" font-weight="800">A SMALL GUESS.</text>
        <text x="0" y="${h*0.058}" text-anchor="middle" fill="${INK}" font-family="Arial,sans-serif" font-size="${w*0.016}" font-weight="800">A BIGGER PICTURE.</text>
      </g>

      <!-- result variables: no duplicate panel/background -->
      <text x="${scoreX}" y="${scoreY}" fill="${BLUE}" font-family="Arial Black,Impact,sans-serif" font-size="${w*0.125}" font-weight="900" letter-spacing="-5">${esc(data.score)}</text>
      <path d="M ${scoreX} ${scoreY+h*0.012} L ${scoreX+w*0.255} ${scoreY+h*0.008}" stroke="${BLUE}" stroke-width="${w*0.006}" stroke-linecap="round" opacity="0.9"/>
      ${headlineSvg}
      <path d="M ${headlineX} ${headlineY + headlineLines.length*headlineSize*1.02 + h*0.012} L ${headlineX+w*0.31} ${headlineY + headlineLines.length*headlineSize*1.02 + h*0.005}" stroke="${YELLOW}" stroke-width="${w*0.009}" stroke-linecap="round" opacity="0.92"/>
      ${streak}

      <!-- fixed timeline in artwork is intentionally covered, then redrawn once -->
      <rect x="${w*0.105}" y="${bandY}" width="${w*0.79}" height="${bandH}" rx="${w*0.012}" fill="${PAPER}" opacity="0.985"/>
      <line x1="${startX}" y1="${timelineY}" x2="${endX}" y2="${timelineY}" stroke="#a9a69e" stroke-width="${w*0.0022}"/>
      ${nodes}
      <text x="${startX}" y="${timelineY+h*0.043}" text-anchor="middle" fill="#77756f" font-family="Arial,sans-serif" font-size="${w*0.018}" font-weight="800">PAST</text>
      <text x="${endX}" y="${timelineY+h*0.043}" text-anchor="middle" fill="#77756f" font-family="Arial,sans-serif" font-size="${w*0.018}" font-weight="800">NOW</text>
    </svg>`;
  }

  function imageSize(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ w: image.naturalWidth || 1215, h: image.naturalHeight || 1295 });
      image.onerror = () => resolve({ w: 1215, h: 1295 });
      image.src = src;
    });
  }

  async function upgradePoster(poster) {
    if (!poster || poster.dataset.posterUnified === '1') return;
    const data = readPosterData(poster);
    const { w, h } = await imageSize(data.bg);
    poster.dataset.posterUnified = '1';
    poster.dataset.posterData = JSON.stringify(data);
    poster.style.aspectRatio = `${w}/${h}`;
    poster.innerHTML = svgMarkup(data, w, h);
  }

  async function posterPngBlob(poster) {
    const data = JSON.parse(poster.dataset.posterData || '{}');
    const svg = poster.querySelector('svg');
    if (!svg) throw new Error('Poster SVG missing');
    const box = svg.viewBox.baseVal;
    const markup = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = box.width;
      canvas.height = box.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(image, 0, 0, box.width, box.height);
      return await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png', 0.96));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function savePoster(poster) {
    const blob = await posterPngBlob(poster);
    const data = JSON.parse(poster.dataset.posterData || '{}');
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `internet-timeline-${String(data.puzzle || 'daily').replace('#','')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function sharePoster(poster) {
    const blob = await posterPngBlob(poster);
    const data = JSON.parse(poster.dataset.posterData || '{}');
    const file = new File([blob], `internet-timeline-${String(data.puzzle || 'daily').replace('#','')}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Internet Timeline ${data.puzzle || ''}`, text: `${data.href || location.origin + '/?ref=share'}` });
      return true;
    }
    await savePoster(poster);
    return false;
  }

  function bindActions() {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('.share-actions button');
      if (!button) return;
      const poster = document.querySelector(POSTER_SELECTOR);
      if (!poster || poster.dataset.posterUnified !== '1') return;
      const text = (button.textContent || '').toLowerCase();
      if (text.includes('save') || text.includes('card saved')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        await savePoster(poster);
        button.textContent = 'Card saved';
        return;
      }
      if (text.includes('share result') || text === 'shared') {
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          const shared = await sharePoster(poster);
          if (shared) button.textContent = 'Shared';
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error);
        }
      }
    }, true);
  }

  function scan() {
    const poster = document.querySelector(POSTER_SELECTOR);
    if (poster && poster.dataset.posterUnified !== '1') upgradePoster(poster);
  }

  bindActions();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
