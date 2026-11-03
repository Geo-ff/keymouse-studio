import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { eventToHotkey, formatHotkeyLabel, normalizeHotkeyDisplay } from '../utils/hotkey';

interface HotkeyCaptureInputProps {
  value: string;
  /** Called with the captured chord (display form), or '' when cleared. */
  onChange: (hotkey: string) => void;
  placeholder?: string;
  disabled?: boolean;
  width?: number;
}

/**
 * Compact "click, then press a key" field. Backspace / Delete clears, Esc cancels.
 */
export function HotkeyCaptureInput({
  value,
  onChange,
  placeholder = '设置快捷键',
  disabled = false,
  width = 112,
}: HotkeyCaptureInputProps) {
  const [capturing, setCapturing] = useState(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const noModifiers = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if (event.key === 'Escape' && noModifiers) {
      event.currentTarget.blur();
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && noModifiers) {
      if (value) onChange('');
      event.currentTarget.blur();
      return;
    }
    const captured = eventToHotkey(event.nativeEvent);
    if (!captured) return;
    onChange(normalizeHotkeyDisplay(captured));
    event.currentTarget.blur();
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <input
        className="input"
        readOnly
        disabled={disabled}
        value={capturing ? '请按下按键…' : formatHotkeyLabel(value, '')}
        placeholder={placeholder}
        title="点击后按下快捷键；Backspace 清除，Esc 取消"
        onFocus={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
        onKeyDown={handleKeyDown}
        onClick={event => event.stopPropagation()}
        style={{
          width,
          padding: '0 6px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 'var(--fs-sm)',
          color: capturing ? 'var(--color-action-primary)' : undefined,
        }}
      />
      {value && !disabled && (
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          data-tooltip="清除快捷键"
          aria-label="清除快捷键"
          onClick={event => {
            event.stopPropagation();
            onChange('');
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
