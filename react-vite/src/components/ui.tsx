/* =========================================================================
   UI 基础组件 — 按等效 shadcn 风格手写
   不依赖 shadcn CLI，通过 CSS 变量驱动主题
   ========================================================================= */

import React from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/* --- Button --- */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'running' | 'paused';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  tooltip?: string;
}

export function Button({ variant = 'secondary', size = 'md', icon, tooltip, children, className = '', ...props }: ButtonProps & Record<string, any>) {
  const cls = `btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`;
  return (
    <button className={[(cls), className].filter(Boolean).join(" ")} data-tooltip={tooltip} {...props} style={(props as any)?.style} data-qoder-id={(props as any)?.["data-qoder-id"]} data-qoder-source={(props as any)?.["data-qoder-source"]}>
      {icon}
      {children}
    </button>
  );
}

/* --- IconButton --- */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  children: ReactNode;
}

export function IconButton({ tooltip, children, className = '', ...props }: IconButtonProps & Record<string, any>) {
  return (
    <button className={`btn btn-ghost btn-icon ${className}`} data-tooltip={tooltip} {...props} style={(props as any)?.style} data-qoder-id={(props as any)?.["data-qoder-id"]} data-qoder-source={(props as any)?.["data-qoder-source"]}>
      {children}
    </button>
  );
}

/* --- Input --- */
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  variant?: 'text' | 'number';
}

export function Input({ size = 'md', variant = 'text', className = '', ...props }: InputProps & Record<string, any>) {
  const cls = `input ${size === 'sm' ? 'input-sm' : ''} ${variant === 'number' ? 'input-number' : ''} ${className}`;
  return <input className={[(cls), className].filter(Boolean).join(" ")} {...props}  style={(props as any)?.style} data-qoder-id={(props as any)?.["data-qoder-id"]} data-qoder-source={(props as any)?.["data-qoder-source"]}/>;
}

interface NumericInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange(value: number): void;
  min?: number;
  max?: number;
}

