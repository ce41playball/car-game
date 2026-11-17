import { StoredStats } from '../types/game';

const STORAGE_KEY = 'urban_car_stacker_stats_v1';

const DEFAULT_STATS: StoredStats = {
  bestScore: 0,
  bestFloors: 0,
  totalPerfects: 0,
  gamesPlayed: 0,
  muted: false,
  hapticsEnabled: true,
};

export function loadStoredStats(): StoredStats {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_STATS };
    }
    const parsed = JSON.parse(raw) as Partial<StoredStats>;
    return {
      bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
      bestFloors: typeof parsed.bestFloors === 'number' && parsed.bestFloors >= 0 ? parsed.bestFloors : 0,
      totalPerfects:
        typeof parsed.totalPerfects === 'number' && parsed.totalPerfects >= 0 ? parsed.totalPerfects : 0,
      gamesPlayed: typeof parsed.gamesPlayed === 'number' && parsed.gamesPlayed >= 0 ? parsed.gamesPlayed : 0,
      muted: Boolean(parsed.muted),
      hapticsEnabled: parsed.hapticsEnabled === undefined ? true : Boolean(parsed.hapticsEnabled),
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStoredStats(stats: StoredStats): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota or private-mode failures gracefully.
  }
}
