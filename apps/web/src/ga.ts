import baseQuestions from "../../../games/internet-timeline/questions.json";
import extraQuestions from "../../../games/internet-timeline/questions-extra.json";
import funQuestions from "../../../games/internet-timeline/questions-fun.json";
import questionOverrides from "../../../games/internet-timeline/question-overrides.json";

type AnalyticsValue = string | number | boolean | null;
type AnalyticsData = Record<string, AnalyticsValue>;
type VaPayload = { name?: string; data?: AnalyticsData };
type VaFn = (event: string, properties?: unknown) => void;
type QuestionLite = { id: string; prompt: string; answerYear: number };
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  va?: VaFn;
  vaq?: [string, unknown?][];
};

const GAME_ID = "internet-timeline";
const HISTORY_KEY = `dailyfoundry:${GAME_ID}:history:v2`;
const analyticsWindow = window as AnalyticsWindow;
const overrides = (questionOverrides as { questions?: Record<string, Partial<QuestionLite>> }).questions ?? {};
const questionByPrompt = new Map<string, QuestionLite>(
  [...baseQuestions, ...extraQuestions, ...funQuestions].map((raw) => {
    const q = raw as QuestionLite;
    return [{ ...q, ...(overrides[q.id] ?? {}) }.prompt, { ...q, ...(overrides[q.id] ?? {}) } as QuestionLite];
  }),
);

function priorCompletedDays() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}") as Record<string, unknown>;
    return Object.keys(value).length;
  } catch {
    return 0;
  }
}

function currentQuestion() {
  const prompt = document.querySelector<HTMLElement>(".challenge-card .question")?.textContent?.trim();
  return prompt ? questionByPrompt.get(prompt) : undefined;
}

function slotError(answerYear: number) {
  const slots = [...document.querySelectorAll<HTMLElement>(".timeline-stack .slot")];
  const selected = slots.findIndex((slot) => slot.classList.contains("selected"));
  if (selected < 0) return null;
  const years = [...document.querySelectorAll<HTMLElement>(".timeline-stack .event-year")]
    .map((el) => Number(el.textContent))
    .filter(Number.isFinite);
  const correct = years.filter((year) => year < answerYear).length;
  return selected - correct;
}

function enrichPayload(payload: VaPayload): VaPayload {
  if (!payload.name) return payload;
  const data: AnalyticsData = { ...(payload.data ?? {}) };

  if (["game_start", "archive_start", "practice_start"].includes(payload.name)) {
    const completed = priorCompletedDays();
    data.player_type = completed > 0 ? "returning" : "new";
    data.prior_completed_days = completed;
  }

  if (payload.name === "round_complete") {
    const question = currentQuestion();
    if (question) {
      data.question_id = question.id;
      data.answer_year = question.answerYear;
      data.slot_error = slotError(question.answerYear);
    }
  }

  return { ...payload, data };
}

function mirrorToGa(event: string, properties?: unknown) {
  if (event !== "event" || !properties || typeof properties !== "object") return;
  const payload = enrichPayload(properties as VaPayload);
  if (!payload.name) return;
  analyticsWindow.gtag?.("event", payload.name, payload.data ?? {});
}

let underlyingVa: VaFn | undefined = analyticsWindow.va;
let bridgeVa: VaFn = () => {};

function installBridge(next?: VaFn) {
  if (next && next !== bridgeVa) underlyingVa = next;

  const wrapped: VaFn = (event, properties) => {
    const enriched = event === "event" && properties && typeof properties === "object"
      ? enrichPayload(properties as VaPayload)
      : properties;
    mirrorToGa(event, enriched);
    if (underlyingVa && underlyingVa !== wrapped) {
      underlyingVa(event, enriched);
    } else {
      (analyticsWindow.vaq = analyticsWindow.vaq || []).push([event, enriched]);
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
