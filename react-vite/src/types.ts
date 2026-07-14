/* =========================================================================
   类型定义 — 键鼠自动化工具
   所有业务类型集中于此，确保 service interface 和组件使用统一类型
   ========================================================================= */

export type MouseButton = 'left' | 'right' | 'middle';

export type ClickMode = 'single' | 'double';

export type ActionType =
  | 'mouse_move'
  | 'mouse_click'
  | 'mouse_scroll'
  | 'key_down'
  | 'key_up'
  | 'wait';

export type RunState = 'idle' | 'running' | 'paused' | 'stopped' | 'emergency';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export type ServiceMode = 'mock' | 'real';

export interface ScriptAction {
  id: string;
  type: ActionType;
  enabled: boolean;
  /** 鼠标移动/点击/滚轮参数 */
  x?: number;
  y?: number;
  button?: MouseButton;
  clickMode?: ClickMode;
  scrollDelta?: number;
  /** 键盘参数 */
  key?: string;
  /** 执行此动作前的等待时间（毫秒） */
  delay: number;
  /** 动作持续时间（毫秒），仅用于按下保持等场景 */
  duration?: number;
  /** 备注 */
  comment?: string;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  actions: ScriptAction[];
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface ClickerConfig {
  button: MouseButton;
  clickMode: ClickMode;
  /** 间隔时间（毫秒） */
  intervalMs: number;
  /** 执行次数，0 = 持续运行 */
  times: number;
  /** 使用当前鼠标位置 */
  useCurrentPos: boolean;
  x?: number;
  y?: number;
}

export interface TimedClickConfig {
  /** 等待时间（毫秒） */
  waitMs: number;
  /** 循环执行 */
  loop: boolean;
  x?: number;
  y?: number;
  button: MouseButton;
}

export type LoopMode = 'count' | 'duration' | 'infinite';

export interface PlaybackOptions {
  /** 执行次数（loopMode='count' 时有效） */
  times: number;
  /** 速度倍率 */
  speedMultiplier: number;
  /** 无限循环（loopMode='infinite' 时为 true） */
  loop: boolean;
  /** 循环模式 */
  loopMode: LoopMode;
  /** 循环总时长（毫秒，loopMode='duration' 时有效） */
  loopDurationMs?: number;
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface ServiceState {
  runState: RunState;
  recordingState: RecordingState;
  clickerCount: number;
  clickerRunningTime: number;
  nextClickCountdown: number;
  recordingTime: number;
  recordingActionCount: number;
  recordingActions: ScriptAction[];
  playbackProgress: number;
  playbackCurrentIndex: number;
  playbackCurrentLoop: number;
  /** 循环剩余时间（毫秒，loopMode='duration' 时有效） */
  playbackLoopRemainingMs: number;
  mousePos: MousePosition;
  keyboardListening: boolean;
  countdownRemaining: number;
  timedClickCount: number;
  timedClickCountdown: number;
}

export type StateChangeListener = (state: ServiceState) => void;

export interface IAutomationService {
  readonly mode: ServiceMode;
  readonly state: ServiceState;

  // Listeners
  onStateChange(listener: StateChangeListener): () => void;

  // Mouse
  getMousePosition(): MousePosition;

  // Clicker
  startClicker(config: ClickerConfig): void;
  pauseClicker(): void;
  resumeClicker(): void;
  stopClicker(): void;

  // Timed Click
  startTimedClick(config: TimedClickConfig): void;
  stopTimedClick(): void;

  // Recording
  startRecording(): void;
  pauseRecording(): void;
  resumeRecording(): void;
  stopRecording(): ScriptAction[];

  // Playback
  playback(script: Script, options: PlaybackOptions): void;
  pausePlayback(): void;
  resumePlayback(): void;
  stopPlayback(): void;

  // Emergency
  emergencyStop(): void;

  // Scripts
  saveScript(script: Script): void;
  loadScript(id: string): Script | undefined;
  listRecentScripts(): Script[];
  deleteScript(id: string): void;

  // Settings
  getSettings(): AppSettings;
  updateSettings(settings: Partial<AppSettings>): void;
}

export interface AppSettings {
  emergencyHotkey: string;
  countdownEnabled: boolean;
  countdownSeconds: number;
  theme: 'light' | 'dark';
  serviceMode: ServiceMode;
  recordMouseMove: boolean;
  minRecordInterval: number;
  defaultSpeedMultiplier: number;
  defaultLoopTimes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  emergencyHotkey: 'F12',
  countdownEnabled: true,
  countdownSeconds: 3,
  theme: 'light',
  serviceMode: 'mock',
  recordMouseMove: true,
  minRecordInterval: 50,
  defaultSpeedMultiplier: 1.0,
  defaultLoopTimes: 1,
};
