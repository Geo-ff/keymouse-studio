/* =========================================================================
   AutoClicker — 连点器页面（鼠标 / 键盘）
   ========================================================================= */

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { Play, Pause, Square, MousePointer, Crosshair, Clock, Keyboard } from 'lucide-react';
import { useService } from '../hooks/useService';
import { Button, RadioGroup, Toggle, Input, NumericInput, Select, IconButton } from '../components/ui';
import type { ClickerConfig, ClickerInputType, KeySpec, MouseButton, ClickMode } from '../types';
import { formatTime } from '../data/mockData';
import { showSystemAlert } from '../utils/systemAlert';
import { usePersistedFormState } from '../utils/formPersistence';
import { resolveCountdownMs } from '../utils/countdown';
import {
  eventToKeySpecs,
  findControlHotkeyConflict,
  formatKeySpecsLabel,
} from '../utils/keySpec';
import { HOTKEY_FIELD_LABELS } from '../utils/hotkey';

interface ClickerFormState {
  inputType: ClickerInputType;
  button: MouseButton;
  clickMode: ClickMode;
  hours: number;
  minutes: number;
  seconds: number;
  millis: number;
  timesMode: 'fixed' | 'continuous';
  times: number;
  useCurrentPos: boolean;
  posX: number;
  posY: number;
  keys: KeySpec[];
  pressDurationMs: number;
}

const CLICKER_DEFAULTS: ClickerFormState = {
  inputType: 'mouse',
  button: 'left',
  clickMode: 'single',
  hours: 0,
  minutes: 0,
  seconds: 0,
  millis: 500,
  timesMode: 'continuous',
  times: 10,
  useCurrentPos: true,
  posX: 960,
  posY: 540,
  keys: [],
  pressDurationMs: 30,
};

