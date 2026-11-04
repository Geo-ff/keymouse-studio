/* =========================================================================
   TimedClick — 定时页面
   等待一段时间或到指定时刻后：点击鼠标、按下按键或运行脚本
   ========================================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Crosshair, MousePointer, Timer, Zap } from 'lucide-react';
import { useService } from '../hooks/useService';
import { Button, Toggle, Input, NumericInput, Select, IconButton, RadioGroup } from '../components/ui';
import { KeyCaptureInput } from '../components/KeyCaptureInput';
import type { MouseButton } from '../types';
import { formatTime } from '../data/mockData';
import { showSystemAlert } from '../utils/systemAlert';
import { usePersistedFormState } from '../utils/formPersistence';
import { formatKeySpecsLabel } from '../utils/keySpec';
import { buildPlaybackOptionsFromScript } from '../utils/playbackOptions';
import {
  TIMED_DEFAULTS,
  TIMED_FORM_KEY,
  buildTimedClickConfig,
  formatRunAt,
  timedSchedule,
  type TimedContent,
  type TimedFormState,
  type TimedTimingMode,
} from '../utils/timedConfig';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '—';
  return ms >= 60_000 ? formatTime(ms) : `${(ms / 1000).toFixed(1)}s`;
}

export function TimedClick(qoderProps: Record<string, any>) {
  const {
    startTimedClick, stopTimedClick, getMousePosition, state, settings,
    scripts, loadScript, playback, stopPlayback,
  } = useService();
  const [form, setForm] = usePersistedFormState<TimedFormState>(TIMED_FORM_KEY, TIMED_DEFAULTS);
  const [formError, setFormError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const starting = useRef(false);
  const { timingMode, hours, minutes, seconds, atHour, atMinute, atSecond, loop, content } = form;

  const active = state.runState === 'running' || state.runState === 'paused';
  const clickTaskRunning = state.snapshot.operationType === 'timed_click' && active;
  // A playback counts as this page's task only when it was scheduled here.
  const scriptTaskRunning =
    state.snapshot.operationType === 'playback' && active && content === 'script' && form.scheduledAt !== null;
  const isRunning = clickTaskRunning || scriptTaskRunning;

  // Forget the schedule once the task is over (or was left over from an earlier session).
  useEffect(() => {
    if (!isRunning && !starting.current && form.scheduledAt !== null) {
      setForm(f => ({ ...f, scheduledAt: null }));
    }
  }, [isRunning, form.scheduledAt, setForm]);

  // Keep the "first run at" preview current while choosing a clock time.
  useEffect(() => {
    if (isRunning) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const preview = useMemo(() => timedSchedule(form, now), [form, now]);
  const remainingMs = clickTaskRunning
    ? state.timedClickCountdown
    : scriptTaskRunning
      ? state.snapshot.countdownRemainingMs
      : 0;
  const scheduledLabel = form.scheduledAt ? formatRunAt(new Date(form.scheduledAt), now) : '—';

  const update = useCallback(<K extends keyof TimedFormState>(key: K, value: TimedFormState[K]) => {
    setFormError(null);
    setForm(f => ({ ...f, [key]: value }));
  }, [setForm]);

  const handleStart = useCallback(async () => {
    setFormError(null);
    const startedAt = new Date();
    if (content === 'script') {
      if (!form.scriptId) {
        setFormError('请选择要运行的脚本');
        return;
      }
      let script;
      try {
        script = await loadScript(form.scriptId);
      } catch {
        setFormError('无法读取该脚本，可能已被删除，请重新选择');
        return;
      }
      const enabled = script.actions.filter(action => action.enabled);
      if (!enabled.length) {
        setFormError(`脚本「${script.name}」没有可回放的动作`);
        return;
      }
      const schedule = timedSchedule(form, startedAt);
      starting.current = true;
      setForm(f => ({ ...f, scheduledAt: schedule.runAt.toISOString() }));
      try {
        await playback(
          { ...script, actions: enabled },
          { ...buildPlaybackOptionsFromScript(script, settings), countdownMs: 0, startDelayMs: schedule.delayMs },
        );
        void showSystemAlert('定时', '定时任务已开始', `将于 ${formatRunAt(schedule.runAt, startedAt)} 运行脚本「${script.name}」`);
      } catch {
        setForm(f => ({ ...f, scheduledAt: null }));
      } finally {
        starting.current = false;
      }
      return;
    }
    const result = buildTimedClickConfig(form, settings, startedAt);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    starting.current = true;
    setForm(f => ({ ...f, scheduledAt: result.schedule.runAt.toISOString() }));
    try {
      await startTimedClick(result.config);
      const what = content === 'keyboard' ? `按下 ${formatKeySpecsLabel(form.keys)}` : '点击鼠标';
      void showSystemAlert('定时', '定时任务已开始', `将于 ${formatRunAt(result.schedule.runAt, startedAt)} ${what}`);
    } catch {
      setForm(f => ({ ...f, scheduledAt: null }));
    } finally {
      starting.current = false;
    }
  }, [content, form, settings, loadScript, playback, startTimedClick, setForm]);

  const handleStop = useCallback(() => {
    const stop = scriptTaskRunning ? stopPlayback : stopTimedClick;
    void stop().catch(() => undefined);
  }, [scriptTaskRunning, stopPlayback, stopTimedClick]);

  const lockedStyle = { pointerEvents: isRunning ? 'none' as const : undefined, opacity: isRunning ? 0.6 : 1 };

  return (
    <div className={['responsive-split', (qoderProps as any)?.className].filter(Boolean).join(' ')} style={{ display: 'flex', gap: 'var(--space-lg)', height: '100%', ...((qoderProps as any)?.style) }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', minWidth: 0 }}>
        {/* 执行时间 */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <Timer size={14} /> 执行时间
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', ...lockedStyle }}>
            <RadioGroup
              style={{ alignSelf: 'flex-start' }}
              value={timingMode}
              onChange={value => update('timingMode', value as TimedTimingMode)}
              options={[
                { value: 'delay', label: '等待一段时间' },
                { value: 'at', label: '指定时刻' },
              ]}
            />
            {timingMode === 'delay' ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
                <TimeField label="小时" value={hours} max={23} onChange={v => update('hours', v)} />
                <TimeField label="分钟" value={minutes} max={59} onChange={v => update('minutes', v)} />
                <TimeField label="秒" value={seconds} max={59} onChange={v => update('seconds', v)} />
                <span className="text-sm text-tertiary" style={{ paddingBottom: '6px' }}>= {formatTime(preview.delayMs)}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
                <TimeField label="时" value={atHour} max={23} onChange={v => update('atHour', v)} />
                <TimeField label="分" value={atMinute} max={59} onChange={v => update('atMinute', v)} />
                <TimeField label="秒" value={atSecond} max={59} onChange={v => update('atSecond', v)} />
              </div>
            )}
            {!isRunning && (
              <span className="text-sm text-secondary">
                首次执行：{formatRunAt(preview.runAt, now)}（还有 {formatTime(preview.delayMs)}）
              </span>
            )}
            {content !== 'script' ? (
              <Toggle
                checked={loop}
                onChange={value => update('loop', value)}
                label={timingMode === 'at' ? '每天在这个时刻重复' : '循环执行（每隔同样的时长重复）'}
              />
            ) : (
              <span className="text-sm text-tertiary">运行脚本时只执行一次，循环次数和速度使用脚本自己保存的设置。</span>
            )}
            <span className="text-sm text-tertiary" style={{ lineHeight: 1.6 }}>
              定时任务不使用运行前倒计时。到点前请保持电脑开机、不休眠，并让 KeyMouse Studio 保持运行。
            </span>
          </div>
        </div>

        {/* 执行内容 */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <Zap size={14} /> 执行内容
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', ...lockedStyle }}>
            <RadioGroup
              style={{ alignSelf: 'flex-start' }}
              value={content}
              onChange={value => update('content', value as TimedContent)}
              options={[
                { value: 'mouse', label: '点击鼠标' },
                { value: 'keyboard', label: '按下按键' },
                { value: 'script', label: '运行脚本' },
              ]}
            />

            {content === 'mouse' && (
              <>
                <div className="field-group" style={{ alignSelf: 'flex-start' }}>
                  <label className="field-label">鼠标按键</label>
                  <Select value={form.button} onChange={e => update('button', e.target.value as MouseButton)}>
                    <option value="left">左键</option>
                    <option value="right">右键</option>
                    <option value="middle">中键</option>
                  </Select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap', rowGap: 'var(--space-sm)' }}>
                  <span className="text-sm text-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Crosshair size={13} /> 点击位置
                  </span>
                  <Toggle checked={form.useCurrentPos} onChange={v => update('useCurrentPos', v)} label="使用当前鼠标位置" />
                  {!form.useCurrentPos && (
                    <div className="field-row">
                      <div className="field-inline">
                        <span className="text-sm text-secondary">X</span>
                        <Input type="number" variant="number" value={form.posX} onChange={e => update('posX', +e.target.value)} style={{ width: 80 }} />
                      </div>
                      <div className="field-inline">
                        <span className="text-sm text-secondary">Y</span>
                        <Input type="number" variant="number" value={form.posY} onChange={e => update('posY', +e.target.value)} style={{ width: 80 }} />
                      </div>
                      <IconButton
                        tooltip="拾取当前鼠标坐标"
                        onClick={() => { void getMousePosition().then(p => { setForm(f => ({ ...f, posX: p.x, posY: p.y })); }).catch(() => undefined); }}
                      >
                        <MousePointer size={14} />
                      </IconButton>
                    </div>
                  )}
                </div>
              </>
            )}

            {content === 'keyboard' && (
              <div className="field-group" style={{ maxWidth: 260 }}>
                <label className="field-label">按键或组合键</label>
                <KeyCaptureInput value={form.keys} mode="chord" onCapture={keys => update('keys', keys)} placeholder="点击后按下按键" />
                <span className="text-sm text-tertiary">组合键会同时按下，约 30 ms 后松开。</span>
              </div>
            )}

            {content === 'script' && (
              <div className="field-group" style={{ maxWidth: 320 }}>
                <label className="field-label">脚本</label>
                <Select value={form.scriptId} onChange={e => update('scriptId', e.target.value)}>
                  <option value="">选择要运行的脚本</option>
                  {scripts.map(script => (
                    <option key={script.id} value={script.id}>{script.name}</option>
                  ))}
                </Select>
                {scripts.length === 0 && (
                  <span className="text-sm text-tertiary">还没有脚本，可以先去「录制」或「脚本」页面创建。</span>
                )}
              </div>
            )}
          </div>
        </div>

        {formError && (
          <div className="text-sm" style={{ color: 'var(--color-danger, #c50f1f)' }}>{formError}</div>
        )}
      </div>

      {/* 右侧状态 */}
      <div className="responsive-split-side" style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div className="panel-title">运行状态</div>
          <StatRow label="计划时间" value={isRunning ? scheduledLabel : '—'} />
          <StatRow
            label="距离执行"
            value={isRunning && remainingMs <= 0 && scriptTaskRunning ? '脚本运行中' : formatRemaining(isRunning ? remainingMs : 0)}
            highlight={isRunning}
          />
          {content !== 'script' && (
            <>
              <StatRow label="已执行次数" value={String(state.timedClickCount)} />
              <StatRow label="运行时长" value={formatTime(state.timedClickRunningTime)} />
            </>
          )}
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {!isRunning ? (
            <Button variant="primary" icon={<Play size={14} />} onClick={() => { void handleStart(); }} style={{ justifyContent: 'center' }}>
              启动
            </Button>
          ) : (
            <Button variant="danger" icon={<Square size={14} fill="currentColor" />} onClick={handleStop} style={{ justifyContent: 'center' }}>
              停止
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="field-group" style={{ width: 80 }}>
      <label className="field-label">{label}</label>
      <NumericInput value={value} onValueChange={onChange} min={0} max={max} />
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <span className="text-sm text-secondary">{label}</span>
      <span className={`text-mono ${highlight ? 'text-running' : ''}`} style={{ fontWeight: highlight ? 600 : 400, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
