/* =========================================================================
   Layout — 应用整体布局
   侧边导航栏 + 顶部工具栏 + 主内容区 + 底部状态栏
   ========================================================================= */

import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  MousePointerClick,
  Circle,
  Timer,
  FileCode2,
  Settings,
  Sun,
  Moon,
  Save,
  Zap,
  Keyboard,
  MousePointer,
  Play,
  Pause,
  Square,
} from 'lucide-react';
import { useService } from '../hooks/useService';
import type { RunState } from '../types';
import { matchesHotkey } from '../utils/hotkey';

export type PageId = 'dashboard' | 'clicker' | 'timed' | 'recording' | 'script' | 'manager' | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '控制台', icon: <LayoutDashboard size={18}  data-qoder-id="qel-layoutdashboard-6a18ff30" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-layoutdashboard-6a18ff30&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Unknown&quot;,&quot;elementRole&quot;:&quot;layoutdashboard&quot;,&quot;loc&quot;:{&quot;line&quot;:37,&quot;column&quot;:42}}"/> },
  { id: 'clicker', label: '连点器', icon: <MousePointerClick size={18}  data-qoder-id="qel-mousepointerclick-9b7b7bb1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-mousepointerclick-9b7b7bb1&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Unknown&quot;,&quot;elementRole&quot;:&quot;mousepointerclick&quot;,&quot;loc&quot;:{&quot;line&quot;:38,&quot;column&quot;:40}}"/> },
  { id: 'timed', label: '定时', icon: <Timer size={18}  data-qoder-id="qel-timer-0f289056" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-timer-0f289056&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Unknown&quot;,&quot;elementRole&quot;:&quot;timer&quot;,&quot;loc&quot;:{&quot;line&quot;:39,&quot;column&quot;:37}}"/> },
  { id: 'recording', label: '录制', icon: <Circle size={18}  data-qoder-id="qel-circle-c471470b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-circle-c471470b&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Unknown&quot;,&quot;elementRole&quot;:&quot;circle&quot;,&quot;loc&quot;:{&quot;line&quot;:40,&quot;column&quot;:41}}"/> },
  { id: 'script', label: '脚本', icon: <FileCode2 size={18}  data-qoder-id="qel-filecode2-de4d8be0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-filecode2-de4d8be0&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Unknown&quot;,&quot;elementRole&quot;:&quot;filecode2&quot;,&quot;loc&quot;:{&quot;line&quot;:41,&quot;column&quot;:38}}"/> },
  { id: 'settings', label: '设置', icon: <Settings size={18}  data-qoder-id="qel-settings-b1a4688f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-settings-b1a4688f&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Unknown&quot;,&quot;elementRole&quot;:&quot;settings&quot;,&quot;loc&quot;:{&quot;line&quot;:42,&quot;column&quot;:40}}"/> },
];

