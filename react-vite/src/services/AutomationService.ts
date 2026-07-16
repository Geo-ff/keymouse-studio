import type {
  AppSettings,
  BackendSettings,
  Capabilities,
  ClickerConfig,
  DesktopConnectionInfo,
  EmergencyStopResponse,
  ErrorDetail,
  EventEnvelope,
  HotkeyStatus,
  HotkeyValidationResponse,
  IAutomationService,
  MousePosition,
  OperationTransition,
  PlaybackOptions,
  PlaybackRequest,
  RecordingActionCapturedPayload,
  RecordingConfig,
  RecordingResult,
  RecordingStopResponse,
  Script,
  ScriptAction,
  ScriptCreate,
  ScriptValidationResponse,
  ServiceMode,
  ServiceState,
  StateChangeListener,
  StateSnapshot,
  TimedClickConfig,
} from '../types';
import { DEFAULT_SETTINGS, INITIAL_SNAPSHOT } from '../types';
import { generateRandomAction, mockScripts } from '../data/mockData';
import { resolveServiceMode } from '../utils/runtime';
import { hotkeyToBackend } from '../utils/hotkey';
import { resolveCountdownMs } from '../utils/countdown';
import { ApiClient, ApiError } from './ApiClient';

const genId = () => crypto.randomUUID();
const clone = <T,>(value: T): T => structuredClone(value);
const activeState = (state: StateSnapshot['state']) => state === 'countdown' || state === 'running' || state === 'recording' || state === 'paused' || state === 'stopping';

function createState(snapshot: StateSnapshot = INITIAL_SNAPSHOT): ServiceState {
  return {
    snapshot: clone(snapshot),
    runState: snapshot.state === 'paused' ? 'paused' : activeState(snapshot.state) ? 'running' : 'idle',
    recordingState: snapshot.operationType === 'recording' ? (snapshot.state === 'paused' ? 'paused' : snapshot.state === 'recording' ? 'recording' : 'stopped') : 'idle',
    clickerCount: snapshot.operationType === 'clicker' ? snapshot.completedCount : 0,
    clickerRunningTime: snapshot.operationType === 'clicker' ? snapshot.elapsedMs : 0,
    nextClickCountdown: snapshot.operationType === 'clicker' ? snapshot.countdownRemainingMs : 0,
    recordingTime: snapshot.operationType === 'recording' ? snapshot.elapsedMs : 0,
    recordingActionCount: snapshot.operationType === 'recording' ? snapshot.completedCount : 0,
    recordingActions: [],
    playbackProgress: snapshot.operationType === 'playback' ? Math.round((snapshot.progress ?? 0) * 100) : 0,
    playbackCurrentIndex: snapshot.operationType === 'playback' ? (snapshot.currentActionIndex ?? -1) : -1,
    playbackCurrentLoop: snapshot.operationType === 'playback' ? snapshot.completedCount : 0,
    playbackLoopRemainingMs: 0,
    mousePos: { x: 960, y: 540 },
    keyboardListening: snapshot.operationType === 'recording' && activeState(snapshot.state),
    countdownRemaining: Math.ceil(snapshot.countdownRemainingMs / 1000),
    timedClickCount: snapshot.operationType === 'timed_click' ? snapshot.completedCount : 0,
    timedClickRunningTime: snapshot.operationType === 'timed_click' ? snapshot.elapsedMs : 0,
    timedClickCountdown: snapshot.operationType === 'timed_click' ? snapshot.countdownRemainingMs : 0,
  };
}

abstract class AutomationServiceBase implements IAutomationService {
  abstract readonly mode: ServiceMode;
  protected currentState = createState();
  protected listeners = new Set<StateChangeListener>();
  protected errorListeners = new Set<(error: ErrorDetail | null) => void>();
  protected currentError: ErrorDetail | null = null;

