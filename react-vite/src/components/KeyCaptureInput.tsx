import { useState, type KeyboardEvent } from 'react';
import type { KeySpec } from '../types';
import { eventToKeySpecs, eventToSingleKeySpec, formatKeySpecsLabel } from '../utils/keySpec';

interface KeyCaptureInputProps {
  /** Current key(s); shown as a label such as "Ctrl+C" or "A". */
  value: KeySpec[];
  /** single: one physical key (modifiers allowed alone); chord: modifiers + one main key. */
  mode: 'single' | 'chord';
  onCapture: (keys: KeySpec[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
}

/** "Click, then press" key field. Every key is captured (including Esc), then the field blurs. */
export function KeyCaptureInput({
  value,
  mode,
  onCapture,
  placeholder = '点击后按下按键',
  autoFocus = false,
  invalid = false,
}: KeyCaptureInputProps) {
  const [capturing, setCapturing] = useState(autoFocus);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode === 'single') {
      const key = eventToSingleKeySpec(event.nativeEvent);
      if (!key) return;
      onCapture([key]);
      event.currentTarget.blur();
      return;
    }
    // Chord: wait until a non-modifier key is pressed together with any held modifiers.
    const keys = eventToKeySpecs(event.nativeEvent);
    if (!keys?.length) return;
    onCapture(keys);
    event.currentTarget.blur();
  };

  return (
    <input
      className="input"
      readOnly
      autoFocus={autoFocus}
      value={capturing ? (mode === 'chord' ? '请按下组合键…' : '请按下按键…') : formatKeySpecsLabel(value, '')}
      placeholder={placeholder}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={handleKeyDown}
      style={{
        textAlign: 'center',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        color: capturing ? 'var(--color-action-primary)' : invalid ? 'var(--color-danger)' : undefined,
        borderColor: invalid && !capturing ? 'var(--color-danger)' : undefined,
      }}
    />
  );
}
