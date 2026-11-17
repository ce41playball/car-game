import React, { useEffect, useRef } from 'react';
import { soundEngine, triggerHaptic } from '../audio/soundEngine';
import {
  ActiveCar,
  CAR_HEIGHT,
  CAR_PALETTES,
  COMBO_FOR_RECOVERY,
  FloatingText,
  GameMetrics,
  GameState,
  INITIAL_CAR_WIDTH,
  LOGICAL_WIDTH,
  MIN_OVERLAP_WIDTH,
  PERFECT_TOLERANCE,
  Particle,
  SlicedDebris,
  StackedCar,
  WIDTH_RECOVERY_STEP,
} from '../types/game';
import {
  drawActiveCar,
  drawCrane,
  drawDebris,
  drawFloatingTexts,
  drawGround,
  drawParticles,
  drawSkyAndCity,
  drawStackedCar,
} from './carRenderer';

interface GameCanvasProps {
  gameState: GameState;
  runId: number;
  bestScore: number;
  hapticsEnabled: boolean;
  onMetricsChange: (metrics: GameMetrics) => void;
  onGameOver: (finalMetrics: GameMetrics) => void;
}

const SWING_MARGIN = 20;
const CRANE_RAIL_Y = 78;
const CAR_HANG_TOP_Y = CRANE_RAIL_Y + 52;
const GRAVITY = 2650;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  runId,
  bestScore,
  hapticsEnabled,
  onMetricsChange,
  onGameOver,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const gameStateRef = useRef<GameState>(gameState);
  const bestScoreRef = useRef<number>(bestScore);
  const hapticsRef = useRef<boolean>(hapticsEnabled);
  const onMetricsChangeRef = useRef(onMetricsChange);
  const onGameOverRef = useRef(onGameOver);

  gameStateRef.current = gameState;
  bestScoreRef.current = bestScore;
  hapticsRef.current = hapticsEnabled;
  onMetricsChangeRef.current = onMetricsChange;
  onGameOverRef.current = onGameOver;

  // Mutable simulation state held inside ref for 60fps zero-re-render loop
  const simRef = useRef({
    logicalH: 740,
    stack: [] as StackedCar[],
    activeCar: null as ActiveCar | null,
    debris: [] as SlicedDebris[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    cameraY: 0,
    targetCameraY: 0,
    shakeTime: 0,
    shakePower: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    currentWidth: INITIAL_CAR_WIDTH,
    nextId: 1,
    ending: false,
    endingTimer: 0,
    timeSec: 0,
    reducedMotion: false,
    titleCraneX: LOGICAL_WIDTH / 2,
    titleCraneDir: 1,
  });

  const emitMetrics = () => {
    const s = simRef.current;
    const currentLabel = s.activeCar
      ? s.activeCar.palette.label
      : s.stack.length > 0
        ? s.stack[s.stack.length - 1].palette.label
        : CAR_PALETTES[0].label;

    onMetricsChangeRef.current({
      score: s.score,
      floors: s.stack.length,
      combo: s.combo,
      maxCombo: s.maxCombo,
      perfectCount: s.perfectCount,
      widthPercent: Math.round((s.currentWidth / INITIAL_CAR_WIDTH) * 100),
      currentCarLabel: currentLabel,
      isNewRecord: s.score > 0 && s.score > bestScoreRef.current,
    });
  };

  const spawnNextCar = () => {
    const s = simRef.current;
    const floor = s.stack.length + 1;
    const palette = CAR_PALETTES[(floor - 1) % CAR_PALETTES.length];
    const groundScreenY = s.logicalH - 84;
    const hangWorldY = s.targetCameraY + (groundScreenY - CAR_HANG_TOP_Y - CAR_HEIGHT);

    const speed = 165 + Math.min(255, (floor - 1) * 7.5 + Math.sqrt(floor - 1) * 14);
    const spawnLeft = floor % 2 === 1;
    const startX = spawnLeft ? SWING_MARGIN : LOGICAL_WIDTH - s.currentWidth - SWING_MARGIN;
    const vx = spawnLeft ? speed : -speed;

    s.activeCar = {
      floor,
      x: startX,
      y: hangWorldY,
      width: s.currentWidth,
      height: CAR_HEIGHT,
      vx,
      vy: 0,
      tilt: 0,
      phase: 'SWINGING',
      palette,
    };
  };

  const resetSimulation = () => {
    const s = simRef.current;
    s.stack = [];
    s.debris = [];
    s.particles = [];
    s.floatingTexts = [];
    s.cameraY = 0;
    s.targetCameraY = 0;
    s.shakeTime = 0;
    s.shakePower = 0;
    s.score = 0;
    s.combo = 0;
    s.maxCombo = 0;
    s.perfectCount = 0;
    s.currentWidth = INITIAL_CAR_WIDTH;
    s.nextId = 1;
    s.ending = false;
    s.endingTimer = 0;
    spawnNextCar();
    emitMetrics();
  };

  // Trigger reset whenever runId increments
  useEffect(() => {
    if (runId > 0) {
      resetSimulation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const releaseActiveCar = () => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.ending || !s.activeCar || s.activeCar.phase !== 'SWINGING') return;

    soundEngine.unlock();
    soundEngine.playRelease();
    s.activeCar.phase = 'FALLING';
    s.activeCar.vy = -120; // crisp initial downward impulse
  };

  // Keyboard support for desktop convenience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
      if (e.code === 'Space' || e.code === 'ArrowDown') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT') return;
        e.preventDefault();
        releaseActiveCar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main Canvas ResizeObserver + requestAnimationFrame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    simRef.current.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let pxPerLogical = 1;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      pxPerLogical = canvas.width / LOGICAL_WIDTH;
      simRef.current.logicalH = canvas.height / pxPerLogical;
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    const addDustParticles = (cx: number, y: number, count: number, color: string) => {
      const s = simRef.current;
      if (s.reducedMotion && count > 4) count = 4;
      for (let i = 0; i < count; i++) {
        const angle = Math.PI * (0.1 + Math.random() * 0.8);
        const speed = 35 + Math.random() * 95;
        s.particles.push({
          x: cx + (Math.random() - 0.5) * 32,
          y,
          vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
          vy: Math.sin(angle) * speed * 0.7,
          size: 4 + Math.random() * 5,
          color,
          alpha: 0.85,
          life: 0,
          maxLife: 0.38 + Math.random() * 0.22,
          kind: 'dust',
        });
      }
    };

    const addSliceSparks = (x: number, y: number) => {
      const s = simRef.current;
      const count = s.reducedMotion ? 3 : 9;
      for (let i = 0; i < count; i++) {
        const vx = (Math.random() - 0.5) * 180;
        const vy = 60 + Math.random() * 140;
        s.particles.push({
          x,
          y,
          vx,
          vy,
          size: 2.5 + Math.random() * 2.5,
          color: i % 2 === 0 ? '#FACC15' : '#FB923C',
          alpha: 1,
          life: 0,
          maxLife: 0.3 + Math.random() * 0.2,
          kind: 'spark',
        });
      }
    };

    const handleLanding = (active: ActiveCar) => {
      const s = simRef.current;
      const groundScreenY = s.logicalH - 84;
      const prev = s.stack.length > 0 ? s.stack[s.stack.length - 1] : null;
      const targetY = prev ? prev.y + prev.height : 0;

      if (!prev) {
        // First car lands solidly on the street foundation
        s.stack.push({
          id: s.nextId++,
          floor: 1,
          x: active.x,
          y: 0,
          width: active.width,
          height: CAR_HEIGHT,
          spriteOriginX: active.x,
          spriteFullWidth: active.width,
          palette: active.palette,
          squashProgress: 0.01,
          perfectGlow: 0,
        });
        s.score += 10;
        soundEngine.playLand(0, false);
        triggerHaptic(12, hapticsRef.current);
        addDustParticles(active.x + active.width / 2, 4, 8, 'rgba(248, 250, 252, 0.85)');
        s.floatingTexts.push({
          id: s.nextId++,
          x: active.x + active.width / 2,
          y: CAR_HEIGHT + 12,
          text: '+10',
          color: '#FFFFFF',
          life: 0,
          maxLife: 0.7,
        });
        s.activeCar = null;
        spawnNextCar();
        emitMetrics();
        return;
      }

      const deltaX = active.x - prev.x;
      const isPerfect = Math.abs(deltaX) <= PERFECT_TOLERANCE;

      if (isPerfect) {
        let newX = prev.x;
        let newWidth = prev.width;
        s.combo += 1;
        s.perfectCount += 1;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;

        let expanded = false;
        if (s.combo >= COMBO_FOR_RECOVERY && newWidth < INITIAL_CAR_WIDTH) {
          const nextWidth = Math.min(INITIAL_CAR_WIDTH, newWidth + WIDTH_RECOVERY_STEP);
          const diff = nextWidth - newWidth;
          newX = Math.max(SWING_MARGIN, Math.min(LOGICAL_WIDTH - nextWidth - SWING_MARGIN, newX - diff / 2));
          newWidth = nextWidth;
          s.currentWidth = newWidth;
          expanded = true;
        }

        s.stack.push({
          id: s.nextId++,
          floor: s.stack.length + 1,
          x: newX,
          y: targetY,
          width: newWidth,
          height: CAR_HEIGHT,
          spriteOriginX: newX,
          spriteFullWidth: newWidth,
          palette: active.palette,
          squashProgress: 0.01,
          perfectGlow: 1,
        });

        const points = 10 + s.combo * 5;
        s.score += points;

        if (expanded) {
          soundEngine.playExpand();
          triggerHaptic([15, 25, 20], hapticsRef.current);
        } else {
          soundEngine.playLand(s.combo, true);
          triggerHaptic(18, hapticsRef.current);
        }

        s.particles.push({
          x: newX + newWidth / 2,
          y: targetY + 4,
          vx: 0,
          vy: 0,
          size: newWidth * 0.52,
          color: '#FACC15',
          alpha: 0.95,
          life: 0,
          maxLife: 0.42,
          kind: 'ring',
        });
        addDustParticles(newX + newWidth / 2, targetY + 3, 6, '#FEF08A');

        s.floatingTexts.push({
          id: s.nextId++,
          x: newX + newWidth / 2,
          y: targetY + CAR_HEIGHT + 16,
          text: s.combo > 1 ? `PERFECT x${s.combo}` : 'PERFECT!',
          subtext: expanded ? `車身加寬 +${points}` : `+${points}`,
          color: '#FDE047',
          life: 0,
          maxLife: 0.9,
        });
      } else {
        const overlapLeft = Math.max(active.x, prev.x);
        const overlapRight = Math.min(active.x + active.width, prev.x + prev.width);
        const overlapWidth = overlapRight - overlapLeft;

        if (overlapWidth < MIN_OVERLAP_WIDTH) {
          // Complete miss! Tumble entire car down & end game
          s.combo = 0;
          s.debris.push({
            id: s.nextId++,
            x: active.x,
            y: active.y,
            width: active.width,
            height: CAR_HEIGHT,
            spriteOriginX: active.x,
            spriteFullWidth: active.width,
            vx: deltaX > 0 ? 68 : -68,
            vy: -160,
            angle: 0,
            angularVelocity: deltaX > 0 ? 3.4 : -3.4,
            palette: active.palette,
            alpha: 1,
          });
          s.activeCar = null;
          s.ending = true;
          s.endingTimer = 0.46;
          if (!s.reducedMotion) {
            s.shakeTime = 0.28;
            s.shakePower = 7;
          }
          soundEngine.playGameOver();
          triggerHaptic([35, 30, 75], hapticsRef.current);
          emitMetrics();
          return;
        }

        // Partial overlap: keep aligned core, slice overhang
        s.combo = 0;
        s.currentWidth = overlapWidth;

        s.stack.push({
          id: s.nextId++,
          floor: s.stack.length + 1,
          x: overlapLeft,
          y: targetY,
          width: overlapWidth,
          height: CAR_HEIGHT,
          spriteOriginX: active.x,
          spriteFullWidth: active.width,
          palette: active.palette,
          squashProgress: 0.01,
          perfectGlow: 0,
        });

        // Left overhang debris
        if (active.x < prev.x) {
          const cutW = prev.x - active.x;
          s.debris.push({
            id: s.nextId++,
            x: active.x,
            y: targetY,
            width: cutW,
            height: CAR_HEIGHT,
            spriteOriginX: active.x,
            spriteFullWidth: active.width,
            vx: -75 - Math.random() * 35,
            vy: 60,
            angle: 0,
            angularVelocity: -3.8,
            palette: active.palette,
            alpha: 1,
          });
          addSliceSparks(prev.x, targetY + CAR_HEIGHT * 0.5);
        }

        // Right overhang debris
        if (active.x + active.width > prev.x + prev.width) {
          const cutX = prev.x + prev.width;
          const cutW = active.x + active.width - cutX;
          s.debris.push({
            id: s.nextId++,
            x: cutX,
            y: targetY,
            width: cutW,
            height: CAR_HEIGHT,
            spriteOriginX: active.x,
            spriteFullWidth: active.width,
            vx: 75 + Math.random() * 35,
            vy: 60,
            angle: 0,
            angularVelocity: 3.8,
            palette: active.palette,
            alpha: 1,
          });
          addSliceSparks(cutX, targetY + CAR_HEIGHT * 0.5);
        }

        s.score += 10;
        if (!s.reducedMotion) {
          s.shakeTime = 0.14;
          s.shakePower = 3.5;
        }
        soundEngine.playSlice();
        soundEngine.playLand(0, false);
        triggerHaptic(14, hapticsRef.current);
        addDustParticles(overlapLeft + overlapWidth / 2, targetY + 3, 6, 'rgba(248, 250, 252, 0.85)');

        s.floatingTexts.push({
          id: s.nextId++,
          x: overlapLeft + overlapWidth / 2,
          y: targetY + CAR_HEIGHT + 12,
          text: '+10',
          color: '#FFFFFF',
          life: 0,
          maxLife: 0.65,
        });
      }

      // Smoothly lift camera so tower top stays around 62% down the viewport
      const newTowerTop = targetY + CAR_HEIGHT;
      const desiredTowerYOffset = groundScreenY - s.logicalH * 0.62;
      s.targetCameraY = Math.max(0, newTowerTop - desiredTowerYOffset);

      s.activeCar = null;
      spawnNextCar();
      emitMetrics();
    };

    let lastTime = performance.now();
    let rafId = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const s = simRef.current;
      const state = gameStateRef.current;
      const groundScreenY = s.logicalH - 84;

      if (state !== 'PAUSED') {
        s.timeSec += dt;
      }

      // Title screen gentle ambient crane motion
      if (state === 'TITLE_MENU') {
        s.titleCraneX += s.titleCraneDir * 95 * dt;
        if (s.titleCraneX > LOGICAL_WIDTH - 115) {
          s.titleCraneX = LOGICAL_WIDTH - 115;
          s.titleCraneDir = -1;
        } else if (s.titleCraneX < 115) {
          s.titleCraneX = 115;
          s.titleCraneDir = 1;
        }
      }

      // Active gameplay simulation
      if (state === 'PLAYING') {
        // Camera damping
        s.cameraY += (s.targetCameraY - s.cameraY) * Math.min(1, dt * 6.5);

        // Screen shake decay
        if (s.shakeTime > 0) {
          s.shakeTime = Math.max(0, s.shakeTime - dt);
        }

        // Update stacked car micro animations
        for (let i = Math.max(0, s.stack.length - 4); i < s.stack.length; i++) {
          const c = s.stack[i];
          if (c.squashProgress > 0 && c.squashProgress < 1) {
            c.squashProgress = Math.min(1, c.squashProgress + dt * 5.8);
            if (c.squashProgress >= 1) c.squashProgress = 0;
          }
          if (c.perfectGlow > 0) {
            c.perfectGlow = Math.max(0, c.perfectGlow - dt * 2.2);
          }
        }

        // Update active hanging or falling car
        if (s.activeCar) {
          const ac = s.activeCar;
          if (ac.phase === 'SWINGING') {
            ac.x += ac.vx * dt;
            const maxRight = LOGICAL_WIDTH - ac.width - SWING_MARGIN;
            if (ac.x >= maxRight) {
              ac.x = maxRight;
              ac.vx = -Math.abs(ac.vx);
            } else if (ac.x <= SWING_MARGIN) {
              ac.x = SWING_MARGIN;
              ac.vx = Math.abs(ac.vx);
            }
            const targetTilt = (ac.vx / 400) * 0.065;
            ac.tilt += (targetTilt - ac.tilt) * Math.min(1, dt * 12);
            ac.y = s.cameraY + (groundScreenY - CAR_HANG_TOP_Y - CAR_HEIGHT);
          } else {
            ac.vy -= GRAVITY * dt;
            ac.y += ac.vy * dt;
            ac.tilt += (0 - ac.tilt) * Math.min(1, dt * 14);

            const targetTopY =
              s.stack.length > 0 ? s.stack[s.stack.length - 1].y + CAR_HEIGHT : 0;
            if (ac.y <= targetTopY) {
              ac.y = targetTopY;
              handleLanding(ac);
            }
          }
        }

        // Update falling sliced debris
        for (let i = s.debris.length - 1; i >= 0; i--) {
          const d = s.debris[i];
          d.vy -= GRAVITY * 0.72 * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.angle += d.angularVelocity * dt;
          if (d.y < s.cameraY - 200) {
            s.debris.splice(i, 1);
          }
        }

        // Update particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.life += dt;
          if (p.kind !== 'ring') {
            p.vy -= 260 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          }
          if (p.life >= p.maxLife) {
            s.particles.splice(i, 1);
          }
        }

        // Update floating texts
        for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
          const ft = s.floatingTexts[i];
          ft.life += dt;
          if (ft.life >= ft.maxLife) {
            s.floatingTexts.splice(i, 1);
          }
        }

        // Ending countdown after missed car
        if (s.ending) {
          s.endingTimer -= dt;
          if (s.endingTimer <= 0) {
            s.ending = false;
            const finalMetrics: GameMetrics = {
              score: s.score,
              floors: s.stack.length,
              combo: s.combo,
              maxCombo: s.maxCombo,
              perfectCount: s.perfectCount,
              widthPercent: Math.round((s.currentWidth / INITIAL_CAR_WIDTH) * 100),
              currentCarLabel:
                s.stack.length > 0
                  ? s.stack[s.stack.length - 1].palette.label
                  : CAR_PALETTES[0].label,
              isNewRecord: s.score > 0 && s.score > bestScoreRef.current,
            };
            onGameOverRef.current(finalMetrics);
          }
        }
      }

      // Render pass
      ctx.save();
      ctx.setTransform(pxPerLogical, 0, 0, pxPerLogical, 0, 0);

      // Apply micro screen shake
      if (s.shakeTime > 0 && !s.reducedMotion) {
        const mag = s.shakePower * (s.shakeTime / 0.2);
        ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
      }

      drawSkyAndCity(ctx, s.logicalH, groundScreenY, s.cameraY, s.timeSec);
      drawGround(ctx, s.logicalH, groundScreenY, s.cameraY);

      if (state === 'TITLE_MENU') {
        // Show sample preview car hanging cleanly in menu backdrop
        const demoCar: ActiveCar = {
          floor: 1,
          x: s.titleCraneX - INITIAL_CAR_WIDTH / 2,
          y: groundScreenY - CAR_HANG_TOP_Y - CAR_HEIGHT,
          width: INITIAL_CAR_WIDTH,
          height: CAR_HEIGHT,
          vx: s.titleCraneDir * 95,
          vy: 0,
          tilt: s.titleCraneDir * 0.025,
          phase: 'SWINGING',
          palette: CAR_PALETTES[0],
        };
        drawCrane(ctx, s.titleCraneX, CRANE_RAIL_Y, CAR_HANG_TOP_Y, true);
        drawActiveCar(ctx, demoCar, groundScreenY, 0);
      } else {
        // Draw stacked tower
        for (const car of s.stack) {
          drawStackedCar(ctx, car, groundScreenY, s.cameraY);
        }

        // Draw falling debris
        for (const d of s.debris) {
          drawDebris(ctx, d, groundScreenY, s.cameraY);
        }

        // Draw crane & active car
        if (s.activeCar) {
          const trolleyX = s.activeCar.x + s.activeCar.width / 2;
          const carScreenTopY = groundScreenY - (s.activeCar.y + CAR_HEIGHT - s.cameraY);
          drawCrane(
            ctx,
            trolleyX,
            CRANE_RAIL_Y,
            carScreenTopY,
            s.activeCar.phase === 'SWINGING'
          );
          drawActiveCar(ctx, s.activeCar, groundScreenY, s.cameraY);
        } else {
          drawCrane(ctx, LOGICAL_WIDTH / 2, CRANE_RAIL_Y, CAR_HANG_TOP_Y, false);
        }

        drawParticles(ctx, s.particles, groundScreenY, s.cameraY);
        drawFloatingTexts(ctx, s.floatingTexts, groundScreenY, s.cameraY);
      }

      ctx.restore();
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        releaseActiveCar();
      }}
      className="relative h-full w-full select-none overflow-hidden touch-manipulation cursor-pointer"
      aria-label="汽車疊疊樂遊戲畫布"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};