  async getState(): Promise<ServiceState> { return clone(this.currentState); }
  onStateChange(listener: StateChangeListener): () => void { this.listeners.add(listener); void this.getState().then(listener); return () => { this.listeners.delete(listener); }; }
  onError(listener: (error: ErrorDetail | null) => void): () => void { this.errorListeners.add(listener); listener(this.currentError); return () => { this.errorListeners.delete(listener); }; }
  protected notify(): void { void this.getState().then(state => this.listeners.forEach(listener => listener(state))); }
  protected report(error: unknown): never {
    const detail = error instanceof ApiError ? error.detail : {
      code: 'ENGINE_INTERNAL_ERROR' as const,
      message: error instanceof Error ? error.message : '未知错误',
      details: {}, retryable: false, operationId: this.currentState.snapshot.operationId,
    };
    this.currentError = detail;
    this.errorListeners.forEach(listener => listener(detail));
    throw error;
  }
  protected clearError(): void { this.currentError = null; this.errorListeners.forEach(listener => listener(null)); }
  protected applySnapshot(snapshot: StateSnapshot): void {
    const previous = this.currentState;
    const actions = previous.recordingActions;
    const mousePos = previous.mousePos;
    let merged = snapshot;
    const sameOperation =
      Boolean(previous.snapshot.operationId) &&
      previous.snapshot.operationId === snapshot.operationId &&
      previous.snapshot.operationType === snapshot.operationType;
    if (sameOperation && activeState(snapshot.state) && activeState(previous.snapshot.state)) {
      merged = {
        ...snapshot,
        completedCount: Math.max(snapshot.completedCount, previous.snapshot.completedCount),
        elapsedMs: Math.max(snapshot.elapsedMs, previous.snapshot.elapsedMs),
        sequence: Math.max(snapshot.sequence, previous.snapshot.sequence),
      };
    }
    const next = { ...createState(merged), recordingActions: actions, mousePos };
    if (merged.operationType !== 'clicker') {
      next.clickerCount = previous.clickerCount;
      next.clickerRunningTime = previous.clickerRunningTime;
    }
    if (merged.operationType !== 'timed_click') {
      next.timedClickCount = previous.timedClickCount;
      next.timedClickRunningTime = previous.timedClickRunningTime;
    }
    if (merged.operationType !== 'playback') {
      next.playbackProgress = previous.playbackProgress;
      next.playbackCurrentIndex = previous.playbackCurrentIndex;
      next.playbackCurrentLoop = previous.playbackCurrentLoop;
    }
    if (merged.operationType === 'recording' && actions.length > next.recordingActionCount) {
      next.recordingActionCount = actions.length;
    }
    if (merged.state === 'idle' && previous.recordingState === 'stopped') {
      next.recordingState = 'stopped';
      next.recordingTime = previous.recordingTime;
      next.recordingActionCount = previous.recordingActionCount;
    }
    this.currentState = next;
    this.notify();
  }

  abstract initialize(): Promise<void>;

  abstract getMousePosition(): Promise<MousePosition>;
  abstract startClicker(config: ClickerConfig): Promise<OperationTransition>;
  abstract pauseClicker(): Promise<OperationTransition>;
  abstract resumeClicker(): Promise<OperationTransition>;
  abstract stopClicker(): Promise<OperationTransition>;
  abstract startTimedClick(config: TimedClickConfig): Promise<OperationTransition>;
  abstract stopTimedClick(): Promise<OperationTransition>;
  abstract startRecording(config?: RecordingConfig): Promise<OperationTransition>;
  abstract pauseRecording(): Promise<OperationTransition>;
  abstract resumeRecording(): Promise<OperationTransition>;
  abstract stopRecording(): Promise<RecordingStopResponse>;
  abstract discardRecording(): Promise<void>;
  abstract getRecordingResult(id: string): Promise<RecordingResult>;
  abstract playback(script: Script, options: PlaybackOptions): Promise<OperationTransition>;
  abstract pausePlayback(): Promise<OperationTransition>;
  abstract resumePlayback(): Promise<OperationTransition>;
  abstract stopPlayback(): Promise<OperationTransition>;
  abstract emergencyStop(): Promise<EmergencyStopResponse>;
  abstract validateScript(script: Script): Promise<ScriptValidationResponse>;
  abstract saveScript(script: Script): Promise<Script>;
  abstract loadScript(id: string): Promise<Script>;
  abstract listScripts(): Promise<Script[]>;
  abstract duplicateScript(id: string): Promise<Script>;
  abstract deleteScript(id: string): Promise<void>;
  abstract getSettings(): Promise<AppSettings>;
  abstract updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  abstract getCapabilities(): Promise<Capabilities>;
  abstract getHotkeyStatus(): Promise<HotkeyStatus>;
  abstract dispose(): Promise<void>;
}

export class MockAutomationService extends AutomationServiceBase {
  readonly mode = 'mock' as const;
  private settings = { ...DEFAULT_SETTINGS };
  private scripts = clone(mockScripts);
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private operationId: string | null = null;
  private operationType: StateSnapshot['operationType'] = null;
  private beforePause: StateSnapshot['state'] = 'running';
  private sequence = 0;
  private recordingResults = new Map<string, RecordingResult>();
  private lastRecordingStop: RecordingStopResponse | null = null;
  private disposed = false;

  async initialize(): Promise<void> { this.ensureActive(); this.clearError(); }

  private ensureActive(): void {
    if (this.disposed) throw new Error('服务已释放');
  }

  private transition(state: StateSnapshot['state']): OperationTransition {
    this.ensureActive();
    if (!this.operationId) this.operationId = genId();
    const snapshot: StateSnapshot = {
      ...this.currentState.snapshot,
      operationId: state === 'idle' ? null : this.operationId,
      operationType: state === 'idle' ? null : this.operationType,
      state,
      sequence: ++this.sequence,
      startedAt: state === 'idle' ? null : (this.currentState.snapshot.startedAt ?? new Date().toISOString()),
      elapsedMs: state === 'idle' ? 0 : this.currentState.snapshot.elapsedMs,
      countdownRemainingMs: 0,
    };
    const operationId = this.operationId;
    this.applySnapshot(snapshot);
    if (state === 'idle') { this.operationId = null; this.operationType = null; }
    return { operationId, state, snapshot };
  }

