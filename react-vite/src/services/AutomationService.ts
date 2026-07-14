/* =========================================================================
   AutomationService — 系统能力抽象层
   定义 typed service interface，提供 Mock 实现
   所有模拟逻辑封装于此，组件不散落模拟代码
   ========================================================================= */

import type {
  IAutomationService,
  ServiceMode,
  ServiceState,
  StateChangeListener,
  ClickerConfig,
  TimedClickConfig,
  ScriptAction,
  Script,
  PlaybackOptions,
  MousePosition,
  RunState,
  RecordingState,
  AppSettings,
  MouseButton,
  ActionType,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { mockScripts, generateRandomAction, randomKey } from '../data/mockData';

type Timer = ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null;

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  mouse_move: '鼠标移动',
  mouse_click: '鼠标点击',
  mouse_scroll: '滚轮滚动',
  key_down: '键盘按下',
  key_up: '键盘释放',
  wait: '等待',
};

const MOUSE_BUTTONS: MouseButton[] = ['left', 'right', 'middle'];
const ACTION_TYPES: ActionType[] = ['mouse_move', 'mouse_click', 'mouse_scroll', 'key_down', 'key_up', 'wait'];

const genId = () => Math.random().toString(36).slice(2, 11);

function createInitialState(): ServiceState {
  return {
    runState: 'idle',
    recordingState: 'idle',
    clickerCount: 0,
    clickerRunningTime: 0,
    nextClickCountdown: 0,
    recordingTime: 0,
    recordingActionCount: 0,
    recordingActions: [],
    playbackProgress: 0,
    playbackCurrentIndex: -1,
    playbackCurrentLoop: 0,
    playbackLoopRemainingMs: 0,
    mousePos: { x: 960, y: 540 },
    keyboardListening: false,
    countdownRemaining: 0,
    timedClickCount: 0,
    timedClickCountdown: 0,
  };
}

/* --- Mock Automation Service --- */
export class MockAutomationService implements IAutomationService {
  readonly mode: ServiceMode = 'mock';
  private _state: ServiceState = createInitialState();
  private listeners = new Set<StateChangeListener>();
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private scripts: Script[] = [...mockScripts];

  // Timers
  private mouseTimer: Timer = null;
  private clickerTimer: Timer = null;
  private clickerCountdownTimer: Timer = null;
  private clickerRunningTimer: Timer = null;
  private recordingTimer: Timer = null;
  private recordingRunningTimer: Timer = null;
  private playbackTimer: Timer = null;
  private playbackDurationTimer: Timer = null;
  private timedClickTimer: Timer = null;
  private timedClickCountdownTimer: Timer = null;
  private countdownTimer: Timer = null;

  // Internal state
  private currentScript: Script | null = null;
  private currentPlaybackOptions: PlaybackOptions | null = null;
  private clickerConfig: ClickerConfig | null = null;
  private timedClickConfig: TimedClickConfig | null = null;
  private playbackActions: ScriptAction[] = [];
  private playbackIndex = 0;
  private playbackLoop = 0;
  private playbackStartTime = 0;
  private playbackPauseStart = 0;
  private isPaused = false;

  constructor() {
    this.startMouseSimulation();
  }

  get state(): ServiceState {
    return { ...this._state };
  }

  private startMouseSimulation(): void {
    if (this.mouseTimer) clearInterval(this.mouseTimer as any);
    this.mouseTimer = setInterval(() => {
      // Simulate small mouse movements
      const dx = Math.round((Math.random() - 0.5) * 6);
      const dy = Math.round((Math.random() - 0.5) * 6);
      this._state.mousePos = {
        x: Math.max(0, Math.min(1920, this._state.mousePos.x + dx)),
        y: Math.max(0, Math.min(1080, this._state.mousePos.y + dy)),
      };
      this.notify();
    }, 500);
  }

