export type MouseButton = 'left' | 'right' | 'middle';
export type ClickMode = 'single' | 'double';
export type LoopMode = 'count' | 'infinite';
export type EditorLoopMode = LoopMode | 'duration';
export type PositionMode = 'current' | 'fixed';
export type EngineState = 'idle' | 'countdown' | 'recording' | 'running' | 'paused' | 'stopping' | 'error';
export type OperationType = 'clicker' | 'timed_click' | 'recording' | 'playback';
export type ServiceMode = 'mock' | 'real';
export type RunState = ServiceState['runState'];
export type BackendErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED_LOCAL_CLIENT'
  | 'ORIGIN_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'OPERATION_CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'SCRIPT_NOT_FOUND'
  | 'SCRIPT_VERSION_UNSUPPORTED'
  | 'SETTINGS_INVALID'
  | 'HOTKEY_REGISTRATION_FAILED'
  | 'INPUT_PERMISSION_DENIED'
  | 'DISPLAY_LAYOUT_CHANGED'
  | 'ENGINE_INTERNAL_ERROR';
export type ErrorCode = BackendErrorCode | 'CONNECTION_ERROR' | 'CAPABILITY_UNAVAILABLE';

export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
  retryable: boolean;
  operationId: string | null;
}

export interface ErrorResponse {
  error: ErrorDetail;
}

export interface ActionBase {
  id: string;
  enabled: boolean;
  delayBeforeMs: number;
}

export interface MouseMoveAction extends ActionBase {
  type: 'mouse_move';
  payload: { x: number; y: number; durationMs: number };
}

export interface MouseButtonDownAction extends ActionBase {
  type: 'mouse_button_down';
  payload: { button: MouseButton };
}

export interface MouseButtonUpAction extends ActionBase {
  type: 'mouse_button_up';
  payload: { button: MouseButton };
}

export interface MouseClickAction extends ActionBase {
  type: 'mouse_click';
  payload: { button: MouseButton; clickCount: 1 | 2; x: number | null; y: number | null; intervalMs: number };
}

export interface MouseWheelAction extends ActionBase {
  type: 'mouse_wheel';
  payload: { deltaX: number; deltaY: number };
}

export interface KeyDownAction extends ActionBase {
  type: 'key_down';
  payload: { keyCode: string; scanCode: number | null; extended: boolean };
}

export interface KeyUpAction extends ActionBase {
  type: 'key_up';
  payload: { keyCode: string; scanCode: number | null; extended: boolean };
}

export interface WaitAction extends ActionBase {
  type: 'wait';
  payload: { durationMs: number };
}

export type ScriptAction =
  | MouseMoveAction
  | MouseButtonDownAction
  | MouseButtonUpAction
  | MouseClickAction
  | MouseWheelAction
  | KeyDownAction
  | KeyUpAction
  | WaitAction;
export type ActionType = ScriptAction['type'];

export interface ScriptSettings {
  speedMultiplier: number;
  loopMode: LoopMode;
  loopCount: number;
  countdownMs: number;
}

export interface Script {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: ScriptSettings;
  actions: ScriptAction[];
}

export interface ScriptCreate {
  name: string;
  description: string;
  settings: ScriptSettings;
  actions: ScriptAction[];
}

export type ScriptUpdate = Script;
export interface ScriptValidationRequest { script: Record<string, unknown>; }
export interface ScriptValidationResponse { valid: true; script: Script; }

export interface StateSnapshot {
  operationId: string | null;
  operationType: OperationType | null;
  state: EngineState;
  sequence: number;
  startedAt: string | null;
  elapsedMs: number;
  progress: number | null;
  currentActionIndex: number | null;
  completedCount: number;
  countdownRemainingMs: number;
  error: ErrorDetail | null;
}

export interface OperationTransition {
  operationId: string;
  state: EngineState;
  snapshot: StateSnapshot;
}

export interface RecordingStopResponse extends OperationTransition { recordingResultId: string; }
export interface RecordingResult {
  id: string;
  operationId: string;
  durationMs: number;
  actionCount: number;
  actions: ScriptAction[];
}

export interface ClickerConfig {
  button: MouseButton;
  clickCount: 1 | 2;
  intervalMs: number;
  repeatMode: LoopMode;
  repeatCount: number;
  positionMode: PositionMode;
  x: number | null;
  y: number | null;
  countdownMs: number;
}

export interface TimedClickConfig extends ClickerConfig { delayMs: number; }
export interface RecordingConfig {
  recordMouseMove: boolean;
  minMoveSampleMs: number;
  moveErrorPx: number;
  recordWheel: boolean;
  recordMouse: boolean;
  recordKeyboard: boolean;
}

export interface PlaybackRequest {
  scriptId: string | null;
  inlineScript: Script | null;
  speedMultiplier: number;
  loopMode: LoopMode;
  loopCount: number;
  loopDurationMs: number | null;
  countdownMs: number;
}

export interface PlaybackOptions {
  times: number;
  speedMultiplier: number;
  loop: boolean;
  loopMode: EditorLoopMode;
  loopDurationMs?: number;
}

export interface EmergencyStopResponse {
  operationId: string | null;
  state: 'idle';
  releasedInputCount: number;
  releaseFailures: string[];
}

export interface CapabilityStatus {
  status: 'available' | 'unavailable';
  reason: string | null;
}