/* --- Sidebar --- */
function Sidebar({ activePage, onNavigate, ...qoderProps }: { activePage: PageId; onNavigate: (page: PageId) => void } & Record<string, any>) {
  return (
    <nav className={["app-sidebar", (qoderProps as any)?.className].filter(Boolean).join(" ")} role="navigation" aria-label="主导航" data-component="sidebar" style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <button
        className="sidebar-brand"
        type="button"
        onClick={() => onNavigate('dashboard')}
        aria-label="KeyBoard Studio 首页"
      >
        <img src="./keyboard-studio-logo.png" alt="" className="sidebar-brand-logo" draggable={false} />
      </button>
      <div className="sidebar-divider" />
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item ${activePage === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          data-tooltip={item.label}
          aria-label={item.label}
          aria-current={activePage === item.id ? 'page' : undefined}
         data-qoder-id="qel-button-d6b96ae9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-d6b96ae9&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Sidebar&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:50,&quot;column&quot;:9}}">
          <span className="nav-item-icon" data-qoder-id="qel-nav-item-icon-8acdfb7b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-nav-item-icon-8acdfb7b&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Sidebar&quot;,&quot;elementRole&quot;:&quot;nav-item-icon&quot;,&quot;loc&quot;:{&quot;line&quot;:58,&quot;column&quot;:11}}">{item.icon}</span>
          <span className="nav-item-label" data-qoder-id="qel-nav-item-label-df57558e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-nav-item-label-df57558e&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Sidebar&quot;,&quot;elementRole&quot;:&quot;nav-item-label&quot;,&quot;loc&quot;:{&quot;line&quot;:59,&quot;column&quot;:11}}">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* --- Toolbar --- */
interface ToolbarProps {
  scriptName: string;
  saved: boolean;
  currentPage: PageId;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onEmergencyStop: () => void;
  onQuickAction?: (action: 'run' | 'pause' | 'stop' | 'save') => void;
}

function Toolbar({ scriptName, saved, theme, onToggleTheme, onEmergencyStop, ...qoderProps }: ToolbarProps & Record<string, any>) {
  const { state, settings } = useService();

  const runStateMap: Record<RunState, 'idle' | 'running' | 'paused' | 'emergency'> = {
    idle: 'idle',
    running: 'running',
    paused: 'paused',

    emergency: 'emergency',
  };

  return (
    <header className={["app-toolbar", (qoderProps as any)?.className].filter(Boolean).join(" ")} role="banner" data-component="toolbar" style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 脚本名称 + 保存状态 */}
      <div className="toolbar-section" data-qoder-id="qel-toolbar-section-b7c8c037" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-section-b7c8c037&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;toolbar-section&quot;,&quot;loc&quot;:{&quot;line&quot;:91,&quot;column&quot;:7}}">
        <FileCode2 size={15} className="text-secondary"  data-qoder-id="qel-text-secondary-c2fd4f21" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-secondary-c2fd4f21&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;text-secondary&quot;,&quot;loc&quot;:{&quot;line&quot;:92,&quot;column&quot;:9}}"/>
        <span className="text-md" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} data-qoder-id="qel-text-md-2e2eb21a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-md-2e2eb21a&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;text-md&quot;,&quot;loc&quot;:{&quot;line&quot;:93,&quot;column&quot;:9}}">{scriptName}</span>
        {saved ? (
          <span className="badge toolbar-hide-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} data-qoder-id="qel-badge-eac1b571" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-badge-eac1b571&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;badge&quot;,&quot;loc&quot;:{&quot;line&quot;:95,&quot;column&quot;:11}}">
            <Save size={10}  data-qoder-id="qel-save-1afcc903" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-save-1afcc903&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;save&quot;,&quot;loc&quot;:{&quot;line&quot;:96,&quot;column&quot;:13}}"/> 已保存
          </span>
        ) : (
          <span className="badge toolbar-hide-mobile" style={{ color: 'var(--color-paused)' }} data-qoder-id="qel-badge-e8c1b24b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-badge-e8c1b24b&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;badge&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:11}}">未保存</span>
        )}
      </div>

      <div className="toolbar-divider toolbar-hide-mobile"  data-qoder-id="qel-toolbar-divider-e62325c3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-e62325c3&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:103,&quot;column&quot;:7}}"/>

      {/* 全局运行状态 */}
      <div className="toolbar-section toolbar-hide-mobile" data-qoder-id="qel-toolbar-section-b0c8b532" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-section-b0c8b532&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;toolbar-section&quot;,&quot;loc&quot;:{&quot;line&quot;:106,&quot;column&quot;:7}}">
        <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-3b7fb812" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-3b7fb812&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:107,&quot;column&quot;:9}}">全局状态</span>
        <GlobalStatusBadge state={runStateMap[state.runState]}  data-qoder-id="qel-globalstatusbadge-0cb02d4f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-globalstatusbadge-0cb02d4f&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;globalstatusbadge&quot;,&quot;loc&quot;:{&quot;line&quot;:108,&quot;column&quot;:9}}"/>
      </div>

      <div className="toolbar-spacer"  data-qoder-id="qel-toolbar-spacer-104dd2af" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-spacer-104dd2af&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;toolbar-spacer&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:7}}"/>

      {/* 急停提示 */}
      <div className="toolbar-section toolbar-hide-mobile" data-qoder-id="qel-toolbar-section-1ecba0f3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-section-1ecba0f3&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;toolbar-section&quot;,&quot;loc&quot;:{&quot;line&quot;:114,&quot;column&quot;:7}}">
        <span className="estop-hint" data-qoder-id="qel-estop-hint-2d29d525" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-estop-hint-2d29d525&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;estop-hint&quot;,&quot;loc&quot;:{&quot;line&quot;:115,&quot;column&quot;:9}}">
          <Zap size={13}  data-qoder-id="qel-zap-fe1c9c77" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-zap-fe1c9c77&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;zap&quot;,&quot;loc&quot;:{&quot;line&quot;:116,&quot;column&quot;:11}}"/>
          <span data-qoder-id="qel-span-28e8d206" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-28e8d206&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:117,&quot;column&quot;:11}}">急停</span>
          <kbd className="kbd" data-qoder-id="qel-kbd-67c91175" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-kbd-67c91175&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;kbd&quot;,&quot;loc&quot;:{&quot;line&quot;:118,&quot;column&quot;:11}}">{settings.emergencyHotkey}</kbd>
        </span>
      </div>

      <div className="toolbar-divider toolbar-hide-mobile"  data-qoder-id="qel-toolbar-divider-641b9d58" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-641b9d58&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:122,&quot;column&quot;:7}}"/>

      {/* 主题切换 */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={onToggleTheme}
        data-tooltip={theme === 'light' ? '切换深色' : '切换浅色'}
        aria-label="切换主题"
       data-qoder-id="qel-button-6c6127e7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-6c6127e7&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:125,&quot;column&quot;:7}}">
        {theme === 'light' ? <Moon size={16}  data-qoder-id="qel-moon-910937cf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-moon-910937cf&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;moon&quot;,&quot;loc&quot;:{&quot;line&quot;:131,&quot;column&quot;:30}}"/> : <Sun size={16}  data-qoder-id="qel-sun-c10184ee" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-sun-c10184ee&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;sun&quot;,&quot;loc&quot;:{&quot;line&quot;:131,&quot;column&quot;:51}}"/>}
      </button>

      {/* 急停按钮 */}
      <button
        className="btn btn-danger btn-sm"
        onClick={onEmergencyStop}
        data-tooltip="立即停止所有操作"
        aria-label="紧急停止"
       data-qoder-id="qel-button-67635e9f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-67635e9f&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:135,&quot;column&quot;:7}}">
        <Square size={13} fill="currentColor"  data-qoder-id="qel-square-0a5dbc0e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-square-0a5dbc0e&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Toolbar&quot;,&quot;elementRole&quot;:&quot;square&quot;,&quot;loc&quot;:{&quot;line&quot;:141,&quot;column&quot;:9}}"/>
        急停
      </button>
    </header>
  );
}

