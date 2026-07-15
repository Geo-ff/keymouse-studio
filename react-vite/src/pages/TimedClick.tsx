/* =========================================================================
   TimedClick — 定时点击页面
   设定等待时间后执行点击，支持循环和坐标记录
   ========================================================================= */

import { useState, useCallback } from 'react';
import { Play, Square, Crosshair, MousePointer, Timer } from 'lucide-react';
import { useService } from '../hooks/useService';
import { Button, Toggle, Input, Select, IconButton } from '../components/ui';
import type { TimedClickConfig, MouseButton } from '../types';
import { formatTime } from '../data/mockData';

export function TimedClick(qoderProps: Record<string, any>) {
  const { startTimedClick, stopTimedClick, getMousePosition, state } = useService();

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);
  const [loop, setLoop] = useState(false);
  const [button, setButton] = useState<MouseButton>('left');
  const [useCurrentPos, setUseCurrentPos] = useState(true);
  const [posX, setPosX] = useState(960);
  const [posY, setPosY] = useState(540);

  const isRunning = state.snapshot.operationType === 'timed_click' && (state.runState === 'running' || state.runState === 'paused');
  const waitMs = hours * 3600000 + minutes * 60000 + seconds * 1000;

  const handleStart = useCallback(() => {
    const config: TimedClickConfig = {
      delayMs: Math.max(1000, waitMs),
      button,
      clickCount: 1,
      intervalMs: 100,
      repeatMode: loop ? 'infinite' : 'count',
      repeatCount: 1,
      positionMode: useCurrentPos ? 'current' : 'fixed',
      x: useCurrentPos ? null : posX,
      y: useCurrentPos ? null : posY,
      countdownMs: 0,
    };
    void startTimedClick(config).catch(() => undefined);
  }, [startTimedClick, waitMs, loop, useCurrentPos, posX, posY, button]);

  const handleStop = useCallback(() => {
    void stopTimedClick().catch(() => undefined);
  }, [stopTimedClick]);

  return (
    <div className={["responsive-split", (qoderProps as any)?.className].filter(Boolean).join(" ")} style={{ ...({ display: 'flex', gap: 'var(--space-lg)', height: '100%' }), ...((qoderProps as any)?.style) }} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }} data-qoder-id="qel-div-ef952f93" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ef952f93&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:45,&quot;column&quot;:7}}">
        {/* 等待时间 */}
        <div className="panel" data-qoder-id="qel-panel-541fb4cd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-541fb4cd&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:47,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-ebb6290e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-ebb6290e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:48,&quot;column&quot;:11}}">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-bc789ee1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-bc789ee1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:49,&quot;column&quot;:13}}">
              <Timer size={14}  data-qoder-id="qel-timer-316f0703" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-timer-316f0703&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;timer&quot;,&quot;loc&quot;:{&quot;line&quot;:50,&quot;column&quot;:15}}"/> 等待时间
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)' }} data-qoder-id="qel-div-f295344c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-f295344c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:53,&quot;column&quot;:11}}">
            <div className="field-group" style={{ width: 80 }} data-qoder-id="qel-field-group-1fdc6bc4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-1fdc6bc4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:54,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-51e1f757" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-51e1f757&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:55,&quot;column&quot;:15}}">小时</label>
              <Input type="number" variant="number" value={hours} onChange={e => setHours(Math.max(0, +e.target.value))} disabled={isRunning} min={0}  data-qoder-id="qel-input-e9e9871e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-e9e9871e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:56,&quot;column&quot;:15}}"/>
            </div>
            <div className="field-group" style={{ width: 80 }} data-qoder-id="qel-field-group-b0ebff8a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-b0ebff8a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:58,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-dba43bf7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-dba43bf7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:59,&quot;column&quot;:15}}">分钟</label>
              <Input type="number" variant="number" value={minutes} onChange={e => setMinutes(Math.max(0, +e.target.value))} disabled={isRunning} min={0} max={59}  data-qoder-id="qel-input-e8e9858b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-e8e9858b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:60,&quot;column&quot;:15}}"/>
            </div>
            <div className="field-group" style={{ width: 80 }} data-qoder-id="qel-field-group-adebfad1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-adebfad1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:62,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-d8a4373e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-d8a4373e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:63,&quot;column&quot;:15}}">秒</label>
              <Input type="number" variant="number" value={seconds} onChange={e => setSeconds(Math.max(0, +e.target.value))} disabled={isRunning} min={0} max={59}  data-qoder-id="qel-input-ebe98a44" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-ebe98a44&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:64,&quot;column&quot;:15}}"/>
            </div>
            <span className="text-sm text-tertiary" style={{ paddingBottom: '6px' }} data-qoder-id="qel-text-sm-dfa08dcf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-dfa08dcf&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:66,&quot;column&quot;:13}}">
              = {formatTime(waitMs)}
            </span>
          </div>
        </div>

        {/* 点击设置 */}
        <div className="panel" data-qoder-id="qel-panel-e6e49d4d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-e6e49d4d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:73,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-c2ceddbc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-c2ceddbc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:74,&quot;column&quot;:11}}">
            <span className="panel-title" data-qoder-id="qel-panel-title-88e44b0c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-88e44b0c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:75,&quot;column&quot;:13}}">点击设置</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', rowGap: 'var(--space-md)' }} data-qoder-id="qel-div-c9d9fc06" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-c9d9fc06&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:77,&quot;column&quot;:11}}">
            <div className="field-group" data-qoder-id="qel-field-group-15eedd20" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-15eedd20&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:78,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-42a71cb3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-42a71cb3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:79,&quot;column&quot;:15}}">鼠标按键</label>
              <Select value={button} onChange={e => setButton(e.target.value as MouseButton)} disabled={isRunning} data-qoder-id="qel-select-5d254e39" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-5d254e39&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:80,&quot;column&quot;:15}}">
                <option value="left" data-qoder-id="qel-option-a6e47ecc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-a6e47ecc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:81,&quot;column&quot;:17}}">左键</option>
                <option value="right" data-qoder-id="qel-option-a9e48385" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-a9e48385&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:82,&quot;column&quot;:17}}">右键</option>
                <option value="middle" data-qoder-id="qel-option-a8e481f2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-a8e481f2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:83,&quot;column&quot;:17}}">中键</option>
              </Select>
            </div>
            <div className="field-group" style={{ justifyContent: 'center' }} data-qoder-id="qel-field-group-1feeecde" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-group-1feeecde&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-group&quot;,&quot;loc&quot;:{&quot;line&quot;:86,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-4ca72c71" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-4ca72c71&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:87,&quot;column&quot;:15}}">循环执行</label>
              <div style={{ paddingTop: '2px' }} data-qoder-id="qel-div-c4d7b590" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-c4d7b590&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:88,&quot;column&quot;:15}}">
                <Toggle checked={loop} onChange={setLoop} label={loop ? '已开启' : '已关闭'} disabled={isRunning}  data-qoder-id="qel-toggle-e99f730b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-e99f730b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;toggle&quot;,&quot;loc&quot;:{&quot;line&quot;:89,&quot;column&quot;:17}}"/>
              </div>
            </div>
          </div>
        </div>

        {/* 位置 */}
        <div className="panel" data-qoder-id="qel-panel-6ce9ed6d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-6ce9ed6d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:96,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-bcca571c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-bcca571c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:97,&quot;column&quot;:11}}">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-0ae75649" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-0ae75649&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:98,&quot;column&quot;:13}}">
              <Crosshair size={14}  data-qoder-id="qel-crosshair-cd938bbb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-crosshair-cd938bbb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;crosshair&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:15}}"/> 点击位置
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap', rowGap: 'var(--space-sm)' }} data-qoder-id="qel-div-cad7bf02" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-cad7bf02&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:102,&quot;column&quot;:11}}">
            <Toggle checked={useCurrentPos} onChange={setUseCurrentPos} label="使用当前鼠标位置" disabled={isRunning}  data-qoder-id="qel-toggle-ef9f7c7d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-ef9f7c7d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;toggle&quot;,&quot;loc&quot;:{&quot;line&quot;:103,&quot;column&quot;:13}}"/>
            {!useCurrentPos && (
              <div className="field-row" data-qoder-id="qel-field-row-85d6788a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-85d6788a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:105,&quot;column&quot;:15}}">
                <div className="field-inline" data-qoder-id="qel-field-inline-7543b94c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-7543b94c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:106,&quot;column&quot;:17}}">
                  <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-6a9919db" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-6a9919db&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:107,&quot;column&quot;:19}}">X</span>
                  <Input type="number" variant="number" value={posX} onChange={e => setPosX(+e.target.value)} disabled={isRunning} style={{ width: 80 }}  data-qoder-id="qel-input-56e1e3f0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-56e1e3f0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:108,&quot;column&quot;:19}}"/>
                </div>
                <div className="field-inline" data-qoder-id="qel-field-inline-763271be" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-inline-763271be&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;field-inline&quot;,&quot;loc&quot;:{&quot;line&quot;:110,&quot;column&quot;:17}}">
                  <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-6b991b6e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-6b991b6e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:19}}">Y</span>
                  <Input type="number" variant="number" value={posY} onChange={e => setPosY(+e.target.value)} disabled={isRunning} style={{ width: 80 }}  data-qoder-id="qel-input-5be1ebcf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-5be1ebcf&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:112,&quot;column&quot;:19}}"/>
                </div>
                <IconButton tooltip="拾取当前鼠标坐标" onClick={() => { void getMousePosition().then(p => { setPosX(p.x); setPosY(p.y); }).catch(() => undefined); }} data-qoder-id="qel-iconbutton-d31de59a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-d31de59a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:114,&quot;column&quot;:17}}">
                  <MousePointer size={14}  data-qoder-id="qel-mousepointer-2009d4e1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-mousepointer-2009d4e1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;mousepointer&quot;,&quot;loc&quot;:{&quot;line&quot;:115,&quot;column&quot;:19}}"/>
                </IconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧状态 */}
      <div className="responsive-split-side" style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }} data-qoder-id="qel-responsive-split-side-c67d5b5c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-responsive-split-side-c67d5b5c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;responsive-split-side&quot;,&quot;loc&quot;:{&quot;line&quot;:124,&quot;column&quot;:7}}">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} data-qoder-id="qel-panel-58d884d0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-58d884d0&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:125,&quot;column&quot;:9}}">
          <div className="panel-title" data-qoder-id="qel-panel-title-f7a2ab42" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-f7a2ab42&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:126,&quot;column&quot;:11}}">运行状态</div>
          <StatRow label="已执行次数" value={String(state.timedClickCount)}  data-qoder-id="qel-statrow-c48b6406" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statrow-c48b6406&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;statrow&quot;,&quot;loc&quot;:{&quot;line&quot;:127,&quot;column&quot;:11}}"/>
          <StatRow label="下次点击" value={state.timedClickCountdown > 0 ? `${(state.timedClickCountdown / 1000).toFixed(1)}s` : '—'} highlight={isRunning}  data-qoder-id="qel-statrow-c58b6599" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statrow-c58b6599&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;statrow&quot;,&quot;loc&quot;:{&quot;line&quot;:128,&quot;column&quot;:11}}"/>
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} data-qoder-id="qel-panel-64dad64b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-64dad64b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:130,&quot;column&quot;:9}}">
          {!isRunning ? (
            <Button variant="primary" icon={<Play size={14}  data-qoder-id="qel-play-7045b146" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-7045b146&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:132,&quot;column&quot;:45}}"/>} onClick={handleStart} style={{ justifyContent: 'center' }} data-qoder-id="qel-button-4ca84d7b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-4ca84d7b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:132,&quot;column&quot;:13}}">
              启动
            </Button>
          ) : (
            <Button variant="danger" icon={<Square size={14} fill="currentColor"  data-qoder-id="qel-square-7dc9423a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-square-7dc9423a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;square&quot;,&quot;loc&quot;:{&quot;line&quot;:136,&quot;column&quot;:44}}"/>} onClick={handleStop} style={{ justifyContent: 'center' }} data-qoder-id="qel-button-52a856ed" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-52a856ed&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;TimedClick&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:136,&quot;column&quot;:13}}">
              停止
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight, ...qoderProps }: { label: string; value: string; highlight?: boolean } & Record<string, any>) {
  return (
    <div style={{ ...({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-e84ae115" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-e84ae115&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;StatRow&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:149,&quot;column&quot;:7}}">{label}</span>
      <span className={`text-mono ${highlight ? 'text-running' : ''}`} style={{ fontWeight: highlight ? 600 : 400 }} data-qoder-id="qel-span-a960d428" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-a960d428&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/TimedClick.tsx&quot;,&quot;componentName&quot;:&quot;StatRow&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:150,&quot;column&quot;:7}}">
        {value}
      </span>
    </div>
  );
}