  private notify(): void {
    const snapshot = { ...this._state };
    this.listeners.forEach(l => l(snapshot));
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getMousePosition(): MousePosition {
    return { ...this._state.mousePos };
  }

  // --- Countdown helper ---
  private startCountdown(seconds: number, onComplete: () => void): void {
    this._state.countdownRemaining = seconds;
    this.notify();
    let remaining = seconds;
    this.countdownTimer = setInterval(() => {
      remaining--;
      this._state.countdownRemaining = remaining;
      this.notify();
      if (remaining <= 0) {
        this.clearTimer('countdownTimer');
        this._state.countdownRemaining = 0;
        this.notify();
        onComplete();
      }
    }, 1000);
  }

  private clearTimer(name: string): void {
    const t = (this as any)[name] as Timer;
    if (t) {
      clearInterval(t as any);
      clearTimeout(t as any);
      (this as any)[name] = null;
    }
  }

  private clearAllTimers(): void {
    this.clearTimer('clickerTimer');
    this.clearTimer('clickerCountdownTimer');
    this.clearTimer('clickerRunningTimer');
    this.clearTimer('recordingTimer');
    this.clearTimer('recordingRunningTimer');
    this.clearTimer('playbackTimer');
    this.clearTimer('playbackDurationTimer');
    this.clearTimer('timedClickTimer');
    this.clearTimer('timedClickCountdownTimer');
    this.clearTimer('countdownTimer');
  }

  // --- Clicker ---
  startClicker(config: ClickerConfig): void {
    this.clickerConfig = config;
    this._state.clickerCount = 0;
    this._state.clickerRunningTime = 0;
    this.isPaused = false;

    const beginClicking = () => {
      this._state.runState = 'running';
      this._state.nextClickCountdown = config.intervalMs;
      this.notify();

      // Running time tracker
      this.clickerRunningTimer = setInterval(() => {
        if (!this.isPaused) {
          this._state.clickerRunningTime += 100;
          this._state.nextClickCountdown = Math.max(0, this._state.nextClickCountdown - 100);
          this.notify();
        }
      }, 100);

      // Click interval
      this.clickerTimer = setInterval(() => {
        if (this.isPaused) return;
        this._state.clickerCount++;
        this._state.nextClickCountdown = config.intervalMs;
        this.notify();

        if (config.times > 0 && this._state.clickerCount >= config.times) {
          this.stopClicker();
        }
      }, config.intervalMs);
    };

    if (this.settings.countdownEnabled && this.settings.countdownSeconds > 0) {
      this.startCountdown(this.settings.countdownSeconds, beginClicking);
    } else {
      beginClicking();
    }
  }

  pauseClicker(): void {
    if (this._state.runState !== 'running') return;
    this.isPaused = true;
    this._state.runState = 'paused';
    this.notify();
  }

  resumeClicker(): void {
    if (this._state.runState !== 'paused') return;
    this.isPaused = false;
    this._state.runState = 'running';
    this.notify();
  }

  stopClicker(): void {
    this.clearTimer('clickerTimer');
    this.clearTimer('clickerCountdownTimer');
    this.clearTimer('clickerRunningTimer');
    this.clearTimer('countdownTimer');
    this._state.runState = 'idle';
    this._state.clickerCount = 0;
    this._state.clickerRunningTime = 0;
    this._state.nextClickCountdown = 0;
    this._state.countdownRemaining = 0;
    this.isPaused = false;
    this.notify();
  }

  // --- Timed Click ---
  startTimedClick(config: TimedClickConfig): void {
    this.timedClickConfig = config;
    this._state.timedClickCount = 0;
    this._state.timedClickCountdown = config.waitMs;
    this.isPaused = false;

    const doClick = () => {
      this._state.timedClickCount++;
      this.notify();

      if (config.loop) {
        this._state.timedClickCountdown = config.waitMs;
        this.notify();
        this.timedClickTimer = setTimeout(doClick, config.waitMs);
      } else {
        this._state.runState = 'idle';
        this._state.timedClickCountdown = 0;
        this.notify();
      }
    };

    const begin = () => {
      this._state.runState = 'running';
      this.notify();

      // Countdown tracker
      this.timedClickCountdownTimer = setInterval(() => {
        if (!this.isPaused) {
          this._state.timedClickCountdown = Math.max(0, this._state.timedClickCountdown - 100);
          this.notify();
        }
      }, 100);

      this.timedClickTimer = setTimeout(doClick, config.waitMs);
    };

    if (this.settings.countdownEnabled && this.settings.countdownSeconds > 0) {
      this.startCountdown(this.settings.countdownSeconds, begin);
    } else {
      begin();
    }
  }

  stopTimedClick(): void {
    this.clearTimer('timedClickTimer');
    this.clearTimer('timedClickCountdownTimer');
    this.clearTimer('countdownTimer');
    this._state.runState = 'idle';
    this._state.timedClickCount = 0;
    this._state.timedClickCountdown = 0;
    this._state.countdownRemaining = 0;
    this.notify();
  }

  // --- Recording ---
  startRecording(): void {
    this._state.recordingActions = [];
    this._state.recordingActionCount = 0;
    this._state.recordingTime = 0;
    this._state.recordingState = 'recording';
    this._state.keyboardListening = true;
    this.isPaused = false;
    this.notify();

    // Time tracker
    this.recordingRunningTimer = setInterval(() => {
      if (!this.isPaused) {
        this._state.recordingTime += 100;
        this.notify();
      }
    }, 100);

    // Generate random actions
    this.recordingTimer = setInterval(() => {
      if (this.isPaused) return;
      if (Math.random() < 0.3) return; // Skip some intervals

      const action = generateRandomAction();
      this._state.recordingActions = [...this._state.recordingActions, action];
      this._state.recordingActionCount++;
      this.notify();
    }, 300 + Math.random() * 500);
  }

  pauseRecording(): void {
    if (this._state.recordingState !== 'recording') return;
    this.isPaused = true;
    this._state.recordingState = 'paused';
    this.notify();
  }

  resumeRecording(): void {
    if (this._state.recordingState !== 'paused') return;
    this.isPaused = false;
    this._state.recordingState = 'recording';
    this.notify();
  }

  stopRecording(): ScriptAction[] {
    this.clearTimer('recordingTimer');
    this.clearTimer('recordingRunningTimer');
    this._state.recordingState = 'stopped';
    this._state.keyboardListening = false;
    this.isPaused = false;
    const actions = [...this._state.recordingActions];
    this.notify();
    return actions;
  }

  // --- Playback ---
  playback(script: Script, options: PlaybackOptions): void {
    this.currentScript = script;
    this.currentPlaybackOptions = options;
    this.playbackActions = script.actions.filter(a => a.enabled);
    this.playbackIndex = 0;
    this.playbackLoop = 0;
    this.playbackStartTime = 0;
    this.isPaused = false;
    this._state.playbackProgress = 0;
    this._state.playbackCurrentIndex = -1;
    this._state.playbackCurrentLoop = 0;
    this._state.playbackLoopRemainingMs = options.loopMode === 'duration' ? (options.loopDurationMs || 0) : 0;
    this.notify();

    const begin = () => {
      this._state.runState = 'running';
      this.playbackStartTime = Date.now();
      this.notify();

      // Duration-based loop: track remaining time
      if (options.loopMode === 'duration' && options.loopDurationMs) {
        this.playbackDurationTimer = setInterval(() => {
          if (!this.isPaused) {
            const elapsed = Date.now() - this.playbackStartTime;
            const remaining = Math.max(0, options.loopDurationMs! - elapsed);
            this._state.playbackLoopRemainingMs = remaining;
            this.notify();
            if (remaining <= 0) {
              this.clearTimer('playbackDurationTimer');
              this._state.runState = 'idle';
              this._state.playbackProgress = 100;
              this._state.playbackCurrentIndex = -1;
              this.notify();
            }
          }
        }, 100);
      }

      this.executeNextAction();
    };

    if (this.settings.countdownEnabled && this.settings.countdownSeconds > 0) {
      this.startCountdown(this.settings.countdownSeconds, begin);
    } else {
      begin();
    }
  }

  private executeNextAction(): void {
    if (this.isPaused) return;
    if (this._state.runState !== 'running') return; // duration timer may have stopped us

    const opts = this.currentPlaybackOptions!;

    // Check if we've finished all actions in the current loop iteration
    if (this.playbackIndex >= this.playbackActions.length) {
      const shouldContinue =
        opts.loopMode === 'infinite' ||
        (opts.loopMode === 'count' && this.playbackLoop + 1 < opts.times) ||
        opts.loopMode === 'duration'; // duration mode continues until the timer stops it

      if (shouldContinue) {
        this.playbackLoop++;
        this.playbackIndex = 0;
        this._state.playbackCurrentLoop = this.playbackLoop;
        this.notify();
      } else {
        this._state.runState = 'idle';
        this._state.playbackProgress = 100;
        this._state.playbackCurrentIndex = -1;
        this.notify();
        return;
      }
    }

    const action = this.playbackActions[this.playbackIndex];
    this._state.playbackCurrentIndex = this.playbackIndex;

    // Progress calculation depends on loop mode
    if (opts.loopMode === 'count') {
      const totalActions = this.playbackActions.length * opts.times;
      const completed = this.playbackLoop * this.playbackActions.length + this.playbackIndex;
      this._state.playbackProgress = totalActions > 0 ? Math.round((completed / totalActions) * 100) : 0;
    } else if (opts.loopMode === 'duration' && opts.loopDurationMs) {
      const elapsed = Date.now() - this.playbackStartTime;
      this._state.playbackProgress = Math.min(100, Math.round((elapsed / opts.loopDurationMs) * 100));
      this._state.playbackLoopRemainingMs = Math.max(0, opts.loopDurationMs - elapsed);
    } else {
      // infinite — progress within current loop iteration
      this._state.playbackProgress = Math.round(((this.playbackIndex + 1) / this.playbackActions.length) * 100);
    }
    this.notify();

    this.playbackIndex++;
    const delay = action.delay / (opts.speedMultiplier || 1);
    this.playbackTimer = setTimeout(() => this.executeNextAction(), Math.max(50, delay));
  }

  pausePlayback(): void {
    if (this._state.runState !== 'running') return;
    this.isPaused = true;
    this.playbackPauseStart = Date.now();
    this._state.runState = 'paused';
    this.notify();
  }

  resumePlayback(): void {
    if (this._state.runState !== 'paused') return;
    // Adjust start time by pause duration so elapsed time excludes paused period
    if (this.playbackPauseStart > 0) {
      this.playbackStartTime += Date.now() - this.playbackPauseStart;
      this.playbackPauseStart = 0;
    }
    this.isPaused = false;
    this._state.runState = 'running';
    this.notify();
    this.executeNextAction();
  }

  stopPlayback(): void {
    this.clearTimer('playbackTimer');
    this.clearTimer('playbackDurationTimer');
    this.clearTimer('countdownTimer');
    this._state.runState = 'idle';
    this._state.playbackProgress = 0;
    this._state.playbackCurrentIndex = -1;
    this._state.playbackCurrentLoop = 0;
    this._state.playbackLoopRemainingMs = 0;
    this._state.countdownRemaining = 0;
    this.isPaused = false;
    this.notify();
  }

  // --- Emergency Stop ---
  emergencyStop(): void {
    this.clearAllTimers();
    this._state.runState = 'emergency';
    this._state.recordingState = 'idle';
    this._state.keyboardListening = false;
    this._state.countdownRemaining = 0;
    this._state.playbackProgress = 0;
    this._state.playbackCurrentIndex = -1;
    this._state.playbackCurrentLoop = 0;
    this._state.playbackLoopRemainingMs = 0;
    this._state.clickerCount = 0;
    this._state.nextClickCountdown = 0;
    this._state.timedClickCountdown = 0;
    this.isPaused = false;
    this.notify();

    // Reset to idle after showing emergency state
    setTimeout(() => {
      if (this._state.runState === 'emergency') {
        this._state.runState = 'idle';
        this.notify();
      }
    }, 2000);
  }

  // --- Scripts ---
  saveScript(script: Script): void {
    const idx = this.scripts.findIndex(s => s.id === script.id);
    if (idx >= 0) {
      this.scripts[idx] = { ...script, updatedAt: Date.now(), lastUsedAt: Date.now() };
    } else {
      this.scripts.push({ ...script, id: genId(), createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now() });
    }
  }

  loadScript(id: string): Script | undefined {
    const script = this.scripts.find(s => s.id === id);
    if (script) {
      script.lastUsedAt = Date.now();
    }
    return script ? { ...script } : undefined;
  }

  listRecentScripts(): Script[] {
    return [...this.scripts]
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, 10);
  }

  deleteScript(id: string): void {
    this.scripts = this.scripts.filter(s => s.id !== id);
  }

  // --- Settings ---
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(settings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  destroy(): void {
    this.clearAllTimers();
    if (this.mouseTimer) clearInterval(this.mouseTimer as any);
  }
}

/* --- Factory --- */
let serviceInstance: IAutomationService | null = null;

export function createService(mode: ServiceMode = 'mock'): IAutomationService {
  if (serviceInstance) {
    return serviceInstance;
  }
  if (mode === 'real') {
    // In real mode, a RealAutomationService would be instantiated here
    // Currently not implemented — falls back to mock with a warning
    console.warn('[AutomationService] Real mode not yet implemented, using mock.');
  }
  serviceInstance = new MockAutomationService();
  return serviceInstance;
}

export function getService(): IAutomationService {
  if (!serviceInstance) {
    return createService();
  }
  return serviceInstance;
}

export { ACTION_TYPE_LABELS, genId };
