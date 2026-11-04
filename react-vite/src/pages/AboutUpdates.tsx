/* =========================================================================
   AboutUpdates — 关于与更新
   有可用更新时，这里一直显示该版本的完整更新说明；下方是历次版本的更新日志
   ========================================================================= */

import { useCallback } from 'react';
import { ChevronRight, Download, ExternalLink, Github, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../components/ui';
import { ReleaseNotesView } from '../components/ReleaseNotesView';
import type { DesktopAboutInfo, DesktopUpdateState } from '../types';
import {
  BUNDLED_RELEASE_NOTES,
  compareVersions,
  findReleaseNote,
  normalizeNotes,
  RELEASES_URL,
} from '../utils/releaseNotes';

interface AboutUpdatesProps {
  about: DesktopAboutInfo | null;
  update: DesktopUpdateState | null;
  checking: boolean;
  onCheckUpdate(): void;
  onDownload(): void;
  onInstall(): void;
}

const REPO_URL = 'https://github.com/Geo-ff/keymouse-studio';

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function openExternal(url: string) {
  if (window.desktop?.openExternal) void window.desktop.openExternal(url).catch(() => undefined);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function AboutUpdates({ about, update, checking, onCheckUpdate, onDownload, onInstall }: AboutUpdatesProps) {
  const desktop = typeof window !== 'undefined' && Boolean(window.desktop?.checkForUpdates);
  const currentVersion = about?.version ?? update?.currentVersion ?? '';
  const status = update?.status ?? 'idle';
  const percent = Math.max(0, Math.min(100, Math.round(update?.percent ?? 0)));
  const hasUpdate = status === 'available' || status === 'downloading' || status === 'downloaded' || status === 'installing';
  const isChecking = checking || status === 'checking';
  const availableNotes = hasUpdate
    ? normalizeNotes(update?.releaseNotes) ?? findReleaseNote(update?.version)?.markdown ?? null
    : null;

  // The changelog shows what this build knows about, up to the installed version.
  const history = BUNDLED_RELEASE_NOTES.filter(note => !currentVersion || compareVersions(note.version, currentVersion) <= 0);

  let statusText = desktop ? '启动后会自动检查更新' : '浏览器预览不支持自动更新，请使用桌面安装版';
  if (status === 'checking') statusText = '正在检查更新…';
  else if (status === 'up-to-date') statusText = '已是最新版本';
  else if (status === 'available') statusText = `有新版本 v${update?.version ?? ''} 可以更新`;
  else if (status === 'downloading') statusText = `正在下载 v${update?.version ?? ''}（${percent}%）`;
  else if (status === 'downloaded') statusText = `v${update?.version ?? ''} 已下载，重启后完成安装`;
  else if (status === 'installing') statusText = '正在重启安装…';
  else if (status === 'dev-mode') statusText = '开发模式：不会执行正式更新';
  else if (status === 'error') statusText = `更新检查失败：${update?.message || '请稍后重试'}`;

  const action = useCallback(() => {
    if (status === 'downloaded') onInstall();
    else if (status === 'available') onDownload();
    else onCheckUpdate();
  }, [status, onCheckUpdate, onDownload, onInstall]);

  return (
    <div className="responsive-split" style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* 软件更新 */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <RefreshCw size={14} /> 软件更新
            </span>
            {currentVersion && <span className="text-sm text-tertiary">当前版本 v{currentVersion}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 200, color: hasUpdate ? 'var(--color-action-primary)' : undefined, fontWeight: hasUpdate ? 600 : 400 }}>
              {statusText}
            </span>
            {desktop && status !== 'installing' && status !== 'downloading' && (
              <Button
                variant={hasUpdate ? 'primary' : 'secondary'}
                size="sm"
                onClick={action}
                disabled={isChecking}
                icon={status === 'downloaded' ? <RotateCcw size={13} /> : status === 'available' ? <Download size={13} /> : <RefreshCw size={13} className={isChecking ? 'about-spin' : undefined} />}
              >
                {status === 'downloaded' ? '立即重启安装' : status === 'available' ? '下载更新' : isChecking ? '检查中…' : '检查更新'}
              </Button>
            )}
          </div>
          {(status === 'downloading' || status === 'downloaded') && (
            <div className="about-progress-block" aria-live="polite" style={{ marginTop: 'var(--space-md)' }}>
              <div className="about-progress-track">
                <div className="about-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="about-progress-label">{percent}%</div>
            </div>
          )}
          {status === 'downloaded' && (
            <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-sm)' }}>
              也可以稍后再装：下次退出 KeyMouse Studio 时会自动完成安装。
            </p>
          )}

          {hasUpdate && (
            <div className="update-available-notes">
              <div className="release-notes-version-title">
                <Sparkles size={14} style={{ color: 'var(--color-action-primary)' }} />
                <span>v{update?.version} 更新内容</span>
                {formatDate(update?.releaseDate) && <span className="text-sm text-tertiary">{formatDate(update?.releaseDate)}</span>}
              </div>
              <ReleaseNotesView markdown={availableNotes} />
            </div>
          )}
        </div>

        {/* 更新日志 */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">更新日志</span>
            <button type="button" className="update-notes-link text-sm" onClick={() => openExternal(RELEASES_URL)}>
              在 GitHub 查看全部
            </button>
          </div>
          {history.length === 0 ? (
            <ReleaseNotesView markdown={null} />
          ) : (
            history.map((note, index) => (
              <details key={note.version} className="release-history-item" open={index === 0}>
                <summary>
                  <ChevronRight size={14} className="release-history-chevron" />
                  <span>v{note.version}</span>
                  {note.version === currentVersion && <span className="badge">当前版本</span>}
                </summary>
                <ReleaseNotesView markdown={note.markdown} />
              </details>
            ))
          )}
        </div>
      </div>

      {/* 关于 */}
      <div className="responsive-split-side panel about-page-card" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <img src="./keyboard-studio-logo.png" alt="" className="about-logo" draggable={false} style={{ width: 48, height: 48 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{about?.appTitle ?? 'KeyMouse Studio'}</div>
            <div className="text-sm text-tertiary">{currentVersion ? `v${currentVersion}` : '浏览器预览'}</div>
          </div>
        </div>
        <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>
          {about?.description ?? '键鼠自动化工具 — 连点、录制、脚本编辑与回放'}
        </p>
        <button type="button" className="about-github" onClick={() => openExternal(about?.githubUrl ?? REPO_URL)}>
          <Github size={18} strokeWidth={1.75} />
          <span className="about-github-text">
            <span className="about-github-title">GitHub 仓库</span>
            <span className="about-github-url">{about?.githubOwner ?? 'Geo-ff'}/{about?.githubRepo ?? 'keymouse-studio'}</span>
          </span>
          <ExternalLink size={14} className="about-github-external" />
        </button>
        <button type="button" className="update-notes-link text-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openExternal(`${REPO_URL}/issues`)}>
          反馈问题或建议
        </button>
        <p className="about-support">
          本项目坚持免费开源，由个人利用业余时间持续开发和维护。制作不易，点个 Star 就是对我努力最大的支持。
        </p>
      </div>
    </div>
  );
}
