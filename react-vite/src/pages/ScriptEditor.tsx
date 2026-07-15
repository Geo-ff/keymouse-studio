/* =========================================================================
   ScriptEditor — 脚本编辑器（核心页面）
   左侧动作列表 + 右侧属性面板 + 顶部工具栏
   支持新增、编辑、删除、拖拽排序、启用/禁用、多选、运行高亮
   ========================================================================= */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { DragEvent } from 'react';
import {
  FilePlus2,
  FolderOpen,
  Save,
  Save as SaveIcon,
  Circle,
  Play,
  Pause,
  Square,
  Trash2,
  Copy,
  GripVertical,
  MousePointer,
  MousePointerClick,
  Scroll,
  Keyboard,
  Clock,
  Plus,
  ChevronUp,
  ChevronDown,
  Repeat,
  Infinity as InfinityIcon,
  Timer,
} from 'lucide-react';
import { useService } from '../hooks/useService';
import { usePageHotkeys } from '../hooks/usePageHotkeys';
import { Button, IconButton, Toggle, Input, Select, RadioGroup, EmptyState, ProgressBar } from '../components/ui';
import { formatDuration, formatTime, createAction, createEmptyScript } from '../data/mockData';
import type { ScriptAction, ActionType, MouseButton, Script, PlaybackOptions, EditorLoopMode } from '../types';
import { genId } from '../services/AutomationService';
import type { PageId } from '../components/Layout';

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

const KEYS = ['Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'Delete', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A', 'Ctrl+S', 'Alt+Tab', 'Win+D', 'F5', 'Shift+Tab'];

interface ScriptEditorProps {
  script: Script;
  onScriptChange: (script: Script) => void;
  onScriptSave: (script: Script) => Promise<void>;
  onNavigate: (page: PageId) => void;

}

function summarizeAction(a: ScriptAction): string {
  switch (a.type) {
    case 'mouse_move': return `移动到 (${a.payload.x}, ${a.payload.y})`;
    case 'mouse_button_down': return `${a.payload.button === 'left' ? '左' : a.payload.button === 'right' ? '右' : '中'}键按下`;
    case 'mouse_button_up': return `${a.payload.button === 'left' ? '左' : a.payload.button === 'right' ? '右' : '中'}键释放`;
    case 'mouse_click': return `${a.payload.button === 'left' ? '左' : a.payload.button === 'right' ? '右' : '中'}键${a.payload.clickCount === 2 ? '双击' : '单击'} (${a.payload.x ?? '当前'}, ${a.payload.y ?? '当前'})`;
    case 'mouse_wheel': return `滚动 ${a.payload.deltaY > 0 ? '↓' : '↑'} ${Math.abs(a.payload.deltaY)}`;
    case 'key_down': return `按下 ${a.payload.keyCode}`;
    case 'key_up': return `释放 ${a.payload.keyCode}`;
    case 'wait': return formatDuration(a.payload.durationMs);
  }
}

