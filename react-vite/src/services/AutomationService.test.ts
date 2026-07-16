import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Capabilities,
  ClickerConfig,
  EventEnvelope,
  OperationTransition,
  StateSnapshot,
} from '../types';
import { RealAutomationService } from './AutomationService';

const capabilities: Capabilities = {
  platform: 'windows',
  platformVersion: 'test',
  input: { status: 'available', reason: null },
  globalHotkey: { status: 'available', reason: null },
  display: { status: 'available', reason: null },
  displayCount: 1,
  dpiAwareness: { status: 'available', reason: null },
};

const clickerConfig: ClickerConfig = {
  button: 'left',
  clickCount: 1,
  intervalMs: 100,
  repeatMode: 'count',
  repeatCount: 1,
  positionMode: 'current',
  x: null,
  y: null,
  countdownMs: 3000,
};

function snapshot(
  sequence: number,
  state: StateSnapshot['state'],
  operationId: string | null = null,
  operationType: StateSnapshot['operationType'] = null,
  countdownRemainingMs = 0,
): StateSnapshot {
  return {
    operationId,
    operationType,
    state,
    sequence,
    startedAt: operationId ? '2026-07-16T00:00:00Z' : null,
    elapsedMs: 0,
    progress: null,
    currentActionIndex: null,
    completedCount: 0,
    countdownRemainingMs,
    error: null,
  };
}

function event(payload: StateSnapshot): EventEnvelope<StateSnapshot> {
  return {
    protocolVersion: 1,
    eventId: crypto.randomUUID(),
    sequence: payload.sequence,
    timestamp: '2026-07-16T00:00:00Z',
    operationId: payload.operationId,
    type: 'engine.state_snapshot',
    payload,
  };
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  emit(envelope: EventEnvelope): void {
    this.readyState = MockWebSocket.OPEN;
    this.onmessage?.({ data: JSON.stringify(envelope) } as MessageEvent);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }
}

describe('RealAutomationService state synchronization', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubGlobal('window', {
      desktop: {
        getConnectionInfo: vi.fn().mockResolvedValue({
          host: '127.0.0.1',
          port: 43123,
          token: 'test-token',
        }),
      },
      setTimeout,
      clearTimeout,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('waits for the first websocket snapshot before initialization completes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/v1/capabilities') return response(capabilities);
      if (path === '/api/v1/state') return response(snapshot(1, 'idle'));
      if (path === '/api/v1/mouse-position') return response({ x: 10, y: 20 });
      throw new Error(`Unexpected request: ${path}`);
    }));
    const service = new RealAutomationService();
    let initialized = false;

    const initialization = service.initialize().then(() => { initialized = true; });
    await vi.waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    expect(initialized).toBe(false);

    MockWebSocket.instances[0].emit(event(snapshot(1, 'idle')));
    await initialization;

    expect(initialized).toBe(true);
    await service.dispose();
  });

  it('does not let a stale start response overwrite newer websocket state', async () => {
    const startResponse = deferred<Response>();
    let stateReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/v1/capabilities') return response(capabilities);
      if (path === '/api/v1/state') {
        stateReads += 1;
        return response(stateReads === 1 ? snapshot(1, 'idle') : snapshot(4, 'idle'));
      }
      if (path === '/api/v1/mouse-position') return response({ x: 10, y: 20 });
      if (path === '/api/v1/clicker/start' && init?.method === 'POST') {
        return startResponse.promise;
      }
      throw new Error(`Unexpected request: ${path}`);
    }));
    const service = new RealAutomationService();
    const initialization = service.initialize();
    await vi.waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const socket = MockWebSocket.instances[0];
    socket.emit(event(snapshot(1, 'idle')));
    await initialization;

    const started = service.startClicker(clickerConfig);
    socket.emit(event(snapshot(3, 'running', 'operation-1', 'clicker')));
    socket.emit(event(snapshot(4, 'idle')));
    const stale = snapshot(2, 'countdown', 'operation-1', 'clicker', 3000);
    const transition: OperationTransition = {
      operationId: 'operation-1',
      state: 'countdown',
      snapshot: stale,
    };
    startResponse.resolve(response(transition));
    await started;

    const state = await service.getState();
    expect(state.snapshot.sequence).toBe(4);
    expect(state.snapshot.state).toBe('idle');
    expect(state.countdownRemaining).toBe(0);
    await service.dispose();
  });
});