function GlobalStatusBadge({ state, ...qoderProps }: { state: 'idle' | 'running' | 'paused' | 'emergency' } & Record<string, any>) {
  const config = {
    idle: { cls: 'status-idle', label: '空闲' },
    running: { cls: 'status-running', label: '运行中' },
    paused: { cls: 'status-paused', label: '已暂停' },
    emergency: { cls: 'status-danger', label: '已急停' },
  };
  const c = config[state];
  return (
    <span className={[(`status-badge ${c.cls}`), (qoderProps as any)?.className].filter(Boolean).join(" ")} style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <span className="dot"  data-qoder-id="qel-dot-b76b890c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dot-b76b890c&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;GlobalStatusBadge&quot;,&quot;elementRole&quot;:&quot;dot&quot;,&quot;loc&quot;:{&quot;line&quot;:158,&quot;column&quot;:7}}"/>
      {c.label}
    </span>
  );
}

/* --- StatusBar --- */
function StatusBar(qoderProps: Record<string, any>) {
  const { state } = useService();

  const runStateLabel: Record<RunState, string> = {
    idle: '空闲',
    running: '运行中',
    paused: '已暂停',

    emergency: '已急停',
  };

  const runStateColor: Record<RunState, string> = {
    idle: 'var(--color-text-secondary)',
    running: 'var(--color-running)',
    paused: 'var(--color-paused)',

    emergency: 'var(--color-danger)',
  };

  return (
    <footer className={["app-statusbar", (qoderProps as any)?.className].filter(Boolean).join(" ")} role="contentinfo" data-component="statusbar" style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <div className="flex items-center gap-xs" data-qoder-id="qel-flex-b75f12de" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-b75f12de&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:186,&quot;column&quot;:7}}">
        <MousePointer size={12}  data-qoder-id="qel-mousepointer-45132725" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-mousepointer-45132725&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;mousepointer&quot;,&quot;loc&quot;:{&quot;line&quot;:187,&quot;column&quot;:9}}"/>
        <span className="text-mono" data-qoder-id="qel-text-mono-50353abd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-50353abd&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:188,&quot;column&quot;:9}}">
          {state.mousePos.x}, {state.mousePos.y}
        </span>
      </div>

      <div className="flex items-center gap-xs" data-qoder-id="qel-flex-b04dbeb8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-b04dbeb8&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:193,&quot;column&quot;:7}}">
        <Keyboard size={12}  data-qoder-id="qel-keyboard-6c690cff" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-keyboard-6c690cff&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;keyboard&quot;,&quot;loc&quot;:{&quot;line&quot;:194,&quot;column&quot;:9}}"/>
        <span data-qoder-id="qel-span-4963bf64" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-4963bf64&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:195,&quot;column&quot;:9}}">{state.keyboardListening ? '键盘监听中' : '未监听'}</span>
      </div>

      <div className="toolbar-spacer"  data-qoder-id="qel-toolbar-spacer-ed1a9586" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-spacer-ed1a9586&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;toolbar-spacer&quot;,&quot;loc&quot;:{&quot;line&quot;:198,&quot;column&quot;:7}}"/>

      <div className="flex items-center gap-xs" data-qoder-id="qel-flex-b44dc504" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-b44dc504&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:200,&quot;column&quot;:7}}">
        {state.runState === 'running' ? <Play size={12} style={{ color: 'var(--color-running)' }}  data-qoder-id="qel-play-53870d89" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-53870d89&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:201,&quot;column&quot;:41}}"/> :
         state.runState === 'paused' ? <Pause size={12} style={{ color: 'var(--color-paused)' }}  data-qoder-id="qel-pause-fe214a48" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-pause-fe214a48&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;pause&quot;,&quot;loc&quot;:{&quot;line&quot;:202,&quot;column&quot;:40}}"/> :
         state.runState === 'emergency' ? <Zap size={12} style={{ color: 'var(--color-danger)' }}  data-qoder-id="qel-zap-61cf8a37" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-zap-61cf8a37&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;zap&quot;,&quot;loc&quot;:{&quot;line&quot;:203,&quot;column&quot;:43}}"/> :
         null}
        <span style={{ color: runStateColor[state.runState] }} data-qoder-id="qel-span-4363b5f2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-4363b5f2&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:205,&quot;column&quot;:9}}">
          {runStateLabel[state.runState]}
        </span>
      </div>

      {state.countdownRemaining > 0 && (
        <div className="badge" style={{ color: 'var(--color-action-primary)', background: 'var(--color-info-bg)' }} data-qoder-id="qel-badge-84ec36fd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-badge-84ec36fd&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;StatusBar&quot;,&quot;elementRole&quot;:&quot;badge&quot;,&quot;loc&quot;:{&quot;line&quot;:211,&quot;column&quot;:9}}">
          倒计时 {state.countdownRemaining}s
        </div>
      )}
    </footer>
  );
}

