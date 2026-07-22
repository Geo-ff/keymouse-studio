import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from './ui';
import type { DesktopUpdateState } from '../types';
import { formatReleaseNotesLines } from '../utils/updateAnnouncement';

export type UpdateAnnouncementMode = 'available' | 'whats-new';

interface UpdateAnnouncementDialogProps {
  open: boolean;
  mode: UpdateAnnouncementMode;
  update: DesktopUpdateState | null;
  /** Override notes (e.g. cached notes for whats-new). */
  notes?: string | null;
  version?: string | null;
  releaseDate?: string | null;
  onClose(): void;
  onDownload?(): void;
  onInstall?(): void;
}

function formatReleaseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotesBody({ notes }: { notes: string | null | undefined }) {
  const lines = formatReleaseNotesLines(notes);
  if (!lines.length) {
    return <p className="update-notes-empty">暂无详细更新说明。发布时请在 GitHub Release 正文中填写更新公告。</p>;
  }
  return (
    <div className="update-notes-body">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="update-notes-spacer" />;
        if (/^#{1,3}\s+/.test(line)) {
          return (
            <div key={index} className="update-notes-heading">
              {line.replace(/^#{1,3}\s+/, '')}
            </div>
          );
        }
        if (/^[-*•]\s+/.test(line)) {
          return (
            <div key={index} className="update-notes-bullet">
              <span className="update-notes-bullet-mark">•</span>
              <span>{line.replace(/^[-*•]\s+/, '')}</span>
            </div>
          );
        }
        return (
          <p key={index} className="update-notes-paragraph">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function UpdateAnnouncementDialog({
  open,
  mode,
  update,
  notes,
  version,
  releaseDate,
  onClose,
  onDownload,
  onInstall,
}: UpdateAnnouncementDialogProps) {
  const [visible, setVisible] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    if (!open || leaving) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, leaving, onClose]);

  if (!visible) return null;

  const status = update?.status ?? '';
  const displayVersion = version ?? update?.version ?? update?.currentVersion ?? '';
  const displayDate = formatReleaseDate(releaseDate ?? update?.releaseDate);
  const displayNotes = notes ?? update?.releaseNotes ?? null;
  const canDownload = mode === 'available' && status === 'available' && onDownload;
  const canInstall = mode === 'available' && status === 'downloaded' && onInstall;
  const isDownloading = mode === 'available' && status === 'downloading';
  const percent = Math.max(0, Math.min(100, Math.round(update?.percent ?? 0)));

  const title =
    mode === 'whats-new'
      ? `欢迎使用 v${displayVersion}`
      : status === 'downloaded'
        ? `更新已就绪 v${displayVersion}`
        : `发现新版本 v${displayVersion}`;

  const subtitle =
    mode === 'whats-new'
      ? '本次安装包含以下更新'
      : displayDate
        ? `发布时间：${displayDate}`
        : '以下为该版本更新说明';

  return createPortal(
    <div
      className={`dialog-backdrop${leaving ? ' dialog-leave' : ' dialog-enter'}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !leaving) onClose();
      }}
    >
      <div
        className={`update-announce-dialog${leaving ? ' dialog-panel-leave' : ' dialog-panel-enter'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-announce-title"
      >
        <button type="button" className="about-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>

        <div className="update-announce-header">
          <div className="update-announce-icon" aria-hidden>
            <Sparkles size={20} />
          </div>
          <div>
            <h2 id="update-announce-title">{title}</h2>
            <p className="update-announce-subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="update-notes-scroll">
          <NotesBody notes={displayNotes} />
        </div>

        {isDownloading && (
          <div className="about-progress-block" aria-live="polite">
            <div className="about-progress-track">
              <div className="about-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="about-progress-label">{percent}%</div>
          </div>
        )}

        <div className="update-announce-actions">
          <Button variant="ghost" onClick={onClose}>
            {mode === 'whats-new' ? '知道了' : '稍后'}
          </Button>
          {canInstall ? (
            <Button onClick={onInstall} icon={<RotateCcw size={14} />}>
              立即重启安装
            </Button>
          ) : canDownload ? (
            <Button onClick={onDownload} icon={<Download size={14} />}>
              下载更新
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}