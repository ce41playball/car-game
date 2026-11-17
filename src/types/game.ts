export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type CarType = 'sedan' | 'taxi' | 'suv' | 'van' | 'coupe' | 'pickup';

export interface CarPalette {
  type: CarType;
  label: string;
  body: string;
  bodyShade: string;
  roof: string;
  window: string;
  accent: string;
}

export interface StackedCar {
  id: number;
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  spriteOriginX: number;
  spriteFullWidth: number;
  palette: CarPalette;
  squashProgress: number; // 0 -> 1 animation on landing
  perfectGlow: number; // 0 -> 1 glow fade on perfect landing
}

export interface ActiveCar {
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  tilt: number;
  phase: 'SWINGING' | 'FALLING';
  palette: CarPalette;
}

export interface SlicedDebris {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  spriteOriginX: number;
  spriteFullWidth: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  palette: CarPalette;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  kind: 'dust' | 'spark' | 'ring';
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface GameMetrics {
  score: number;
  floors: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  widthPercent: number;
  currentCarLabel: string;
  isNewRecord: boolean;
}

export interface StoredStats {
  bestScore: number;
  bestFloors: number;
  totalPerfects: number;
  gamesPlayed: number;
  muted: boolean;
  hapticsEnabled: boolean;
}

export const LOGICAL_WIDTH = 420;
export const INITIAL_CAR_WIDTH = 186;
export const CAR_HEIGHT = 46;
export const PERFECT_TOLERANCE = 6;
export const MIN_OVERLAP_WIDTH = 4;
export const COMBO_FOR_RECOVERY = 5;
export const WIDTH_RECOVERY_STEP = 10;

export const CAR_PALETTES: CarPalette[] = [
  {
    type: 'taxi',
    label: '都會計程車',
    body: '#FACC15',
    bodyShade: '#EAB308',
    roof: '#FEF08A',
    window: '#BAE6FD',
    accent: '#1E293B',
  },
  {
    type: 'sedan',
    label: '紅寶石轎車',
    body: '#EF4444',
    bodyShade: '#DC2626',
    roof: '#FCA5A5',
    window: '#E0F2FE',
    accent: '#FDE047',
  },
  {
    type: 'suv',
    label: '晴空休旅車',
    body: '#3B82F6',
    bodyShade: '#2563EB',
    roof: '#93C5FD',
    window: '#E0F2FE',
    accent: '#F8FAFC',
  },
  {
    type: 'van',
    label: '薄荷麵包車',
    body: '#10B981',
    bodyShade: '#059669',
    roof: '#A7F3D0',
    window: '#E0F2FE',
    accent: '#FEF3C7',
  },
  {
    type: 'coupe',
    label: '活力雙門跑車',
    body: '#F97316',
    bodyShade: '#EA580C',
    roof: '#FDBA74',
    window: '#E0F2FE',
    accent: '#FDE047',
  },
  {
    type: 'pickup',
    label: '經典城市皮卡',
    body: '#8B5CF6',
    bodyShade: '#7C3AED',
    roof: '#C4B5FD',
    window: '#E0F2FE',
    accent: '#FDE68A',
  },
];
