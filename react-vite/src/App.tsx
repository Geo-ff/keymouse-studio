/* =========================================================================
   App — 根组件
   状态管理（主题、当前页面、当前脚本）、页面路由、主题切换
   ========================================================================= */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Layout, type PageId } from './components/Layout';
import { AboutDialog } from './components/AboutDialog';
import { UpdateAnnouncementDialog, type UpdateAnnouncementMode } from './components/UpdateAnnouncementDialog';
import { UpdateProgressBar } from './components/UpdateProgressBar';
import { AlertDialog } from './components/ui';
import {
  cacheReleaseNotes,
  completeWhatsNew,
  hasSeenUpdateAnnouncement,
  markUpdateAnnouncementSeen,
  shouldShowWhatsNew,
} from './utils/updateAnnouncement';
import { Dashboard } from './pages/Dashboard';
import { AutoClicker } from './pages/AutoClicker';
import { TimedClick } from './pages/TimedClick';
import { Recording } from './pages/Recording';
import { ScriptEditor } from './pages/ScriptEditor';
import { ScriptManager } from './pages/ScriptManager';
import { Settings } from './pages/Settings';
import { useService } from './hooks/useService';
import { createEmptyScript, mockScripts } from './data/mockData';
import { useToast } from './providers/ToastProvider';
import { showSystemAlert } from './utils/systemAlert';
import { formatErrorForDisplay } from './utils/errorMessages';
import type {
  DesktopAboutInfo,
  DesktopUpdateState,
  ErrorDetail,
  PlaybackOptions,
  Script,
  ScriptAction,
  AppSettings,
} from './types';
import { ApiError } from './services/ApiClient';
import { buildPlaybackOptionsFromScript } from './utils/playbackOptions';
import { buildRecordingConfig } from './utils/recordingConfig';
import { buildClickerConfig, readClickerForm } from './utils/clickerConfig';
import { usePageHotkeys } from './hooks/usePageHotkeys';
import { activityLine } from './utils/activityStatus';

const MOCK_SCRIPT_IDS = new Set(mockScripts.map(script => script.id));

function toErrorDetail(err: unknown): ErrorDetail {
  if (err instanceof ApiError) return err.detail;
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as ErrorDetail;
  }
  return {
    code: 'ENGINE_INTERNAL_ERROR',
    message: err instanceof Error ? err.message : '发生未知错误',
    details: {},
    retryable: true,
    operationId: null,
  };
}

