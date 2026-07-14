/* =========================================================================
   AutoClicker — 连点器页面
   完整参数配置：按键、模式、间隔、次数、坐标、启停控制
   ========================================================================= */

import { useState, useCallback } from 'react';
import { Play, Pause, Square, MousePointer, Crosshair, Clock } from 'lucide-react';
import { useService } from '../hooks/useService';
import { Button, RadioGroup, Toggle, Input, Select, IconButton } from '../components/ui';
import type { ClickerConfig, MouseButton, ClickMode } from '../types';
import { formatTime } from '../data/mockData';

export function AutoClicker(qoderProps: Record<string, any>) {
  const { service, state } = useService();

  const [button, setButton] = useState<MouseButton>('left');
  const [clickMode, setClickMode] = useState<ClickMode>('single');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [millis, setMillis] = useState(500);
  const [timesMode, setTimesMode] = useState<'fixed' | 'continuous'>('continuous');
  const [times, setTimes] = useState(10);
  const [useCurrentPos, setUseCurrentPos] = useState(true);
  const [posX, setPosX] = useState(960);
  const [posY, setPosY] = useState(540);

  const isRunning = state.runState === 'running' || state.runState === 'paused';
  const isPaused = state.runState === 'paused';

  const intervalMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;

  const handleStart = useCallback(() => {
    const config: ClickerConfig = {
      button,
      clickMode,
      intervalMs: Math.max(50, intervalMs),
      times: timesMode === 'continuous' ? 0 : times,
      useCurrentPos,
      x: useCurrentPos ? undefined : posX,
      y: useCurrentPos ? undefined : posY,
    };
    service.startClicker(config);
  }, [service, button, clickMode, intervalMs, timesMode, times, useCurrentPos, posX, posY]);

  const handlePause = useCallback(() => {
    if (isPaused) service.resumeClicker();
    else service.pauseClicker();
  }, [service, isPaused]);

  const handleStop = useCallback(() => {
    service.stopClicker();
  }, [service]);

  return (
    <div className={["responsive-split", (qoderProps as any)?.className].filter(Boolean).join(" ")} style={{ ...({ display: 'flex', gap: 'var(--space-lg)', height: '100%' }), ...((qoderProps as any)?.style) }} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 参数配置 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }} data-qoder-id="qel-div-fab31c97" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-fab31c97&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:58,&quot;column&quot;:7}}">
        {/* 鼠标按键 + 点击模式 */}
        <div className="panel" data-qoder-id="qel-panel-67783339" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-67783339&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:60,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-b9ba02aa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-b9ba02aa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:61,&quot;column&quot;:11}}">
            <span className="panel-title" data-qoder-id="qel-panel-title-dc778bcd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-dc778bcd&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:62,&quot;column&quot;:13}}">点击设置</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', rowGap: 'var(--space-md)' }} data-qoder-id="qel-div-f6b3164b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-f6b3164b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:64,&quot;column&quot;:11}}">
            <div className="field-group" data-qoder-id="qel-field-group-059cc0d5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-059cc0d5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:65,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-92a5ac80" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-92a5ac80&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:66,&quot;column&quot;:15}}">鼠标按键</label>
              <Select value={button} onChange={e => setButton(e.target.value as MouseButton)} disabled={isRunning} data-qoder-id="qel-select-4a2f3926" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-4a2f3926&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:67,&quot;column&quot;:15}}">
                <option value="left" data-qoder-id="qel-option-aa519064" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-aa519064&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:68,&quot;column&quot;:17}}">左键</option>
                <option value="right" data-qoder-id="qel-option-ab5191f7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-ab5191f7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:69,&quot;column&quot;:17}}">右键</option>
                <option value="middle" data-qoder-id="qel-option-ac51938a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-ac51938a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:70,&quot;column&quot;:17}}">中键</option>
              </Select>
            </div>
            <div className="field-group" data-qoder-id="qel-field-group-b3b492f0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-b3b492f0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:73,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-a4e4c84d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-a4e4c84d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:74,&quot;column&quot;:15}}">点击模式</label>
              <RadioGroup
                value={clickMode}
                onChange={(v) => setClickMode(v as ClickMode)}
                options={[
                  { value: 'single', label: '单击' },
                  { value: 'double', label: '双击' },
                ]}
               data-qoder-id="qel-radiogroup-f4f2eb29" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-radiogroup-f4f2eb29&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;radiogroup&quot;,&quot;loc&quot;:{&quot;line&quot;:75,&quot;column&quot;:15}}"/>
            </div>
          </div>
        </div>

        {/* 间隔时间 */}
        <div className="panel" data-qoder-id="qel-panel-e133ca3f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-e133ca3f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:88,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-6cca7eb2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-6cca7eb2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:89,&quot;column&quot;:11}}">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-7d27823b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-7d27823b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:90,&quot;column&quot;:13}}">
              <Clock size={14}  data-qoder-id="qel-clock-9fc425c1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-clock-9fc425c1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;clock&quot;,&quot;loc&quot;:{&quot;line&quot;:91,&quot;column&quot;:15}}"/> 间隔时间
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)', flexWrap: 'wrap' }} data-qoder-id="qel-div-4ef61ae5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-4ef61ae5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:94,&quot;column&quot;:11}}">
            <div className="field-group" style={{ width: 72 }} data-qoder-id="qel-field-group-bdb6e145" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-bdb6e145&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:95,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-a4e706e4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-a4e706e4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:96,&quot;column&quot;:15}}">小时</label>
              <Input type="number" variant="number" value={hours} onChange={e => setHours(Math.max(0, +e.target.value))} disabled={isRunning} min={0}  data-qoder-id="qel-input-75796278" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-75796278&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:97,&quot;column&quot;:15}}"/>
            </div>
            <div className="field-group" style={{ width: 72 }} data-qoder-id="qel-field-group-b8b6d966" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-b8b6d966&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-a3e70551" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-a3e70551&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:100,&quot;column&quot;:15}}">分钟</label>
              <Input type="number" variant="number" value={minutes} onChange={e => setMinutes(Math.max(0, +e.target.value))} disabled={isRunning} min={0} max={59}  data-qoder-id="qel-input-7a796a57" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-7a796a57&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:101,&quot;column&quot;:15}}"/>
            </div>
            <div className="field-group" style={{ width: 72 }} data-qoder-id="qel-field-group-b7b6d7d3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-b7b6d7d3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:103,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-9ee6fd72" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-9ee6fd72&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:104,&quot;column&quot;:15}}">秒</label>
              <Input type="number" variant="number" value={seconds} onChange={e => setSeconds(Math.max(0, +e.target.value))} disabled={isRunning} min={0} max={59}  data-qoder-id="qel-input-6f795906" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-6f795906&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:105,&quot;column&quot;:15}}"/>
            </div>
            <div className="field-group" style={{ width: 80 }} data-qoder-id="qel-field-group-42b9f13b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-42b9f13b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:107,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-0be9e7a0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-0be9e7a0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:108,&quot;column&quot;:15}}">毫秒</label>
              <Input type="number" variant="number" value={millis} onChange={e => setMillis(Math.max(0, +e.target.value))} disabled={isRunning} min={0} max={999}  data-qoder-id="qel-input-7477224e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-7477224e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:109,&quot;column&quot;:15}}"/>
            </div>
            <span className="text-sm text-tertiary" style={{ paddingBottom: '6px' }} data-qoder-id="qel-text-sm-25a33b11" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-25a33b11&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:13}}">
              = {formatTime(intervalMs)}
            </span>
          </div>
        </div>

        {/* 次数 + 坐标 */}
        <div className="panel" data-qoder-id="qel-panel-ef385d77" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-ef385d77&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:118,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-7ec61dda" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-7ec61dda&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:119,&quot;column&quot;:11}}">
            <span className="panel-title" data-qoder-id="qel-panel-title-0b225197" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-0b225197&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:120,&quot;column&quot;:13}}">执行设置</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', rowGap: 'var(--space-md)' }} data-qoder-id="qel-div-47f3d149" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-47f3d149&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:122,&quot;column&quot;:11}}">
            <div className="field-group" data-qoder-id="qel-field-group-3ab9e4a3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-3ab9e4a3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:123,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-13e9f438" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-13e9f438&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:124,&quot;column&quot;:15}}">执行模式</label>
              <RadioGroup
                value={timesMode}
                onChange={(v) => setTimesMode(v as 'fixed' | 'continuous')}
                options={[
                  { value: 'continuous', label: '持续运行' },
                  { value: 'fixed', label: '固定次数' },
                ]}
               data-qoder-id="qel-radiogroup-f5ffb8af" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-radiogroup-f5ffb8af&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;radiogroup&quot;,&quot;loc&quot;:{&quot;line&quot;:125,&quot;column&quot;:15}}"/>
            </div>
            {timesMode === 'fixed' && (
              <div className="field-group" style={{ width: 120 }} data-qoder-id="qel-field-group-49bc3ad7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-49bc3ad7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:135,&quot;column&quot;:15}}">
                <label className="field-label" data-qoder-id="qel-field-label-14ec3462" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-14ec3462&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:136,&quot;column&quot;:17}}">次数</label>
                <Input type="number" variant="number" value={times} onChange={e => setTimes(Math.max(1, +e.target.value))} disabled={isRunning} min={1}  data-qoder-id="qel-input-7d88799a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-7d88799a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:137,&quot;column&quot;:17}}"/>
              </div>
            )}
          </div>
        </div>

        {/* 位置 */}
        <div className="panel" data-qoder-id="qel-panel-6d3b6268" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-6d3b6268&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:144,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-fed2204d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-fed2204d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:145,&quot;column&quot;:11}}">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-892e50e4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-892e50e4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:146,&quot;column&quot;:13}}">
              <Crosshair size={14}  data-qoder-id="qel-crosshair-54f3fa66" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-crosshair-54f3fa66&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;crosshair&quot;,&quot;loc&quot;:{&quot;line&quot;:147,&quot;column&quot;:15}}"/> 点击位置
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap', rowGap: 'var(--space-sm)' }} data-qoder-id="qel-div-caf0cdeb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-caf0cdeb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:150,&quot;column&quot;:11}}">
            <Toggle checked={useCurrentPos} onChange={setUseCurrentPos} label="使用当前鼠标位置" disabled={isRunning}  data-qoder-id="qel-toggle-b8bfa740" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-b8bfa740&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;toggle&quot;,&quot;loc&quot;:{&quot;line&quot;:151,&quot;column&quot;:13}}"/>
            {!useCurrentPos && (
              <div className="field-row" data-qoder-id="qel-field-row-093a74f0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-093a74f0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:153,&quot;column&quot;:15}}">
                <div className="field-inline" data-qoder-id="qel-field-inline-9489d402" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-9489d402&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:154,&quot;column&quot;:17}}">
                  <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-24b24408" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-24b24408&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:155,&quot;column&quot;:19}}">X</span>
                  <Input type="number" variant="number" value={posX} onChange={e => setPosX(+e.target.value)} disabled={isRunning} style={{ width: 80 }}  data-qoder-id="qel-input-f58564eb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-f58564eb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:156,&quot;column&quot;:19}}"/>
                </div>
                <div className="field-inline" data-qoder-id="qel-field-inline-9189cf49" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-9189cf49&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:158,&quot;column&quot;:17}}">
                  <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-2bb24f0d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-2bb24f0d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:159,&quot;column&quot;:19}}">Y</span>
                  <Input type="number" variant="number" value={posY} onChange={e => setPosY(+e.target.value)} disabled={isRunning} style={{ width: 80 }}  data-qoder-id="qel-input-f88569a4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-f88569a4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:160,&quot;column&quot;:19}}"/>
                </div>
                <IconButton tooltip="拾取当前鼠标坐标" onClick={() => { const p = service.getMousePosition(); setPosX(p.x); setPosY(p.y); }} data-qoder-id="qel-iconbutton-ee43b539" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-ee43b539&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:162,&quot;column&quot;:17}}">
                  <MousePointer size={14}  data-qoder-id="qel-mousepointer-d86c1bda" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-mousepointer-d86c1bda&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;mousepointer&quot;,&quot;loc&quot;:{&quot;line&quot;:163,&quot;column&quot;:19}}"/>
                </IconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧运行状态 */}
      <div className="responsive-split-side" style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }} data-qoder-id="qel-responsive-split-side-49c87427" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-responsive-split-side-49c87427&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;responsive-split-side&quot;,&quot;loc&quot;:{&quot;line&quot;:172,&quot;column&quot;:7}}">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} data-qoder-id="qel-panel-5d3fc666" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-5d3fc666&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:173,&quot;column&quot;:9}}">
          <div className="panel-title" data-qoder-id="qel-panel-title-a9d2f170" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-a9d2f170&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:174,&quot;column&quot;:11}}">运行状态</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} data-qoder-id="qel-div-d4ec607b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-d4ec607b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:175,&quot;column&quot;:11}}">
            <StatRow label="已执行次数" value={String(state.clickerCount)}  data-qoder-id="qel-statrow-7ed57b78" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statrow-7ed57b78&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;statrow&quot;,&quot;loc&quot;:{&quot;line&quot;:176,&quot;column&quot;:13}}"/>
            <StatRow label="运行时长" value={formatTime(state.clickerRunningTime)}  data-qoder-id="qel-statrow-85d5867d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statrow-85d5867d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;statrow&quot;,&quot;loc&quot;:{&quot;line&quot;:177,&quot;column&quot;:13}}"/>
            <StatRow label="下次点击" value={state.nextClickCountdown > 0 ? `${(state.nextClickCountdown / 1000).toFixed(1)}s` : '—'} highlight={isRunning}  data-qoder-id="qel-statrow-84d584ea" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statrow-84d584ea&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;statrow&quot;,&quot;loc&quot;:{&quot;line&quot;:178,&quot;column&quot;:13}}"/>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} data-qoder-id="qel-panel-5f3fc98c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-5f3fc98c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:183,&quot;column&quot;:9}}">
          {!isRunning ? (
            <Button variant="primary" icon={<Play size={14}  data-qoder-id="qel-play-9430fee5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-9430fee5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:185,&quot;column&quot;:45}}"/>} onClick={handleStart} style={{ justifyContent: 'center' }} data-qoder-id="qel-button-ce5605ec" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-ce5605ec&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:185,&quot;column&quot;:13}}">
              启动
            </Button>
          ) : (
            <>
              <Button
                variant={isPaused ? 'running' : 'paused'}
                icon={isPaused ? <Play size={14}  data-qoder-id="qel-play-962ec374" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-962ec374&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:192,&quot;column&quot;:34}}"/> : <Pause size={14}  data-qoder-id="qel-pause-471db6b7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-pause-471db6b7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;pause&quot;,&quot;loc&quot;:{&quot;line&quot;:192,&quot;column&quot;:55}}"/>}
                onClick={handlePause}
                style={{ justifyContent: 'center' }}
               data-qoder-id="qel-button-d4560f5e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-d4560f5e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:190,&quot;column&quot;:15}}">
                {isPaused ? '继续' : '暂停'}
              </Button>
              <Button variant="danger" icon={<Square size={14} fill="currentColor"  data-qoder-id="qel-square-f177ad1b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-square-f177ad1b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;square&quot;,&quot;loc&quot;:{&quot;line&quot;:198,&quot;column&quot;:46}}"/>} onClick={handleStop} style={{ justifyContent: 'center' }} data-qoder-id="qel-button-c953bf76" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-c953bf76&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;AutoClicker&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:198,&quot;column&quot;:15}}">
                停止
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight, ...qoderProps }: { label: string; value: string; highlight?: boolean } & Record<string, any>) {
  return (
    <div style={{ ...({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-20d1e1d7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-20d1e1d7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;StatRow&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:212,&quot;column&quot;:7}}">{label}</span>
      <span className={`text-mono ${highlight ? 'text-running' : ''}`} style={{ fontWeight: highlight ? 600 : 400 }} data-qoder-id="qel-span-a0914372" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-a0914372&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/AutoClicker.tsx&quot;,&quot;componentName&quot;:&quot;StatRow&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:213,&quot;column&quot;:7}}">
        {value}
      </span>
    </div>
  );
}
