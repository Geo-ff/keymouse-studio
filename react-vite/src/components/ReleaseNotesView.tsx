import { Fragment, type MouseEvent } from 'react';
import { parseNotes, RELEASES_URL, type InlinePart } from '../utils/releaseNotes';

const REPO_URL = 'https://github.com/Geo-ff/keymouse-studio';

/** Only pages of this project's repository open in the browser; other links stay plain text. */
function isOpenable(href: string): boolean {
  return href === REPO_URL || href.startsWith(`${REPO_URL}/`);
}

function openLink(event: MouseEvent, href: string) {
  event.preventDefault();
  if (window.desktop?.openExternal) {
    void window.desktop.openExternal(href).catch(() => undefined);
  } else {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}

function Inline({ parts }: { parts: InlinePart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === 'bold') return <strong key={index}>{part.text}</strong>;
        if (part.kind === 'code') return <code key={index} className="update-notes-code">{part.text}</code>;
        if (part.kind === 'link') {
          if (!isOpenable(part.href)) {
            return <Fragment key={index}>{part.text === part.href ? part.text : `${part.text}（${part.href}）`}</Fragment>;
          }
          return (
            <a key={index} href={part.href} onClick={event => openLink(event, part.href)} className="update-notes-link">
              {part.text}
            </a>
          );
        }
        return <Fragment key={index}>{part.text}</Fragment>;
      })}
    </>
  );
}

/** Renders release notes Markdown (a safe subset; never raw HTML). */
export function ReleaseNotesView({ markdown, emptyHint = true }: { markdown: string | null | undefined; emptyHint?: boolean }) {
  const blocks = markdown ? parseNotes(markdown) : [];
  if (!blocks.length) {
    if (!emptyHint) return null;
    return (
      <p className="update-notes-empty">
        这个版本暂无更新说明，可以在{' '}
        <a href={RELEASES_URL} onClick={event => openLink(event, RELEASES_URL)} className="update-notes-link">GitHub Releases</a>
        {' '}查看。
      </p>
    );
  }
  return (
    <div className="update-notes-body">
      {blocks.map((block, index) => {
        if (block.kind === 'gap') return <div key={index} className="update-notes-spacer" />;
        if (block.kind === 'heading') {
          return (
            <div key={index} className={`update-notes-heading update-notes-heading-${block.level}`}>
              <Inline parts={block.parts} />
            </div>
          );
        }
        if (block.kind === 'bullet') {
          return (
            <div key={index} className="update-notes-bullet">
              <span className="update-notes-bullet-mark">•</span>
              <span><Inline parts={block.parts} /></span>
            </div>
          );
        }
        return (
          <p key={index} className="update-notes-paragraph">
            <Inline parts={block.parts} />
          </p>
        );
      })}
    </div>
  );
}
