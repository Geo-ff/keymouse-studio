/* =========================================================================
   App — 根组件
   状态管理（主题、当前页面、当前脚本）、页面路由、主题切换
   ========================================================================= */

import { useState, useCallback, useEffect } from 'react';
import { Layout, type PageId } from './components/Layout';
import { AboutDialog } from './components/AboutDialog';
import { UpdateProgressBar } from './components/UpdateProgressBar';
import { AlertDialog } from './components/ui';
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
import type { DesktopAboutInfo, DesktopUpdateState, Script, ScriptAction, AppSettings } from './types';

const MOCK_SCRIPT_IDS = new Set(mockScripts.map(script => script.id));

export default function App() {
  const {
    emergencyStop, state, settings, error, clearError, updateSettings, saveScript, refreshScripts,
    startRecording, stopRecording, playback, stopPlayback,
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

  // Register business global hotkeys; suspend them while playback is active.
  useEffect(() => {
    if (!window.desktop?.setGlobalHotkeys) return;
    const playbackActive =
      state.snapshot.operationType === 'playback' &&
      (state.runState === 'running' || state.runState === 'paused');
    void window.desktop.setGlobalHotkeys(playbackActive ? {} : {
      recordStart: settings.recordStartHotkey,
      recordStop: settings.recordStopHotkey,
      playbackStart: settings.playbackStartHotkey,
      playbackStop: settings.playbackStopHotkey,
    }).catch(() => undefined);
  }, [
    state.snapshot.operationType,
    state.runState,
    settings.recordStartHotkey,
    settings.recordStopHotkey,
    settings.playbackStartHotkey,
    settings.playbackStopHotkey,
  ]);

  useEffect(() => {
    if (!window.desktop?.onGlobalHotkey) return;
    return window.desktop.onGlobalHotkey(({ actionId }) => {
      if (actionId === 'recordStart') {
        if (state.snapshot.operationType && state.runState !== 'idle') return;
        setPage('recording');
        void startRecording({
          recordMouseMove: settings.recordMouseMove,
          minMoveSampleMs: settings.minRecordInterval,
          moveErrorPx: 2,
          recordWheel: true,
          recordMouse: true,
          recordKeyboard: true,
          controlHotkeys: [
            settings.emergencyHotkey,
            settings.recordStartHotkey,
            settings.recordStopHotkey,
            settings.playbackStartHotkey,
            settings.playbackStopHotkey,
          ].filter(Boolean),
        })
          .then(() => { void showSystemAlert('录制', '录制已开始', '正在记录键鼠操作'); })
          .catch(() => undefined);
        return;
      }
      if (actionId === 'recordStop') {
        if (state.snapshot.operationType !== 'recording') return;
        void stopRecording()
          .then(() => { void showSystemAlert('录制', '录制已结束', '可保存为脚本，或丢弃本次录制结果'); })
          .catch(() => undefined);
        return;
      }
      if (actionId === 'playbackStart') {
        const enabled = currentScript.actions.filter(a => a.enabled);
        if (enabled.length === 0 || (state.runState !== 'idle' && state.snapshot.operationType === 'playback')) return;
        if (state.runState !== 'idle' && state.snapshot.operationType) return;
        setPage('script');
        void (async () => {
          await window.desktop?.setGlobalHotkeys?.({}).catch(() => undefined);
          await playback(
            { ...currentScript, actions: enabled },
            {
              times: currentScript.settings.loopMode === 'count' ? Math.max(1, currentScript.settings.loopCount) : 1,
              speedMultiplier: currentScript.settings.speedMultiplier,
              loop: currentScript.settings.loopMode === 'infinite',
              loopMode: currentScript.settings.loopMode === 'count' ? 'count' : 'infinite',
              countdownMs: settings.countdownEnabled ? Math.round(settings.countdownSeconds * 1000) : 0,
            },
          );
          void showSystemAlert('回放', '回放已开始', currentScript.name.trim() ? `脚本：${currentScript.name.trim()}` : undefined);
        })().catch(() => {
          void window.desktop?.setGlobalHotkeys?.({
            recordStart: settings.recordStartHotkey,
            recordStop: settings.recordStopHotkey,
            playbackStart: settings.playbackStartHotkey,
            playbackStop: settings.playbackStopHotkey,
          }).catch(() => undefined);
        });
        return;
      }
      if (actionId === 'playbackStop') {
        if (state.snapshot.operationType !== 'playback') return;
        void stopPlayback()
          .then(() => {
            void showSystemAlert('回放', '回放已结束', currentScript.name.trim() ? `脚本：${currentScript.name.trim()}` : undefined);
          })
          .catch(() => undefined);
      }
    });
  }, [
    state, settings, currentScript, startRecording, stopRecording, playback, stopPlayback,
  ]);

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

  useEffect(() => {
    void refreshAbout();
    void window.desktop?.getUpdateState?.().then((s) => {
      if (s) setUpdateState(s);
    }).catch(() => undefined);

    const offState = window.desktop?.onUpdateState?.((next) => {
      setUpdateState(next);
      setCheckingUpdate(next.status === 'checking');
      if (next.status === 'available' || next.status === 'downloading' || next.status === 'downloaded') {
        setUpdateBannerDismissed(false);
      }
    });
    const offAbout = window.desktop?.onOpenAbout?.(() => {
      void refreshAbout();
      setAboutOpen(true);
    });
    const offUpdate = window.desktop?.onOpenUpdatePrompt?.(() => {
      void refreshAbout();
      setAboutOpen(true);
    });
    return () => {
      offState?.();
      offAbout?.();
      offUpdate?.();
    };
  }, [refreshAbout]);

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
    setCurrentScript(prev => {
      if (prev.id !== id) return prev;
      setSaved(true);
      return createEmptyScript();
    });
  }, []);

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
        return <Dashboard onNavigate={setPage} onLoadScript={handleLoadScript}  data-qoder-id="qel-dashboard-84159909" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboard-84159909&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;dashboard&quot;,&quot;loc&quot;:{&quot;line&quot;:90,&quot;column&quot;:16}}"/>;
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

           data-qoder-id="qel-scripteditor-9f5415e1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-scripteditor-9f5415e1&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;scripteditor&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:11}}"/>
        );
      case 'manager':
        return <ScriptManager onNavigate={setPage} onLoadScript={handleLoadScript} onNewScript={handleNewScript} onScriptDeleted={handleScriptDeleted}  data-qoder-id="qel-scriptmanager-6f7a5cc0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-scriptmanager-6f7a5cc0&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;scriptmanager&quot;,&quot;loc&quot;:{&quot;line&quot;:107,&quot;column&quot;:16}}"/>;
      case 'settings':
        return <Settings settings={settings} onUpdate={handleUpdateSettings}  data-qoder-id="qel-settings-0722e165" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-settings-0722e165&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;settings&quot;,&quot;loc&quot;:{&quot;line&quot;:109,&quot;column&quot;:16}}"/>;
      default:
        return <Dashboard onNavigate={setPage} onLoadScript={handleLoadScript}  data-qoder-id="qel-dashboard-8b15a40e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboard-8b15a40e&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;dashboard&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:16}}"/>;
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
        />
      )}
      <Layout
        activePage={page}
        onPageChange={setPage}
        scriptName={currentScript.name.trim() || '暂未选择脚本'}
        saved={saved}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onEmergencyStop={handleEmergencyStop}
        onOpenAbout={() => {
          void refreshAbout();
          setAboutOpen(true);
        }}
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
      />
      {/* Countdown overlay */}
      {state.countdownRemaining > 0 && (
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