export function AutoClicker(qoderProps: Record<string, any>) {
  const {
    startClicker,
    pauseClicker,
    resumeClicker,
    stopClicker,
    getMousePosition,
    state,
    settings,
  } = useService();
  const [form, setForm] = usePersistedFormState('clicker', CLICKER_DEFAULTS);
  const [capturing, setCapturing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    inputType,
    button,
    clickMode,
    hours,
    minutes,
    seconds,
    millis,
    timesMode,
    times,
    useCurrentPos,
    posX,
    posY,
    keys,
    pressDurationMs,
  } = form;

  const isRunning =
    state.snapshot.operationType === 'clicker' &&
    (state.runState === 'running' || state.runState === 'paused');
  const isPaused = state.snapshot.operationType === 'clicker' && state.runState === 'paused';
  const isKeyboard = inputType === 'keyboard';

  const intervalMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
  const cycleMs = isKeyboard ? Math.max(10, pressDurationMs) + Math.max(50, intervalMs) : Math.max(50, intervalMs);
  const estimatedHz = cycleMs > 0 ? (1000 / cycleMs).toFixed(1) : '—';

  const controlHotkeys = useMemo(
    () => ({
      emergencyHotkey: settings.emergencyHotkey || 'F12',
      recordStartHotkey: settings.recordStartHotkey || '',
      recordStopHotkey: settings.recordStopHotkey || '',
      playbackStartHotkey: settings.playbackStartHotkey || '',
      playbackStopHotkey: settings.playbackStopHotkey || '',
    }),
    [settings],
  );

  const handleCaptureKey = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!capturing || isRunning) return;
      event.preventDefault();
      event.stopPropagation();
      const specs = eventToKeySpecs(event.nativeEvent);
      if (!specs?.length) return;
      setForm(f => ({ ...f, keys: specs }));
      setCapturing(false);
      setFormError(null);
    },
    [capturing, isRunning, setForm],
  );

  const handleStart = useCallback(() => {
    setFormError(null);
    if (isKeyboard) {
      if (!keys.length) {
        setFormError('请先捕获按键组合');
        return;
      }
      const conflict = findControlHotkeyConflict(keys, controlHotkeys);
      if (conflict) {
        const label = HOTKEY_FIELD_LABELS[conflict] ?? conflict;
        setFormError(`按键组合不能与${label}相同`);
        return;
      }
      if (pressDurationMs < 10 || pressDurationMs > 60000) {
        setFormError('按下时长需在 10～60000 ms');
        return;
      }
    }

    const config: ClickerConfig = isKeyboard
      ? {
          inputType: 'keyboard',
          button: 'left',
          clickCount: 1,
          intervalMs: Math.max(50, intervalMs),
          repeatMode: timesMode === 'continuous' ? 'infinite' : 'count',
          repeatCount: timesMode === 'continuous' ? 1 : times,
          positionMode: 'current',
          x: null,
          y: null,
          countdownMs: resolveCountdownMs(settings),
          keys,
          pressDurationMs: Math.max(10, Math.min(60000, pressDurationMs)),
        }
      : {
          inputType: 'mouse',
          button,
          clickCount: clickMode === 'double' ? 2 : 1,
          intervalMs: Math.max(50, intervalMs),
          repeatMode: timesMode === 'continuous' ? 'infinite' : 'count',
          repeatCount: timesMode === 'continuous' ? 1 : times,
          positionMode: useCurrentPos ? 'current' : 'fixed',
          x: useCurrentPos ? null : posX,
          y: useCurrentPos ? null : posY,
          countdownMs: resolveCountdownMs(settings),
          keys: [],
          pressDurationMs: 30,
        };

    void startClicker(config)
      .then(() => {
        void showSystemAlert(
          '连点器',
          isKeyboard ? '键盘连点已开始' : '连点已开始',
          isKeyboard ? '正在按设定间隔发送按键' : '正在按设定间隔执行点击',
        );
      })
      .catch(() => undefined);
  }, [
    startClicker,
    isKeyboard,
    keys,
    controlHotkeys,
    pressDurationMs,
    button,
    clickMode,
    intervalMs,
    timesMode,
    times,
    useCurrentPos,
    posX,
    posY,
    settings,
  ]);

  const handlePause = useCallback(() => {
    if (isPaused) void resumeClicker().catch(() => undefined);
    else void pauseClicker().catch(() => undefined);
  }, [pauseClicker, resumeClicker, isPaused]);

  const handleStop = useCallback(() => {
    void stopClicker().catch(() => undefined);
  }, [stopClicker]);

  return (
    <div
      className={['responsive-split', (qoderProps as any)?.className].filter(Boolean).join(' ')}
      style={{
        ...{ display: 'flex', gap: 'var(--space-lg)', height: '100%' },
        ...((qoderProps as any)?.style),
      }}
      data-qoder-id={(qoderProps as any)?.['data-qoder-id']}
      data-qoder-source={(qoderProps as any)?.['data-qoder-source']}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">输入类型</span>
          </div>
          <div style={{ pointerEvents: isRunning ? 'none' : undefined, opacity: isRunning ? 0.6 : 1 }}>
            <RadioGroup
              value={inputType}
              onChange={v => {
                setForm(f => ({ ...f, inputType: v as ClickerInputType }));
                setFormError(null);
                setCapturing(false);
              }}
              options={[
                { value: 'mouse', label: '鼠标' },
                { value: 'keyboard', label: '键盘' },
              ]}
            />
          </div>
        </div>

        {isKeyboard ? (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <Keyboard size={14} /> 按键设置
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="field-group">
                <label className="field-label">按键组合</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Input
                    readOnly
                    value={capturing ? '请按下组合键…' : formatKeySpecsLabel(keys)}
                    onFocus={() => {
                      if (!isRunning) setCapturing(true);
                    }}
                    onBlur={() => setCapturing(false)}
                    onKeyDown={handleCaptureKey}
                    disabled={isRunning}
                    style={{ minWidth: 220, flex: 1 }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isRunning || !keys.length}
                    onClick={() => {
                      setForm(f => ({ ...f, keys: [] }));
                      setFormError(null);
                    }}
                  >
                    清除
                  </Button>
                </div>
                <span className="text-sm text-tertiary">
                  支持单键或修饰键+主键；按键会发送到当前前台窗口
                </span>
              </div>
              <div className="field-group" style={{ width: 140 }}>
                <label className="field-label">按下时长 (ms)</label>
                <NumericInput
                  value={pressDurationMs}
                  onValueChange={v => setForm(f => ({ ...f, pressDurationMs: v }))}
                  disabled={isRunning}
                  min={10}
                  max={60000}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">点击设置</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', rowGap: 'var(--space-md)' }}>
              <div className="field-group">
                <label className="field-label">鼠标按键</label>
                <Select
                  value={button}
                  onChange={e => setForm(f => ({ ...f, button: e.target.value as MouseButton }))}
                  disabled={isRunning}
                >
                  <option value="left">左键</option>
                  <option value="right">右键</option>
                  <option value="middle">中键</option>
                </Select>
              </div>
              <div className="field-group">
                <label className="field-label">点击模式</label>
                <div style={{ pointerEvents: isRunning ? 'none' : undefined, opacity: isRunning ? 0.6 : 1 }}>
                  <RadioGroup
                    value={clickMode}
                    onChange={v => setForm(f => ({ ...f, clickMode: v as ClickMode }))}
                    options={[
                      { value: 'single', label: '单击' },
                      { value: 'double', label: '双击' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <Clock size={14} /> {isKeyboard ? '重复间隔（释放后等待）' : '间隔时间'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <div className="field-group" style={{ width: 72 }}>
              <label className="field-label">小时</label>
              <NumericInput value={hours} onValueChange={v => setForm(f => ({ ...f, hours: v }))} disabled={isRunning} min={0} max={23} />
            </div>
            <div className="field-group" style={{ width: 72 }}>
              <label className="field-label">分钟</label>
              <NumericInput value={minutes} onValueChange={v => setForm(f => ({ ...f, minutes: v }))} disabled={isRunning} min={0} max={59} />
            </div>
            <div className="field-group" style={{ width: 72 }}>
              <label className="field-label">秒</label>
              <NumericInput value={seconds} onValueChange={v => setForm(f => ({ ...f, seconds: v }))} disabled={isRunning} min={0} max={59} />
            </div>
            <div className="field-group" style={{ width: 80 }}>
              <label className="field-label">毫秒</label>
              <NumericInput value={millis} onValueChange={v => setForm(f => ({ ...f, millis: v }))} disabled={isRunning} min={0} max={999} />
            </div>
            <span className="text-sm text-tertiary" style={{ paddingBottom: '6px' }}>
              = {formatTime(intervalMs)}
              {isKeyboard ? ` · 约 ${estimatedHz} Hz` : ''}
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">执行设置</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', rowGap: 'var(--space-md)' }}>
            <div className="field-group">
              <label className="field-label">执行模式</label>
              <div style={{ pointerEvents: isRunning ? 'none' : undefined, opacity: isRunning ? 0.6 : 1 }}>
                <RadioGroup
                  value={timesMode}
                  onChange={v => setForm(f => ({ ...f, timesMode: v as 'fixed' | 'continuous' }))}
                  options={[
                    { value: 'continuous', label: '持续运行' },
                    { value: 'fixed', label: '固定次数' },
                  ]}
                />
              </div>
            </div>
            {timesMode === 'fixed' && (
              <div className="field-group" style={{ width: 120 }}>
                <label className="field-label">次数</label>
                <Input
                  type="number"
                  variant="number"
                  value={times}
                  onChange={e => setForm(f => ({ ...f, times: Math.max(1, +e.target.value) }))}
                  disabled={isRunning}
                  min={1}
                />
              </div>
            )}
          </div>
        </div>

        {!isKeyboard && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <Crosshair size={14} /> 点击位置
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap', rowGap: 'var(--space-sm)' }}>
              <Toggle
                checked={useCurrentPos}
                onChange={v => setForm(f => ({ ...f, useCurrentPos: v }))}
                label="使用当前鼠标位置"
                disabled={isRunning}
              />
              {!useCurrentPos && (
                <div className="field-row">
                  <div className="field-inline">
                    <span className="text-sm text-secondary">X</span>
                    <Input
                      type="number"
                      variant="number"
                      value={posX}
                      onChange={e => setForm(f => ({ ...f, posX: +e.target.value }))}
                      disabled={isRunning}
                      style={{ width: 80 }}
                    />
                  </div>
                  <div className="field-inline">
                    <span className="text-sm text-secondary">Y</span>
                    <Input
                      type="number"
                      variant="number"
                      value={posY}
                      onChange={e => setForm(f => ({ ...f, posY: +e.target.value }))}
                      disabled={isRunning}
                      style={{ width: 80 }}
                    />
                  </div>
                  <IconButton
                    tooltip="拾取当前鼠标坐标"
                    onClick={() => {
                      void getMousePosition()
                        .then(p => {
                          setForm(f => ({ ...f, posX: p.x, posY: p.y }));
                        })
                        .catch(() => undefined);
                    }}
                  >
                    <MousePointer size={14} />
                  </IconButton>
                </div>
              )}
            </div>
          </div>
        )}

        {formError && (
          <div className="text-sm" style={{ color: 'var(--color-danger, #c50f1f)' }}>
            {formError}
          </div>
        )}
      </div>

      <div
        className="responsive-split-side"
        style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}
      >
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="panel-title">运行状态</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <StatRow label={isKeyboard ? '已按键次数' : '已执行次数'} value={String(state.clickerCount)} />
            <StatRow label="运行时长" value={formatTime(state.clickerRunningTime)} />
            <StatRow
              label={isKeyboard ? '下次按键' : '下次点击'}
              value={state.nextClickCountdown > 0 ? `${(state.nextClickCountdown / 1000).toFixed(1)}s` : '—'}
              highlight={isRunning}
            />
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {!isRunning ? (
            <Button
              variant="primary"
              icon={<Play size={14} />}
              onClick={handleStart}
              style={{ justifyContent: 'center' }}
              disabled={isKeyboard && !keys.length}
            >
              启动
            </Button>
          ) : (
            <>
              <Button
                variant={isPaused ? 'running' : 'paused'}
                icon={isPaused ? <Play size={14} /> : <Pause size={14} />}
                onClick={handlePause}
                style={{ justifyContent: 'center' }}
              >
                {isPaused ? '继续' : '暂停'}
              </Button>
              <Button
                variant="danger"
                icon={<Square size={14} fill="currentColor" />}
                onClick={handleStop}
                style={{ justifyContent: 'center' }}
              >
                停止
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
  ...qoderProps
}: { label: string; value: string; highlight?: boolean } & Record<string, any>) {
  return (
    <div
      style={{
        ...{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        ...((qoderProps as any)?.style),
      }}
      className={(qoderProps as any)?.className}
      data-qoder-id={(qoderProps as any)?.['data-qoder-id']}
      data-qoder-source={(qoderProps as any)?.['data-qoder-source']}
    >
      <span className="text-sm text-secondary">{label}</span>
      <span
        className={`text-mono ${highlight ? 'text-running' : ''}`}
        style={{ fontWeight: highlight ? 600 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}
