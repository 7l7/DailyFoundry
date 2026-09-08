export type MechanicType = "timeline" | "map";

export interface GameManifest {
  schemaVersion: "0.1";
  id: string;
  name: string;
  description: string;
  author: string;
  contentLicense: string;
  mechanic: MechanicType;
  roundsPerGame: number;
}

export interface RoundResult {
  questionId: string;
  score: number;
  maxScore: number;
}

export interface GameResult {
  gameId: string;
  dayKey: string;
  rounds: RoundResult[];
  totalScore: number;
  maxScore: number;
}

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailySeed(gameId: string, dayKey = utcDayKey()): number {
  return hashSeed(`${gameId}:${dayKey}`);
}

export function selectDaily<T>(items: readonly T[], count: number, seed: number): T[] {
  if (count < 0 || count > items.length) throw new Error("Invalid daily selection count");
  const copy = [...items];
  let state = seed || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
