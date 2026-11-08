const estimates: Record<string, number> = {
  CHECKOUT: 30,
  STAYOVER: 15,
  FULL_SERVICE: 30,
  DEEP_CLEAN: 60,
  ARRIVAL_TOUCHUP: 15,
};

export function estimatedCleaningMinutes(cleaningType: string): number {
  return estimates[cleaningType] ?? 0;
}

export function elapsedCleaningMinutes(
  startedAt: Date | null,
  completedAt: Date | null,
): number | null {
  if (!startedAt || !completedAt || completedAt <= startedAt) return null;
  return Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000);
}