  private start(type: NonNullable<StateSnapshot['operationType']>, state: StateSnapshot['state']): OperationTransition {
    if (this.operationId) throw new ApiError({ code: 'OPERATION_CONFLICT', message: '已有操作正在运行', details: {}, retryable: false, operationId: this.operationId });
    this.operationId = genId(); this.operationType = type;
    this.currentState.recordingActions = type === 'recording' ? [] : this.currentState.recordingActions;
    return this.transition(state);
  }

  private requireOperation(): string {
    if (!this.operationId) throw new ApiError({ code: 'INVALID_STATE_TRANSITION', message: '当前没有活动操作', details: {}, retryable: false, operationId: null });
    return this.operationId;
  }

  private timer(callback: () => void, delay: number): void {
    this.ensureActive();
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, delay);
    this.timers.add(timer);
  }

  async getMousePosition(): Promise<MousePosition> { return clone(this.currentState.mousePos); }
  async startClicker(config: ClickerConfig): Promise<OperationTransition> {
    const result = this.start('clicker', 'running');
    const tick = () => {
      if (!this.operationId || this.operationType !== 'clicker') return;
      if (this.currentState.snapshot.state === 'paused') { this.timer(tick, config.intervalMs); return; }
      this.currentState.snapshot.completedCount += config.clickCount;
      this.currentState.snapshot.elapsedMs += config.intervalMs;
      this.applySnapshot({ ...this.currentState.snapshot, sequence: ++this.sequence });
      if (config.repeatMode === 'count' && this.currentState.snapshot.completedCount >= config.repeatCount * config.clickCount) this.transition('idle');
      else this.timer(tick, config.intervalMs);
    };
    this.timer(tick, config.intervalMs);
    return result;
  }
  async pauseClicker(): Promise<OperationTransition> { return this.pause(); }
  async resumeClicker(): Promise<OperationTransition> { return this.resume(); }
  async stopClicker(): Promise<OperationTransition> { this.requireOperation(); return this.transition('idle'); }
  async startTimedClick(config: TimedClickConfig): Promise<OperationTransition> {
    const result = this.start('timed_click', 'running');
    const tick = () => {
      if (!this.operationId || this.operationType !== 'timed_click') return;
      this.currentState.snapshot.completedCount += config.clickCount;
      this.currentState.snapshot.elapsedMs += config.delayMs;
      this.applySnapshot({ ...this.currentState.snapshot, sequence: ++this.sequence });
      if (config.repeatMode === 'infinite' || this.currentState.snapshot.completedCount < config.repeatCount * config.clickCount) this.timer(tick, config.delayMs);
      else this.transition('idle');
    };
    this.timer(tick, config.delayMs);
    return result;
  }
  async stopTimedClick(): Promise<OperationTransition> { this.requireOperation(); return this.transition('idle'); }
  async startRecording(): Promise<OperationTransition> {
    this.lastRecordingStop = null;
    const result = this.start('recording', 'recording');
    const capture = () => {
      if (!this.operationId || this.operationType !== 'recording') return;
      if (this.currentState.snapshot.state !== 'paused') {
        this.currentState.recordingActions = [...this.currentState.recordingActions, generateRandomAction()];
        this.currentState.snapshot.completedCount = this.currentState.recordingActions.length;
        this.currentState.snapshot.elapsedMs += 400;
        this.applySnapshot({ ...this.currentState.snapshot, sequence: ++this.sequence });
      }
      this.timer(capture, 400);
    };
    this.timer(capture, 400);
    return result;
  }
  private async pause(): Promise<OperationTransition> { this.requireOperation(); this.beforePause = this.currentState.snapshot.state; return this.transition('paused'); }
  private async resume(): Promise<OperationTransition> { this.requireOperation(); return this.transition(this.beforePause === 'paused' ? 'running' : this.beforePause); }
  async pauseRecording(): Promise<OperationTransition> { return this.pause(); }
  async resumeRecording(): Promise<OperationTransition> { return this.resume(); }
  async stopRecording(): Promise<RecordingStopResponse> {
    if (this.lastRecordingStop) return clone(this.lastRecordingStop);
    const operationId = this.requireOperation();
    const actions = clone(this.currentState.recordingActions);
    const durationMs = this.currentState.snapshot.elapsedMs;
    const transition = this.transition('idle');
    const recordingResultId = genId();
    this.recordingResults.set(recordingResultId, { id: recordingResultId, operationId, durationMs, actionCount: actions.length, actions });
    this.currentState.recordingState = 'stopped'; this.currentState.recordingActions = actions; this.currentState.recordingActionCount = actions.length; this.notify();
    const response = { ...transition, recordingResultId };
    this.lastRecordingStop = response;
    return clone(response);
  }
  async discardRecording(): Promise<void> {
    if (this.lastRecordingStop) this.recordingResults.delete(this.lastRecordingStop.recordingResultId);
    this.lastRecordingStop = null;
    this.currentState = {
      ...this.currentState,
      recordingState: 'idle',
      recordingTime: 0,
      recordingActionCount: 0,
      recordingActions: [],
    };
    this.notify();
  }
  async getRecordingResult(id: string): Promise<RecordingResult> {
    const result = this.recordingResults.get(id);
    if (!result) throw new ApiError({ code: 'SCRIPT_NOT_FOUND', message: '录制结果不存在', details: { id }, retryable: false, operationId: null });
    return clone(result);
  }
  async playback(script: Script, options: PlaybackOptions): Promise<OperationTransition> {
    const result = this.start('playback', 'running');
    const actions = script.actions.filter(action => action.enabled);
    let index = 0;
    const total = Math.max(1, actions.length * (options.loopMode === 'count' ? options.times : 1));
    const tick = () => {
      if (!this.operationId || this.operationType !== 'playback' || !actions.length) return;
      if (this.currentState.snapshot.state === 'paused') { this.timer(tick, 100); return; }
      this.currentState.snapshot.currentActionIndex = index % actions.length;
      this.currentState.snapshot.completedCount = Math.floor(index / actions.length);
      this.currentState.snapshot.progress = options.loopMode === 'infinite' ? (index % actions.length) / actions.length : Math.min(1, (index + 1) / total);
      this.applySnapshot({ ...this.currentState.snapshot, sequence: ++this.sequence });
      index += 1;
      if (options.loopMode === 'count' && index >= total) this.transition('idle');
      else this.timer(tick, Math.max(50, actions[index % actions.length].delayBeforeMs / options.speedMultiplier));
    };
    this.timer(tick, 50);
    return result;
  }
  async pausePlayback(): Promise<OperationTransition> { return this.pause(); }
  async resumePlayback(): Promise<OperationTransition> { return this.resume(); }
  async stopPlayback(): Promise<OperationTransition> { this.requireOperation(); return this.transition('idle'); }
  async emergencyStop(): Promise<EmergencyStopResponse> {
    const operationId = this.operationId;
    this.timers.forEach(clearTimeout); this.timers.clear();
    if (this.operationId) this.transition('idle');
    this.currentState.runState = 'emergency'; this.notify();
    this.timer(() => { this.currentState.runState = 'idle'; this.notify(); }, 1000);
    return { operationId, state: 'idle', releasedInputCount: 0, releaseFailures: [] };
  }
  async validateScript(script: Script): Promise<ScriptValidationResponse> { return { valid: true, script: clone(script) }; }
  async saveScript(script: Script): Promise<Script> {
    const now = new Date().toISOString();
    const saved = { ...clone(script), id: script.id || genId(), createdAt: script.createdAt || now, updatedAt: now };
    const index = this.scripts.findIndex(item => item.id === saved.id);
    if (index >= 0) this.scripts[index] = saved; else this.scripts.push(saved);
    return clone(saved);
  }
  async loadScript(id: string): Promise<Script> {
    const script = this.scripts.find(item => item.id === id);
    if (!script) throw new ApiError({ code: 'SCRIPT_NOT_FOUND', message: '脚本不存在', details: { id }, retryable: false, operationId: null });
    return clone(script);
  }
  async listScripts(): Promise<Script[]> { return clone([...this.scripts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); }
  async duplicateScript(id: string): Promise<Script> {
    const source = await this.loadScript(id); const now = new Date().toISOString();
    const copy = { ...source, id: genId(), name: `${source.name} (副本)`, createdAt: now, updatedAt: now };
    this.scripts.push(copy); return clone(copy);
  }
  async deleteScript(id: string): Promise<void> { this.scripts = this.scripts.filter(script => script.id !== id); }
  async getSettings(): Promise<AppSettings> { return clone(this.settings); }
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> { this.settings = { ...this.settings, ...settings }; return clone(this.settings); }
  async getCapabilities(): Promise<Capabilities> { this.ensureActive(); return { platform: 'windows', platformVersion: 'mock', input: { status: 'available', reason: null }, globalHotkey: { status: 'available', reason: null }, display: { status: 'available', reason: null }, displayCount: 1, dpiAwareness: { status: 'available', reason: null } }; }
  async getHotkeyStatus(): Promise<HotkeyStatus> { this.ensureActive(); return { key: this.settings.emergencyHotkey, available: true, registered: true }; }
  async dispose(): Promise<void> { if (this.disposed) return; this.disposed = true; this.timers.forEach(clearTimeout); this.timers.clear(); this.operationId = null; this.operationType = null; this.listeners.clear(); this.errorListeners.clear(); }
}

