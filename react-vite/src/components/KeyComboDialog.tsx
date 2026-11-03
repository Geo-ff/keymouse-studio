import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeySpec } from '../types';
import { Button } from './ui';
import { KeyCaptureInput } from './KeyCaptureInput';
import { formatKeySpecsLabel } from '../utils/keySpec';

interface KeyComboDialogProps {
  open: boolean;
  onConfirm: (keys: KeySpec[]) => void;
  onCancel: () => void;
}

/** Capture a key or chord (e.g. Ctrl+C) to insert as a press-and-release sequence. */
export function KeyComboDialog({ open, onConfirm, onCancel }: KeyComboDialogProps) {
  const [keys, setKeys] = useState<KeySpec[]>([]);

  useEffect(() => {
    if (open) setKeys([]);
  }, [open]);

  if (!open) return null;
  const label = formatKeySpecsLabel(keys, '');
  return createPortal(
    <div
      className="dialog-backdrop dialog-enter"
      onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="confirm-dialog dialog-panel-enter" role="dialog" aria-modal="true" aria-labelledby="key-combo-title">
        <h2 id="key-combo-title">添加按键 / 组合键</h2>
        <p>
          点击下面的输入框，再按下要发送的按键或组合键（例如 Ctrl+C、Alt+Tab）。
          将按「依次按下修饰键 → 按下并松开主键 → 松开修饰键」的顺序插入动作。
        </p>
        <KeyCaptureInput value={keys} mode="chord" onCapture={setKeys} placeholder="点击后按下组合键" autoFocus />
        <div className="confirm-dialog-actions">
          <Button onClick={onCancel}>取消</Button>
          <Button variant="primary" onClick={() => onConfirm(keys)} disabled={!keys.length}>
            {label ? `插入 ${label}` : '插入'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
