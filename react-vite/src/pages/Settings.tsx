/* =========================================================================
   Settings — 设置页面
   急停热键、运行参数、外观偏好、Mock/Real 模式
   ========================================================================= */

import { useState } from 'react';
import { Zap, Clock, Palette, Cpu, MousePointerClick, Play } from 'lucide-react';
import { useService } from '../hooks/useService';
import { Toggle, Input, Select } from '../components/ui';
import type { AppSettings } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (settings: Partial<AppSettings>) => void;
}

export function Settings({ settings, onUpdate, ...qoderProps }: SettingsProps & Record<string, any>) {
  const { service } = useService();
  const [hotkeyInput, setHotkeyInput] = useState(settings.emergencyHotkey);

  const handleHotkeyCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const key = e.key;
    if (key === ' ') {
      setHotkeyInput('Space');
      onUpdate({ emergencyHotkey: 'Space' });
    } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      setHotkeyInput(key.toUpperCase());
      onUpdate({ emergencyHotkey: key.toUpperCase() });
    } else if (key.startsWith('F') && /\d+/.test(key.slice(1))) {
      setHotkeyInput(key);
      onUpdate({ emergencyHotkey: key });
    }
  };

  return (
    <div style={{ ...({ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', maxWidth: 720 }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 安全设置 */}
      <div className="panel" data-qoder-id="qel-panel-01a60bfa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-01a60bfa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:39,&quot;column&quot;:7}}">
        <div className="panel-header" data-qoder-id="qel-panel-header-1d0dd807" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-1d0dd807&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:40,&quot;column&quot;:9}}">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-ca06da8e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-ca06da8e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:41,&quot;column&quot;:11}}">
            <Zap size={14} style={{ color: 'var(--color-danger)' }}  data-qoder-id="qel-zap-da291ada" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-zap-da291ada&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;zap&quot;,&quot;loc&quot;:{&quot;line&quot;:42,&quot;column&quot;:13}}"/> 安全机制
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} data-qoder-id="qel-div-ae6a449f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ae6a449f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:45,&quot;column&quot;:9}}">
          <div className="field-row" data-qoder-id="qel-field-row-49e2d642" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-49e2d642&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:46,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-1b0c0f04" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-1b0c0f04&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:47,&quot;column&quot;:13}}">急停热键</label>
            <input
              className="input"
              style={{ width: 120, textAlign: 'center', fontFamily: 'var(--font-mono)' }}
              value={hotkeyInput}
              onKeyDown={handleHotkeyCapture}
              onChange={() => {}}
              readOnly
             data-qoder-id="qel-input-c0b602e2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-c0b602e2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:48,&quot;column&quot;:13}}"/>
            <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-cdc6a8d6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-cdc6a8d6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:56,&quot;column&quot;:13}}">在输入框内按下按键设置热键</span>
          </div>

          <div className="field-row" data-qoder-id="qel-field-row-bf088633" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-bf088633&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:59,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-5be9fbb7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-5be9fbb7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:60,&quot;column&quot;:13}}">运行前倒计时</label>
            <Toggle
              checked={settings.countdownEnabled}
              onChange={v => onUpdate({ countdownEnabled: v })}
              label={settings.countdownEnabled ? '已开启' : '已关闭'}
             data-qoder-id="qel-toggle-97f7e137" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-97f7e137&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;toggle&quot;,&quot;loc&quot;:{&quot;line&quot;:61,&quot;column&quot;:13}}"/>
          </div>

          {settings.countdownEnabled && (
            <div className="field-row" style={{ paddingLeft: 140 }} data-qoder-id="qel-field-row-c2088aec" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-c2088aec&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:69,&quot;column&quot;:13}}">
              <label className="field-label" data-qoder-id="qel-field-label-58e9f6fe" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-58e9f6fe&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:70,&quot;column&quot;:15}}">倒计时秒数</label>
              <Input
                type="number"
                variant="number"
                value={settings.countdownSeconds}
                onChange={e => onUpdate({ countdownSeconds: Math.max(1, +e.target.value) })}
                style={{ width: 80 }}
                min={1}
                max={10}
               data-qoder-id="qel-input-dbf74c84" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-dbf74c84&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:71,&quot;column&quot;:15}}"/>
              <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-d0c6ad8f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-d0c6ad8f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:80,&quot;column&quot;:15}}">秒</span>
            </div>
          )}
        </div>
      </div>

      {/* 外观 */}
      <div className="panel" data-qoder-id="qel-panel-6462538d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-6462538d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:87,&quot;column&quot;:7}}">
        <div className="panel-header" data-qoder-id="qel-panel-header-f6cfe07c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-f6cfe07c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:88,&quot;column&quot;:9}}">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-b2ceb6cc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-b2ceb6cc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:89,&quot;column&quot;:11}}">
            <Palette size={14}  data-qoder-id="qel-palette-28154c9a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-palette-28154c9a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;palette&quot;,&quot;loc&quot;:{&quot;line&quot;:90,&quot;column&quot;:13}}"/> 外观
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} data-qoder-id="qel-div-a64032b3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-a64032b3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:93,&quot;column&quot;:9}}">
          <div className="field-row" data-qoder-id="qel-field-row-511027ce" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-511027ce&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:94,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-c7ece452" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-c7ece452&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:95,&quot;column&quot;:13}}">主题</label>
            <Select
              value={settings.theme}
              onChange={e => onUpdate({ theme: e.target.value as 'light' | 'dark' })}
              style={{ width: 120 }}
             data-qoder-id="qel-select-289ed3e6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-289ed3e6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:96,&quot;column&quot;:13}}">
              <option value="light" data-qoder-id="qel-option-c5906fc5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-c5906fc5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:101,&quot;column&quot;:15}}">浅色</option>
              <option value="dark" data-qoder-id="qel-option-c4906e32" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-c4906e32&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:102,&quot;column&quot;:15}}">深色</option>
            </Select>
          </div>
        </div>
      </div>

      {/* 系统模式 */}
      <div className="panel" data-qoder-id="qel-panel-5a648266" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-5a648266&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:109,&quot;column&quot;:7}}">
        <div className="panel-header" data-qoder-id="qel-panel-header-76c85b37" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-76c85b37&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:110,&quot;column&quot;:9}}">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-38d1c855" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-38d1c855&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:11}}">
            <Cpu size={14}  data-qoder-id="qel-cpu-ac05d147" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-cpu-ac05d147&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;cpu&quot;,&quot;loc&quot;:{&quot;line&quot;:112,&quot;column&quot;:13}}"/> 系统模式
          </span>
        </div>
        <div className="field-row" data-qoder-id="qel-field-row-c80d118c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-c80d118c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:115,&quot;column&quot;:9}}">
          <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-caef27a2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-caef27a2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:116,&quot;column&quot;:11}}">运行模式</label>
          <Select
            value={settings.serviceMode}
            onChange={e => onUpdate({ serviceMode: e.target.value as 'mock' | 'real' })}
            style={{ width: 160 }}
           data-qoder-id="qel-select-239c8d70" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-239c8d70&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:117,&quot;column&quot;:11}}">
            <option value="mock" data-qoder-id="qel-option-d68e4bf1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-d68e4bf1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:122,&quot;column&quot;:13}}">Mock（模拟）</option>
            <option value="real" disabled data-qoder-id="qel-option-d38e4738" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-d38e4738&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:123,&quot;column&quot;:13}}">Real（真实，尚未接入）</option>
          </Select>
          <span className="badge" style={{ color: 'var(--color-paused)' }} data-qoder-id="qel-badge-728545c6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-badge-728545c6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;badge&quot;,&quot;loc&quot;:{&quot;line&quot;:125,&quot;column&quot;:11}}">
            当前为 Mock 模式
          </span>
        </div>
        <p className="text-sm text-tertiary mt-sm" style={{ paddingLeft: 140 }} data-qoder-id="qel-text-sm-4c0f698a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-4c0f698a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:129,&quot;column&quot;:9}}">
          Mock 模式使用模拟数据，不操作真实键鼠。Real 模式将连接本地键鼠控制 API，尚未实现。
        </p>
      </div>

      {/* 录制选项 */}
      <div className="panel" data-qoder-id="qel-panel-df67925c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-df67925c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:135,&quot;column&quot;:7}}">
        <div className="panel-header" data-qoder-id="qel-panel-header-81c3ef5a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-81c3ef5a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:136,&quot;column&quot;:9}}">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-c7ca5aad" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-c7ca5aad&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:137,&quot;column&quot;:11}}">
            <MousePointerClick size={14}  data-qoder-id="qel-mousepointerclick-d84dc809" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-mousepointerclick-d84dc809&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;mousepointerclick&quot;,&quot;loc&quot;:{&quot;line&quot;:138,&quot;column&quot;:13}}"/> 录制选项
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} data-qoder-id="qel-div-ad4f4842" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ad4f4842&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:141,&quot;column&quot;:9}}">
          <div className="field-row" data-qoder-id="qel-field-row-5814b001" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-5814b001&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:142,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-c4ddd50f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-c4ddd50f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:143,&quot;column&quot;:13}}">录制鼠标移动</label>
            <Toggle
              checked={settings.recordMouseMove}
              onChange={v => onUpdate({ recordMouseMove: v })}
              label={settings.recordMouseMove ? '已开启' : '已关闭'}
             data-qoder-id="qel-toggle-9504a871" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-9504a871&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;toggle&quot;,&quot;loc&quot;:{&quot;line&quot;:144,&quot;column&quot;:13}}"/>
          </div>
          <div className="field-row" data-qoder-id="qel-field-row-5514ab48" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-5514ab48&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:150,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-c7ddd9c8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-c7ddd9c8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:151,&quot;column&quot;:13}}">最小记录间隔</label>
            <Input
              type="number"
              variant="number"
              value={settings.minRecordInterval}
              onChange={e => onUpdate({ minRecordInterval: Math.max(10, +e.target.value) })}
              style={{ width: 80 }}
              min={10}
              max={1000}
             data-qoder-id="qel-input-4eefb2c8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-4eefb2c8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:152,&quot;column&quot;:13}}"/>
            <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-55bcf192" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-55bcf192&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:161,&quot;column&quot;:13}}">毫秒</span>
          </div>
        </div>
      </div>

      {/* 回放选项 */}
      <div className="panel" data-qoder-id="qel-panel-e3588e1e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-e3588e1e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:167,&quot;column&quot;:7}}">
        <div className="panel-header" data-qoder-id="qel-panel-header-69c60829" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-69c60829&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:168,&quot;column&quot;:9}}">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-adcc7056" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-adcc7056&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:169,&quot;column&quot;:11}}">
            <Play size={14}  data-qoder-id="qel-play-6f5f7386" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-play-6f5f7386&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;play&quot;,&quot;loc&quot;:{&quot;line&quot;:170,&quot;column&quot;:13}}"/> 回放选项
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} data-qoder-id="qel-div-2b4c3d05" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-2b4c3d05&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:173,&quot;column&quot;:9}}">
          <div className="field-row" data-qoder-id="qel-field-row-54126b1e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-54126b1e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:174,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-c6e016cc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-c6e016cc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:175,&quot;column&quot;:13}}">默认速度倍率</label>
            <Select
              value={String(settings.defaultSpeedMultiplier)}
              onChange={e => onUpdate({ defaultSpeedMultiplier: +e.target.value })}
              style={{ width: 120 }}
             data-qoder-id="qel-select-b3975ff2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-b3975ff2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:176,&quot;column&quot;:13}}">
              <option value="0.5" data-qoder-id="qel-option-4e938607" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-4e938607&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:181,&quot;column&quot;:15}}">0.5x</option>
              <option value="1" data-qoder-id="qel-option-579a4ff7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-579a4ff7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:182,&quot;column&quot;:15}}">1x（正常）</option>
              <option value="2" data-qoder-id="qel-option-569a4e64" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-569a4e64&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:183,&quot;column&quot;:15}}">2x（快速）</option>
              <option value="5" data-qoder-id="qel-option-599a531d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-option-599a531d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;option&quot;,&quot;loc&quot;:{&quot;line&quot;:184,&quot;column&quot;:15}}">5x（极速）</option>
            </Select>
          </div>
          <div className="field-row" data-qoder-id="qel-field-row-c919df12" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-row-c919df12&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-row&quot;,&quot;loc&quot;:{&quot;line&quot;:187,&quot;column&quot;:11}}">
            <label className="field-label" style={{ width: 140 }} data-qoder-id="qel-field-label-47e32076" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-field-label-47e32076&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;field-label&quot;,&quot;loc&quot;:{&quot;line&quot;:188,&quot;column&quot;:13}}">默认循环次数</label>
            <Input
              type="number"
              variant="number"
              value={settings.defaultLoopTimes}
              onChange={e => onUpdate({ defaultLoopTimes: Math.max(1, +e.target.value) })}
              style={{ width: 80 }}
              min={1}
             data-qoder-id="qel-input-deea854a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-deea854a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:189,&quot;column&quot;:13}}"/>
            <span className="text-sm text-tertiary" data-qoder-id="qel-text-sm-51baacaf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-51baacaf&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Settings.tsx&quot;,&quot;componentName&quot;:&quot;Settings&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:197,&quot;column&quot;:13}}">次</span>
          </div>
        </div>
      </div>
    </div>
  );
}
