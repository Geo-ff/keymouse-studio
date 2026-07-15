/* =========================================================================
   App — 根组件
   状态管理（主题、当前页面、当前脚本）、页面路由、主题切换
   ========================================================================= */

import { useState, useCallback, useEffect } from 'react';
import { Layout, type PageId } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { AutoClicker } from './pages/AutoClicker';
import { TimedClick } from './pages/TimedClick';
import { Recording } from './pages/Recording';
import { ScriptEditor } from './pages/ScriptEditor';
import { ScriptManager } from './pages/ScriptManager';
import { Settings } from './pages/Settings';
import { useService } from './hooks/useService';
import { mockScripts } from './data/mockData';
import type { Script, ScriptAction, AppSettings } from './types';


export default function App() {
  const { emergencyStop, state, settings, error, clearError, updateSettings } = useService();

  const [page, setPage] = useState<PageId>('dashboard');
  const theme = settings.theme;
  const [currentScript, setCurrentScript] = useState<Script>(mockScripts[0]);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (settings.serviceMode === 'real' && mockScripts.some(script => script.id === currentScript.id)) {
      const now = new Date().toISOString();
      setCurrentScript(previous => ({ ...previous, id: '', createdAt: now, updatedAt: now }));
      setSaved(false);
    }
  }, [settings.serviceMode, currentScript.id]);


  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  // Handle script load
  const handleLoadScript = useCallback((script: Script) => {
    setCurrentScript(script);
    setSaved(true);
  }, []);

  // Handle recorded actions
  const handleRecordedActions = useCallback((actions: ScriptAction[]) => {

    const newScript: Script = {
      ...currentScript,
      id: '',
      name: `录制脚本 ${new Date().toLocaleString('zh-CN')}`,
      description: `由录制生成的脚本，共 ${actions.length} 个动作`,
      actions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: currentScript.settings,
    };
    setCurrentScript(newScript);
    setSaved(false);
  }, [currentScript]);

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
            onNavigate={setPage}

           data-qoder-id="qel-scripteditor-9f5415e1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-scripteditor-9f5415e1&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;scripteditor&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:11}}"/>
        );
      case 'manager':
        return <ScriptManager onNavigate={setPage} onLoadScript={handleLoadScript}  data-qoder-id="qel-scriptmanager-6f7a5cc0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-scriptmanager-6f7a5cc0&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;scriptmanager&quot;,&quot;loc&quot;:{&quot;line&quot;:107,&quot;column&quot;:16}}"/>;
      case 'settings':
        return <Settings settings={settings} onUpdate={handleUpdateSettings}  data-qoder-id="qel-settings-0722e165" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-settings-0722e165&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;settings&quot;,&quot;loc&quot;:{&quot;line&quot;:109,&quot;column&quot;:16}}"/>;
      default:
        return <Dashboard onNavigate={setPage} onLoadScript={handleLoadScript}  data-qoder-id="qel-dashboard-8b15a40e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboard-8b15a40e&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;dashboard&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:16}}"/>;
    }
  };

  return (
    <>
      {error && (
        <div role="alert" style={{ position: 'fixed', top: 48, left: 64, right: 0, zIndex: 1001, padding: '8px 16px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderBottom: '1px solid var(--color-danger)', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span><strong>{error.code}</strong> · {error.message}{error.operationId ? ` · ${error.operationId}` : ''}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearError}>关闭</button>
        </div>
      )}
      <Layout
        activePage={page}
        onPageChange={setPage}
        scriptName={currentScript.name}
        saved={saved}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onEmergencyStop={handleEmergencyStop}
       data-qoder-id="qel-layout-c21360f5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-layout-c21360f5&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.tsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;layout&quot;,&quot;loc&quot;:{&quot;line&quot;:117,&quot;column&quot;:7}}">
        {renderPage()}
      </Layout>
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
