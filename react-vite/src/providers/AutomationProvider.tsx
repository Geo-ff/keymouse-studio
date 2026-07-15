import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, Capabilities, ErrorDetail, HotkeyStatus, IAutomationService, Script, ServiceMode, ServiceState } from '../types';
import { DEFAULT_SETTINGS, INITIAL_SNAPSHOT } from '../types';
import { createService } from '../services/AutomationService';

interface AutomationContextValue {
  service: IAutomationService;
  state: ServiceState;
  settings: AppSettings;
  capabilities: Capabilities | null;
  hotkey: HotkeyStatus | null;
  scripts: Script[];
  error: ErrorDetail | null;
  ready: boolean;
  updateSettings(updates: Partial<AppSettings>): Promise<void>;
  refreshScripts(): Promise<void>;
  clearError(): void;
}

const fallbackState: ServiceState = {
  snapshot: INITIAL_SNAPSHOT, runState: 'idle', recordingState: 'idle', clickerCount: 0, clickerRunningTime: 0,
  nextClickCountdown: 0, recordingTime: 0, recordingActionCount: 0, recordingActions: [], playbackProgress: 0,
  playbackCurrentIndex: -1, playbackCurrentLoop: 0, playbackLoopRemainingMs: 0, mousePos: { x: 960, y: 540 },
  keyboardListening: false, countdownRemaining: 0, timedClickCount: 0, timedClickCountdown: 0,
};

const AutomationContext = createContext<AutomationContextValue | null>(null);

export function AutomationProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [service, setService] = useState<IAutomationService>(() => createService(DEFAULT_SETTINGS.serviceMode));
  const [state, setState] = useState<ServiceState>(fallbackState);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [hotkey, setHotkey] = useState<HotkeyStatus | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [error, setError] = useState<ErrorDetail | null>(null);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const pendingDisposals = useRef(new Map<IAutomationService, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pendingDisposal = pendingDisposals.current.get(service);
    if (pendingDisposal) {
      clearTimeout(pendingDisposal);
      pendingDisposals.current.delete(service);
    }
    const currentGeneration = ++generation.current;
    let active = true;
    setReady(false);
    setError(null);
    const unsubscribeState = service.onStateChange(next => { if (active) setState(next); });
    const unsubscribeError = service.onError(next => { if (active) setError(next); });
    void (async () => {
      try {
        await service.initialize();
        const [nextSettings, nextCapabilities, nextHotkey, nextScripts] = await Promise.all([
          service.getSettings(), service.getCapabilities(), service.getHotkeyStatus(), service.listScripts(),
        ]);
        if (!active || currentGeneration !== generation.current) return;
        setSettings(previous => ({ ...previous, ...nextSettings, serviceMode: service.mode }));
        setCapabilities(nextCapabilities); setHotkey(nextHotkey); setScripts(nextScripts); setReady(true);
      } catch (cause) {
        if (!active || currentGeneration !== generation.current) return;
        setReady(false);
        setCapabilities(null);
        setHotkey(null);
        setScripts([]);
        // Real 初始化失败不得静默回退 Mock；onError 可能已推送，这里兜底展示
        if (service.mode === 'real') {
          setError(previous => previous ?? {
            code: 'CONNECTION_ERROR',
            message: cause instanceof Error ? cause.message : '真实服务初始化失败',
            details: { mode: 'real' },
            retryable: true,
            operationId: null,
          });
        }
      }
    })();
    return () => {
      active = false;
      unsubscribeState();
      unsubscribeError();
      const timer = setTimeout(() => {
        pendingDisposals.current.delete(service);
        void service.dispose();
      }, 0);
      pendingDisposals.current.set(service, timer);
    };
  }, [service]);

  const refreshScripts = useCallback(async () => {
    try { setScripts(await service.listScripts()); } catch { }
  }, [service]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const requestedMode = updates.serviceMode;
    if (requestedMode && requestedMode !== service.mode) {
      const nextSettings = { ...settings, ...updates, serviceMode: requestedMode };
      setSettings(nextSettings);
      setError(null);
      setReady(false);
      setService(createService(requestedMode));
      return;
    }
    try {
      const next = await service.updateSettings(updates);
      setSettings(previous => ({ ...previous, ...next, serviceMode: service.mode }));
      if (updates.emergencyHotkey) setHotkey(await service.getHotkeyStatus());
    } catch { }
  }, [service, settings]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AutomationContextValue>(() => ({
    service, state, settings, capabilities, hotkey, scripts, error, ready,
    updateSettings, refreshScripts, clearError,
  }), [service, state, settings, capabilities, hotkey, scripts, error, ready, updateSettings, refreshScripts, clearError]);

  return <AutomationContext.Provider value={value}>{children}</AutomationContext.Provider>;
}

export function useAutomation(): AutomationContextValue {
  const context = useContext(AutomationContext);
  if (!context) throw new Error('useAutomation 必须在 AutomationProvider 内使用');
  return context;
}