export interface Capabilities {
  platform: string;
  platformVersion: string;
  input: CapabilityStatus;
  globalHotkey: CapabilityStatus;
  display: CapabilityStatus;
  displayCount: number | null;
  dpiAwareness: CapabilityStatus;
}

export interface HealthResponse {
  status: 'ok';
  appVersion: string;
  protocolVersion: number;
  engineState: EngineState;
}

export type EventType =
  | 'engine.state_snapshot'
  | 'operation.state_changed'
  | 'operation.progress'
  | 'recording.action_captured'
  | 'recording.snapshot'
  | 'error.raised';

export interface EventEnvelope<T = unknown> {
  protocolVersion: number;
  eventId: string;
  sequence: number;
  timestamp: string;
  operationId: string | null;
  type: EventType;
  payload: T;
}

export interface StateSnapshotEvent extends EventEnvelope<StateSnapshot> {
  type: 'engine.state_snapshot' | 'operation.state_changed' | 'operation.progress';
}

export interface RecordingActionCapturedPayload { action: ScriptAction; actionCount: number; }

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

export interface BackendSettings {
  defaultSpeedMultiplier: number;
  defaultLoopMode: LoopMode;
  defaultLoopCount: number;
  defaultCountdownMs: number;
  emergencyStopHotkey: string;
}

export interface HotkeyValidationResponse {
  valid: true;
  normalizedHotkey: string;
  availability: 'available' | 'unavailable';
  reason: string | null;
}

export interface SettingsResponse { settings: AppSettings; }
export interface SettingsUpdateRequest { settings: Partial<AppSettings>; }
export interface HotkeyStatus {
  key: string;
  available: boolean;
  registered: boolean;
  reason?: string | null;
}
export interface HotkeyUpdateRequest { key: string; }
export interface HotkeyUpdateResponse { hotkey: HotkeyStatus; }

export interface MousePosition { x: number; y: number; }
export interface ServiceState {
  snapshot: StateSnapshot;
  runState: 'idle' | 'running' | 'paused' | 'emergency';
  recordingState: 'idle' | 'recording' | 'paused' | 'stopped';
  clickerCount: number;
  clickerRunningTime: number;
  nextClickCountdown: number;
  recordingTime: number;
  recordingActionCount: number;
  recordingActions: ScriptAction[];
  playbackProgress: number;
  playbackCurrentIndex: number;
  playbackCurrentLoop: number;
  playbackLoopRemainingMs: number;
  mousePos: MousePosition;
  keyboardListening: boolean;
  countdownRemaining: number;
  timedClickCount: number;
  timedClickCountdown: number;
}

export type StateChangeListener = (state: ServiceState) => void;
export type ErrorListener = (error: ErrorDetail | null) => void;

export interface IAutomationService {
  readonly mode: ServiceMode;
  onStateChange(listener: StateChangeListener): () => void;
  onError(listener: ErrorListener): () => void;
  initialize(): Promise<void>;
  getState(): Promise<ServiceState>;
  getMousePosition(): Promise<MousePosition>;
  startClicker(config: ClickerConfig): Promise<OperationTransition>;
  pauseClicker(): Promise<OperationTransition>;
  resumeClicker(): Promise<OperationTransition>;
  stopClicker(): Promise<OperationTransition>;
  startTimedClick(config: TimedClickConfig): Promise<OperationTransition>;
  stopTimedClick(): Promise<OperationTransition>;
  startRecording(config?: RecordingConfig): Promise<OperationTransition>;
  pauseRecording(): Promise<OperationTransition>;
  resumeRecording(): Promise<OperationTransition>;
  stopRecording(): Promise<RecordingStopResponse>;
  getRecordingResult(recordingResultId: string): Promise<RecordingResult>;
  playback(script: Script, options: PlaybackOptions): Promise<OperationTransition>;
  pausePlayback(): Promise<OperationTransition>;
  resumePlayback(): Promise<OperationTransition>;
  stopPlayback(): Promise<OperationTransition>;
  emergencyStop(): Promise<EmergencyStopResponse>;
  validateScript(script: Script): Promise<ScriptValidationResponse>;
  saveScript(script: Script): Promise<Script>;
  loadScript(id: string): Promise<Script>;
  listScripts(): Promise<Script[]>;
  duplicateScript(id: string): Promise<Script>;
  deleteScript(id: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  getCapabilities(): Promise<Capabilities>;
  getHotkeyStatus(): Promise<HotkeyStatus>;
  dispose(): Promise<void>;
}

export interface DesktopConnectionInfo { host: string; port: number; token: string; }
export interface DesktopApi { getConnectionInfo(): Promise<DesktopConnectionInfo>; }

declare global {
  interface Window { desktop?: DesktopApi; }
}

export const DEFAULT_SETTINGS: AppSettings = {
  emergencyHotkey: 'F12',
  countdownEnabled: true,
  countdownSeconds: 3,
  theme: 'light',
  serviceMode: 'mock',
  recordMouseMove: true,
  minRecordInterval: 50,
  defaultSpeedMultiplier: 1,
  defaultLoopTimes: 1,
};

export const INITIAL_SNAPSHOT: StateSnapshot = {
  operationId: null,
  operationType: null,
  state: 'idle',
  sequence: 0,
  startedAt: null,
  elapsedMs: 0,
  progress: null,
  currentActionIndex: null,
  completedCount: 0,
  countdownRemainingMs: 0,
  error: null,
};
