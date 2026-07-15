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
    nextClickCountdown: 0,
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
    const next = { ...createState(snapshot), recordingActions: actions, mousePos };
    if (snapshot.state === 'idle' && previous.recordingState === 'stopped') {
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
  private disposed = false;
  private initializePromise: Promise<void> | null = null;
  private lastSequence = -1;
  private settings = { ...DEFAULT_SETTINGS, serviceMode: 'real' as const };
  private capabilities: Capabilities | null = null;
  private lastRecordingStop: RecordingStopResponse | null = null;
  private mousePositionTimer: ReturnType<typeof setInterval> | null = null;
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
      this.connectEvents();
      this.clearError();
    } catch (error) { this.report(error); }
  }

  private async alignState(): Promise<void> {
    const snapshot = await this.api().get<StateSnapshot>('/api/v1/state');
    if (snapshot.sequence >= this.lastSequence) { this.lastSequence = snapshot.sequence; this.applySnapshot(snapshot); }
  }

  private connectEvents(): void {
    if (this.disposed || !this.connection) return;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
    }
    const { host, port, token } = this.connection;
    const socket = new WebSocket(`ws://${host}:${port}/api/v1/events?token=${encodeURIComponent(token)}`);
    this.socket = socket;
    let receivedFirstSnapshot = false;
    socket.onmessage = event => {
      try {
        const envelope = JSON.parse(String(event.data)) as EventEnvelope;
        if (!receivedFirstSnapshot) {
          if (envelope.type !== 'engine.state_snapshot') return;
          receivedFirstSnapshot = true;
        }
        this.handleEvent(envelope);
      } catch (error) {
        this.currentError = { code: 'ENGINE_INTERNAL_ERROR', message: error instanceof Error ? error.message : '事件解析失败', details: {}, retryable: true, operationId: this.currentState.snapshot.operationId };
        this.errorListeners.forEach(listener => listener(this.currentError));
      }
    };
    socket.onopen = () => { this.reconnectAttempt = 0; };
    socket.onerror = () => socket.close();
    socket.onclose = () => { if (!this.disposed) this.scheduleReconnect(); };
  }

  private handleEvent(envelope: EventEnvelope): void {
    if (envelope.sequence <= this.lastSequence) return;
    const activeOperationId = this.currentState.snapshot.operationId;
    const activeOperation = activeState(this.currentState.snapshot.state);
    if (activeOperation && activeOperationId && envelope.operationId && envelope.operationId !== activeOperationId) return;
    this.lastSequence = envelope.sequence;
    if (envelope.type === 'engine.state_snapshot' || envelope.type === 'operation.state_changed' || envelope.type === 'operation.progress') {
      const snapshot = envelope.payload as StateSnapshot;
      if (snapshot.sequence < this.currentState.snapshot.sequence) return;
      this.applySnapshot(snapshot);
    } else if (envelope.type === 'recording.action_captured') {
      const payload = envelope.payload as RecordingActionCapturedPayload;
      this.currentState.recordingActions = [...this.currentState.recordingActions, payload.action];
      this.currentState.recordingActionCount = payload.actionCount;
      this.notify();
    } else if (envelope.type === 'recording.snapshot') {
      const result = envelope.payload as RecordingResult;
      this.currentState.recordingActions = result.actions;
      this.currentState.recordingActionCount = result.actionCount;
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
      try { await this.alignState(); this.connectEvents(); } catch (error) {
        const detail = error instanceof ApiError ? error.detail : { code: 'CONNECTION_ERROR' as const, message: error instanceof Error ? error.message : '重连失败', details: {}, retryable: true, operationId: null };
        this.currentError = detail; this.errorListeners.forEach(listener => listener(detail)); this.scheduleReconnect();
      }
    }, delay);
  }

  private applyTransition(transition: OperationTransition): OperationTransition { this.applySnapshot(transition.snapshot); return transition; }
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

  async getMousePosition(): Promise<MousePosition> {
    return this.call(() => this.refreshMousePosition());
  }
  async startClicker(config: ClickerConfig): Promise<OperationTransition> { return this.call(async () => this.applyTransition(await this.api().post('/api/v1/clicker/start', config))); }
  async pauseClicker(): Promise<OperationTransition> { return this.pauseOperation(); }
  async resumeClicker(): Promise<OperationTransition> { return this.resumeOperation(); }
  async stopClicker(): Promise<OperationTransition> { return this.stopOperation(); }
  async startTimedClick(config: TimedClickConfig): Promise<OperationTransition> { return this.call(async () => this.applyTransition(await this.api().post('/api/v1/timed-click/start', config))); }
  async stopTimedClick(): Promise<OperationTransition> { return this.stopOperation(); }
  async startRecording(config: RecordingConfig = { recordMouseMove: true, minMoveSampleMs: 10, moveErrorPx: 2, recordWheel: true, recordMouse: true, recordKeyboard: true }): Promise<OperationTransition> {
    this.lastRecordingStop = null;
    this.currentState.recordingActions = [];
    this.currentState.recordingActionCount = 0;
    return this.call(async () => this.applyTransition(await this.api().post('/api/v1/recordings/start', config)));
  }
  async pauseRecording(): Promise<OperationTransition> { return this.pauseOperation(); }
  async resumeRecording(): Promise<OperationTransition> { return this.resumeOperation(); }
  async stopRecording(): Promise<RecordingStopResponse> {
    if (this.lastRecordingStop) return clone(this.lastRecordingStop);
    return this.call(async () => {
      const result = await this.api().post<RecordingStopResponse>(this.operationPath('stop'));
      this.lastRecordingStop = result;
      const recording = await this.api().get<RecordingResult>(`/api/v1/recordings/${result.recordingResultId}`);
      this.applySnapshot(result.snapshot);
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
      countdownMs: script.settings.countdownMs,
    };
    return this.call(async () => this.applyTransition(await this.api().post('/api/v1/playback/start', request)));
  }
  async pausePlayback(): Promise<OperationTransition> { return this.pauseOperation(); }
  async resumePlayback(): Promise<OperationTransition> { return this.resumeOperation(); }
  async stopPlayback(): Promise<OperationTransition> { return this.stopOperation(); }
  private async pauseOperation(): Promise<OperationTransition> { return this.call(async () => this.applyTransition(await this.api().post(this.operationPath('pause')))); }
  private async resumeOperation(): Promise<OperationTransition> { return this.call(async () => this.applyTransition(await this.api().post(this.operationPath('resume')))); }
  private async stopOperation(): Promise<OperationTransition> { return this.call(async () => this.applyTransition(await this.api().post(this.operationPath('stop')))); }
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
  private mergeBackendSettings(backend: BackendSettings): AppSettings {
    this.settings = {
      ...this.settings,
      emergencyHotkey: backend.emergencyStopHotkey.toUpperCase(),
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
      emergencyStopHotkey: settings.emergencyHotkey,
    };
  }
  async getSettings(): Promise<AppSettings> {
    const backend = await this.call(() => this.api().get<BackendSettings>('/api/v1/settings'));
    return this.mergeBackendSettings(backend);
  }
  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...this.settings, ...updates, serviceMode: 'real' as const };
    if (updates.emergencyHotkey) {
      const validation = await this.call(() => this.api().post<HotkeyValidationResponse>('/api/v1/hotkeys/validate', { hotkey: updates.emergencyHotkey }));
      next.emergencyHotkey = validation.normalizedHotkey.toUpperCase();
    }
    const backend = await this.call(() => this.api().put<BackendSettings>('/api/v1/settings', this.toBackendSettings(next)));
    this.settings = { ...next, serviceMode: 'real' };
    return this.mergeBackendSettings(backend);
  }
  async getCapabilities(): Promise<Capabilities> { return this.capabilities ? clone(this.capabilities) : this.call(() => this.api().get('/api/v1/capabilities')); }
  async getHotkeyStatus(): Promise<HotkeyStatus> {
    const validation = await this.call(() => this.api().post<HotkeyValidationResponse>('/api/v1/hotkeys/validate', { hotkey: this.settings.emergencyHotkey }));
    return { key: validation.normalizedHotkey.toUpperCase(), available: validation.availability === 'available', registered: true, reason: validation.reason };
  }
  async dispose(): Promise<void> { this.disposed = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = null; if (this.mousePositionTimer) clearInterval(this.mousePositionTimer); this.mousePositionTimer = null; if (this.socket) { this.socket.onclose = null; this.socket.close(); } this.socket = null; this.listeners.clear(); this.errorListeners.clear(); }
}

export function createService(mode: ServiceMode): IAutomationService {
  return mode === 'real' ? new RealAutomationService() : new MockAutomationService();
}

export { genId };
