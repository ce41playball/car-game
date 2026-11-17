import React, { useCallback, useEffect, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
  Home,
} from 'lucide-react';
import { soundEngine, triggerHaptic } from './audio/soundEngine';
import { GameCanvas } from './game/GameCanvas';
import { loadStoredStats, saveStoredStats } from './storage/statsStorage';
import {
  CAR_PALETTES,
  COMBO_FOR_RECOVERY,
  GameMetrics,
  GameState,
  StoredStats,
} from './types/game';

const INITIAL_METRICS: GameMetrics = {
  score: 0,
  floors: 0,
  combo: 0,
  maxCombo: 0,
  perfectCount: 0,
  widthPercent: 100,
  currentCarLabel: CAR_PALETTES[0].label,
  isNewRecord: false,
};

export default function App() {
  const [stats, setStats] = useState<StoredStats>(() => {
    const loaded = loadStoredStats();
    soundEngine.setMuted(loaded.muted);
    return loaded;
  });

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [runId, setRunId] = useState<number>(0);
  const [metrics, setMetrics] = useState<GameMetrics>(INITIAL_METRICS);

  const persistStats = useCallback((next: StoredStats) => {
    setStats(next);
    saveStoredStats(next);
  }, []);

  const toggleMute = useCallback(() => {
    soundEngine.unlock();
    const nextMuted = !stats.muted;
    soundEngine.setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playClick();
    }
    persistStats({ ...stats, muted: nextMuted });
  }, [persistStats, stats]);

  const toggleHaptics = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playClick();
    const nextHaptics = !stats.hapticsEnabled;
    if (nextHaptics) {
      triggerHaptic(15, true);
    }
    persistStats({ ...stats, hapticsEnabled: nextHaptics });
  }, [persistStats, stats]);

  const startGame = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playClick();
    triggerHaptic(12, stats.hapticsEnabled);
    setMetrics(INITIAL_METRICS);
    setRunId((id) => id + 1);
    setGameState('PLAYING');
  }, [stats.hapticsEnabled]);

  const togglePause = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playClick();
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const returnToMenu = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playClick();
    setGameState('TITLE_MENU');
    setMetrics(INITIAL_METRICS);
  }, []);

  const handleGameOver = useCallback(
    (finalMetrics: GameMetrics) => {
      setMetrics(finalMetrics);
      setGameState('GAME_OVER');

      const nextStats: StoredStats = {
        ...stats,
        bestScore: Math.max(stats.bestScore, finalMetrics.score),
        bestFloors: Math.max(stats.bestFloors, finalMetrics.floors),
        totalPerfects: stats.totalPerfects + finalMetrics.perfectCount,
        gamesPlayed: stats.gamesPlayed + 1,
      };
      persistStats(nextStats);
    },
    [persistStats, stats]
  );

  // Global keyboard shortcuts for desktop ergonomics
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          togglePause();
        }
      } else if (e.code === 'KeyR' && (gameState === 'GAME_OVER' || gameState === 'PAUSED')) {
        e.preventDefault();
        startGame();
      } else if (e.code === 'Enter' && (gameState === 'TITLE_MENU' || gameState === 'GAME_OVER')) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON') return;
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, startGame, togglePause]);

  const streakProgress = Math.min(metrics.combo, COMBO_FOR_RECOVERY);
  const recoveryReady = metrics.combo >= COMBO_FOR_RECOVERY;

  return (
    <main className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-slate-200 lg:px-8 lg:py-4">
      <div className="grid h-full w-full max-w-6xl grid-cols-1 items-center lg:grid-cols-[1fr_minmax(380px,430px)_1fr] lg:gap-8">
        {/* Desktop Left Info Panel */}
        <aside className="hidden flex-col gap-6 rounded-3xl border border-slate-900/10 bg-white/80 p-6 shadow-sm backdrop-blur-md lg:flex">
          <div>
            <p className="text-xs font-semibold tracking-wide text-sky-700">即時車塔狀態</p>
            <h2 className="font-display mt-1 text-2xl font-extrabold text-slate-900">
              都市汽車疊疊樂
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-900/10 pt-5">
            <div>
              <div className="text-xs font-medium text-slate-500">目前得分</div>
              <div className="font-display mt-1 text-3xl font-extrabold tabular-nums text-slate-900">
                {metrics.score}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">堆疊層數</div>
              <div className="font-display mt-1 text-3xl font-extrabold tabular-nums text-orange-600">
                {metrics.floors} 層
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900/10 pt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>完美連擊獎勵進度</span>
              <span className="font-mono-tabular text-amber-600">
                {recoveryReady ? `已啟動 (x${metrics.combo})` : `${streakProgress} / ${COMBO_FOR_RECOVERY}`}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-200 ${
                  recoveryReady ? 'bg-amber-400' : 'bg-sky-500'
                }`}
                style={{ width: `${(streakProgress / COMBO_FOR_RECOVERY) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              連續 {COMBO_FOR_RECOVERY} 次完美對齊後，每次精準堆疊皆可微幅恢復車身寬度。
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-900/10 pt-5 text-sm">
            <span className="text-slate-600">目前車寬比例</span>
            <span className="font-mono-tabular font-bold text-slate-900">
              {metrics.widthPercent}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">吊掛車款</span>
            <span className="font-semibold text-slate-900">{metrics.currentCarLabel}</span>
          </div>
        </aside>

        {/* Center Playable Game Stage (Full viewport on mobile, 9:16 frame on desktop) */}
        <section className="relative h-dvh w-full overflow-hidden bg-sky-200 lg:h-[min(860px,92dvh)] lg:rounded-3xl lg:border-2 lg:border-slate-900/15 lg:shadow-2xl">
          <GameCanvas
            gameState={gameState}
            runId={runId}
            bestScore={stats.bestScore}
            hapticsEnabled={stats.hapticsEnabled}
            onMetricsChange={setMetrics}
            onGameOver={handleGameOver}
          />

          {/* Compact Top HUD (Strict <=12% height, non-blocking tap targets) */}
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-3">
            {gameState !== 'TITLE_MENU' ? (
              <div className="rounded-2xl border border-slate-900/10 bg-white/85 px-3.5 py-2 shadow-sm backdrop-blur-md">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-display text-2xl font-extrabold leading-none tabular-nums text-slate-900">
                    {metrics.score}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">分</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums text-slate-600">
                  <span>第 {metrics.floors} 層</span>
                  <span aria-hidden="true">·</span>
                  <span>最高 {Math.max(stats.bestScore, metrics.score)}</span>
                  {metrics.combo > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-amber-600">連擊 x{metrics.combo}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div />
            )}

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={stats.muted ? '開啟音效' : '靜音'}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-900/10 bg-white/85 text-slate-800 shadow-sm backdrop-blur-md transition-transform hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {stats.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>

              {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
                <button
                  type="button"
                  onClick={togglePause}
                  aria-label={gameState === 'PAUSED' ? '繼續遊戲' : '暫停遊戲'}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-900/10 bg-white/85 text-slate-800 shadow-sm backdrop-blur-md transition-transform hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {gameState === 'PAUSED' ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </header>

          {/* Subtle tap hint on Floor 0 during active play */}
          {gameState === 'PLAYING' && metrics.floors === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center px-6">
              <p className="rounded-xl bg-slate-900/75 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-sm">
                點擊螢幕任意處，放下第一台汽車！
              </p>
            </div>
          )}

          {/* TITLE MENU OVERLAY */}
          {gameState === 'TITLE_MENU' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-end bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent px-5 pb-8">
              <div className="w-full max-w-sm rounded-3xl border border-slate-900/10 bg-white/95 p-6 shadow-xl backdrop-blur-md">
                <div className="text-center">
                  <p className="text-xs font-bold tracking-wider text-orange-600">
                    2D 街機堆疊挑戰
                  </p>
                  <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                    都市汽車疊疊樂
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    抓準吊臂移動節奏點擊釋放汽車，層層疊高並挑戰完美對齊連擊。
                  </p>
                </div>

                {/* Unboxed stats summary */}
                <div className="mt-5 flex items-center justify-center gap-4 border-y border-slate-900/10 py-3 text-xs font-semibold tabular-nums text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    最高 {stats.bestScore} 分
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    |
                  </span>
                  <span>最高 {stats.bestFloors} 層</span>
                  <span aria-hidden="true" className="text-slate-300">
                    |
                  </span>
                  <span>累計 {stats.gamesPlayed} 局</span>
                </div>

                <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-600">
                  <li>1. 點擊螢幕釋放上方吊臂汽車落向地面或車塔頂端</li>
                  <li>2. 未對齊的車頭或車尾將被俐落切除掉落</li>
                  <li>3. 連續 5 次完美對齊可微幅恢復車身寬度</li>
                </ul>

                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={startGame}
                    className="font-display flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-orange-600/20 transition-transform hover:bg-orange-500 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 whitespace-nowrap"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    開始遊戲
                  </button>

                  <button
                    type="button"
                    onClick={toggleHaptics}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Smartphone className="h-4 w-4 text-slate-500" />
                    震動回饋：{stats.hapticsEnabled ? '已開啟' : '已關閉'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAUSED OVERLAY */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-5 backdrop-blur-sm">
              <div className="w-full max-w-xs rounded-3xl border border-slate-900/10 bg-white p-6 text-center shadow-2xl">
                <h2 className="font-display text-2xl font-extrabold text-slate-900">遊戲暫停</h2>
                <p className="mt-1.5 text-sm tabular-nums text-slate-600">
                  目前第 {metrics.floors} 層 · {metrics.score} 分
                </p>

                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={togglePause}
                    className="font-display flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-base font-bold text-white transition-transform hover:bg-orange-500 active:scale-[0.98] whitespace-nowrap"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    繼續遊戲
                  </button>
                  <button
                    type="button"
                    onClick={startGame}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新開始
                  </button>
                  <button
                    type="button"
                    onClick={returnToMenu}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Home className="h-4 w-4" />
                    返回主選單
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GAME OVER OVERLAY */}
          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/55 px-5 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl border border-slate-900/10 bg-white p-6 text-center shadow-2xl">
                <p
                  className={`text-xs font-bold tracking-wide ${
                    metrics.isNewRecord ? 'text-amber-600' : 'text-slate-500'
                  }`}
                >
                  {metrics.isNewRecord ? '突破個人新紀錄！' : '汽車沒疊穩掉落了'}
                </p>
                <h2 className="font-display mt-1 text-3xl font-extrabold text-slate-900">
                  遊戲結束
                </h2>

                <div className="mt-4 border-y border-slate-900/10 py-4">
                  <div className="text-xs font-medium text-slate-500">最終得分</div>
                  <div className="font-display mt-1 text-5xl font-extrabold tabular-nums text-orange-600">
                    {metrics.score}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-slate-500">堆疊層數</div>
                    <div className="font-mono-tabular mt-0.5 text-lg font-bold text-slate-900">
                      {metrics.floors} 層
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">最高連擊</div>
                    <div className="font-mono-tabular mt-0.5 text-lg font-bold text-slate-900">
                      x{metrics.maxCombo}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">歷史最佳</div>
                    <div className="font-mono-tabular mt-0.5 text-lg font-bold text-amber-600">
                      {stats.bestScore}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={startGame}
                    className="font-display flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-orange-600/20 transition-transform hover:bg-orange-500 active:scale-[0.98] whitespace-nowrap"
                  >
                    <RotateCcw className="h-5 w-5" />
                    再玩一次
                  </button>
                  <button
                    type="button"
                    onClick={returnToMenu}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Home className="h-4 w-4" />
                    返回主選單
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Desktop Right Records & Controls Panel */}
        <aside className="hidden flex-col gap-5 rounded-3xl border border-slate-900/10 bg-white/80 p-6 shadow-sm backdrop-blur-md lg:flex">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500">歷史戰績與設定</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">最高分數</div>
                <div className="font-mono-tabular mt-0.5 text-2xl font-bold text-amber-600">
                  {stats.bestScore}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">最高塔高</div>
                <div className="font-mono-tabular mt-0.5 text-2xl font-bold text-slate-900">
                  {stats.bestFloors} 層
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">累計完美次數</div>
                <div className="font-mono-tabular mt-0.5 text-lg font-bold text-slate-800">
                  {stats.totalPerfects}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">遊玩局數</div>
                <div className="font-mono-tabular mt-0.5 text-lg font-bold text-slate-800">
                  {stats.gamesPlayed}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900/10 pt-5">
            <h3 className="text-sm font-bold text-slate-900">操作方式</h3>
            <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-600">
              <li className="flex items-center justify-between">
                <span>放下吊臂汽車</span>
                <span className="font-mono-tabular font-semibold text-slate-800">點擊 / Space</span>
              </li>
              <li className="flex items-center justify-between">
                <span>暫停或繼續</span>
                <span className="font-mono-tabular font-semibold text-slate-800">P / Esc</span>
              </li>
              <li className="flex items-center justify-between">
                <span>結束後快速重開</span>
                <span className="font-mono-tabular font-semibold text-slate-800">R / Enter</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-900/10 pt-5">
            <button
              type="button"
              onClick={toggleMute}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span>合成音效</span>
              <span className="text-slate-900">{stats.muted ? '靜音' : '開啟'}</span>
            </button>
            <button
              type="button"
              onClick={toggleHaptics}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span>震動感回饋</span>
              <span className="text-slate-900">{stats.hapticsEnabled ? '開啟' : '關閉'}</span>
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
