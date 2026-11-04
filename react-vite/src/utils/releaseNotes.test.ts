import { describe, expect, it } from 'vitest';
import {
  BUNDLED_RELEASE_NOTES,
  bundledReleaseNotes,
  compareVersions,
  htmlToMarkdown,
  normalizeNotes,
  notesSince,
  parseInline,
  parseNotes,
} from './releaseNotes';

// Exactly what GitHub's releases.atom carried for v1.0.3 (after XML unescaping).
const FEED_HTML = `<h2>1.0.3 更新内容</h2>
<h3>新功能</h3>
<ul>
<li><strong>连点器支持键盘连点</strong>：可切换鼠标/键盘模式</li>
<li><strong>更新公告</strong>：发现新版本时自动展示 &lt;说明&gt; &amp; 公告</li>
</ul>
<h3>修复</h3>
<ul>
<li>键盘连点会发送到<strong>当前前台窗口</strong>，启动前请先切换到目标应用</li>
</ul>`;

describe('bundled notes', () => {
  it('ships every docs/release-notes file, newest first', () => {
    const versions = BUNDLED_RELEASE_NOTES.map(note => note.version);
    expect(versions).toContain('1.1.0');
    expect(versions).toContain('1.0.3');
    expect(versions.indexOf('1.1.0')).toBeLessThan(versions.indexOf('1.0.3'));
  });

  it('selects the versions between two installs', () => {
    const notes = bundledReleaseNotes({
      '../../../docs/release-notes/v1.0.3.md': 'a',
      '../../../docs/release-notes/v1.1.0.md': 'b',
      '../../../docs/release-notes/v1.2.0.md': 'c',
      '../../../docs/release-notes/v1.10.0.md': 'd',
      '../../../docs/release-notes/v1.3.0.md': '   ',
    });
    expect(notes.map(n => n.version)).toEqual(['1.10.0', '1.2.0', '1.1.0', '1.0.3']);
    expect(notesSince('1.0.3', '1.2.0', notes).map(n => n.version)).toEqual(['1.2.0', '1.1.0']);
    expect(notesSince('1.2.0', '1.2.0', notes)).toEqual([]);
    expect(compareVersions('v1.10.0', '1.9.9')).toBeGreaterThan(0);
  });
});

describe('feed HTML from older releases', () => {
  it('becomes readable structure instead of raw tags', () => {
    const markdown = htmlToMarkdown(FEED_HTML);
    expect(markdown).not.toMatch(/<\/?(h2|li|strong|ul)>/);
    const blocks = parseNotes(markdown);
    expect(blocks[0]).toEqual({ kind: 'heading', level: 2, parts: [{ kind: 'text', text: '1.0.3 更新内容' }] });
    expect(blocks).toContainEqual({
      kind: 'bullet',
      parts: [{ kind: 'bold', text: '更新公告' }, { kind: 'text', text: '：发现新版本时自动展示 <说明> & 公告' }],
    });
    expect(normalizeNotes(FEED_HTML)).toBe(markdown);
  });

  it('treats GitHub’s empty marker and blank notes as no notes', () => {
    expect(normalizeNotes('No content.')).toBeNull();
    expect(normalizeNotes('   ')).toBeNull();
    expect(normalizeNotes('## 新功能\n- 一项')).toBe('## 新功能\n- 一项');
  });
});

describe('markdown subset', () => {
  it('parses headings, bullets, numbered items and gaps', () => {
    const blocks = parseNotes('# 标题\n\n\n- 甲\n1. 乙\n正文\n\n');
    expect(blocks.map(b => b.kind)).toEqual(['heading', 'gap', 'bullet', 'bullet', 'paragraph']);
    expect(blocks[0]).toMatchObject({ level: 1 });
  });

  it('parses bold, code and links without allowing HTML', () => {
    expect(parseInline('删除 `settings.json` 后见 [说明](https://github.com/Geo-ff/keymouse-studio/releases)。')).toEqual([
      { kind: 'text', text: '删除 ' },
      { kind: 'code', text: 'settings.json' },
      { kind: 'text', text: ' 后见 ' },
      { kind: 'link', text: '说明', href: 'https://github.com/Geo-ff/keymouse-studio/releases' },
      { kind: 'text', text: '。' },
    ]);
    expect(parseInline('见 https://github.com/Geo-ff/keymouse-studio/issues/1。')[1]).toEqual({
      kind: 'link',
      text: 'https://github.com/Geo-ff/keymouse-studio/issues/1',
      href: 'https://github.com/Geo-ff/keymouse-studio/issues/1',
    });
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
});