export class RealAutomationService extends AutomationServiceBase {
  readonly mode = 'real' as const;
  private client: ApiClient | null = null;
  private connection: DesktopConnectionInfo | null = null;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private socketGeneration = 0;
  private socketReady = false;
  private connectPromise: Promise<void> | null = null;
  private alignPromise: Promise<void> | null = null;
  private disposed = false;
  private initializePromise: Promise<void> | null = null;
  private lastSequence = -1;
  private settings = { ...DEFAULT_SETTINGS, serviceMode: 'real' as const };
  private capabilities: Capabilities | null = null;
  private lastRecordingStop: RecordingStopResponse | null = null;
  private mousePositionTimer: ReturnType<typeof setInterval> | null = null;
  private stateAlignmentTimer: ReturnType<typeof setInterval> | null = null;
  private mousePositionPending = false;

  private api(): ApiClient { if (!this.client) throw new Error('服务尚未初始化'); return this.client; }
  private async call<T>(request: () => Promise<T>): Promise<T> { try { const value = await request(); this.clearError(); return value; } catch (error) { return this.report(error); } }

  async initialize(): Promise<void> {
    if (this.initializePromise) return this.initializePromise;
    const pending = this.initializeOnce();
    this.initializePromise = pending;
    try {
      await pending;
    } catch (error) {
      if (this.initializePromise === pending) this.initializePromise = null;
      throw error;
    }
  }

