import { Download, RotateCcw, X } from 'lucide-react';
import type { DesktopUpdateState } from '../types';

interface UpdateProgressBarProps {
  update: DesktopUpdateState | null;
  onDownload?(): void;
  onInstall?(): void;
  onDismiss?(): void;
  onOpenAbout?(): void;
  onOpenAnnouncement?(): void;
}

export function UpdateProgressBar({
  update,
  onDownload,
  onInstall,
  onDismiss,
  onOpenAbout,
  onOpenAnnouncement,
}: UpdateProgressBarProps) {
  if (!update) return null;

  const { status, version, percent = 0, message } = update;
  const show =
    status === 'available' ||
    status === 'downloading' ||
    status === 'downloaded' ||
    status === 'installing';
  if (!show) return null;

  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const label =
    status === 'available'
      ? `发现新版本 v${version ?? ''}`
      : status === 'downloading'
        ? `正在下载 v${version ?? ''} ${pct}%`
        : status === 'downloaded'
          ? `v${version ?? ''} 已下载完成`
          : message || '正在安装更新…';

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-main">
        <Download size={14} className="update-banner-icon" />
        <button
          type="button"
          className="update-banner-text"
          onClick={() => {
            if (onOpenAnnouncement) onOpenAnnouncement();
            else onOpenAbout?.();
          }}
        >
          {label}
        </button>
        {(status === 'downloading' || status === 'downloaded' || status === 'installing') && (
          <div className="update-banner-track" aria-hidden>
            <div className="update-banner-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
        <span className="update-banner-pct text-mono">{status === 'available' ? '' : `${pct}%`}</span>
      </div>
      <div className="update-banner-actions">
        {onOpenAnnouncement && (status === 'available' || status === 'downloaded') && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onOpenAnnouncement}>
            更新说明
          </button>
        )}
        {status === 'available' && onDownload && (
          <button type="button" className="btn btn-sm btn-primary" onClick={onDownload}>
            下载
          </button>
        )}
        {status === 'downloaded' && onInstall && (
          <button type="button" className="btn btn-sm btn-primary" onClick={onInstall}>
            <RotateCcw size={12} />
            重启安装
          </button>
        )}
        {onDismiss && status !== 'installing' && status !== 'downloading' && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onDismiss} aria-label="关闭">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}