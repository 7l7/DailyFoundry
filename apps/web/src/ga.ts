type AnalyticsValue = string | number | boolean | null;
type VaPayload = { name?: string; data?: Record<string, AnalyticsValue> };
type VaFn = (event: string, properties?: unknown) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    va?: VaFn;
    vaq?: [string, unknown?][];
  }
}

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const measurementId = viteEnv?.VITE_GA_MEASUREMENT_ID?.trim() || "G-7X3HQ2PK49";

window.dataLayer = window.dataLayer || [];
window.gtag = (...args: unknown[]) => { window.dataLayer.push(args); };
window.gtag("js", new Date());
window.gtag("config", measurementId, {
  send_page_view: true,
});

const script = document.createElement("script");
script.async = true;
script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
document.head.appendChild(script);

function mirrorToGa(event: string, properties?: unknown) {
  if (event !== "event" || !properties || typeof properties !== "object") return;
  const payload = properties as VaPayload;
  if (!payload.name) return;
  window.gtag?.("event", payload.name, payload.data ?? {});
}

// Vercel Analytics already owns the product-event vocabulary. Bridge its `track()`
// queue into GA4 so both systems receive the exact same events and properties.
// Poll briefly because the Vercel analytics script may replace `window.va` after load.
let underlyingVa: VaFn | undefined = window.va;
let bridgeVa: VaFn;

function installBridge(next?: VaFn) {
  if (next && next !== bridgeVa) underlyingVa = next;
  bridgeVa = (event: string, properties?: unknown) => {
    mirrorToGa(event, properties);
    if (underlyingVa && underlyingVa !== bridgeVa) {
      underlyingVa(event, properties);
    } else {
      (window.vaq = window.vaq || []).push([event, properties]);
    }
  };
  window.va = bridgeVa;
}

installBridge(underlyingVa);

let checks = 0;
const bridgeWatcher = window.setInterval(() => {
  checks += 1;
  if (window.va && window.va !== bridgeVa) installBridge(window.va);
  if (checks >= 40) window.clearInterval(bridgeWatcher);
}, 250);

export {};