  private async initializeOnce(): Promise<void> {
    if (this.disposed) throw new Error('服务已释放');
    if (!window.desktop) return this.report(new ApiError({ code: 'CONNECTION_ERROR', message: '桌面连接桥不可用', details: {}, retryable: false, operationId: null }));
    try {
      this.connection = await window.desktop.getConnectionInfo();
      const baseUrl = `http://${this.connection.host}:${this.connection.port}`;
      this.client = new ApiClient(baseUrl, this.connection.token);
      this.capabilities = await this.api().get<Capabilities>('/api/v1/capabilities');
      await this.alignState();
      await this.refreshMousePosition();
      this.startMousePositionPolling();
      this.startStateAlignmentPolling();
      void this.connectEvents().catch(() => undefined);
      this.clearError();
    } catch (error) { this.report(error); }
  }

  private async alignState(): Promise<void> {
    if (this.alignPromise) return this.alignPromise;
    const pending = (async () => {
      const snapshot = await this.api().get<StateSnapshot>('/api/v1/state');
      this.acceptSnapshot(snapshot);
    })();
    this.alignPromise = pending;
    try {
      await pending;
    } finally {
      if (this.alignPromise === pending) this.alignPromise = null;
    }
  }

  private acceptSnapshot(snapshot: StateSnapshot): boolean {
    const sequence = snapshot.sequence ?? 0;
    if (sequence <= this.lastSequence) return false;
    this.lastSequence = sequence;
    this.applySnapshot(snapshot);
    return true;
  }