export function ScriptEditor({ script, onScriptChange, onScriptSave, onNavigate, ...qoderProps }: ScriptEditorProps & Record<string, any>) {
  const { playback, pausePlayback, resumePlayback, stopPlayback, state, settings } = useService();
  const [actions, setActions] = useState<ScriptAction[]>(script.actions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loopMode, setLoopMode] = useState<EditorLoopMode>('count');
  const [loopCount, setLoopCount] = useState(1);
  const [loopDurationMin, setLoopDurationMin] = useState(1);
  const [loopDurationSec, setLoopDurationSec] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const dragCounter = useRef(0);

  const isPlaying = state.snapshot.operationType === 'playback' && (state.runState === 'running' || state.runState === 'paused');
  const isPaused = state.snapshot.operationType === 'playback' && state.runState === 'paused';
  const isEmpty = actions.length === 0;

  const editingAction = useMemo(() => actions.find(a => a.id === editingId) || null, [actions, editingId]);
  const currentPlaybackIndex = state.playbackCurrentIndex;

  // Sync with script prop
  const scriptRef = useRef(script);
  if (scriptRef.current !== script && script.actions !== actions) {
    scriptRef.current = script;
    setActions(script.actions);
    setSelectedIds(new Set());
    setEditingId(null);
  }

  const updateActions = useCallback((newActions: ScriptAction[]) => {
    setActions(newActions);
    onScriptChange({ ...script, actions: newActions, updatedAt: new Date().toISOString() });
  }, [script, onScriptChange]);

  /* --- Selection --- */
  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
    setEditingId(id);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === actions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actions.map(a => a.id)));
    }
  }, [actions, selectedIds.size]);

  /* --- Add Actions --- */
  const addAction = useCallback((type: ActionType) => {
    const newAction = createAction(type);
    updateActions([...actions, newAction]);
    setEditingId(newAction.id);
    setShowAddMenu(false);
  }, [actions, updateActions]);

  const updateAction = useCallback((id: string, updated: ScriptAction) => {
    updateActions(actions.map(action => action.id === id ? updated : action));
  }, [actions, updateActions]);

  /* --- Delete --- */
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    updateActions(actions.filter(a => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    setEditingId(null);
  }, [actions, selectedIds, updateActions]);

  /* --- Duplicate --- */
  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const newActions: ScriptAction[] = [];
    actions.forEach(a => {
      newActions.push(a);
      if (selectedIds.has(a.id)) {
        newActions.push({ ...a, id: genId() });
      }
    });
    updateActions(newActions);
  }, [actions, selectedIds, updateActions]);

  /* --- Toggle Enabled --- */
  const toggleEnabled = useCallback((id: string) => {
    updateActions(actions.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, [actions, updateActions]);

  /* --- Move Up/Down --- */
  const moveAction = useCallback((id: string, direction: 'up' | 'down') => {
    const idx = actions.findIndex(a => a.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= actions.length) return;
    const newActions = [...actions];
    [newActions[idx], newActions[newIdx]] = [newActions[newIdx], newActions[idx]];
    updateActions(newActions);
  }, [actions, updateActions]);

  /* --- Drag and Drop --- */
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  }, [dragOverId]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const dragIdx = actions.findIndex(a => a.id === dragId);
    const targetIdx = actions.findIndex(a => a.id === targetId);
    if (dragIdx < 0 || targetIdx < 0) return;
    const newActions = [...actions];
    const [moved] = newActions.splice(dragIdx, 1);
    newActions.splice(targetIdx, 0, moved);
    updateActions(newActions);
    setDragId(null);
    setDragOverId(null);
  }, [actions, dragId, updateActions]);

  /* --- Playback --- */
  const handleRun = useCallback(() => {
    const enabledActions = actions.filter(a => a.enabled);
    if (enabledActions.length === 0) return;
    const options: PlaybackOptions = {
      times: loopMode === 'count' ? Math.max(1, loopCount) : 1,
      speedMultiplier,
      loop: loopMode === 'infinite',
      loopMode,
      loopDurationMs: loopMode === 'duration' ? (loopDurationMin * 60 + loopDurationSec) * 1000 : undefined,
    };
    void playback({ ...script, actions: enabledActions }, options).catch(() => undefined);
  }, [actions, script, playback, loopMode, loopCount, loopDurationMin, loopDurationSec, speedMultiplier]);

  const handlePause = useCallback(() => {
    if (isPaused) void resumePlayback().catch(() => undefined);
    else void pausePlayback().catch(() => undefined);
  }, [pausePlayback, resumePlayback, isPaused]);

  const handleStop = useCallback(() => {
    void stopPlayback().catch(() => undefined);
  }, [stopPlayback]);

  const handleNameChange = useCallback((name: string) => {
    onScriptChange({ ...script, name: name.slice(0, 200), updatedAt: new Date().toISOString() });
  }, [script, onScriptChange]);

  const handleSave = useCallback(() => {
    if (!script.name.trim()) return;
    void onScriptSave({ ...script, name: script.name.trim(), actions });
  }, [onScriptSave, script, actions]);

  usePageHotkeys(useMemo(() => [
    {
      hotkey: settings.playbackStartHotkey,
      enabled: !isPlaying && actions.some(a => a.enabled),
      handler: handleRun,
    },
    {
      hotkey: settings.playbackStopHotkey,
      enabled: isPlaying || isPaused,
      handler: handleStop,
    },
  ], [settings.playbackStartHotkey, settings.playbackStopHotkey, isPlaying, isPaused, actions, handleRun, handleStop]));

  return (
    <div style={{ ...({ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 顶部工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }} data-qoder-id="qel-div-ff004509" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ff004509&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:275,&quot;column&quot;:7}}">
        <Button variant="secondary" size="sm" icon={<FilePlus2 size={13}  data-qoder-id="qel-fileplus2-4b671153" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-fileplus2-4b671153&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;fileplus2&quot;,&quot;loc&quot;:{&quot;line&quot;:276,&quot;column&quot;:53}}"/>} onClick={() => { onScriptChange(createEmptyScript()); setActions([]); setEditingId(null); setSelectedIds(new Set()); }} data-qoder-id="qel-button-874a436e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-874a436e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:276,&quot;column&quot;:9}}">
          新建
        </Button>
        <Button variant="secondary" size="sm" icon={<FolderOpen size={13}  data-qoder-id="qel-folderopen-48c1b1f5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-folderopen-48c1b1f5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;folderopen&quot;,&quot;loc&quot;:{&quot;line&quot;:279,&quot;column&quot;:53}}"/>} onClick={() => onNavigate('manager')} data-qoder-id="qel-button-894a4694" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-894a4694&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:279,&quot;column&quot;:9}}">
          打开
        </Button>
        <Input
          value={script.name}
          onChange={event => handleNameChange(event.target.value)}
          placeholder="脚本名称"
          maxLength={200}
          disabled={isPlaying}
          style={{ width: 180 }}
        />
        <Button variant="secondary" size="sm" icon={<SaveIcon size={13}  data-qoder-id="qel-saveicon-7eb7f443" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-saveicon-7eb7f443&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;saveicon&quot;,&quot;loc&quot;:{&quot;line&quot;:282,&quot;column&quot;:53}}"/>} onClick={handleSave} data-qoder-id="qel-button-8b4a49ba" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-8b4a49ba&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:282,&quot;column&quot;:9}}">
          保存
        </Button>
        <div className="toolbar-divider"  data-qoder-id="qel-toolbar-divider-c90f2a74" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-c90f2a74&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:285,&quot;column&quot;:9}}"/>
        <Button variant="danger" size="sm" icon={<Circle size={13} fill="currentColor"  data-qoder-id="qel-circle-481671cb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-circle-481671cb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;circle&quot;,&quot;loc&quot;:{&quot;line&quot;:286,&quot;column&quot;:50}}"/>} onClick={() => onNavigate('recording')} data-qoder-id="qel-button-4be37ce8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-4be37ce8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:286,&quot;column&quot;:9}}">
          录制
        </Button>
        <div className="toolbar-divider"  data-qoder-id="qel-toolbar-divider-d8cc1daa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-d8cc1daa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:289,&quot;column&quot;:9}}"/>
        {!isPlaying ? (
          <>
            {/* 循环设置 */}
            <div className="loop-config-bar" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-loop-config-bar-0ec8dd49" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-loop-config-bar-0ec8dd49&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;loop-config-bar&quot;,&quot;loc&quot;:{&quot;line&quot;:293,&quot;column&quot;:13}}">
              <Repeat size={14} className="text-tertiary"  data-qoder-id="qel-text-tertiary-dcdc6573" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-tertiary-dcdc6573&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-tertiary&quot;,&quot;loc&quot;:{&quot;line&quot;:294,&quot;column&quot;:15}}"/>
              <Select
                value={loopMode}
                onChange={e => setLoopMode(e.target.value as EditorLoopMode)}
                style={{ width: 'auto', minWidth: 72, fontSize: 'var(--fs-sm)' }}
               data-qoder-id="qel-select-6d504e6b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-6d504e6b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:295,&quot;column&quot;:15}}">
                <option value="count" data-qoder-id="qel-option-da3671b4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-da3671b4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:300,&quot;column&quot;:17}}">按次数</option>
                <option value="duration" data-qoder-id="qel-option-db367347" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-db367347&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:301,&quot;column&quot;:17}}">按时长</option>
                <option value="infinite" data-qoder-id="qel-option-d03661f6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-d03661f6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:302,&quot;column&quot;:17}}">无限循环</option>
              </Select>
              {loopMode === 'count' && (
                <div className="field-inline" style={{ gap: 'var(--space-xs)' }} data-qoder-id="qel-field-inline-26239abc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-26239abc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:305,&quot;column&quot;:17}}">
                  <Input
                    type="number"
                    variant="number"
                    value={loopCount}
                    onChange={e => setLoopCount(Math.max(1, +e.target.value))}
                    min={1}
                    style={{ width: 60 }}
                   data-qoder-id="qel-input-dd6e8ca7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-dd6e8ca7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:306,&quot;column&quot;:19}}"/>
                  <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-f34629bc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f34629bc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:314,&quot;column&quot;:19}}">次</span>
                </div>
              )}
              {loopMode === 'duration' && (
                <div className="field-inline" style={{ gap: 'var(--space-xs)' }} data-qoder-id="qel-field-inline-9f1c0a72" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-9f1c0a72&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:318,&quot;column&quot;:17}}">
                  <Input
                    type="number"
                    variant="number"
                    value={loopDurationMin}
                     onChange={e => setLoopDurationMin(Math.min(59, Math.max(0, Number.parseInt(e.target.value || '0', 10))))}
                    min={0}
                    style={{ width: 50 }}
                   data-qoder-id="qel-input-de6e8e3a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-de6e8e3a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:319,&quot;column&quot;:19}}"/>
                  <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-f0462503" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f0462503&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:327,&quot;column&quot;:19}}">分</span>
                  <Input
                    type="number"
                    variant="number"
                    value={loopDurationSec}
                    onChange={e => setLoopDurationSec(Math.max(0, Math.min(59, +e.target.value)))}
                    min={0}
                    max={59}
                    style={{ width: 50 }}
                   data-qoder-id="qel-input-d86e84c8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-d86e84c8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:328,&quot;column&quot;:19}}"/>
                  <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-f2462829" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f2462829&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:337,&quot;column&quot;:19}}">秒</span>
                </div>
              )}
              {loopMode === 'infinite' && (
                <span className="text-sm text-tertiary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} data-qoder-id="qel-text-sm-f1462696" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f1462696&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:341,&quot;column&quot;:17}}">
                  <InfinityIcon size={14}  data-qoder-id="qel-infinityicon-f8b5a349" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-infinityicon-f8b5a349&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;infinityicon&quot;,&quot;loc&quot;:{&quot;line&quot;:342,&quot;column&quot;:19}}"/> 无限
                </span>
              )}
            </div>
            {/* 速度 */}
            <div className="field-inline" style={{ gap: 'var(--space-xs)' }} data-qoder-id="qel-field-inline-a61c1577" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-a61c1577&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:347,&quot;column&quot;:13}}">
              <Timer size={14} className="text-tertiary"  data-qoder-id="qel-text-tertiary-83e636c5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-tertiary-83e636c5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-tertiary&quot;,&quot;loc&quot;:{&quot;line&quot;:348,&quot;column&quot;:15}}"/>
              <Select
                value={String(speedMultiplier)}
                onChange={e => setSpeedMultiplier(+e.target.value)}
                style={{ width: 'auto', minWidth: 64, fontSize: 'var(--fs-sm)' }}
               data-qoder-id="qel-select-dd557be9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-dd557be9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:349,&quot;column&quot;:15}}">
                <option value="0.5" data-qoder-id="qel-option-4e311822" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-4e311822&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:354,&quot;column&quot;:17}}">0.5x</option>
                <option value="1" data-qoder-id="qel-option-4f3119b5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-4f3119b5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:355,&quot;column&quot;:17}}">1x</option>
                <option value="2" data-qoder-id="qel-option-48310eb0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-48310eb0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:356,&quot;column&quot;:17}}">2x</option>
                <option value="4" data-qoder-id="qel-option-49311043" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-49311043&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:357,&quot;column&quot;:17}}">4x</option>
              </Select>
            </div>
            <Button variant="running" size="sm" icon={<Play size={13}  data-qoder-id="qel-play-1de843e7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-1de843e7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:360,&quot;column&quot;:55}}"/>} onClick={handleRun} disabled={isEmpty} data-qoder-id="qel-button-51e80388" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-51e80388&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:360,&quot;column&quot;:13}}">
              运行
            </Button>
          </>
        ) : (
          <>
            <Button
              variant={isPaused ? 'running' : 'paused'}
              size="sm"
              icon={isPaused ? <Play size={13}  data-qoder-id="qel-play-13e83429" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-13e83429&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:369,&quot;column&quot;:32}}"/> : <Pause size={13}  data-qoder-id="qel-pause-153fc3a1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-pause-153fc3a1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;pause&quot;,&quot;loc&quot;:{&quot;line&quot;:369,&quot;column&quot;:53}}"/>}
              onClick={handlePause}
             data-qoder-id="qel-button-4fe80062" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-4fe80062&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:366,&quot;column&quot;:13}}">
              {isPaused ? '继续' : '暂停'}
            </Button>
            <Button variant="danger" size="sm" icon={<Square size={13} fill="currentColor"  data-qoder-id="qel-square-9da2d59d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-square-9da2d59d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;square&quot;,&quot;loc&quot;:{&quot;line&quot;:374,&quot;column&quot;:54}}"/>} onClick={handleStop} data-qoder-id="qel-button-c8ef7aa2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-c8ef7aa2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:374,&quot;column&quot;:13}}">
              停止
            </Button>
          </>
        )}
        <div className="toolbar-spacer"  data-qoder-id="qel-toolbar-spacer-3fa4e0ef" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-spacer-3fa4e0ef&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;toolbar-spacer&quot;,&quot;loc&quot;:{&quot;line&quot;:379,&quot;column&quot;:9}}"/>
        {selectedIds.size > 0 && (
          <>
            <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-f43720c5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f43720c5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:382,&quot;column&quot;:13}}">已选 {selectedIds.size} 项</span>
            <IconButton tooltip="复制选中" onClick={handleDuplicateSelected} data-qoder-id="qel-iconbutton-02a551e8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-02a551e8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:383,&quot;column&quot;:13}}">
              <Copy size={14}  data-qoder-id="qel-copy-f9db2f39" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-copy-f9db2f39&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;copy&quot;,&quot;loc&quot;:{&quot;line&quot;:384,&quot;column&quot;:15}}"/>
            </IconButton>
            <IconButton tooltip="删除选中" onClick={handleDeleteSelected} data-qoder-id="qel-iconbutton-04a5550e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-04a5550e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:386,&quot;column&quot;:13}}">
              <Trash2 size={14}  data-qoder-id="qel-trash2-e0895b45" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-trash2-e0895b45&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;trash2&quot;,&quot;loc&quot;:{&quot;line&quot;:387,&quot;column&quot;:15}}"/>
            </IconButton>
            <div className="toolbar-divider"  data-qoder-id="qel-toolbar-divider-4bc483ee" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-divider-4bc483ee&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;toolbar-divider&quot;,&quot;loc&quot;:{&quot;line&quot;:389,&quot;column&quot;:13}}"/>
          </>
        )}
        {/* 添加动作下拉 */}
        <div style={{ position: 'relative' }} data-qoder-id="qel-div-ac6f40c4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ac6f40c4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:393,&quot;column&quot;:9}}">
          <Button variant="secondary" size="sm" icon={<Plus size={13}  data-qoder-id="qel-plus-c05e8bda" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-plus-c05e8bda&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;plus&quot;,&quot;loc&quot;:{&quot;line&quot;:394,&quot;column&quot;:55}}"/>} onClick={() => setShowAddMenu(!showAddMenu)} data-qoder-id="qel-button-c4ed35bf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-c4ed35bf&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:394,&quot;column&quot;:11}}">
            添加动作
          </Button>
          {showAddMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-control)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 100,
              minWidth: 160,
            }} data-qoder-id="qel-div-af6f457d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-af6f457d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:398,&quot;column&quot;:13}}">
              {(['mouse_move', 'mouse_button_down', 'mouse_button_up', 'mouse_click', 'mouse_wheel', 'key_down', 'key_up', 'wait'] as ActionType[]).map(type => {
                const Icon = ACTION_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => addAction(type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      padding: 'var(--space-xs) var(--space-md)',
                      width: '100%',
                      textAlign: 'left',
                      fontSize: 'var(--fs-base)',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                   data-qoder-id="qel-button-63fac440" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-63fac440&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:413,&quot;column&quot;:19}}">
                    <Icon size={14} style={{ color: ACTION_COLORS[type] }}  data-qoder-id="qel-icon-6f0cc475" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-icon-6f0cc475&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;icon&quot;,&quot;loc&quot;:{&quot;line&quot;:429,&quot;column&quot;:21}}"/>
                    {ACTION_LABELS[type]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 运行进度条 */}
      {isPlaying && (
        <div style={{ marginBottom: 'var(--space-sm)' }} data-qoder-id="qel-div-aa6f3d9e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-aa6f3d9e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:441,&quot;column&quot;:9}}">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }} data-qoder-id="qel-div-ab6f3f31" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ab6f3f31&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:442,&quot;column&quot;:11}}">
            <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-f234df08" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f234df08&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:443,&quot;column&quot;:13}}">
              执行进度{isPaused ? '（已暂停）' : ''}
              {loopMode === 'count' && ` · 循环 ${state.playbackCurrentLoop + (state.runState === 'running' ? 1 : 0)}/${loopCount}`}
              {loopMode === 'infinite' && ` · 第 ${state.playbackCurrentLoop + (state.runState === 'running' ? 1 : 0)} 轮`}
              {loopMode === 'duration' && state.playbackLoopRemainingMs > 0 && ` · 剩余 ${formatTime(state.playbackLoopRemainingMs)}`}
            </span>
            <span className="text-sm text-mono text-running" data-qoder-id="qel-text-sm-f334e09b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f334e09b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:449,&quot;column&quot;:13}}">
              {loopMode === 'infinite' ? `第${state.playbackCurrentLoop + (state.runState === 'running' ? 1 : 0)}轮` : `${state.playbackProgress}%`}
            </span>
          </div>
          <ProgressBar value={state.playbackProgress} variant="running"  data-qoder-id="qel-progressbar-3693036b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-progressbar-3693036b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;progressbar&quot;,&quot;loc&quot;:{&quot;line&quot;:453,&quot;column&quot;:11}}"/>
        </div>
      )}

      {/* 空状态 */}
      {isEmpty ? (
        <EmptyState
          icon={<FilePlus2 size={32} />}
          title="当前脚本为空"
          description="通过录制或手动添加动作来创建自动化脚本"
          actions={
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <Button variant="danger" size="sm" icon={<Circle size={13} fill="currentColor" />} onClick={() => onNavigate('recording')}>
                开始录制
              </Button>
              <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => addAction('mouse_click')}>
                手动添加动作
              </Button>
            </div>
          }
         data-qoder-id="qel-emptystate-c9ce77a0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-emptystate-c9ce77a0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;emptystate&quot;,&quot;loc&quot;:{&quot;line&quot;:459,&quot;column&quot;:9}}"/>
      ) : (
        <div className="split-layout" data-qoder-id="qel-split-layout-fad6eb0b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-split-layout-fad6eb0b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;split-layout&quot;,&quot;loc&quot;:{&quot;line&quot;:475,&quot;column&quot;:9}}">
          {/* 左侧动作列表 */}
          <div className="split-main" data-qoder-id="qel-split-main-db7053a5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-split-main-db7053a5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;split-main&quot;,&quot;loc&quot;:{&quot;line&quot;:477,&quot;column&quot;:11}}">
            <div className="action-list" style={{ overflow: 'auto' }} data-qoder-id="qel-action-list-69ea7df1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-action-list-69ea7df1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;action-list&quot;,&quot;loc&quot;:{&quot;line&quot;:478,&quot;column&quot;:13}}">
              {/* 表头 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-bg-muted)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                position: 'sticky',
                top: 0,
                zIndex: 5,
              }} data-qoder-id="qel-div-1976a820" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-1976a820&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:480,&quot;column&quot;:15}}">
                <span style={{ width: 20 }} data-qoder-id="qel-span-bda7627d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-bda7627d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:494,&quot;column&quot;:17}}">
                  <input type="checkbox" checked={selectedIds.size === actions.length && actions.length > 0} onChange={handleSelectAll} style={{ cursor: 'pointer' }}  data-qoder-id="qel-input-be5eaa42" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-be5eaa42&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:495,&quot;column&quot;:19}}"/>
                </span>
                <span style={{ width: 24 }} data-qoder-id="qel-span-afa74c73" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-afa74c73&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:497,&quot;column&quot;:17}}"></span>
                <span style={{ width: 36 }} data-qoder-id="qel-span-aea74ae0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-aea74ae0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:498,&quot;column&quot;:17}}">#</span>
                <span style={{ width: 90 }} data-qoder-id="qel-span-b1a51102" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-b1a51102&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:499,&quot;column&quot;:17}}">类型</span>
                <span style={{ flex: 1 }} data-qoder-id="qel-span-b2a51295" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-b2a51295&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:500,&quot;column&quot;:17}}">参数摘要</span>
                <span style={{ width: 70, textAlign: 'right' }} data-qoder-id="qel-span-afa50ddc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-afa50ddc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:501,&quot;column&quot;:17}}">延迟</span>
                <span style={{ width: 44, textAlign: 'center' }} data-qoder-id="qel-span-b0a50f6f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-b0a50f6f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:502,&quot;column&quot;:17}}">启用</span>
                <span style={{ width: 44, textAlign: 'center' }} data-qoder-id="qel-span-ada50ab6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-ada50ab6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:503,&quot;column&quot;:17}}">
                  <span className="text-tertiary" data-tooltip="上下移动" data-qoder-id="qel-text-tertiary-ba0faa03" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-tertiary-ba0faa03&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-tertiary&quot;,&quot;loc&quot;:{&quot;line&quot;:504,&quot;column&quot;:19}}">⇅</span>
                </span>
              </div>

              {/* 动作行 */}
              {actions.map((action, idx) => {
                const Icon = ACTION_ICONS[action.type];
              const isSelected = selectedIds.has(action.id);
              const isCurrent = isPlaying && currentPlaybackIndex === idx;
              const isDragOver = dragOverId === action.id;

              return (
                <div
                  key={action.id}
                  className={`action-row ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''} ${!action.enabled ? 'disabled' : ''} ${dragId === action.id ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, action.id)}
                  onDragOver={(e) => handleDragOver(e, action.id)}
                  onDrop={(e) => handleDrop(e, action.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  onClick={(e) => handleSelect(action.id, e)}
                 data-qoder-id="qel-div-1a746b1c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-1a746b1c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:516,&quot;column&quot;:17}}">
                  <span style={{ width: 20 }} onClick={e => e.stopPropagation()} data-qoder-id="qel-span-aca50923" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-aca50923&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:526,&quot;column&quot;:19}}">
                    <input type="checkbox" checked={isSelected} onChange={() => handleSelect(action.id, { shiftKey: false, ctrlKey: false, metaKey: false } as any)} style={{ cursor: 'pointer' }}  data-qoder-id="qel-input-4b5bb6a2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-4b5bb6a2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:527,&quot;column&quot;:21}}"/>
                  </span>
                  <span className="action-row-drag" style={{ width: 24 }} data-qoder-id="qel-action-row-drag-434aed8b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-action-row-drag-434aed8b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;action-row-drag&quot;,&quot;loc&quot;:{&quot;line&quot;:529,&quot;column&quot;:19}}">
                    <GripVertical size={14}  data-qoder-id="qel-gripvertical-cedaca2d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-gripvertical-cedaca2d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;gripvertical&quot;,&quot;loc&quot;:{&quot;line&quot;:530,&quot;column&quot;:21}}"/>
                  </span>
                  <span className="text-mono text-tertiary" style={{ width: 36 }} data-qoder-id="qel-text-mono-bb9bae4f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-bb9bae4f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:532,&quot;column&quot;:19}}">{idx + 1}</span>
                  <span style={{ width: 90, display: 'flex', alignItems: 'center', gap: '4px' }} data-qoder-id="qel-span-31c01dff" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-31c01dff&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:533,&quot;column&quot;:19}}">
                    <Icon size={13} style={{ color: ACTION_COLORS[action.type] }}  data-qoder-id="qel-icon-691986f6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-icon-691986f6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;icon&quot;,&quot;loc&quot;:{&quot;line&quot;:534,&quot;column&quot;:21}}"/>
                    <span className="text-sm" data-qoder-id="qel-text-sm-f45535d9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f45535d9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:535,&quot;column&quot;:21}}">{ACTION_LABELS[action.type]}</span>
                  </span>
                  <span className="text-sm text-mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-qoder-id="qel-text-sm-f3553446" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f3553446&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:537,&quot;column&quot;:19}}">
                    {summarizeAction(action)}
                  </span>
                  <span className="text-mono text-sm text-tertiary" style={{ width: 70, textAlign: 'right' }} data-qoder-id="qel-text-mono-b89ba996" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-b89ba996&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:540,&quot;column&quot;:19}}">
                    {formatDuration(action.delayBeforeMs)}
                  </span>
                  <span style={{ width: 44, display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()} data-qoder-id="qel-span-2cc01620" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-2cc01620&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:543,&quot;column&quot;:19}}">
                    <Toggle checked={action.enabled} onChange={() => toggleEnabled(action.id)}  data-qoder-id="qel-toggle-6e9bf519" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-6e9bf519&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;toggle&quot;,&quot;loc&quot;:{&quot;line&quot;:544,&quot;column&quot;:21}}"/>
                  </span>
                  <span style={{ width: 44, display: 'flex', justifyContent: 'center', gap: '2px' }} onClick={e => e.stopPropagation()} data-qoder-id="qel-span-3ac02c2a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-3ac02c2a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:546,&quot;column&quot;:19}}">
                    <button className="btn btn-ghost" style={{ padding: '2px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => moveAction(action.id, 'up')} data-tooltip="上移" disabled={idx === 0} data-qoder-id="qel-btn-41323602" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-btn-41323602&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;btn&quot;,&quot;loc&quot;:{&quot;line&quot;:547,&quot;column&quot;:21}}">
                      <ChevronUp size={12}  data-qoder-id="qel-chevronup-8baf86bf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-chevronup-8baf86bf&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;chevronup&quot;,&quot;loc&quot;:{&quot;line&quot;:548,&quot;column&quot;:23}}"/>
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '2px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => moveAction(action.id, 'down')} data-tooltip="下移" disabled={idx === actions.length - 1} data-qoder-id="qel-btn-3f3232dc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-btn-3f3232dc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;btn&quot;,&quot;loc&quot;:{&quot;line&quot;:550,&quot;column&quot;:21}}">
                      <ChevronDown size={12}  data-qoder-id="qel-chevrondown-48fcf7e1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-chevrondown-48fcf7e1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;chevrondown&quot;,&quot;loc&quot;:{&quot;line&quot;:551,&quot;column&quot;:23}}"/>
                    </button>
                  </span>
                </div>
              );
              })}
            </div>
          </div>

          {/* 右侧属性编辑器 */}
          <div className="split-side" data-qoder-id="qel-split-side-87109321" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-split-side-87109321&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;split-side&quot;,&quot;loc&quot;:{&quot;line&quot;:561,&quot;column&quot;:11}}">
            <div className="prop-panel" data-qoder-id="qel-prop-panel-03bcd928" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-panel-03bcd928&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;prop-panel&quot;,&quot;loc&quot;:{&quot;line&quot;:562,&quot;column&quot;:13}}">
              <div className="panel-title" style={{ marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border-subtle)' }} data-qoder-id="qel-panel-title-ac2ec024" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-ac2ec024&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:563,&quot;column&quot;:15}}">
                {editingAction ? `编辑动作 #${actions.findIndex(a => a.id === editingAction.id) + 1}` : '属性面板'}
              </div>
              {!editingAction ? (
                <div className="text-sm text-tertiary" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }} data-qoder-id="qel-text-sm-e648c37a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-e648c37a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:567,&quot;column&quot;:17}}">
                  选择一个动作以编辑参数
                </div>
              ) : (
                <PropertyEditor action={editingAction} onUpdate={(updates) => updateAction(editingAction.id, updates)}  data-qoder-id="qel-propertyeditor-758905c8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-propertyeditor-758905c8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;ScriptEditor&quot;,&quot;elementRole&quot;:&quot;propertyeditor&quot;,&quot;loc&quot;:{&quot;line&quot;:571,&quot;column&quot;:17}}"/>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Property Editor --- */
function PropertyEditor({ action, onUpdate, ...qoderProps }: { action: ScriptAction; onUpdate: (updated: ScriptAction) => void } & Record<string, any>) {
  return (
    <div style={{ ...({ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 类型显示 */}
      <div className="prop-group" data-qoder-id="qel-prop-group-5c312d8e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-5c312d8e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:586,&quot;column&quot;:7}}">
        <span className="prop-label" data-qoder-id="qel-prop-label-3d3cc5a3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-3d3cc5a3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:587,&quot;column&quot;:9}}">动作类型</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', padding: 'var(--space-xs) var(--space-sm)', background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-control)' }} data-qoder-id="qel-div-0c075438" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-0c075438&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:588,&quot;column&quot;:9}}">
          {(() => { const Icon = ACTION_ICONS[action.type]; return <Icon size={14} style={{ color: ACTION_COLORS[action.type] }}  data-qoder-id="qel-icon-68ca9f0d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-icon-68ca9f0d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;icon&quot;,&quot;loc&quot;:{&quot;line&quot;:589,&quot;column&quot;:68}}"/>; })()}
          <span className="text-sm" data-qoder-id="qel-text-sm-426bcede" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-426bcede&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:590,&quot;column&quot;:11}}">{ACTION_LABELS[action.type]}</span>
        </div>
      </div>

      {/* 鼠标坐标 */}
      {(action.type === 'mouse_move' || action.type === 'mouse_click') && (
        <div className="prop-group" data-qoder-id="qel-prop-group-6131356d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-6131356d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:596,&quot;column&quot;:9}}">
          <span className="prop-label" data-qoder-id="qel-prop-label-423ccd82" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-423ccd82&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:597,&quot;column&quot;:11}}">坐标</span>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }} data-qoder-id="qel-div-11075c17" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-11075c17&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:598,&quot;column&quot;:11}}">
            <div className="field-inline" style={{ flex: 1 }} data-qoder-id="qel-field-inline-374bae7f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-374bae7f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:599,&quot;column&quot;:13}}">
              <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-3f6bca25" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-3f6bca25&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:600,&quot;column&quot;:15}}">X</span>
              <Input type="number" variant="number" value={action.payload.x ?? 0} onChange={e => onUpdate(action.type === 'mouse_move' ? { ...action, payload: { ...action.payload, x: +e.target.value } } : { ...action, payload: { ...action.payload, x: +e.target.value } })}  data-qoder-id="qel-input-4ef60d3b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-4ef60d3b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:601,&quot;column&quot;:15}}"/>
            </div>
            <div className="field-inline" style={{ flex: 1 }} data-qoder-id="qel-field-inline-3a4974a1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-3a4974a1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:603,&quot;column&quot;:13}}">
              <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-2e6dedf9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-2e6dedf9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:604,&quot;column&quot;:15}}">Y</span>
              <Input type="number" variant="number" value={action.payload.y ?? 0} onChange={e => onUpdate(action.type === 'mouse_move' ? { ...action, payload: { ...action.payload, y: +e.target.value } } : { ...action, payload: { ...action.payload, y: +e.target.value } })}  data-qoder-id="qel-input-4ff60ece" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-4ff60ece&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:605,&quot;column&quot;:15}}"/>
            </div>
          </div>
        </div>
      )}

      {/* 按键选择 */}
      {action.type === 'mouse_click' && (
        <>
          <div className="prop-group" data-qoder-id="qel-prop-group-5e336f4b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-5e336f4b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:614,&quot;column&quot;:11}}">
            <span className="prop-label" data-qoder-id="qel-prop-label-453f10d2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-453f10d2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:615,&quot;column&quot;:13}}">鼠标按键</span>
            <Select value={action.payload.button} onChange={e => onUpdate({ ...action, payload: { ...action.payload, button: e.target.value as MouseButton } })} data-qoder-id="qel-select-b615aa9d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-b615aa9d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:616,&quot;column&quot;:13}}">
              <option value="left" data-qoder-id="qel-option-9b2dfb9c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-9b2dfb9c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:617,&quot;column&quot;:15}}">左键</option>
              <option value="right" data-qoder-id="qel-option-a22e06a1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-a22e06a1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:618,&quot;column&quot;:15}}">右键</option>
              <option value="middle" data-qoder-id="qel-option-a12e050e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-a12e050e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:619,&quot;column&quot;:15}}">中键</option>
            </Select>
          </div>
          <div className="prop-group" data-qoder-id="qel-prop-group-d02bd3fc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-d02bd3fc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:622,&quot;column&quot;:11}}">
            <span className="prop-label" data-qoder-id="qel-prop-label-494155b5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-494155b5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:623,&quot;column&quot;:13}}">点击模式</span>
            <RadioGroup
              value={action.payload.clickCount === 2 ? 'double' : 'single'}
              onChange={(v) => onUpdate({ ...action, payload: { ...action.payload, clickCount: v === 'double' ? 2 : 1 } })}
              options={[
                { value: 'single', label: '单击' },
                { value: 'double', label: '双击' },
              ]}
             data-qoder-id="qel-radiogroup-1e37766e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-radiogroup-1e37766e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;radiogroup&quot;,&quot;loc&quot;:{&quot;line&quot;:624,&quot;column&quot;:13}}"/>
          </div>
        </>
      )}

      {/* 滚轮 */}
      {action.type === 'mouse_wheel' && (
        <div className="prop-group" data-qoder-id="qel-prop-group-d32bd8b5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-d32bd8b5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:638,&quot;column&quot;:9}}">
          <span className="prop-label" data-qoder-id="qel-prop-label-44414dd6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-44414dd6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:639,&quot;column&quot;:11}}">滚动距离</span>
          <Input type="number" variant="number" value={action.payload.deltaY} onChange={e => onUpdate({ ...action, payload: { ...action.payload, deltaY: +e.target.value } })}  data-qoder-id="qel-input-c1ee737f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-c1ee737f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:640,&quot;column&quot;:11}}"/>
          <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-c066850a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-c066850a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:641,&quot;column&quot;:11}}">负值向下，正值向上</span>
        </div>
      )}

      {/* 键盘按键 */}
      {(action.type === 'key_down' || action.type === 'key_up') && (
        <div className="prop-group" data-qoder-id="qel-prop-group-cf2bd269" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-cf2bd269&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:647,&quot;column&quot;:9}}">
          <span className="prop-label" data-qoder-id="qel-prop-label-504160ba" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-504160ba&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:648,&quot;column&quot;:11}}">按键</span>
          <Select value={action.payload.keyCode} onChange={e => onUpdate({ ...action, payload: { ...action.payload, keyCode: e.target.value } })} data-qoder-id="qel-select-a70ed73b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-a70ed73b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:649,&quot;column&quot;:11}}">
            {KEYS.map(k => <option key={k} value={k} data-qoder-id="qel-option-a6328a1b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-a6328a1b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:650,&quot;column&quot;:28}}">{k}</option>)}
          </Select>
        </div>
      )}

      {/* 延迟 */}
      <div className="prop-group" data-qoder-id="qel-prop-group-d52e1a72" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-group-d52e1a72&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-group&quot;,&quot;loc&quot;:{&quot;line&quot;:656,&quot;column&quot;:7}}">
        <span className="prop-label" data-qoder-id="qel-prop-label-50439f51" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-prop-label-50439f51&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;prop-label&quot;,&quot;loc&quot;:{&quot;line&quot;:657,&quot;column&quot;:9}}">{action.type === 'wait' ? '等待时间（毫秒）' : '执行前延迟（毫秒）'}</span>
        <Input type="number" variant="number" value={action.type === 'wait' ? action.payload.durationMs : action.delayBeforeMs} onChange={e => onUpdate(action.type === 'wait' ? { ...action, payload: { durationMs: Math.max(0, +e.target.value) } } : { ...action, delayBeforeMs: Math.max(0, +e.target.value) })} min={0}  data-qoder-id="qel-input-bff0aef0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-bff0aef0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:658,&quot;column&quot;:9}}"/>
        <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-4469936d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-4469936d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptEditor.tsx&quot;,&quot;componentName&quot;:&quot;PropertyEditor&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:659,&quot;column&quot;:9}}">= {formatDuration(action.type === 'wait' ? action.payload.durationMs : action.delayBeforeMs)}</span>
      </div>


    </div>
  );
}