export default function App() {
  const {
    emergencyStop, state, settings, error, clearError, updateSettings, saveScript, refreshScripts,
    startRecording, stopRecording, playback, stopPlayback, scripts, loadScript, startClicker, stopClicker,
    pauseClicker, resumeClicker, pauseRecording, resumeRecording, pausePlayback, resumePlayback,
    stopTimedClick,
  } = useService();
  const toast = useToast();

  const [page, setPage] = useState<PageId>('dashboard');
  const theme = settings.theme;
  const [currentScript, setCurrentScript] = useState<Script>(createEmptyScript);
  const [saved, setSaved] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutInfo, setAboutInfo] = useState<DesktopAboutInfo | null>(null);
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [privilegeDialog, setPrivilegeDialog] = useState<{ title: string; description: string } | null>(null);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceMode, setAnnounceMode] = useState<UpdateAnnouncementMode>('available');
  const [whatsNewNotes, setWhatsNewNotes] = useState<string | null>(null);
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);
  const pendingHotkeyActions = useRef(new Set<string>());
  const autoAnnouncedVersionRef = useRef<string | null>(null);
  /** Latest options from ScriptEditor UI (loop/duration/speed); falls back to script.settings. */
  const playbackOptionsRef = useRef<PlaybackOptions | null>(null);
  const currentScriptRef = useRef(currentScript);
  currentScriptRef.current = currentScript;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Saved script that is currently playing, however it was started (list, hotkey, editor…). */
  const playbackActive = state.snapshot.operationType === 'playback' && state.runState !== 'idle';
  const runningScriptId = playbackActive ? state.playbackScript?.id ?? null : null;

  const reportFailure = useCallback((title: string, err: unknown) => {
    const friendly = formatErrorForDisplay(toErrorDetail(err));
    toast.error(`${friendly.title}：${friendly.message}`);
    void showSystemAlert(title, friendly.title, friendly.message);
  }, [toast]);

  /** Run a saved script (its own loop/speed settings); calling it again for that script stops it. */
  const runScript = useCallback(async (scriptId: string, viaHotkey: boolean) => {
    const liveState = stateRef.current;
    const busy = Boolean(liveState.snapshot.operationType) && liveState.runState !== 'idle';
    if (busy) {
      if (liveState.snapshot.operationType === 'playback' && liveState.playbackScript?.id === scriptId) {
        try {
          await stopPlayback();
          void showSystemAlert('回放', '回放已停止');
        } catch (err) {
          reportFailure('回放', err);
        }
        return;
      }
      const message = '当前已有任务在运行，请先停止或急停后再运行脚本';
      toast.error(message);
      if (viaHotkey) void showSystemAlert('回放', '无法运行脚本', message);
      return;
    }
    let script: Script;
    try {
      script = await loadScript(scriptId);
    } catch (err) {
      reportFailure('回放', err);
      return;
    }
    const enabled = script.actions.filter(action => action.enabled);
    if (enabled.length === 0) {
      const message = `脚本「${script.name}」没有可回放的动作`;
      toast.error(message);
      if (viaHotkey) void showSystemAlert('回放', '无法运行脚本', message);
      return;
    }
    const options = buildPlaybackOptionsFromScript(script, settingsRef.current);
    try {
      // A hotkey is pressed from inside the target window, so start right away.
      await playback({ ...script, actions: enabled }, viaHotkey ? { ...options, countdownMs: 0 } : options);
      void showSystemAlert('回放', '回放已开始', `脚本：${script.name}`);
    } catch (err) {
      reportFailure('回放', err);
    }
  }, [loadScript, playback, stopPlayback, reportFailure, toast]);

  /** Global clicker hotkey: start with the clicker page's last settings, or stop it. */
  const toggleClicker = useCallback(async () => {
    const liveState = stateRef.current;
    const busy = Boolean(liveState.snapshot.operationType) && liveState.runState !== 'idle';
    if (busy) {
      if (liveState.snapshot.operationType === 'clicker') {
        try {
          await stopClicker();
          void showSystemAlert('连点器', '连点已停止');
        } catch (err) {
          reportFailure('连点器', err);
        }
        return;
      }
      const message = '当前已有任务在运行，请先停止或急停后再启动连点器';
      toast.error(message);
      void showSystemAlert('连点器', '无法启动连点器', message);
      return;
    }
    const result = buildClickerConfig(readClickerForm(), settingsRef.current, { countdownMs: 0 });
    if (!result.ok) {
      toast.error(`连点器无法启动：${result.error}`);
      void showSystemAlert('连点器', '无法启动连点器', result.error);
      return;
    }
    try {
      await startClicker(result.config);
      void showSystemAlert(
        '连点器',
        result.config.inputType === 'keyboard' ? '键盘连点已开始' : '连点已开始',
        '再按一次快捷键停止',
      );
    } catch (err) {
      reportFailure('连点器', err);
    }
  }, [startClicker, stopClicker, reportFailure, toast]);

  /** Global pause/resume hotkey: works for whichever task is running. */
  const togglePause = useCallback(async () => {
    const live = stateRef.current;
    const operation = live.snapshot.operationType;
    const refuse = (message: string) => {
      toast.info(message);
      void showSystemAlert('暂停 / 继续', message);
    };
    if (!operation || live.runState === 'idle') {
      refuse('当前没有正在运行的任务');
      return;
    }
    if (live.snapshot.state === 'countdown' || live.snapshot.state === 'stopping') {
      refuse('任务正在倒计时或停止中，暂时不能暂停');
      return;
    }
    const controls = {
      clicker: { label: '连点器', pause: pauseClicker, resume: resumeClicker },
      timed_click: { label: '定时任务', pause: pauseClicker, resume: resumeClicker },
      recording: { label: '录制', pause: pauseRecording, resume: resumeRecording },
      playback: { label: '回放', pause: pausePlayback, resume: resumePlayback },
    }[operation];
    try {
      if (live.runState === 'paused') {
        await controls.resume();
        void showSystemAlert('暂停 / 继续', `${controls.label}已继续`);
      } else {
        await controls.pause();
        void showSystemAlert('暂停 / 继续', `${controls.label}已暂停`, '再按一次快捷键继续');
      }
    } catch (err) {
      reportFailure('暂停 / 继续', err);
    }
  }, [pauseClicker, resumeClicker, pauseRecording, resumeRecording, pausePlayback, resumePlayback, reportFailure, toast]);

  /** Stop whatever is running (tray menu / mini window). Recording keeps its result for saving. */
  const stopActive = useCallback(async () => {
    const live = stateRef.current;
    const operation = live.snapshot.operationType;
    if (!operation || live.runState === 'idle') return;
    try {
      if (operation === 'clicker') await stopClicker();
      else if (operation === 'timed_click') await stopTimedClick();
      else if (operation === 'playback') await stopPlayback();
      else {
        await stopRecording();
        setPage('recording');
        void showSystemAlert('录制', '录制已结束', '打开主窗口可保存或丢弃本次录制结果');
      }
    } catch (err) {
      reportFailure('停止', err);
    }
  }, [stopClicker, stopTimedClick, stopPlayback, stopRecording, reportFailure]);

  const stopActiveRef = useRef(stopActive);
  stopActiveRef.current = stopActive;
  const togglePauseRef = useRef(togglePause);
  togglePauseRef.current = togglePause;
  const runScriptRef = useRef(runScript);
  runScriptRef.current = runScript;
  const toggleClickerRef = useRef(toggleClicker);
  toggleClickerRef.current = toggleClicker;
  const scriptIds = useMemo(() => new Set(scripts.map(script => script.id)), [scripts]);


  useEffect(() => {
    if (!error || error.code !== 'INPUT_PERMISSION_DENIED') return;
    setPrivilegeDialog({
      title: '无法向当前窗口注入输入',
      description: error.message,
    });
    void showSystemAlert('权限限制', '无法向当前窗口注入输入', error.message);
    clearError();
  }, [error, clearError]);

  useEffect(() => {
    if (settings.serviceMode !== 'real') return;
    if (!currentScript.id || !MOCK_SCRIPT_IDS.has(currentScript.id)) return;
    setCurrentScript(createEmptyScript());
    setSaved(true);
  }, [settings.serviceMode, currentScript.id]);

  useEffect(() => {
    if (!window.desktop?.setGlobalHotkeys) return;
    const bindings: Record<string, string> = {
      recordStart: settings.recordStartHotkey,
      recordStop: settings.recordStopHotkey,
      playbackStart: settings.playbackStartHotkey,
      playbackStop: settings.playbackStopHotkey,
      clickerToggle: settings.clickerToggleHotkey,
      pauseToggle: settings.pauseToggleHotkey,
    };
    for (const [scriptId, hotkey] of Object.entries(settings.scriptHotkeys)) {
      // Skip bindings whose script no longer exists.
      if (scriptIds.has(scriptId)) bindings[`script:${scriptId}`] = hotkey;
    }
    void window.desktop.setGlobalHotkeys(bindings).catch(() => undefined);
  }, [
    settings.emergencyHotkey,
    settings.recordStartHotkey,
    settings.recordStopHotkey,
    settings.playbackStartHotkey,
    settings.playbackStopHotkey,
    settings.clickerToggleHotkey,
    settings.pauseToggleHotkey,
    settings.scriptHotkeys,
    scriptIds,
  ]);

  // Without the desktop bridge (browser preview) these work while the window is focused.
  usePageHotkeys(useMemo(() => {
    if (typeof window !== 'undefined' && window.desktop?.setGlobalHotkeys) return [];
    return [
      { hotkey: settings.clickerToggleHotkey, handler: () => { void toggleClickerRef.current(); } },
      { hotkey: settings.pauseToggleHotkey, handler: () => { void togglePauseRef.current(); } },
      ...Object.entries(settings.scriptHotkeys)
        .filter(([scriptId]) => scriptIds.has(scriptId))
        .map(([scriptId, hotkey]) => ({
          hotkey,
          handler: () => { void runScriptRef.current(scriptId, true); },
        })),
    ];
  }, [settings.clickerToggleHotkey, settings.pauseToggleHotkey, settings.scriptHotkeys, scriptIds]));

  useEffect(() => {
    if (!window.desktop?.onGlobalHotkey) return;
    return window.desktop.onGlobalHotkey(({ actionId }) => {
      const runOnce = (task: () => Promise<unknown>) => {
        if (pendingHotkeyActions.current.has(actionId)) return;
        pendingHotkeyActions.current.add(actionId);
        void task().finally(() => pendingHotkeyActions.current.delete(actionId));
      };
      const liveState = stateRef.current;
      const liveSettings = settingsRef.current;
      const liveScript = currentScriptRef.current;
      if (actionId === 'clickerToggle') {
        runOnce(() => toggleClickerRef.current());
        return;
      }
      if (actionId === 'pauseToggle') {
        runOnce(() => togglePauseRef.current());
        return;
      }
      if (actionId === 'stopActive') {
        runOnce(() => stopActiveRef.current());
        return;
      }
      if (actionId.startsWith('script:')) {
        const scriptId = actionId.slice('script:'.length);
        runOnce(() => runScriptRef.current(scriptId, true));
        return;
      }
      if (actionId === 'emergency') {
        runOnce(() => emergencyStop()
          .then(() => { void showSystemAlert('急停', '已紧急停止', '所有输入注入已中止'); })
          .catch((err) => {
            const friendly = formatErrorForDisplay(toErrorDetail(err));
            toast.error(`${friendly.title}：${friendly.message}`);
          }));
        return;
      }
      if (actionId === 'recordStart') {
        if (liveState.snapshot.operationType && liveState.runState !== 'idle') {
          toast.error('当前已有任务在运行，请先停止或急停后再开始录制');
          return;
        }
        setPage('recording');
        runOnce(() => startRecording(buildRecordingConfig(liveSettings))
          .then(() => { void showSystemAlert('录制', '录制已开始', '正在记录键鼠操作'); })
          .catch((err) => {
            const friendly = formatErrorForDisplay(toErrorDetail(err));
            toast.error(`${friendly.title}：${friendly.message}`);
          }));
        return;
      }
      if (actionId === 'recordStop') {
        if (liveState.snapshot.operationType !== 'recording') return;
        runOnce(() => stopRecording()
          .then(() => { void showSystemAlert('录制', '录制已结束', '可保存为脚本，或丢弃本次录制结果'); })
          .catch((err) => {
            const friendly = formatErrorForDisplay(toErrorDetail(err));
            toast.error(`${friendly.title}：${friendly.message}`);
          }));
        return;
      }
      if (actionId === 'playbackStart') {
        // The user is usually inside another window, so explain problems via a system notification too.
        const refuse = (message: string) => {
          toast.error(message);
          void showSystemAlert('回放', '无法开始回放', message);
        };
        const enabled = liveScript.actions.filter(a => a.enabled);
        if (enabled.length === 0) {
          const opened = Boolean(liveScript.id || liveScript.name.trim() || liveScript.actions.length);
          refuse(opened
            ? `回放快捷键运行的是编辑器中打开的脚本，「${liveScript.name.trim() || '未命名脚本'}」没有可回放的动作`
            : '回放快捷键运行的是编辑器中打开的脚本，当前没有打开脚本。也可以在「脚本」页面为常用脚本单独设置快捷键');
          return;
        }
        if (liveState.runState !== 'idle' && liveState.snapshot.operationType === 'playback') {
          refuse('回放正在运行，请先停止或急停后再重新开始');
          return;
        }
        if (liveState.runState !== 'idle' && liveState.snapshot.operationType) {
          refuse('当前已有任务在运行，请先停止或急停后再开始回放');
          return;
        }
        // Started from a hotkey: run immediately, like every other hotkey (the countdown is for buttons).
        const options = {
          ...(playbackOptionsRef.current ?? buildPlaybackOptionsFromScript(liveScript, liveSettings)),
          countdownMs: 0,
        };
        setPage('script');
        runOnce(() => playback({ ...liveScript, actions: enabled }, options)
          .then(() => { void showSystemAlert('回放', '回放已开始', liveScript.name.trim() ? `脚本：${liveScript.name.trim()}` : undefined); })
          .catch((err) => {
            const friendly = formatErrorForDisplay(toErrorDetail(err));
            toast.error(`${friendly.title}：${friendly.message}`);
          }));
        return;
      }
      if (actionId === 'playbackStop') {
        if (liveState.snapshot.operationType !== 'playback' && liveState.runState === 'idle') return;
        runOnce(() => stopPlayback()
          .then(() => {
            void showSystemAlert('回放', '回放已结束', liveScript.name.trim() ? `脚本：${liveScript.name.trim()}` : undefined);
          })
          .catch((err) => {
            const friendly = formatErrorForDisplay(toErrorDetail(err));
            if (!/不匹配|idle|没有活动/i.test(friendly.message)) {
              toast.error(`${friendly.title}：${friendly.message}`);
            }
          }));
      }
    });
  }, [startRecording, stopRecording, playback, stopPlayback, emergencyStop, toast]);

  // Tray tooltip follows what is running (desktop app only).
  const shellStatus = activityLine(state);
  useEffect(() => {
    void window.desktop?.setShellStatus?.(shellStatus).catch(() => undefined);
  }, [shellStatus]);

  // Apply theme to document and native window chrome
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.title = 'KeyMouse Studio';
    void window.desktop?.setTheme?.(theme).catch(() => undefined);
  }, [theme]);

  const refreshAbout = useCallback(async () => {
    if (!window.desktop?.getAboutInfo) return;
    try {
      const info = await window.desktop.getAboutInfo();
      setAboutInfo(info);
      if (info.update) setUpdateState(info.update);
    } catch {
      // ignore when not in Electron
    }
  }, []);

  const openUpdateAnnouncement = useCallback((mode: UpdateAnnouncementMode = 'available') => {
    setAnnounceMode(mode);
    setAnnounceOpen(true);
  }, []);

  useEffect(() => {
    void refreshAbout();
    void window.desktop?.getUpdateState?.().then((s) => {
      if (s) setUpdateState(s);
    }).catch(() => undefined);

    // What's New after version bump (uses notes cached when user previously saw available update).
    void (async () => {
      try {
        const version =
          (await window.desktop?.getAppVersion?.()) ||
          (await window.desktop?.getAboutInfo?.())?.version ||
          null;
        if (!version) return;
        const result = shouldShowWhatsNew(version);
        if (result.show) {
          setWhatsNewVersion(version);
          setWhatsNewNotes(result.notes);
          setAnnounceMode('whats-new');
          setAnnounceOpen(true);
        }
      } catch {
        // ignore
      }
    })();

    const offState = window.desktop?.onUpdateState?.((next) => {
      setUpdateState(next);
      setCheckingUpdate(next.status === 'checking');
      if (next.status === 'available' || next.status === 'downloading' || next.status === 'downloaded') {
        setUpdateBannerDismissed(false);
      }
      if (next.version && next.releaseNotes) {
        cacheReleaseNotes(next.version, next.releaseNotes);
      }
    });
    const offAbout = window.desktop?.onOpenAbout?.(() => {
      void refreshAbout();
      setAboutOpen(true);
    });
    const offUpdate = window.desktop?.onOpenUpdatePrompt?.(() => {
      void refreshAbout();
      openUpdateAnnouncement('available');
    });
    return () => {
      offState?.();
      offAbout?.();
      offUpdate?.();
    };
  }, [refreshAbout, openUpdateAnnouncement]);

  // Auto-open update announcement once per remote version.
  useEffect(() => {
    const status = updateState?.status;
    const version = updateState?.version;
    if (!version) return;
    if (status !== 'available' && status !== 'downloaded') return;
    if (updateState?.releaseNotes) cacheReleaseNotes(version, updateState.releaseNotes);
    if (hasSeenUpdateAnnouncement(version)) return;
    if (autoAnnouncedVersionRef.current === version) return;
    autoAnnouncedVersionRef.current = version;
    setAnnounceMode('available');
    setAnnounceOpen(true);
  }, [updateState?.status, updateState?.version, updateState?.releaseNotes]);

  const handleCheckUpdate = useCallback(async () => {
    if (!window.desktop?.checkForUpdates) {
      toast.info('仅在桌面安装包中支持检查更新');
      return;
    }
    setCheckingUpdate(true);
    try {
      const result = await window.desktop.checkForUpdates();
      setUpdateState((prev) => ({ ...(prev ?? { status: 'idle' }), ...result }));
      if (result.status === 'up-to-date') toast.success(result.message || '已是最新版本');
      else if (result.status === 'dev-mode') toast.info(result.message || '开发模式不可更新');
      else if (result.status === 'error') toast.error(result.message || '检查更新失败');
      else if (result.status === 'available') toast.info(`发现新版本 v${result.version ?? ''}`);
      await refreshAbout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '检查更新失败');
    } finally {
      setCheckingUpdate(false);
    }
  }, [toast, refreshAbout]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!window.desktop?.downloadUpdate) return;
    setUpdateBannerDismissed(false);
    try {
      const result = await window.desktop.downloadUpdate();
      setUpdateState((prev) => ({ ...(prev ?? { status: 'idle' }), ...result, status: result.status }));
      if (result.status === 'error') toast.error(result.message || '下载更新失败');
      else if (result.status === 'downloaded') toast.success(`v${result.version ?? ''} 已下载完成`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '下载更新失败');
    }
  }, [toast]);

  const handleInstallUpdate = useCallback(async () => {
    if (!window.desktop?.installUpdate) return;
    try {
      await window.desktop.installUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '安装更新失败');
    }
  }, [toast]);

  // Handle theme toggle
  const handleToggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    void updateSettings({ theme: newTheme });
  }, [theme, updateSettings]);

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    void updateSettings(updates);
  }, [updateSettings]);

  // Handle emergency stop
  const handleEmergencyStop = useCallback(() => {
    void emergencyStop().catch(() => undefined);
  }, [emergencyStop]);

  // Handle script change
  const handleScriptChange = useCallback((script: Script) => {
    setCurrentScript(script);
    setSaved(false);
  }, []);

  const handleScriptSave = useCallback(async (draft: Script) => {
    const persisted = await saveScript(draft);
    await refreshScripts();
    setCurrentScript(persisted);
    setSaved(true);
    toast.success('脚本保存成功');
  }, [saveScript, refreshScripts, toast]);

  // Handle script load
  const handleLoadScript = useCallback((script: Script) => {
    setCurrentScript(script);
    setSaved(true);
  }, []);

  const handleNewScript = useCallback(() => {
    setCurrentScript(createEmptyScript());
    setSaved(true);
    setPage('script');
  }, []);

  const handleScriptDeleted = useCallback((id: string) => {
    const hotkeys = settingsRef.current.scriptHotkeys;
    if (hotkeys[id]) {
      const { [id]: _removed, ...rest } = hotkeys;
      void updateSettings({ scriptHotkeys: rest });
    }
    setCurrentScript(prev => {
      if (prev.id !== id) return prev;
      setSaved(true);
      return createEmptyScript();
    });
  }, [updateSettings]);

  // Handle recorded actions
  const handleRecordedActions = useCallback(async (actions: ScriptAction[], name: string) => {
    const now = new Date().toISOString();
    const newScript: Script = {
      ...currentScript,
      id: '',
      name: name.trim(),
      description: `由录制生成的脚本，共 ${actions.length} 个动作`,
      actions,
      createdAt: now,
      updatedAt: now,
      settings: currentScript.settings,
    };
    const savedScript = await saveScript(newScript);
    await refreshScripts();
    setCurrentScript(savedScript);
    setSaved(true);
    toast.success('录制脚本保存成功');
  }, [currentScript, saveScript, refreshScripts, toast]);

  // Render current page
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={setPage} onLoadScript={handleLoadScript} runningScriptId={runningScriptId} onRunScript={(scriptId: string) => { void runScript(scriptId, false); }}  data-qoder-id="qel-dashboard-84159909" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboard-84159909&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;dashboard&quot;,&quot;loc&quot;:{&quot;line&quot;:90,&quot;column&quot;:16}}"/>;
      case 'clicker':
        return <AutoClicker  data-qoder-id="qel-autoclicker-73789248" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-autoclicker-73789248&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;autoclicker&quot;,&quot;loc&quot;:{&quot;line&quot;:92,&quot;column&quot;:16}}"/>;
      case 'timed':
        return <TimedClick  data-qoder-id="qel-timedclick-780bcd41" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-timedclick-780bcd41&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;timedclick&quot;,&quot;loc&quot;:{&quot;line&quot;:94,&quot;column&quot;:16}}"/>;
      case 'recording':
        return <Recording onNavigate={setPage} onActionsSaved={handleRecordedActions}  data-qoder-id="qel-recording-d02222ba" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-recording-d02222ba&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;recording&quot;,&quot;loc&quot;:{&quot;line&quot;:96,&quot;column&quot;:16}}"/>;
      case 'script':
        return (
          <ScriptEditor
            script={currentScript}
            onScriptChange={handleScriptChange}
            onScriptSave={handleScriptSave}
            onNavigate={setPage}
            onPlaybackOptionsChange={options => {
              playbackOptionsRef.current = options;
            }}
            hasUnsavedChanges={!saved}
           data-qoder-id="qel-scripteditor-9f5415e1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-scripteditor-9f5415e1&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;scripteditor&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:11}}"/>
        );
      case 'manager':
        return <ScriptManager onNavigate={setPage} onLoadScript={handleLoadScript} onNewScript={handleNewScript} onScriptDeleted={handleScriptDeleted} runningScriptId={runningScriptId} onRunScript={(scriptId: string) => { void runScript(scriptId, false); }}  data-qoder-id="qel-scriptmanager-6f7a5cc0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-scriptmanager-6f7a5cc0&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;scriptmanager&quot;,&quot;loc&quot;:{&quot;line&quot;:107,&quot;column&quot;:16}}"/>;
      case 'settings':
        return <Settings settings={settings} onUpdate={handleUpdateSettings}  data-qoder-id="qel-settings-0722e165" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-settings-0722e165&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;settings&quot;,&quot;loc&quot;:{&quot;line&quot;:109,&quot;column&quot;:16}}"/>;
      default:
        return <Dashboard onNavigate={setPage} onLoadScript={handleLoadScript} runningScriptId={runningScriptId} onRunScript={(scriptId: string) => { void runScript(scriptId, false); }}  data-qoder-id="qel-dashboard-8b15a40e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboard-8b15a40e&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;dashboard&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:16}}"/>;
    }
  };

  return (
    <>
      {error && (() => {
        const friendly = formatErrorForDisplay(error);
        return (
          <div role="alert" style={{ position: 'fixed', top: 48, left: 64, right: 0, zIndex: 1001, padding: '8px 16px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderBottom: '1px solid var(--color-danger)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span><strong>{friendly.title}</strong> · {friendly.message}{error.retryable ? ' · 可重试' : ''}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={clearError}>关闭</button>
          </div>
        );
      })()}
      {!updateBannerDismissed && (
        <UpdateProgressBar
          update={updateState}
          onDownload={() => { void handleDownloadUpdate(); }}
          onInstall={() => { void handleInstallUpdate(); }}
          onDismiss={() => setUpdateBannerDismissed(true)}
          onOpenAbout={() => {
            void refreshAbout();
            setAboutOpen(true);
          }}
          onOpenAnnouncement={() => openUpdateAnnouncement('available')}
        />
      )}
      <Layout
        activePage={page}
        onPageChange={setPage}
        scriptName={currentScript.name.trim() || '暂未选择脚本'}
        scriptOpen={Boolean(currentScript.id || currentScript.name.trim() || currentScript.actions.length)}
        saved={saved}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onEmergencyStop={handleEmergencyStop}
        onOpenAbout={() => {
          void refreshAbout();
          setAboutOpen(true);
        }}
        updateStatus={updateState?.status}
        navBadges={
          state.recordingState === 'stopped' && state.recordingActions.length > 0
            ? { recording: '有未保存的录制结果' }
            : undefined
        }
       data-qoder-id="qel-layout-c21360f5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-layout-c21360f5&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;layout&quot;,&quot;loc&quot;:{&quot;line&quot;:117,&quot;column&quot;:7}}">
        {renderPage()}
      </Layout>

      <AlertDialog
        open={privilegeDialog !== null}
        title={privilegeDialog?.title ?? ''}
        description={privilegeDialog?.description ?? ''}
        confirmLabel="知道了"
        onClose={() => setPrivilegeDialog(null)}
      />
      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        about={aboutInfo}
        update={updateState}
        checking={checkingUpdate}
        onCheckUpdate={() => { void handleCheckUpdate(); }}
        onDownload={() => { void handleDownloadUpdate(); }}
        onInstall={() => { void handleInstallUpdate(); }}
        onOpenAnnouncement={() => openUpdateAnnouncement('available')}
      />
      <UpdateAnnouncementDialog
        open={announceOpen}
        mode={announceMode}
        update={updateState}
        notes={announceMode === 'whats-new' ? whatsNewNotes : updateState?.releaseNotes}
        version={announceMode === 'whats-new' ? whatsNewVersion : updateState?.version}
        releaseDate={updateState?.releaseDate}
        onClose={() => {
          if (announceMode === 'whats-new') {
            completeWhatsNew(whatsNewVersion);
          } else {
            markUpdateAnnouncementSeen(updateState?.version);
          }
          setAnnounceOpen(false);
        }}
        onDownload={() => {
          markUpdateAnnouncementSeen(updateState?.version);
          void handleDownloadUpdate();
        }}
        onInstall={() => {
          markUpdateAnnouncementSeen(updateState?.version);
          void handleInstallUpdate();
        }}
      />
      {/* Countdown overlay */}
      {state.snapshot.state === 'countdown' && state.countdownRemaining > 0 && (
        <div className="countdown-overlay" onClick={handleEmergencyStop} data-qoder-id="qel-countdown-overlay-c389bc14" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-countdown-overlay-c389bc14&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;countdown-overlay&quot;,&quot;loc&quot;:{&quot;line&quot;:130,&quot;column&quot;:9}}">
          <div className="countdown-number" data-qoder-id="qel-countdown-number-5e575752" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-countdown-number-5e575752&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;countdown-number&quot;,&quot;loc&quot;:{&quot;line&quot;:131,&quot;column&quot;:11}}">{state.countdownRemaining}</div>
          <div style={{ color: 'white', fontSize: '16px', marginTop: '16px' }} data-qoder-id="qel-div-d0a9d045" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-d0a9d045&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:132,&quot;column&quot;:11}}">
            即将开始执行，按 {settings.emergencyHotkey} 或点击空白处取消
          </div>
        </div>
      )}
      {/* Emergency flash */}
      {state.runState === 'emergency' && (
        <div className="countdown-overlay" style={{ background: 'rgba(197, 15, 31, 0.3)' }} data-qoder-id="qel-countdown-overlay-c689c0cd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-countdown-overlay-c689c0cd&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;countdown-overlay&quot;,&quot;loc&quot;:{&quot;line&quot;:139,&quot;column&quot;:9}}">
          <div className="countdown-number" style={{ color: '#ff6b6b', fontSize: '48px' }} data-qoder-id="qel-countdown-number-5b575299" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-countdown-number-5b575299&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;countdown-number&quot;,&quot;loc&quot;:{&quot;line&quot;:140,&quot;column&quot;:11}}">
            已急停
          </div>
        </div>
      )}
    </>
  );
}
