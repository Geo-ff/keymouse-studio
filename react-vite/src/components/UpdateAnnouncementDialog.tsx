import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from './ui';
import { ReleaseNotesView } from './ReleaseNotesView';
import type { DesktopUpdateState } from '../types';
import { findReleaseNote, normalizeNotes, type ReleaseNote } from '../utils/releaseNotes';

export type UpdateAnnouncementMode = 'available' | 'whats-new';

interface UpdateAnnouncementDialogProps {
  open: boolean;
  /** available: a newer version can be installed. whats-new: first launch after updating. */
  mode: UpdateAnnouncementMode;
  update: DesktopUpdateState | null;
  /** whats-new: the version now running and the one that ran before. */
  version?: string | null;
  previousVersion?: string | null;
  /** whats-new: notes of every version since the previous one, newest first. */
  notes?: ReleaseNote[];
  onClose(): void;
  onDownload?(): void;
  onInstall?(): void;
  /** Open the 「关于」 page (full changelog). */
  onOpenAbout?(): void;
}

function formatReleaseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function UpdateAnnouncementDialog({
  open,
  mode,
  update,
  version,
  previousVersion,
  notes = [],
  onClose,
  onDownload,
  onInstall,
  onOpenAbout,
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

  const whatsNew = mode === 'whats-new';
  const status = update?.status ?? '';
  const percent = Math.max(0, Math.min(100, Math.round(update?.percent ?? 0)));
  const canDownload = !whatsNew && status === 'available' && onDownload;
  const canInstall = !whatsNew && status === 'downloaded' && onInstall;
  const isDownloading = !whatsNew && status === 'downloading';

  let title: string;
  let subtitle: string;
  if (whatsNew) {
    title = `已更新到 v${version ?? ''}`;
    subtitle = notes.length > 1
      ? `从 v${previousVersion ?? ''} 升级而来，下面是期间 ${notes.length} 个版本的更新内容`
      : '下面是这次更新的内容';
  } else {
    const updateVersion = update?.version ?? '';
    title = status === 'downloaded' ? `新版本 v${updateVersion} 已下载` : `发现新版本 v${updateVersion}`;
    const date = formatReleaseDate(update?.releaseDate);
    subtitle = [
      update?.currentVersion ? `当前版本 v${update.currentVersion}` : null,
      date ? `发布于 ${date}` : null,
    ].filter(Boolean).join(' · ') || '下面是这个版本的更新内容';
  }

  const availableNotes = whatsNew
    ? null
    : normalizeNotes(update?.releaseNotes) ?? findReleaseNote(update?.version)?.markdown ?? null;

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
          {whatsNew ? (
            notes.length === 0 ? (
              <ReleaseNotesView markdown={null} />
            ) : notes.length === 1 ? (
              <ReleaseNotesView markdown={notes[0].markdown} />
            ) : (
              notes.map(note => (
                <section key={note.version} className="release-notes-version">
                  <div className="release-notes-version-title">v{note.version}</div>
                  <ReleaseNotesView markdown={note.markdown} />
                </section>
              ))
            )
          ) : (
            <ReleaseNotesView markdown={availableNotes} />
          )}
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
          <span className="update-announce-hint">
            {whatsNew ? '以后可以在「关于」页面查看历次更新' : '关闭后可以在「关于」页面随时查看'}
          </span>
          {onOpenAbout && whatsNew && (
            <Button variant="ghost" onClick={onOpenAbout}>
              查看更新日志
            </Button>
          )}
          {whatsNew ? (
            <Button variant="primary" onClick={onClose}>知道了</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                稍后
              </Button>
              {canInstall ? (
                <Button variant="primary" onClick={onInstall} icon={<RotateCcw size={14} />}>
                  立即重启安装
                </Button>
              ) : canDownload ? (
                <Button variant="primary" onClick={onDownload} icon={<Download size={14} />}>
                  下载更新
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
