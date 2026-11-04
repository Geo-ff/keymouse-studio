import { describe, expect, it } from 'vitest';
import type { Script } from '../types';
import { SCRIPT_BUNDLE_FORMAT, buildExportContent, exportFileName, parseImportContent, uniqueScriptName } from './scriptTransfer';

const script = (name: string): Script => ({
  schemaVersion: 1,
  id: `id-${name}`,
  name,
  description: '',
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  settings: { speedMultiplier: 1, loopMode: 'count', loopCount: 1, countdownMs: 3000 },
  actions: [],
});

describe('script export / import', () => {
  it('round-trips a single script and a bundle', () => {
    expect(parseImportContent(buildExportContent([script('签到')]))).toEqual([script('签到')]);
    const bundle = buildExportContent([script('a'), script('b')], new Date('2026-11-04T00:00:00Z'));
    expect(JSON.parse(bundle).format).toBe(SCRIPT_BUNDLE_FORMAT);
    expect(parseImportContent(bundle)).toEqual([script('a'), script('b')]);
    expect(parseImportContent(`﻿${JSON.stringify([script('c')])}`)).toEqual([script('c')]);
  });

  it('explains files that are not scripts', () => {
    expect(() => parseImportContent('{oops')).toThrow('不是有效的 JSON 文件');
    expect(() => parseImportContent('{"hello": 1}')).toThrow('文件里没有找到 KeyMouse Studio 脚本');
    expect(() => parseImportContent(`{"format": "${SCRIPT_BUNDLE_FORMAT}"}`)).toThrow('脚本包内容不完整');
  });

  it('names files and never reuses an existing script name', () => {
    expect(exportFileName([script('日常/签到')])).toBe('日常_签到.json');
    expect(exportFileName([script('a'), script('b')], new Date('2026-11-04T08:00:00Z'))).toBe('KeyMouse-Studio-脚本-2个-2026-11-04.json');
    const taken = new Set(['签到', '签到（导入）']);
    expect(uniqueScriptName('签到', taken)).toBe('签到（导入 2）');
    expect(uniqueScriptName('新脚本', taken)).toBe('新脚本');
    expect(uniqueScriptName('  ', taken)).toBe('导入的脚本');
  });
});
