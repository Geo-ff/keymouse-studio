/* =========================================================================
   MiniStatus — 置顶小窗（Electron 中以 index.html#mini 加载）
   只显示状态；按钮通过主进程转给主窗口执行，避免两个窗口的状态不一致
   ========================================================================= */

import { useEffect, type CSSProperties } from 'react';
import { Pause, Play, Square, Zap, Maximize2, X } from 'lucide-react';
import { useService } from '../hooks/useService';
import { describeActivity } from '../utils/activityStatus';
import { formatHotkeyLabel } from '../utils/hotkey';

type MiniCommand = 'pauseToggle' | 'stopActive' | 'emergency' | 'showMain';

const drag = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties;

const TONE_COLOR = {
  idle: 'var(--color-text-tertiary)',
  running: 'var(--color-running)',
  paused: 'var(--color-paused)',
  emergency: 'var(--color-danger)',
} as const;

function send(command: MiniCommand) {
  void window.desktop?.sendMiniCommand?.(command).catch(() => undefined);
}

export function MiniStatus() {
  const { state, settings, ready } = useService();
  const activity = describeActivity(state);
  const active = activity.tone === 'running' || activity.tone === 'paused';
  const canPause = active && state.snapshot.state !== 'countdown' && state.snapshot.state !== 'stopping';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.title = 'KeyMouse Studio 小窗';
  }, [settings.theme]);

  return (
    <div
      className="mini-status"
      style={{
        ...drag,
        height: '100vh',
        boxSizing: 'border-box',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TONE_COLOR[activity.tone] }} />
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={activity.title}>
          {ready ? activity.title : '正在连接…'}
        </span>
        <button className="btn btn-ghost btn-icon" style={noDrag} data-tooltip="打开主窗口" aria-label="打开主窗口" onClick={() => send('showMain')}>
          <Maximize2 size={13} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          style={noDrag}
          data-tooltip="关闭小窗"
          aria-label="关闭小窗"
          onClick={() => { void window.desktop?.toggleMiniWindow?.(false); }}
        >
          <X size={13} />
        </button>
      </div>
      <div className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {activity.detail}
      </div>
      <div style={{ ...noDrag, display: 'flex', gap: 6, marginTop: 'auto' }}>
        <button className="btn btn-secondary btn-sm" disabled={!canPause} onClick={() => send('pauseToggle')} style={{ flex: 1 }}>
          {state.runState === 'paused' ? <Play size={12} /> : <Pause size={12} />}
          {state.runState === 'paused' ? '继续' : '暂停'}
        </button>
        <button className="btn btn-secondary btn-sm" disabled={!active} onClick={() => send('stopActive')} style={{ flex: 1 }}>
          <Square size={12} fill="currentColor" /> 停止
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => send('emergency')} style={{ flex: 1 }} data-tooltip={`急停（${formatHotkeyLabel(settings.emergencyHotkey, 'F12')}）`}>
          <Zap size={12} /> 急停
        </button>
      </div>
    </div>
  );
}
