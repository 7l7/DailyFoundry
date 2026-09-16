type AnalyticsValue = string | number | boolean | null;
type VaPayload = { name?: string; data?: Record<string, AnalyticsValue> };
type VaFn = (event: string, properties?: unknown) => void;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  va?: VaFn;
  vaq?: [string, unknown?][];
};

const analyticsWindow = window as AnalyticsWindow;
const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const measurementId = viteEnv?.VITE_GA_MEASUREMENT_ID?.trim() || "G-7X3HQ2PK49";

analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
analyticsWindow.gtag = (...args: unknown[]) => { analyticsWindow.dataLayer?.push(args); };
analyticsWindow.gtag("js", new Date());
analyticsWindow.gtag("config", measurementId, { send_page_view: true });

const script = document.createElement("script");
script.async = true;
script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
document.head.appendChild(script);

function mirrorToGa(event: string, properties?: unknown) {
  if (event !== "event" || !properties || typeof properties !== "object") return;
  const payload = properties as VaPayload;
  if (!payload.name) return;
  analyticsWindow.gtag?.("event", payload.name, payload.data ?? {});
}

let underlyingVa: VaFn | undefined = analyticsWindow.va;
let bridgeVa: VaFn = () => {};

function installBridge(next?: VaFn) {
  if (next && next !== bridgeVa) underlyingVa = next;

  const wrapped: VaFn = (event, properties) => {
    mirrorToGa(event, properties);
    if (underlyingVa && underlyingVa !== wrapped) {
      underlyingVa(event, properties);
    } else {
      (analyticsWindow.vaq = analyticsWindow.vaq || []).push([event, properties]);
    }
  };

  bridgeVa = wrapped;
  analyticsWindow.va = wrapped;
}

installBridge(underlyingVa);

let checks = 0;
const bridgeWatcher = window.setInterval(() => {
  checks += 1;
  if (analyticsWindow.va && analyticsWindow.va !== bridgeVa) installBridge(analyticsWindow.va);
  if (checks >= 40) window.clearInterval(bridgeWatcher);
}, 250);

export {};