  private connectEvents(): Promise<void> {
    if (this.disposed || !this.connection) return Promise.reject(new Error('服务已释放'));
    if (this.socket?.readyState === WebSocket.OPEN && this.socketReady) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
    }
    const generation = ++this.socketGeneration;
    const { host, port, token } = this.connection;
    const socket = new WebSocket(`ws://${host}:${port}/api/v1/events?token=${encodeURIComponent(token)}`);
    this.socket = socket;
    this.socketReady = false;
    const pending = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled || generation !== this.socketGeneration) return;
        settled = true;
        socket.close();
        reject(new Error('状态通道连接超时'));
      }, 5000);
      const settleReady = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.socketReady = true;
        this.reconnectAttempt = 0;
        resolve();
      };
      const settleError = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error('状态通道连接已断开'));
      };
      socket.onmessage = event => {
        if (generation !== this.socketGeneration) return;
        try {
          const envelope = JSON.parse(String(event.data)) as EventEnvelope;
          if (!this.socketReady && envelope.type !== 'engine.state_snapshot') return;
          this.handleEvent(envelope, !this.socketReady);
          if (envelope.type === 'engine.state_snapshot') settleReady();
        } catch (error) {
          this.currentError = { code: 'ENGINE_INTERNAL_ERROR', message: error instanceof Error ? error.message : '事件解析失败', details: {}, retryable: true, operationId: this.currentState.snapshot.operationId };
          this.errorListeners.forEach(listener => listener(this.currentError));
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (generation !== this.socketGeneration) return;
        this.socketReady = false;
        settleError();
        if (!this.disposed) {
          void this.alignState().catch(() => undefined);
          this.scheduleReconnect();
        }
      };
    });
    this.connectPromise = pending;
    void pending.finally(() => {
      if (this.connectPromise === pending) this.connectPromise = null;
    }).catch(() => undefined);
    return pending;
  }

  private handleEvent(envelope: EventEnvelope, initialSnapshot = false): void {
    if (!initialSnapshot && envelope.sequence <= this.lastSequence) return;
    const activeOperationId = this.currentState.snapshot.operationId;
    const activeOperation = activeState(this.currentState.snapshot.state);
    if (activeOperation && activeOperationId && envelope.operationId && envelope.operationId !== activeOperationId) return;
    if (envelope.type === 'engine.state_snapshot' || envelope.type === 'operation.state_changed' || envelope.type === 'operation.progress') {
      const raw = envelope.payload as StateSnapshot;
      this.acceptSnapshot({ ...raw, sequence: Math.max(raw.sequence ?? 0, envelope.sequence) });
      return;
    }
    if (envelope.sequence <= this.lastSequence) return;
    this.lastSequence = envelope.sequence;
    if (envelope.type === 'recording.action_captured') {
      const payload = envelope.payload as RecordingActionCapturedPayload;
      this.currentState.recordingActions = [...this.currentState.recordingActions, payload.action];
      this.currentState.recordingActionCount = Math.max(
        payload.actionCount,
        this.currentState.recordingActions.length,
        this.currentState.recordingActionCount,
      );
      if (this.currentState.snapshot.operationType === 'recording') {
        this.currentState.snapshot = {
          ...this.currentState.snapshot,
          completedCount: Math.max(this.currentState.snapshot.completedCount, this.currentState.recordingActionCount),
          sequence: Math.max(this.currentState.snapshot.sequence, envelope.sequence),
        };
      }
      this.notify();
    } else if (envelope.type === 'recording.snapshot') {
      const result = envelope.payload as RecordingResult;
      this.currentState.recordingActions = result.actions;
      this.currentState.recordingActionCount = Math.max(result.actionCount, result.actions.length);
      this.currentState.recordingTime = result.durationMs;
      this.notify();
    } else if (envelope.type === 'error.raised') {
      const payload = envelope.payload as Partial<ErrorDetail>;
      this.currentError = { code: payload.code ?? 'ENGINE_INTERNAL_ERROR', message: payload.message ?? '自动化服务错误', details: payload.details ?? {}, retryable: false, operationId: envelope.operationId };
      this.errorListeners.forEach(listener => listener(this.currentError));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(30000, 500 * 2 ** this.reconnectAttempt++);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.disposed) return;
      try {
        await this.alignState();
        await this.connectEvents();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private applyTransition(transition: OperationTransition): OperationTransition {
    this.acceptSnapshot(transition.snapshot);
    return transition;
  }

  private async applyCommandTransition(
    request: () => Promise<OperationTransition>,
  ): Promise<OperationTransition> {
    const transition = await request();
    this.applyTransition(transition);
    await this.alignState();
    return transition;
  }
  private operationPath(action: 'pause' | 'resume' | 'stop'): string {
    const id = this.currentState.snapshot.operationId;
    if (!id) throw new ApiError({ code: 'INVALID_STATE_TRANSITION', message: '当前没有活动操作', details: {}, retryable: false, operationId: null });
    return `/api/v1/operations/${id}/${action}`;
  }

  private async refreshMousePosition(): Promise<MousePosition> {
    const mousePos = await this.api().get<MousePosition>('/api/v1/mouse-position');
    this.currentState = { ...this.currentState, mousePos };
    this.notify();
    return mousePos;
  }

  private startMousePositionPolling(): void {
    if (this.mousePositionTimer) clearInterval(this.mousePositionTimer);
    this.mousePositionTimer = setInterval(() => {
      if (this.disposed || this.mousePositionPending) return;
      this.mousePositionPending = true;
      void this.refreshMousePosition()
        .catch(() => undefined)
        .finally(() => { this.mousePositionPending = false; });
    }, 250);
  }

  private startStateAlignmentPolling(): void {
    if (this.stateAlignmentTimer) clearInterval(this.stateAlignmentTimer);
    this.stateAlignmentTimer = setInterval(() => {
      if (this.disposed) return;
      if (this.socketReady && !activeState(this.currentState.snapshot.state)) return;
      void this.alignState().catch(() => undefined);
    }, 500);
  }

  async getMousePosition(): Promise<MousePosition> {
    return this.call(() => this.refreshMousePosition());
  }
  async startClicker(config: ClickerConfig): Promise<OperationTransition> { return this.call(() => this.applyCommandTransition(() => this.api().post('/api/v1/clicker/start', config))); }
  async pauseClicker(): Promise<OperationTransition> { return this.pauseOperation(); }
  async resumeClicker(): Promise<OperationTransition> { return this.resumeOperation(); }
  async stopClicker(): Promise<OperationTransition> { return this.stopOperation(); }
  async startTimedClick(config: TimedClickConfig): Promise<OperationTransition> { return this.call(() => this.applyCommandTransition(() => this.api().post('/api/v1/timed-click/start', config))); }
  async stopTimedClick(): Promise<OperationTransition> { return this.stopOperation(); }
  async startRecording(config: RecordingConfig = { recordMouseMove: true, minMoveSampleMs: 10, moveErrorPx: 2, recordWheel: true, recordMouse: true, recordKeyboard: true }): Promise<OperationTransition> {
    this.lastRecordingStop = null;
    this.currentState.recordingActions = [];
    this.currentState.recordingActionCount = 0;
    return this.call(() => this.applyCommandTransition(() => this.api().post('/api/v1/recordings/start', config)));
  }
  async pauseRecording(): Promise<OperationTransition> { return this.pauseOperation(); }
  async resumeRecording(): Promise<OperationTransition> { return this.resumeOperation(); }
  async stopRecording(): Promise<RecordingStopResponse> {
    if (this.lastRecordingStop) return clone(this.lastRecordingStop);
    return this.call(async () => {
      const result = await this.api().post<RecordingStopResponse>(this.operationPath('stop'));
      this.lastRecordingStop = result;
      const recording = await this.api().get<RecordingResult>(`/api/v1/recordings/${result.recordingResultId}`);
      this.applyTransition(result);
      await this.alignState();
      this.currentState.recordingState = 'stopped';
      this.currentState.recordingActions = recording.actions;
      this.currentState.recordingActionCount = recording.actionCount;
      this.currentState.recordingTime = recording.durationMs;
      this.notify();
      return result;
    });
  }
  async discardRecording(): Promise<void> {
    this.lastRecordingStop = null;
    this.currentState = {
      ...this.currentState,
      recordingState: 'idle',
      recordingTime: 0,
      recordingActionCount: 0,
      recordingActions: [],
    };
    this.notify();
  }
  async getRecordingResult(id: string): Promise<RecordingResult> { return this.call(() => this.api().get(`/api/v1/recordings/${id}`)); }
  async playback(script: Script, options: PlaybackOptions): Promise<OperationTransition> {
    const request: PlaybackRequest = {
      scriptId: null,
      inlineScript: script.id
        ? script
        : { ...script, id: crypto.randomUUID(), createdAt: script.createdAt || new Date().toISOString(), updatedAt: script.updatedAt || new Date().toISOString() },
      speedMultiplier: options.speedMultiplier,
      loopMode: options.loopMode === 'duration' ? 'infinite' : options.loopMode,
      loopCount: options.loopMode === 'count' ? options.times : 1,
      loopDurationMs: options.loopMode === 'duration' ? (options.loopDurationMs ?? null) : null,
      countdownMs: options.countdownMs ?? resolveCountdownMs(this.settings),
    };
    return this.call(() => this.applyCommandTransition(() => this.api().post('/api/v1/playback/start', request)));
  }
  async pausePlayback(): Promise<OperationTransition> { return this.pauseOperation(); }
  async resumePlayback(): Promise<OperationTransition> { return this.resumeOperation(); }
  async stopPlayback(): Promise<OperationTransition> { return this.stopOperation(); }
  private async pauseOperation(): Promise<OperationTransition> { return this.call(() => this.applyCommandTransition(() => this.api().post(this.operationPath('pause')))); }
  private async resumeOperation(): Promise<OperationTransition> { return this.call(() => this.applyCommandTransition(() => this.api().post(this.operationPath('resume')))); }
  private async stopOperation(): Promise<OperationTransition> {
    return this.call(async () => {
      const id = this.currentState.snapshot.operationId;
      if (!id || this.currentState.snapshot.state === 'idle') {
        const snapshot = { ...this.currentState.snapshot, state: 'idle' as const, operationId: null, operationType: null };
        this.applySnapshot(snapshot);
        return { operationId: id ?? '', state: 'idle' as const, snapshot };
      }
      try {
        const transition = await this.api().post<OperationTransition>(this.operationPath('stop'));
        this.applyTransition(transition);
        await this.alignState();
        return transition;
      } catch (error) {
        if (error instanceof ApiError && error.detail.code === 'OPERATION_CONFLICT') {
          await this.alignState();
          const snapshot = this.currentState.snapshot;
          return { operationId: id, state: snapshot.state, snapshot };
        }
        throw error;
      }
    });
  }
  async emergencyStop(): Promise<EmergencyStopResponse> {
    return this.call(async () => {
      const result = await this.api().post<EmergencyStopResponse>('/api/v1/emergency-stop');
      await this.alignState();
      this.currentState = { ...this.currentState, runState: 'emergency' };
      this.notify();
      window.setTimeout(() => {
        if (this.disposed || this.currentState.runState !== 'emergency') return;
        this.currentState = { ...this.currentState, runState: 'idle' };
        this.notify();
      }, 1000);
      return result;
    });
  }
  async validateScript(script: Script): Promise<ScriptValidationResponse> { return this.call(() => this.api().post('/api/v1/scripts/validate', { script })); }
  async saveScript(script: Script): Promise<Script> {
    return this.call(() => script.id ? this.api().put(`/api/v1/scripts/${script.id}`, script) : this.api().post<Script>('/api/v1/scripts', { name: script.name, description: script.description, settings: script.settings, actions: script.actions } satisfies ScriptCreate));
  }
  async loadScript(id: string): Promise<Script> { return this.call(() => this.api().get(`/api/v1/scripts/${id}`)); }
  async listScripts(): Promise<Script[]> { return this.call(() => this.api().get('/api/v1/scripts')); }
  async duplicateScript(id: string): Promise<Script> { return this.call(() => this.api().post(`/api/v1/scripts/${id}/duplicate`)); }
  async deleteScript(id: string): Promise<void> { return this.call(() => this.api().delete(`/api/v1/scripts/${id}`)); }
  private formatHotkeyFromBackend(value: string): string {
    if (!value.trim()) return '';
    return value
      .split('+')
      .map(part => {
        const lower = part.trim().toLowerCase();
        if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
        if (lower === 'alt') return 'Alt';
        if (lower === 'shift') return 'Shift';
        if (lower === 'win' || lower === 'cmd' || lower === 'meta') return 'Win';
        if (lower === 'esc' || lower === 'escape') return 'Esc';
        if (lower === 'space') return 'Space';
        if (lower === 'page_up' || lower === 'pageup') return 'PageUp';
        if (lower === 'page_down' || lower === 'pagedown') return 'PageDown';
        if (lower === 'up' || lower === 'arrowup') return 'Up';
        if (lower === 'down' || lower === 'arrowdown') return 'Down';
        if (lower === 'left' || lower === 'arrowleft') return 'Left';
        if (lower === 'right' || lower === 'arrowright') return 'Right';
        if (/^f\d+$/.test(lower)) return lower.toUpperCase();
        return lower.length === 1 ? lower.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('+');
  }

  private mergeBackendSettings(backend: BackendSettings): AppSettings {
    this.settings = {
      ...this.settings,
      emergencyHotkey: this.formatHotkeyFromBackend(backend.emergencyStopHotkey),
      recordStartHotkey: this.formatHotkeyFromBackend(backend.recordStartHotkey ?? ''),
      recordStopHotkey: this.formatHotkeyFromBackend(backend.recordStopHotkey ?? ''),
      playbackStartHotkey: this.formatHotkeyFromBackend(backend.playbackStartHotkey ?? ''),
      playbackStopHotkey: this.formatHotkeyFromBackend(backend.playbackStopHotkey ?? ''),
      countdownEnabled: backend.defaultCountdownMs > 0,
      countdownSeconds: backend.defaultCountdownMs / 1000,
      defaultSpeedMultiplier: backend.defaultSpeedMultiplier,
      defaultLoopTimes: backend.defaultLoopCount,
      serviceMode: 'real',
    };
    return clone(this.settings);
  }
  private toBackendSettings(settings: AppSettings): BackendSettings {
    return {
      defaultSpeedMultiplier: settings.defaultSpeedMultiplier,
      defaultLoopMode: 'count',
      defaultLoopCount: settings.defaultLoopTimes,
      defaultCountdownMs: settings.countdownEnabled ? Math.round(settings.countdownSeconds * 1000) : 0,
      emergencyStopHotkey: hotkeyToBackend(settings.emergencyHotkey),
      recordStartHotkey: hotkeyToBackend(settings.recordStartHotkey),
      recordStopHotkey: hotkeyToBackend(settings.recordStopHotkey),
      playbackStartHotkey: hotkeyToBackend(settings.playbackStartHotkey),
      playbackStopHotkey: hotkeyToBackend(settings.playbackStopHotkey),
    };
  }
  async getSettings(): Promise<AppSettings> {
    const backend = await this.call(() => this.api().get<BackendSettings>('/api/v1/settings'));
    return this.mergeBackendSettings(backend);
  }
  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...this.settings, ...updates, serviceMode: 'real' as const };
    const hotkeyFields = ['emergencyHotkey', 'recordStartHotkey', 'recordStopHotkey', 'playbackStartHotkey', 'playbackStopHotkey'] as const;
    for (const field of hotkeyFields) {
      if (!(field in updates)) continue;
      const value = updates[field] ?? '';
      if (!value.trim()) {
        if (field === 'emergencyHotkey') {
          throw new ApiError({
            code: 'VALIDATION_ERROR',
            message: '急停热键不能为空',
            details: {},
            retryable: false,
            operationId: null,
          });
        }
        next[field] = '';
        continue;
      }
      const backendHotkey = hotkeyToBackend(value);
      const validation = await this.call(() => this.api().post<HotkeyValidationResponse>('/api/v1/hotkeys/validate', { hotkey: backendHotkey }));
      next[field] = this.formatHotkeyFromBackend(validation.normalizedHotkey);
    }
    const backend = await this.call(() => this.api().put<BackendSettings>('/api/v1/settings', this.toBackendSettings(next)));
    this.settings = { ...next, serviceMode: 'real' };
    return this.mergeBackendSettings(backend);
  }
  async getCapabilities(): Promise<Capabilities> { return this.capabilities ? clone(this.capabilities) : this.call(() => this.api().get('/api/v1/capabilities')); }
  async getHotkeyStatus(): Promise<HotkeyStatus> {
    const validation = await this.call(() => this.api().post<HotkeyValidationResponse>('/api/v1/hotkeys/validate', {
      hotkey: hotkeyToBackend(this.settings.emergencyHotkey || 'f12'),
    }));
    return {
      key: this.formatHotkeyFromBackend(validation.normalizedHotkey),
      available: validation.availability === 'available',
      registered: true,
      reason: validation.reason,
    };
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    this.socketGeneration += 1;
    this.socketReady = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.mousePositionTimer) clearInterval(this.mousePositionTimer);
    this.mousePositionTimer = null;
    if (this.stateAlignmentTimer) clearInterval(this.stateAlignmentTimer);
    this.stateAlignmentTimer = null;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
    }
    this.socket = null;
    this.listeners.clear();
    this.errorListeners.clear();
  }
}

export function createService(mode: ServiceMode): IAutomationService {
  const resolved = resolveServiceMode(mode);
  return resolved === 'real' ? new RealAutomationService() : new MockAutomationService();
}

export { genId };