/* --- Layout Shell --- */
interface LayoutProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  scriptName: string;
  saved: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onEmergencyStop: () => void;
  children: ReactNode;
}

export function Layout(props: LayoutProps & Record<string, any>) {
  const { emergencyStop, settings } = useService();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (matchesHotkey(e, settings.emergencyHotkey)) {
      e.preventDefault();
      void emergencyStop().catch(() => undefined);
    }
  }, [emergencyStop, settings.emergencyHotkey]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={["app-shell", (props as any)?.className].filter(Boolean).join(" ")} data-component="app-shell" style={(props as any)?.style} data-qoder-id={(props as any)?.["data-qoder-id"]} data-qoder-source={(props as any)?.["data-qoder-source"]}>
      <Sidebar activePage={props.activePage} onNavigate={props.onPageChange}  data-qoder-id="qel-sidebar-2c38f8f1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-sidebar-2c38f8f1&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Layout&quot;,&quot;elementRole&quot;:&quot;sidebar&quot;,&quot;loc&quot;:{&quot;line&quot;:249,&quot;column&quot;:7}}"/>
      <div className="app-main" data-component="app-main" data-qoder-id="qel-app-main-721867b0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-app-main-721867b0&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Layout&quot;,&quot;elementRole&quot;:&quot;app-main&quot;,&quot;loc&quot;:{&quot;line&quot;:250,&quot;column&quot;:7}}">
        <Toolbar
          scriptName={props.scriptName}
          saved={props.saved}
          currentPage={props.activePage}
          theme={props.theme}
          onToggleTheme={props.onToggleTheme}
          onEmergencyStop={props.onEmergencyStop}
         data-qoder-id="qel-toolbar-2d3b2fe7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-2d3b2fe7&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Layout&quot;,&quot;elementRole&quot;:&quot;toolbar&quot;,&quot;loc&quot;:{&quot;line&quot;:251,&quot;column&quot;:9}}"/>
        <main className="app-content" data-component="app-content" data-qoder-id="qel-app-content-0d7793b6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-app-content-0d7793b6&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Layout&quot;,&quot;elementRole&quot;:&quot;app-content&quot;,&quot;loc&quot;:{&quot;line&quot;:259,&quot;column&quot;:9}}">
          {props.children}
        </main>
        <StatusBar  data-qoder-id="qel-statusbar-38d16ef9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statusbar-38d16ef9&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/Layout.tsx&quot;,&quot;componentName&quot;:&quot;Layout&quot;,&quot;elementRole&quot;:&quot;statusbar&quot;,&quot;loc&quot;:{&quot;line&quot;:262,&quot;column&quot;:9}}"/>
      </div>
    </div>
  );
}