export function NumericInput({ value, onValueChange, min, max, onFocus, onBlur, onKeyDown, ...props }: NumericInputProps) {
  const [draft, setDraft] = React.useState(String(value));
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = React.useCallback((raw: string) => {
    const parsed = Number.parseInt(raw || '0', 10);
    const finite = Number.isFinite(parsed) ? parsed : (min ?? 0);
    const normalized = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? Number.MIN_SAFE_INTEGER, finite));
    setDraft(String(normalized));
    onValueChange(normalized);
  }, [max, min, onValueChange]);

  return (
    <Input
      {...props}
      type="number"
      variant="number"
      value={draft}
      min={min}
      max={max}
      onFocus={event => {
        focused.current = true;
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onChange={event => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw !== '') commit(raw);
      }}
      onBlur={event => {
        focused.current = false;
        commit(event.currentTarget.value);
        onBlur?.(event);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(String(value));
          event.currentTarget.blur();
        }
        onKeyDown?.(event);
      }}
    />
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = '确认', pending = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const [visible, setVisible] = React.useState(open);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setVisible(true);
      setLeaving(false);
      return;
    }
    if (!visible) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setLeaving(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  React.useEffect(() => {
    if (!open || leaving) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, leaving, pending, onCancel]);

  if (!visible) return null;
  return createPortal(
    <div
      className={`dialog-backdrop${leaving ? ' dialog-leave' : ' dialog-enter'}`}
      onMouseDown={event => { if (event.target === event.currentTarget && !pending && !leaving) onCancel(); }}
    >
      <div className={`confirm-dialog${leaving ? ' dialog-panel-leave' : ' dialog-panel-enter'}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="confirm-dialog-actions">
          <Button onClick={onCancel} disabled={pending || leaving}>取消</Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending || leaving} autoFocus>{pending ? '处理中…' : confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* --- Select --- */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ children, className = '', ...props }: SelectProps & Record<string, any>) {
  return (
    <select className={`select ${className}`} {...props} style={(props as any)?.style} data-qoder-id={(props as any)?.["data-qoder-id"]} data-qoder-source={(props as any)?.["data-qoder-source"]}>
      {children}
    </select>
  );
}

/* --- Toggle --- */
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled, ...qoderProps }: ToggleProps & Record<string, any>) {
  return (
    <label className={["toggle", (qoderProps as any)?.className].filter(Boolean).join(" ")} style={{ ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined), ...((qoderProps as any)?.style) }} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
       data-qoder-id="qel-input-c55e86c1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-c55e86c1&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;Toggle&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:76,&quot;column&quot;:7}}"/>
      <span className="toggle-track"  data-qoder-id="qel-toggle-track-3a816a88" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toggle-track-3a816a88&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;Toggle&quot;,&quot;elementRole&quot;:&quot;toggle-track&quot;,&quot;loc&quot;:{&quot;line&quot;:82,&quot;column&quot;:7}}"/>
      {label && <span className="text-sm text-secondary" data-qoder-id="qel-text-sm-3a910957" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-3a910957&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;Toggle&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:83,&quot;column&quot;:17}}">{label}</span>}
    </label>
  );
}

/* --- RadioGroup --- */
interface RadioGroupProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function RadioGroup({ value, options, onChange, ...qoderProps }: RadioGroupProps & Record<string, any>) {
  return (
    <div className={["radio-group", (qoderProps as any)?.className].filter(Boolean).join(" ")} style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {options.map(opt => (
        <button
          key={opt.value}
          className={`radio-option ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
          type="button"
         data-qoder-id="qel-button-c99be736" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-c99be736&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;RadioGroup&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:9}}">
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* --- Panel --- */
interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, actions, children, className = '' }: PanelProps) {
  return (
    <div className={`panel ${className}`} data-qoder-id="qel-div-3cf733f7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-3cf733f7&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;Panel&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:122,&quot;column&quot;:5}}">
      {(title || actions) && (
        <div className="panel-header" data-qoder-id="qel-panel-header-41f5b683" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-41f5b683&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;Panel&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:124,&quot;column&quot;:9}}">
          {title && <span className="panel-title" data-qoder-id="qel-panel-title-42c98eb0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-42c98eb0&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;Panel&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:125,&quot;column&quot;:21}}">{title}</span>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* --- EmptyState --- */
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, description, actions, ...qoderProps }: EmptyStateProps & Record<string, any>) {
  return (
    <div className={["empty-state", (qoderProps as any)?.className].filter(Boolean).join(" ")} style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {icon && <div className="empty-state-icon" data-qoder-id="qel-empty-state-icon-ecc5b4c7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-empty-state-icon-ecc5b4c7&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;EmptyState&quot;,&quot;elementRole&quot;:&quot;empty-state-icon&quot;,&quot;loc&quot;:{&quot;line&quot;:145,&quot;column&quot;:16}}">{icon}</div>}
      <div className="empty-state-title" data-qoder-id="qel-empty-state-title-38fe7c37" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-empty-state-title-38fe7c37&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;EmptyState&quot;,&quot;elementRole&quot;:&quot;empty-state-title&quot;,&quot;loc&quot;:{&quot;line&quot;:146,&quot;column&quot;:7}}">{title}</div>
      {description && <div className="empty-state-desc" data-qoder-id="qel-empty-state-desc-ca4c96d9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-empty-state-desc-ca4c96d9&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;EmptyState&quot;,&quot;elementRole&quot;:&quot;empty-state-desc&quot;,&quot;loc&quot;:{&quot;line&quot;:147,&quot;column&quot;:23}}">{description}</div>}
      {actions && <div className="empty-state-actions" data-qoder-id="qel-empty-state-actions-db6bc0f6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-empty-state-actions-db6bc0f6&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;EmptyState&quot;,&quot;elementRole&quot;:&quot;empty-state-actions&quot;,&quot;loc&quot;:{&quot;line&quot;:148,&quot;column&quot;:19}}">{actions}</div>}
    </div>
  );
}

/* --- StatusBadge --- */
interface StatusBadgeProps {
  state: 'idle' | 'running' | 'paused' | 'emergency';
}

const STATUS_CONFIG = {
  idle: { cls: 'status-idle', label: '空闲' },
  running: { cls: 'status-running', label: '运行中' },
  paused: { cls: 'status-paused', label: '已暂停' },
  emergency: { cls: 'status-danger', label: '已急停' },
};

export function StatusBadge({ state, ...qoderProps }: StatusBadgeProps & Record<string, any>) {
  const config = STATUS_CONFIG[state];
  return (
    <span className={[(`status-badge ${config.cls}`), (qoderProps as any)?.className].filter(Boolean).join(" ")} style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <span className="dot"  data-qoder-id="qel-dot-0643165f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dot-0643165f&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;StatusBadge&quot;,&quot;elementRole&quot;:&quot;dot&quot;,&quot;loc&quot;:{&quot;line&quot;:169,&quot;column&quot;:7}}"/>
      {config.label}
    </span>
  );
}

/* --- ProgressBar --- */
interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'default' | 'running';
}

export function ProgressBar({ value, variant = 'default', ...qoderProps }: ProgressBarProps & Record<string, any>) {
  return (
    <div className={["progress-bar", (qoderProps as any)?.className].filter(Boolean).join(" ")} style={(qoderProps as any)?.style} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <div
        className={`progress-fill ${variant === 'running' ? 'running' : ''}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
       data-qoder-id="qel-div-fcfbc267" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-fcfbc267&quot;,&quot;filePath&quot;:&quot;react-vite/src/components/ui.tsx&quot;,&quot;componentName&quot;:&quot;ProgressBar&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:184,&quot;column&quot;:7}}"/>
    </div>
  );
}
