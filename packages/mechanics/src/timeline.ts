export interface TimelineQuestion { id: string; prompt: string; answerYear: number; }
export interface TimelineConfig { minYear: number; maxYear: number; maxScore?: number; }
export function scoreTimeline(guessYear:number, answerYear:number, config:TimelineConfig):number {
  const maxScore = config.maxScore ?? 1000;
  const span = Math.max(1, config.maxYear - config.minYear);
  const distance = Math.abs(guessYear - answerYear);
  return Math.max(0, Math.round(maxScore * (1 - distance / span)));
}
