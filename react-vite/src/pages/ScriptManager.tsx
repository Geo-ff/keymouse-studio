/* =========================================================================
   ScriptManager — 脚本管理页面
   脚本列表、搜索、新建、打开、复制、删除
   ========================================================================= */

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  FilePlus2,
  Copy,
  Trash2,
  FolderOpen,
  FileCode2,
  Clock,
  ListChecks,
} from 'lucide-react';
import { useService } from '../hooks/useService';
import { Button, Input, IconButton, EmptyState } from '../components/ui';
import { formatDuration, calcScriptDuration } from '../data/mockData';
import type { Script } from '../types';
import type { PageId } from '../components/Layout';

interface ScriptManagerProps {
  onNavigate: (page: PageId) => void;
  onLoadScript: (script: Script) => void;
}

export function ScriptManager({ onNavigate, onLoadScript, ...qoderProps }: ScriptManagerProps & Record<string, any>) {
  const { loadScript, deleteScript, duplicateScript, scripts: allScripts, refreshScripts } = useService();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);


  const filteredScripts = useMemo(() => {
    if (!search.trim()) return allScripts;
    const q = search.toLowerCase();
    return allScripts.filter(s =>
      s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [allScripts, search]);

  const recentScripts = useMemo(() => {
    return [...allScripts]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3);
  }, [allScripts]);

  const handleOpen = useCallback(async (script: Script) => {
    try {
      const loaded = await loadScript(script.id);
      onLoadScript(loaded);
      onNavigate('script');
    } catch { }
  }, [loadScript, onLoadScript, onNavigate]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteScript(id);
      await refreshScripts();
      if (selectedId === id) setSelectedId(null);
    } catch { }
  }, [deleteScript, refreshScripts, selectedId]);

  const handleDuplicate = useCallback(async (script: Script) => {
    try {
      await duplicateScript(script.id);
      await refreshScripts();
    } catch { }
  }, [duplicateScript, refreshScripts]);

  return (
    <div style={{ ...({ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', height: '100%' }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 最近使用快捷区 */}
      {recentScripts.length > 0 && (
        <div className="panel" data-qoder-id="qel-panel-b34cb596" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-b34cb596&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:79,&quot;column&quot;:9}}">
          <div className="panel-header" data-qoder-id="qel-panel-header-cc1303bb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-cc1303bb&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:80,&quot;column&quot;:11}}">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-95cb506a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-95cb506a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:81,&quot;column&quot;:13}}">
              <Clock size={14}  data-qoder-id="qel-clock-fdaa6946" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-clock-fdaa6946&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;clock&quot;,&quot;loc&quot;:{&quot;line&quot;:82,&quot;column&quot;:15}}"/> 最近使用
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }} data-qoder-id="qel-div-1516783b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-1516783b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:85,&quot;column&quot;:11}}">
            {recentScripts.map(script => (
              <button
                key={script.id}
                className="panel"
                onClick={() => handleOpen(script)}
                style={{ flex: '1 1 160px', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
               data-qoder-id="qel-panel-1bc192d4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-1bc192d4&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:87,&quot;column&quot;:15}}">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }} data-qoder-id="qel-div-13167515" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-13167515&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:93,&quot;column&quot;:17}}">
                  <FileCode2 size={14} style={{ color: 'var(--color-action-primary)' }}  data-qoder-id="qel-filecode2-a3b9d5b2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-filecode2-a3b9d5b2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;filecode2&quot;,&quot;loc&quot;:{&quot;line&quot;:94,&quot;column&quot;:19}}"/>
                  <span style={{ fontWeight: 500, fontSize: 'var(--fs-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-qoder-id="qel-span-de4f6eaa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-de4f6eaa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:95,&quot;column&quot;:19}}">
                    {script.name}
                  </span>
                </div>
                <div className="text-sm text-tertiary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-qoder-id="qel-text-sm-c4f57a56" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-c4f57a56&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:17}}">
                  {script.actions.length} 个动作 · {formatDuration(calcScriptDuration(script))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }} data-qoder-id="qel-div-396bbef8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-396bbef8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:109,&quot;column&quot;:7}}">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }} data-qoder-id="qel-div-3a6bc08b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-3a6bc08b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:110,&quot;column&quot;:9}}">
          <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}  data-qoder-id="qel-search-74c1454a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-search-74c1454a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;search&quot;,&quot;loc&quot;:{&quot;line&quot;:111,&quot;column&quot;:11}}"/>
          <Input
            placeholder="搜索脚本..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '28px' }}
           data-qoder-id="qel-input-0a36b7b1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-0a36b7b1&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:112,&quot;column&quot;:11}}"/>
        </div>
        <div className="toolbar-spacer"  data-qoder-id="qel-toolbar-spacer-8ff8e32f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-toolbar-spacer-8ff8e32f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;toolbar-spacer&quot;,&quot;loc&quot;:{&quot;line&quot;:119,&quot;column&quot;:9}}"/>
        <Button variant="primary" size="sm" icon={<FilePlus2 size={13}  data-qoder-id="qel-fileplus2-4e495f8a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-fileplus2-4e495f8a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;fileplus2&quot;,&quot;loc&quot;:{&quot;line&quot;:120,&quot;column&quot;:51}}"/>} onClick={() => onNavigate('script')} data-qoder-id="qel-button-0c0c810f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-0c0c810f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:120,&quot;column&quot;:9}}">
          新建脚本
        </Button>
      </div>

      {/* 脚本列表 */}
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0, overflow: 'hidden' }} data-qoder-id="qel-panel-e8bfb74e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-e8bfb74e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:126,&quot;column&quot;:7}}">
        {filteredScripts.length === 0 ? (
          <EmptyState
            icon={<FileCode2 size={28} />}
            title={search ? '未找到匹配的脚本' : '暂无脚本'}
            description={search ? '尝试修改搜索关键词' : '录制或手动创建你的第一个脚本'}
            actions={!search ? (
              <Button variant="primary" size="sm" icon={<FilePlus2 size={13} />} onClick={() => onNavigate('script')}>
                新建脚本
              </Button>
            ) : undefined}
           data-qoder-id="qel-emptystate-dd701519" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-emptystate-dd701519&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;emptystate&quot;,&quot;loc&quot;:{&quot;line&quot;:128,&quot;column&quot;:11}}"/>
        ) : (
          <table className="data-table" style={{ width: '100%' }} data-qoder-id="qel-data-table-7c4dcef7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-data-table-7c4dcef7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;data-table&quot;,&quot;loc&quot;:{&quot;line&quot;:139,&quot;column&quot;:11}}">
            <thead data-qoder-id="qel-thead-c07726b7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-thead-c07726b7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;thead&quot;,&quot;loc&quot;:{&quot;line&quot;:140,&quot;column&quot;:13}}">
              <tr data-qoder-id="qel-tr-57931760" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tr-57931760&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;tr&quot;,&quot;loc&quot;:{&quot;line&quot;:141,&quot;column&quot;:15}}">
                <th style={{ width: 40 }} data-qoder-id="qel-th-c81134ed" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-c81134ed&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:142,&quot;column&quot;:17}}">
                  <input
                    type="checkbox"
                    style={{ cursor: 'pointer' }}
                   data-qoder-id="qel-input-9d5c64fa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-9d5c64fa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:143,&quot;column&quot;:19}}"/>
                </th>
                <th data-qoder-id="qel-th-c61131c7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-c61131c7&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:148,&quot;column&quot;:17}}">名称</th>
                <th data-qoder-id="qel-th-c5113034" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-c5113034&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:149,&quot;column&quot;:17}}">说明</th>
                <th style={{ width: 70 }} data-qoder-id="qel-th-bc112209" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-bc112209&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:150,&quot;column&quot;:17}}">动作数</th>
                <th style={{ width: 100 }} data-qoder-id="qel-th-bb112076" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-bb112076&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:151,&quot;column&quot;:17}}">总时长</th>
                <th style={{ width: 100 }} data-qoder-id="qel-th-3e0e1d18" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-3e0e1d18&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:152,&quot;column&quot;:17}}">创建时间</th>
                <th style={{ width: 100 }} data-qoder-id="qel-th-3f0e1eab" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-3f0e1eab&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:153,&quot;column&quot;:17}}">最后使用</th>
                <th style={{ width: 100 }} data-qoder-id="qel-th-400e203e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-400e203e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:154,&quot;column&quot;:17}}">操作</th>
              </tr>
            </thead>
            <tbody data-qoder-id="qel-tbody-a7132a99" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tbody-a7132a99&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;tbody&quot;,&quot;loc&quot;:{&quot;line&quot;:157,&quot;column&quot;:13}}">
              {filteredScripts.map(script => (
                <tr
                  key={script.id}
                  className={selectedId === script.id ? 'selected' : ''}
                  onClick={() => setSelectedId(script.id)}
                 data-qoder-id="qel-tr-5890da5c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tr-5890da5c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;tr&quot;,&quot;loc&quot;:{&quot;line&quot;:159,&quot;column&quot;:17}}">
                  <td data-label="" onClick={e => e.stopPropagation()} data-qoder-id="qel-td-d2ccbedf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-td-d2ccbedf&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;td&quot;,&quot;loc&quot;:{&quot;line&quot;:164,&quot;column&quot;:19}}">
                    <input type="checkbox" style={{ cursor: 'pointer' }}  data-qoder-id="qel-input-9a5a21aa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-9a5a21aa&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:165,&quot;column&quot;:21}}"/>
                  </td>
                  <td data-label="名称" style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-td-d4ccc205" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-td-d4ccc205&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;td&quot;,&quot;loc&quot;:{&quot;line&quot;:167,&quot;column&quot;:19}}">
                    <FileCode2 size={13} style={{ color: 'var(--color-action-primary)' }}  data-qoder-id="qel-filecode2-4b9a3914" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-filecode2-4b9a3914&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;filecode2&quot;,&quot;loc&quot;:{&quot;line&quot;:168,&quot;column&quot;:21}}"/>
                    {script.name}
                  </td>
                  <td data-label="说明" className="text-sm text-secondary" data-qoder-id="qel-text-sm-4653f5df" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-4653f5df&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:171,&quot;column&quot;:19}}">{script.description}</td>
                  <td data-label="动作数" className="text-mono" data-qoder-id="qel-text-mono-0a397f7a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-0a397f7a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:172,&quot;column&quot;:19}}">{script.actions.length}</td>
                  <td data-label="总时长" className="text-mono" data-qoder-id="qel-text-mono-0b39810d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-0b39810d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:173,&quot;column&quot;:19}}">{formatDuration(calcScriptDuration(script))}</td>
                  <td data-label="创建时间" className="text-sm text-tertiary" data-qoder-id="qel-text-sm-4951bc01" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-4951bc01&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:174,&quot;column&quot;:19}}">{new Date(script.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td data-label="最后使用" className="text-sm text-tertiary" data-qoder-id="qel-text-sm-4851ba6e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-4851ba6e&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:175,&quot;column&quot;:19}}">
                    {new Date(script.updatedAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td data-label="操作" onClick={e => e.stopPropagation()} data-qoder-id="qel-td-d3de0993" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-td-d3de0993&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;td&quot;,&quot;loc&quot;:{&quot;line&quot;:178,&quot;column&quot;:19}}">
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }} data-qoder-id="qel-div-ac64253c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-ac64253c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:179,&quot;column&quot;:21}}">
                      <IconButton tooltip="打开" onClick={() => handleOpen(script)} data-qoder-id="qel-iconbutton-c9584d53" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-c9584d53&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:180,&quot;column&quot;:23}}">
                        <FolderOpen size={14}  data-qoder-id="qel-folderopen-47d57c4a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-folderopen-47d57c4a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;folderopen&quot;,&quot;loc&quot;:{&quot;line&quot;:181,&quot;column&quot;:25}}"/>
                      </IconButton>
                      <IconButton tooltip="复制" onClick={() => handleDuplicate(script)} data-qoder-id="qel-iconbutton-d758635d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-d758635d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:183,&quot;column&quot;:23}}">
                        <Copy size={14}  data-qoder-id="qel-copy-7ca5c09a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-copy-7ca5c09a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;copy&quot;,&quot;loc&quot;:{&quot;line&quot;:184,&quot;column&quot;:25}}"/>
                      </IconButton>
                      <IconButton tooltip="删除" onClick={() => handleDelete(script.id)} data-qoder-id="qel-iconbutton-c9560ebc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-iconbutton-c9560ebc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;iconbutton&quot;,&quot;loc&quot;:{&quot;line&quot;:186,&quot;column&quot;:23}}">
                        <Trash2 size={14}  data-qoder-id="qel-trash2-27547afd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-trash2-27547afd&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/ScriptManager.tsx&quot;,&quot;componentName&quot;:&quot;ScriptManager&quot;,&quot;elementRole&quot;:&quot;trash2&quot;,&quot;loc&quot;:{&quot;line&quot;:187,&quot;column&quot;:25}}"/>
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
