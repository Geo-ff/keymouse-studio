/* =========================================================================
   Recording — 键鼠录制页面
   录制状态、时长、动作数量、实时动作流
   ========================================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  Play,
  Pause,
  Square,
  Save,
  Trash2,
  MousePointer,
  MousePointerClick,
  Scroll,
  Keyboard,
  Clock,
} from 'lucide-react';
import { useService } from '../hooks/useService';
import { usePageHotkeys } from '../hooks/usePageHotkeys';
import { Button, IconButton, Toggle, Input, EmptyState, ConfirmDialog } from '../components/ui';
import { formatTime, formatDuration } from '../data/mockData';
import type { ScriptAction, ActionType } from '../types';
import type { PageId } from '../components/Layout';
import { useToast } from '../providers/ToastProvider';
import { showSystemAlert } from '../utils/systemAlert';
import { formatHotkeyLabel } from '../utils/hotkey';
import { resolveCountdownMs } from '../utils/countdown';

const ACTION_ICONS: Record<ActionType, typeof MousePointer> = {
  mouse_move: MousePointer,
  mouse_click: MousePointerClick,
  mouse_button_down: MousePointerClick,
  mouse_button_up: MousePointerClick,
  mouse_wheel: Scroll,
  key_down: Keyboard,
  key_up: Keyboard,
  wait: Clock,
};

const ACTION_COLORS: Record<ActionType, string> = {
  mouse_move: 'var(--color-action-primary)',
  mouse_click: 'var(--color-action-primary)',
  mouse_button_down: 'var(--color-action-primary)',
  mouse_button_up: 'var(--color-action-primary)',
  mouse_wheel: 'var(--color-paused)',
  key_down: 'var(--color-running)',
  key_up: 'var(--color-running)',
  wait: 'var(--color-text-tertiary)',
};

const ACTION_LABELS: Record<ActionType, string> = {
  mouse_move: '鼠标移动',
  mouse_click: '鼠标点击',
  mouse_button_down: '鼠标按下',
  mouse_button_up: '鼠标释放',
  mouse_wheel: '滚轮滚动',
  key_down: '键盘按下',
  key_up: '键盘释放',
  wait: '等待',
};

function summarizeAction(a: ScriptAction): string {
  switch (a.type) {
    case 'mouse_move': return `(${a.payload.x}, ${a.payload.y})`;
    case 'mouse_button_down': return `${a.payload.button}键按下`;
    case 'mouse_button_up': return `${a.payload.button}键释放`;
    case 'mouse_click': return `${a.payload.button}键 ${a.payload.clickCount === 2 ? '双击' : '单击'} (${a.payload.x ?? '当前'}, ${a.payload.y ?? '当前'})`;
    case 'mouse_wheel': return `滚动 ${a.payload.deltaY}`;
    case 'key_down': return `按下 ${a.payload.keyCode}`;
    case 'key_up': return `释放 ${a.payload.keyCode}`;
    case 'wait': return formatDuration(a.payload.durationMs);
  }
}

interface RecordingProps {
  onNavigate: (page: PageId) => void;
  onActionsSaved: (actions: ScriptAction[], name: string) => Promise<void>;
}

export function Recording({ onNavigate, onActionsSaved, ...qoderProps }: RecordingProps & Record<string, any>) {
  const { startRecording, pauseRecording, resumeRecording, stopRecording, discardRecording, getRecordingResult, state, settings } = useService();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [scriptName, setScriptName] = useState('');
  const [displayTime, setDisplayTime] = useState(0);
  const displayTimeRef = useRef(0);

  const isRecording = state.snapshot.operationType === 'recording' && state.recordingState === 'recording';
  const isPaused = state.snapshot.operationType === 'recording' && state.recordingState === 'paused';
  const hasActions = state.recordingActions.length > 0;
  const workspaceClearedRef = useRef(false);

  useEffect(() => {
    if (workspaceClearedRef.current) return;
    workspaceClearedRef.current = true;
    const recordingActive =
      state.snapshot.operationType === 'recording' &&
      (state.recordingState === 'recording' || state.recordingState === 'paused');
    if (recordingActive) return;
    if (state.recordingState === 'idle' && state.recordingActions.length === 0) return;
    void discardRecording();
    setScriptName('');
    displayTimeRef.current = 0;
    setDisplayTime(0);
  }, [discardRecording, state.snapshot.operationType, state.recordingState, state.recordingActions.length]);

  useEffect(() => {
    if (state.recordingState === 'stopped') {
      displayTimeRef.current = state.recordingTime;
      setDisplayTime(state.recordingTime);
      return;
    }
    if (!isRecording) return;
    const baseTime = displayTimeRef.current;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const next = baseTime + performance.now() - startedAt;
      displayTimeRef.current = next;
      setDisplayTime(next);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRecording, state.recordingState, state.recordingTime]);

  const handleStart = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      setScriptName(`录制脚本 ${new Date().toLocaleString('zh-CN')}`);
      displayTimeRef.current = 0;
      setDisplayTime(0);
      const countdownMs = resolveCountdownMs(settings);
      if (countdownMs > 0) {
        void showSystemAlert('录制', '倒计时开始', `${Math.round(countdownMs / 1000)} 秒后开始录制`);
        await new Promise<void>(resolve => { window.setTimeout(resolve, countdownMs); });
      }
      await startRecording({
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
      });
      void showSystemAlert('录制', '录制已开始', '正在记录键鼠操作');
    } finally {
      setPending(false);
    }
  }, [pending, startRecording, settings]);

  const handlePause = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      if (isPaused) await resumeRecording();
      else await pauseRecording();
    } finally {
      setPending(false);
    }
  }, [pending, pauseRecording, resumeRecording, isPaused]);

  const handleStop = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const wasActive = state.recordingState === 'recording' || state.recordingState === 'paused';
      await stopRecording();
      if (wasActive) {
        void showSystemAlert('录制', '录制已结束', '可保存为脚本，或丢弃本次录制结果');
      }
    } finally {
      setPending(false);
    }
  }, [pending, stopRecording, state.recordingState]);

  const handleSave = useCallback(async () => {
    if (pending || !scriptName.trim()) return;
    setPending(true);
    try {
      const wasActive = state.recordingState === 'recording' || state.recordingState === 'paused';
      const stopped = await stopRecording();
      if (wasActive) {
        void showSystemAlert('录制', '录制已结束', '正在保存脚本');
      }
      const result = await getRecordingResult(stopped.recordingResultId);
      await onActionsSaved(result.actions, scriptName.trim());
      onNavigate('script');
    } finally {
      setPending(false);
    }
  }, [pending, scriptName, stopRecording, getRecordingResult, onActionsSaved, onNavigate, state.recordingState]);

  const handleDiscard = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await discardRecording();
      setShowDiscardConfirm(false);
      setScriptName('');
      displayTimeRef.current = 0;
      setDisplayTime(0);
      toast.success('录制结果已丢弃');
    } finally {
      setPending(false);
    }
  }, [pending, discardRecording, toast]);

  // Window-local fallback when Electron global shortcuts are unavailable
  usePageHotkeys(useMemo(() => {
    if (typeof window !== 'undefined' && window.desktop?.setGlobalHotkeys) return [];
    return [
      {
        hotkey: settings.recordStartHotkey,
        enabled: !pending && (state.recordingState === 'idle' || state.recordingState === 'stopped'),
        handler: () => { void handleStart(); },
      },
      {
        hotkey: settings.recordStopHotkey,
        enabled: !pending && (isRecording || isPaused),
        handler: () => { void handleStop(); },
      },
    ];
  }, [settings.recordStartHotkey, settings.recordStopHotkey, pending, state.recordingState, isRecording, isPaused, handleStart, handleStop]));

  useEffect(() => {
    const onGlobal = (event: Event) => {
      const actionId = (event as CustomEvent<{ actionId: string }>).detail?.actionId;
      if (actionId === 'recordStart') {
        if (!pending && (state.recordingState === 'idle' || state.recordingState === 'stopped')) {
          void handleStart();
        }
        return;
      }
      if (actionId === 'recordStop') {
        if (!pending && (isRecording || isPaused)) {
          void handleStop();
        }
      }
    };
    window.addEventListener('keymouse-global-hotkey', onGlobal);
    return () => window.removeEventListener('keymouse-global-hotkey', onGlobal);
  }, [pending, state.recordingState, isRecording, isPaused, handleStart, handleStop]);

  // Type distribution
  const typeCounts: Partial<Record<ActionType, number>> = {};
  state.recordingActions.forEach(a => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });

  return (
    <div style={{ ...({ display: 'flex', gap: 'var(--space-lg)', height: '100%' }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <ConfirmDialog
        open={showDiscardConfirm}
        title="丢弃本次录制？"
        description="录制动作将从当前工作区清空，此操作无法撤销。"
        confirmLabel="确认丢弃"
        pending={pending}
        onConfirm={() => void handleDiscard()}
        onCancel={() => setShowDiscardConfirm(false)}
      />
      {/* 左侧主区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', minWidth: 0 }} data-qoder-id="qel-div-3dfdb5df" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-3dfdb5df&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:108,&quot;column&quot;:7}}">
        {/* 录制状态 */}
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }} data-qoder-id="qel-panel-7117c251" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-7117c251&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:110,&quot;column&quot;:9}}">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }} data-qoder-id="qel-div-3bfdb2b9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-3bfdb2b9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:11}}">
            {isRecording && <span className="recording-pulse"  data-qoder-id="qel-recording-pulse-85bff953" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-recording-pulse-85bff953&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;recording-pulse&quot;,&quot;loc&quot;:{&quot;line&quot;:112,&quot;column&quot;:29}}"/>}
            <div data-qoder-id="qel-div-39fdaf93" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-39fdaf93&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:113,&quot;column&quot;:13}}">
              <div className="text-sm text-secondary" data-qoder-id="qel-text-sm-2428002d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-2428002d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:114,&quot;column&quot;:15}}">录制状态</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: isRecording ? 'var(--color-danger)' : isPaused ? 'var(--color-paused)' : 'var(--color-text-primary)' }} data-qoder-id="qel-div-47fdc59d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-47fdc59d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:115,&quot;column&quot;:15}}">
                {isRecording ? '录制中' : isPaused ? '已暂停' : state.recordingState === 'stopped' ? '已停止' : '未开始'}
              </div>
            </div>
          </div>
          <div className="toolbar-divider"  data-qoder-id="qel-toolbar-divider-8c3d2fd2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-8c3d2fd2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:120,&quot;column&quot;:11}}"/>
          <div data-qoder-id="qel-div-6b677ce6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-6b677ce6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:121,&quot;column&quot;:11}}">
            <div className="text-sm text-secondary" data-qoder-id="qel-text-sm-02e91b3e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-02e91b3e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:122,&quot;column&quot;:13}}">录制时长</div>
            <div className="text-mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }} data-qoder-id="qel-text-mono-4ee8aa6e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-4ee8aa6e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:123,&quot;column&quot;:13}}">
               {formatTime(displayTime)}
            </div>
          </div>
          <div className="toolbar-divider"  data-qoder-id="qel-toolbar-divider-b566001b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-b566001b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:127,&quot;column&quot;:11}}"/>
          <div data-qoder-id="qel-div-6f678332" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-6f678332&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:128,&quot;column&quot;:11}}">
            <div className="text-sm text-secondary" data-qoder-id="qel-text-sm-06e9218a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-06e9218a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:129,&quot;column&quot;:13}}">动作数量</div>
            <div className="text-mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }} data-qoder-id="qel-text-mono-52e8b0ba" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-52e8b0ba&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:130,&quot;column&quot;:13}}">
              {state.recordingActionCount}
            </div>
          </div>
        </div>

        {/* 动作类型分布 */}
        {hasActions && (
          <div className="panel" data-qoder-id="qel-panel-fe61d914" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-fe61d914&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:138,&quot;column&quot;:11}}">
            <div className="panel-header" data-qoder-id="qel-panel-header-80a3e4b3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-80a3e4b3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:139,&quot;column&quot;:13}}">
              <span className="panel-title" data-qoder-id="qel-panel-title-ffb21880" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-ffb21880&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:140,&quot;column&quot;:15}}">类型分布</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }} data-qoder-id="qel-div-8565673d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-8565673d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:142,&quot;column&quot;:13}}">
              {Object.entries(typeCounts).map(([type, count]) => {
                const Icon = ACTION_ICONS[type as ActionType];
                return (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-div-846565aa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-846565aa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:146,&quot;column&quot;:19}}">
                    <Icon size={14} style={{ color: ACTION_COLORS[type as ActionType] }}  data-qoder-id="qel-icon-9cfd38f9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-icon-9cfd38f9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;icon&quot;,&quot;loc&quot;:{&quot;line&quot;:147,&quot;column&quot;:21}}"/>
                    <span className="text-sm" data-qoder-id="qel-text-sm-63a45c90" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-63a45c90&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:148,&quot;column&quot;:21}}">{ACTION_LABELS[type as ActionType]}</span>
                    <span className="badge text-mono" data-qoder-id="qel-badge-efd192a6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-badge-efd192a6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;badge&quot;,&quot;loc&quot;:{&quot;line&quot;:149,&quot;column&quot;:21}}">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 控制按钮 */}
        <div className="panel" style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', flexWrap: 'wrap' }} data-qoder-id="qel-panel-00641ad1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-00641ad1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:158,&quot;column&quot;:9}}">
          {state.recordingState === 'stopped' && (
            <div className="field-group" style={{ width: 240 }}>
              <label className="field-label">脚本名称</label>
              <Input
                value={scriptName}
                onChange={event => setScriptName(event.target.value.slice(0, 200))}
                maxLength={200}
                disabled={pending}
              />
            </div>
          )}
          {state.recordingState === 'idle' && (
            <Button variant="danger" icon={<Circle size={14} fill="currentColor"  data-qoder-id="qel-circle-bf61af68" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-circle-bf61af68&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;circle&quot;,&quot;loc&quot;:{&quot;line&quot;:160,&quot;column&quot;:44}}"/>} onClick={handleStart} disabled={pending} data-qoder-id="qel-button-7c641c03" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-7c641c03&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:160,&quot;column&quot;:13}}">
              开始录制
            </Button>
          )}
          {(isRecording || isPaused) && (
            <>
              <Button
                variant={isPaused ? 'running' : 'paused'}
                icon={isPaused ? <Play size={14}  data-qoder-id="qel-play-cd258f66" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-cd258f66&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:168,&quot;column&quot;:34}}"/> : <Pause size={14}  data-qoder-id="qel-pause-e7fa9e18" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-pause-e7fa9e18&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;pause&quot;,&quot;loc&quot;:{&quot;line&quot;:168,&quot;column&quot;:55}}"/>}
                onClick={handlePause}
                disabled={pending}
               data-qoder-id="qel-button-8a64320d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-8a64320d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:166,&quot;column&quot;:15}}">
                {isPaused ? '继续录制' : '暂停'}
              </Button>
              <Button variant="secondary" icon={<Square size={14} fill="currentColor"  data-qoder-id="qel-square-a7353bfc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-square-a7353bfc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;square&quot;,&quot;loc&quot;:{&quot;line&quot;:173,&quot;column&quot;:49}}"/>} onClick={handleStop} disabled={pending} data-qoder-id="qel-button-7d61deff" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-7d61deff&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:173,&quot;column&quot;:15}}">
                停止录制
              </Button>
            </>
          )}
          {state.recordingState === 'stopped' && (
            <>
              <div className="text-sm text-tertiary" style={{ width: '100%', lineHeight: 1.6 }}>
                可用快捷键控制录制：开始 {formatHotkeyLabel(settings.recordStartHotkey)} · 停止 {formatHotkeyLabel(settings.recordStopHotkey)}。
                可在「设置 → 录制 / 回放快捷键」中自定义；推荐 F9 开始、F10 停止。
              </div>
              <Button variant="primary" icon={<Save size={14}  data-qoder-id="qel-save-8bfa1432" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-save-8bfa1432&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;save&quot;,&quot;loc&quot;:{&quot;line&quot;:180,&quot;column&quot;:47}}"/>} onClick={handleSave} disabled={pending || !hasActions || !scriptName.trim()} data-qoder-id="qel-button-7f61e225" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-7f61e225&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:180,&quot;column&quot;:15}}">
                保存为脚本
              </Button>
              <Button variant="secondary" icon={<Circle size={14}  data-qoder-id="qel-circle-3e5ea5be" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-circle-3e5ea5be&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;circle&quot;,&quot;loc&quot;:{&quot;line&quot;:183,&quot;column&quot;:49}}"/>} onClick={handleStart} data-qoder-id="qel-button-7961d8b3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-7961d8b3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:183,&quot;column&quot;:15}}">
                重新录制
              </Button>
              <Button variant="ghost" icon={<Trash2 size={14}  data-qoder-id="qel-trash2-545431ec" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-trash2-545431ec&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;trash2&quot;,&quot;loc&quot;:{&quot;line&quot;:186,&quot;column&quot;:45}}"/>} onClick={() => setShowDiscardConfirm(true)} disabled={pending} data-qoder-id="qel-button-7b61dbd9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-7b61dbd9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:186,&quot;column&quot;:15}}">
                丢弃
              </Button>
            </>
          )}
        </div>

        {/* 实时动作流 */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0 }} data-qoder-id="qel-panel-706709b8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-706709b8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:194,&quot;column&quot;:9}}">
          <div className="panel-header" style={{ padding: 'var(--space-md) var(--space-lg)', margin: 0 }} data-qoder-id="qel-panel-header-faab6086" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-faab6086&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:195,&quot;column&quot;:11}}">
            <span className="panel-title" data-qoder-id="qel-panel-title-7bb99779" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-7bb99779&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:196,&quot;column&quot;:13}}">动作流</span>
            <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-ecb2abc5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-ecb2abc5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:197,&quot;column&quot;:13}}">{state.recordingActions.length} 条</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} data-qoder-id="qel-div-fa600f3e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-fa600f3e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:199,&quot;column&quot;:11}}">
            {!hasActions ? (
              <EmptyState
                icon={<Circle size={28} />}
                title="暂无录制数据"
                description="点击「开始录制」按钮开始捕获鼠标和键盘操作"
               data-qoder-id="qel-emptystate-69946bcb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-emptystate-69946bcb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;emptystate&quot;,&quot;loc&quot;:{&quot;line&quot;:201,&quot;column&quot;:15}}"/>
            ) : (
              <table className="data-table" data-qoder-id="qel-data-table-78335281" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-data-table-78335281&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;data-table&quot;,&quot;loc&quot;:{&quot;line&quot;:207,&quot;column&quot;:15}}">
                <thead data-qoder-id="qel-thead-9e531d45" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-thead-9e531d45&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;thead&quot;,&quot;loc&quot;:{&quot;line&quot;:208,&quot;column&quot;:17}}">
                  <tr data-qoder-id="qel-tr-10dd2f9e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tr-10dd2f9e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;tr&quot;,&quot;loc&quot;:{&quot;line&quot;:209,&quot;column&quot;:19}}">
                    <th style={{ width: 40 }} data-qoder-id="qel-th-fa48f557" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-fa48f557&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:210,&quot;column&quot;:21}}">#</th>
                    <th style={{ width: 80 }} data-qoder-id="qel-th-f948f3c4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-f948f3c4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:211,&quot;column&quot;:21}}">类型</th>
                    <th data-qoder-id="qel-th-ec46a0b6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-ec46a0b6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:212,&quot;column&quot;:21}}">参数</th>
                    <th style={{ width: 100 }} data-qoder-id="qel-th-ed46a249" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-ed46a249&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:213,&quot;column&quot;:21}}">延迟</th>
                  </tr>
                </thead>
                <tbody data-qoder-id="qel-tbody-b3d0ddb8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tbody-b3d0ddb8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;tbody&quot;,&quot;loc&quot;:{&quot;line&quot;:216,&quot;column&quot;:17}}">
                  {state.recordingActions.slice(-200).reverse().map((action, idx) => {
                    const Icon = ACTION_ICONS[action.type];
                    const num = state.recordingActions.length - idx;
                    return (
                      <tr key={action.id} data-qoder-id="qel-tr-0cdaeabb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tr-0cdaeabb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;tr&quot;,&quot;loc&quot;:{&quot;line&quot;:221,&quot;column&quot;:23}}">
                        <td className="text-mono text-tertiary" data-qoder-id="qel-text-mono-fc2e33e7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-fc2e33e7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:222,&quot;column&quot;:25}}">{num}</td>
                        <td data-qoder-id="qel-td-ceb902bd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-td-ceb902bd&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;td&quot;,&quot;loc&quot;:{&quot;line&quot;:223,&quot;column&quot;:25}}">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} data-qoder-id="qel-span-128d303c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-128d303c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:224,&quot;column&quot;:27}}">
                            <Icon size={13} style={{ color: ACTION_COLORS[action.type] }}  data-qoder-id="qel-icon-200045c9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-icon-200045c9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;icon&quot;,&quot;loc&quot;:{&quot;line&quot;:225,&quot;column&quot;:29}}"/>
                            <span className="text-sm" data-qoder-id="qel-text-sm-ecb06d2e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-ecb06d2e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:226,&quot;column&quot;:29}}">{ACTION_LABELS[action.type]}</span>
                          </span>
                        </td>
                        <td className="text-sm text-mono" data-qoder-id="qel-text-sm-a9a9c0b5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-a9a9c0b5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:229,&quot;column&quot;:25}}">{summarizeAction(action)}</td>
                        <td className="text-mono text-sm text-tertiary" data-qoder-id="qel-text-mono-66268c00" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-66268c00&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Recording.tsx&quot;,&quot;componentName&quot;:&quot;Recording&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:230,&quot;column&quot;:25}}">{formatDuration(action.delayBeforeMs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
