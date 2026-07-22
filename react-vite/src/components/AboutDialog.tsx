import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Github, RefreshCw, X } from 'lucide-react';
import { Button } from './ui';
import type { DesktopAboutInfo, DesktopUpdateState } from '../types';

interface AboutDialogProps {
  open: boolean;
  onClose(): void;
  about: DesktopAboutInfo | null;
  update: DesktopUpdateState | null;
  onCheckUpdate(): void;
  onDownload(): void;
  onInstall(): void;
  checking?: boolean;
  onOpenAnnouncement?(): void;
}

function formatReleaseDate(value?: string | null) {
  if (!value) return '—';
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

export function AboutDialog({
  open,
  onClose,
  about,
  update,
  onCheckUpdate,
  onDownload,
  onInstall,
  checking = false,
  onOpenAnnouncement,
}: AboutDialogProps) {
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

  const openGithub = useCallback(() => {
    const url = about?.githubUrl;
    if (!url) return;
    void window.desktop?.openExternal?.(url).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }, [about?.githubUrl]);

  if (!visible) return null;

  const version = about?.version ?? update?.currentVersion ?? '—';
  const status = update?.status ?? 'idle';
  const percent = Math.max(0, Math.min(100, Math.round(update?.percent ?? 0)));
  const canDownload = status === 'available';
  const canInstall = status === 'downloaded';
  const isDownloading = status === 'downloading';

  let statusText = '启动后将自动检查更新';
  if (status === 'checking') statusText = '正在检查更新…';
  else if (status === 'up-to-date') statusText = '已是最新版本';
  else if (status === 'available') statusText = `发现新版本 v${update?.version ?? ''}`;
  else if (status === 'downloading') statusText = `正在下载 v${update?.version ?? ''}（${percent}%）`;
  else if (status === 'downloaded') statusText = `v${update?.version ?? ''} 已就绪，可重启安装`;
  else if (status === 'installing') statusText = '正在重启安装…';
  else if (status === 'dev-mode') statusText = '开发模式：不会执行正式更新安装';
  else if (status === 'error') statusText = update?.message || '更新检查失败';

  const releaseDate =
    update?.releaseDate ||
    about?.releaseDate ||
    (status === 'up-to-date' ? null : null);

  return createPortal(
    <div
      className={`dialog-backdrop${leaving ? ' dialog-leave' : ' dialog-enter'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !leaving) onClose();
      }}
    >
      <div
        className={`about-dialog${leaving ? ' dialog-panel-leave' : ' dialog-panel-enter'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <button type="button" className="about-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>

        <div className="about-hero">
          <img
            src="./keyboard-studio-logo.png"
            alt=""
            className="about-logo"
            draggable={false}
          />
          <div className="about-hero-text">
            <h2 id="about-title">{about?.appTitle ?? 'KeyMouse Studio'}</h2>
            <p className="about-desc">{about?.description ?? '键鼠自动化工具 — 连点、录制、脚本编辑与回放'}</p>
          </div>
        </div>

        <div className="about-meta">
          <div className="about-meta-row">
            <span className="about-meta-label">当前版本</span>
            <span className="about-meta-value text-mono">v{version}</span>
          </div>
          <div className="about-meta-row">
            <span className="about-meta-label">发布信息</span>
            <span className="about-meta-value">
              {releaseDate ? formatReleaseDate(releaseDate) : '本地安装版本'}
              {update?.version ? ` · 远端 v${update.version}` : ''}
            </span>
          </div>
          <div className="about-meta-row">
            <span className="about-meta-label">更新状态</span>
            <span className="about-meta-value">{statusText}</span>
          </div>
        </div>

        {(isDownloading || canInstall) && (
          <div className="about-progress-block" aria-live="polite">
            <div className="about-progress-track">
              <div className="about-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="about-progress-label">{percent}%</div>
          </div>
        )}

        {(canDownload || canInstall || (update?.releaseNotes && (status === 'available' || status === 'downloaded'))) &&
          onOpenAnnouncement && (
            <button type="button" className="about-notes-link" onClick={onOpenAnnouncement}>
              查看更新说明
            </button>
          )}

        <button type="button" className="about-github" onClick={openGithub}>
          <Github size={18} strokeWidth={1.75} />
          <span className="about-github-text">
            <span className="about-github-title">GitHub 仓库</span>
            <span className="about-github-url">
              {about?.githubOwner ?? 'Geo-ff'}/{about?.githubRepo ?? 'keymouse-studio'}
            </span>
          </span>
          <ExternalLink size={14} className="about-github-external" />
        </button>

        <p className="about-support">
          本项目坚持免费开源，由个人利用业余时间持续开发和维护。制作不易，点个 Star 就是对我努力最大的支持。
        </p>

        <div className="about-actions">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          {canInstall ? (
            <Button onClick={onInstall}>立即重启安装</Button>
          ) : canDownload ? (
            <Button onClick={onDownload}>下载更新</Button>
          ) : (
            <Button onClick={onCheckUpdate} disabled={checking || isDownloading || status === 'checking'}>
              <RefreshCw size={14} className={status === 'checking' || checking ? 'about-spin' : undefined} />
              {status === 'checking' || checking ? '检查中…' : '检查更新'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}