import type { Script } from '../types';

/** Marker of a multi-script export file. A single script is exported as the script itself. */
export const SCRIPT_BUNDLE_FORMAT = 'keymouse-studio/scripts';

export interface ScriptBundle {
  format: typeof SCRIPT_BUNDLE_FORMAT;
  version: 1;
  exportedAt: string;
  scripts: Script[];
}

/** File contents for exporting one or more scripts (hotkey bindings are never included). */
export function buildExportContent(scripts: Script[], now = new Date()): string {
  if (scripts.length === 1) return `${JSON.stringify(scripts[0], null, 2)}\n`;
  const bundle: ScriptBundle = { format: SCRIPT_BUNDLE_FORMAT, version: 1, exportedAt: now.toISOString(), scripts };
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function exportFileName(scripts: Pick<Script, 'name'>[], now = new Date()): string {
  if (scripts.length === 1) {
    const name = scripts[0].name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || '脚本';
    return `${name}.json`;
  }
  const day = now.toISOString().slice(0, 10);
  return `KeyMouse-Studio-脚本-${scripts.length}个-${day}.json`;
}

/**
 * The script objects contained in an import file: a single exported script, a bundle, or an
 * array of scripts. Each item is still validated (and migrated) by the backend before saving.
 */
export function parseImportContent(text: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('不是有效的 JSON 文件');
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (record.format === SCRIPT_BUNDLE_FORMAT) {
      if (!Array.isArray(record.scripts)) throw new Error('脚本包内容不完整');
      return record.scripts;
    }
    if (Array.isArray(record.actions)) return [parsed];
  }
  throw new Error('文件里没有找到 KeyMouse Studio 脚本');
}

/** "名称" → "名称（导入）" → "名称（导入 2）"… so imports never overwrite or shadow a script. */
export function uniqueScriptName(name: string, taken: Set<string>): string {
  const base = name.trim() || '导入的脚本';
  if (!taken.has(base)) return base;
  for (let index = 1; ; index += 1) {
    const candidate = index === 1 ? `${base}（导入）` : `${base}（导入 ${index}）`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Save text through the desktop "Save as" dialog, or as a browser download. */
export async function saveTextFile(defaultName: string, content: string): Promise<'saved' | 'canceled'> {
  if (typeof window !== 'undefined' && window.desktop?.saveTextFile) {
    const result = await window.desktop.saveTextFile({ defaultName, content });
    return result.ok ? 'saved' : 'canceled';
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return 'saved';
}
