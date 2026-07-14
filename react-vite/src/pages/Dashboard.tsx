/* =========================================================================
   Dashboard — 控制台首页
   首屏即为可操作的工具控制台
   ========================================================================= */

import {
  MousePointerClick,
  Circle,
  FileCode2,
  Zap,
  Play,
  Clock,
  ListChecks,
  ArrowRight,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useService } from '../hooks/useService';
import { Button, StatusBadge, EmptyState } from '../components/ui';
import type { PageId } from '../components/Layout';
import { formatDuration } from '../data/mockData';
import type { RunState } from '../types';

interface DashboardProps {
  onNavigate: (page: PageId) => void;
}

function QuickCard({ icon, title, desc, onClick, ...qoderProps }: { icon: ReactNode; title: string; desc: string; onClick: () => void } & Record<string, any>) {
  return (
    <button className={["panel", (qoderProps as any)?.className].filter(Boolean).join(" ")} onClick={onClick} style={{ ...({ textAlign: 'left', cursor: 'pointer', transition: 'border-color 120ms' }), ...((qoderProps as any)?.style) }} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }} data-qoder-id="qel-div-045d50a6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-045d50a6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:30,&quot;column&quot;:7}}">
        <span style={{ color: 'var(--color-action-primary)' }} data-qoder-id="qel-span-dc1c9775" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-dc1c9775&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:31,&quot;column&quot;:9}}">{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }} data-qoder-id="qel-span-d51c8c70" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-d51c8c70&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:32,&quot;column&quot;:9}}">{title}</span>
      </div>
      <p className="text-sm text-secondary" style={{ margin: 0 }} data-qoder-id="qel-text-sm-7af0eed9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-7af0eed9&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:34,&quot;column&quot;:7}}">{desc}</p>
      <div style={{ marginTop: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-action-primary)' }} data-qoder-id="qel-div-085d56f2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-085d56f2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:35,&quot;column&quot;:7}}">
        <span className="text-sm" data-qoder-id="qel-text-sm-98ccdd13" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-98ccdd13&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:36,&quot;column&quot;:9}}">进入</span>
        <ArrowRight size={12}  data-qoder-id="qel-arrowright-585cfda6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-arrowright-585cfda6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;QuickCard&quot;,&quot;elementRole&quot;:&quot;arrowright&quot;,&quot;loc&quot;:{&quot;line&quot;:37,&quot;column&quot;:9}}"/>
      </div>
    </button>
  );
}

export function Dashboard({ onNavigate, ...qoderProps }: DashboardProps & Record<string, any>) {
  const { service, state } = useService();
  const recentScripts = service.listRecentScripts();

  const runStateMap: Record<RunState, 'idle' | 'running' | 'paused' | 'emergency'> = {
    idle: 'idle',
    running: 'running',
    paused: 'paused',
    stopped: 'idle',
    emergency: 'emergency',
  };

  return (
    <div style={{ ...({ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }), ...((qoderProps as any)?.style) }} className={(qoderProps as any)?.className} data-qoder-id={(qoderProps as any)?.["data-qoder-id"]} data-qoder-source={(qoderProps as any)?.["data-qoder-source"]}>
      {/* 运行状态概览 */}
      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-lg)' }} data-qoder-id="qel-panel-1d7935c5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-1d7935c5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:58,&quot;column&quot;:7}}">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }} data-qoder-id="qel-div-937c65c5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-937c65c5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:59,&quot;column&quot;:9}}">
          <Zap size={20} style={{ color: 'var(--color-danger)' }}  data-qoder-id="qel-zap-2336b504" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-zap-2336b504&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;zap&quot;,&quot;loc&quot;:{&quot;line&quot;:60,&quot;column&quot;:11}}"/>
          <div data-qoder-id="qel-div-917c629f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-917c629f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:61,&quot;column&quot;:11}}">
            <div className="text-sm text-secondary" data-qoder-id="qel-text-sm-f9bccb09" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-f9bccb09&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:62,&quot;column&quot;:13}}">当前状态</div>
            <StatusBadge state={runStateMap[state.runState]}  data-qoder-id="qel-statusbadge-d2097e65" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statusbadge-d2097e65&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;statusbadge&quot;,&quot;loc&quot;:{&quot;line&quot;:63,&quot;column&quot;:13}}"/>
          </div>
        </div>
        <Button variant="danger" size="sm" icon={<Zap size={13}  data-qoder-id="qel-zap-2036b04b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-zap-2036b04b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;zap&quot;,&quot;loc&quot;:{&quot;line&quot;:66,&quot;column&quot;:50}}"/>} onClick={() => service.emergencyStop()} data-qoder-id="qel-button-3fe68a28" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-3fe68a28&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:66,&quot;column&quot;:9}}">
          紧急停止
        </Button>
      </div>

      {/* 快速入口 */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }} data-qoder-id="qel-dashboard-grid-cb9447ee" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboard-grid-cb9447ee&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;dashboard-grid&quot;,&quot;loc&quot;:{&quot;line&quot;:72,&quot;column&quot;:7}}">
        <QuickCard
          icon={<MousePointerClick size={18} />}
          title="连点器"
          desc="配置自动点击参数，支持多按键和精确定位"
          onClick={() => onNavigate('clicker')}
         data-qoder-id="qel-quickcard-3007dc8d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-quickcard-3007dc8d&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;quickcard&quot;,&quot;loc&quot;:{&quot;line&quot;:73,&quot;column&quot;:9}}"/>
        <QuickCard
          icon={<Circle size={18} />}
          title="键鼠录制"
          desc="录制鼠标移动、点击、滚轮和键盘操作"
          onClick={() => onNavigate('recording')}
         data-qoder-id="qel-quickcard-21058659" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-quickcard-21058659&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;quickcard&quot;,&quot;loc&quot;:{&quot;line&quot;:79,&quot;column&quot;:9}}"/>
        <QuickCard
          icon={<FileCode2 size={18} />}
          title="脚本编辑"
          desc="编辑动作列表，支持拖拽排序和多选操作"
          onClick={() => onNavigate('script')}
         data-qoder-id="qel-quickcard-200584c6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-quickcard-200584c6&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;quickcard&quot;,&quot;loc&quot;:{&quot;line&quot;:85,&quot;column&quot;:9}}"/>
      </div>

      {/* 最近脚本 */}
      <div className="panel" data-qoder-id="qel-panel-a17c4428" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-a17c4428&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;panel&quot;,&quot;loc&quot;:{&quot;line&quot;:94,&quot;column&quot;:7}}">
        <div className="panel-header" data-qoder-id="qel-panel-header-981fdcd5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-header-981fdcd5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;panel-header&quot;,&quot;loc&quot;:{&quot;line&quot;:95,&quot;column&quot;:9}}">
          <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }} data-qoder-id="qel-panel-title-bc507750" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-panel-title-bc507750&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;panel-title&quot;,&quot;loc&quot;:{&quot;line&quot;:96,&quot;column&quot;:11}}">
            <Clock size={15}  data-qoder-id="qel-clock-8a70ee8a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-clock-8a70ee8a&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;clock&quot;,&quot;loc&quot;:{&quot;line&quot;:97,&quot;column&quot;:13}}"/> 最近使用
          </span>
          <Button variant="ghost" size="sm" icon={<ListChecks size={13}  data-qoder-id="qel-listchecks-7d52dc66" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-listchecks-7d52dc66&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;listchecks&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:51}}"/>} onClick={() => onNavigate('manager')} data-qoder-id="qel-button-c1e38537" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-c1e38537&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:99,&quot;column&quot;:11}}">
            全部脚本
          </Button>
        </div>
        {recentScripts.length === 0 ? (
          <EmptyState
            icon={<FileCode2 size={32} />}
            title="暂无脚本"
            description="录制或手动创建你的第一个自动化脚本"
            actions={
              <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <Button variant="primary" size="sm" icon={<Circle size={13} />} onClick={() => onNavigate('recording')}>
                  开始录制
                </Button>
                <Button variant="secondary" size="sm" icon={<Play size={13} />} onClick={() => onNavigate('script')}>
                  手动添加
                </Button>
              </div>
            }
           data-qoder-id="qel-emptystate-aba161b5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-emptystate-aba161b5&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;emptystate&quot;,&quot;loc&quot;:{&quot;line&quot;:104,&quot;column&quot;:11}}"/>
        ) : (
          <table className="data-table" data-qoder-id="qel-data-table-659c6b33" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-data-table-659c6b33&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;data-table&quot;,&quot;loc&quot;:{&quot;line&quot;:120,&quot;column&quot;:11}}">
            <thead data-qoder-id="qel-thead-1d25c2b8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-thead-1d25c2b8&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;thead&quot;,&quot;loc&quot;:{&quot;line&quot;:121,&quot;column&quot;:13}}">
              <tr data-qoder-id="qel-tr-89ec2907" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tr-89ec2907&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;tr&quot;,&quot;loc&quot;:{&quot;line&quot;:122,&quot;column&quot;:15}}">
                <th data-qoder-id="qel-th-6b3082d2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-6b3082d2&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:123,&quot;column&quot;:17}}">名称</th>
                <th data-qoder-id="qel-th-6c308465" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-6c308465&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:124,&quot;column&quot;:17}}">说明</th>
                <th data-qoder-id="qel-th-65307960" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-65307960&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:125,&quot;column&quot;:17}}">动作数</th>
                <th data-qoder-id="qel-th-66307af3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-66307af3&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:126,&quot;column&quot;:17}}">总时长</th>
                <th data-qoder-id="qel-th-67307c86" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-67307c86&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:127,&quot;column&quot;:17}}">最后使用</th>
                <th data-qoder-id="qel-th-68307e19" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-th-68307e19&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;th&quot;,&quot;loc&quot;:{&quot;line&quot;:128,&quot;column&quot;:17}}"></th>
              </tr>
            </thead>
            <tbody data-qoder-id="qel-tbody-247aa8dc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tbody-247aa8dc&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;tbody&quot;,&quot;loc&quot;:{&quot;line&quot;:131,&quot;column&quot;:13}}">
              {recentScripts.slice(0, 5).map(script => (
                <tr key={script.id} onClick={() => { service.loadScript(script.id); onNavigate('script'); }} style={{ cursor: 'pointer' }} data-qoder-id="qel-tr-81ec1c6f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tr-81ec1c6f&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;tr&quot;,&quot;loc&quot;:{&quot;line&quot;:133,&quot;column&quot;:17}}">
                  <td data-label="名称" style={{ fontWeight: 500 }} data-qoder-id="qel-td-f3710f4b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-td-f3710f4b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;td&quot;,&quot;loc&quot;:{&quot;line&quot;:134,&quot;column&quot;:19}}">{script.name}</td>
                  <td data-label="说明" className="text-secondary text-sm" data-qoder-id="qel-text-secondary-da34f020" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-secondary-da34f020&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;text-secondary&quot;,&quot;loc&quot;:{&quot;line&quot;:135,&quot;column&quot;:19}}">{script.description}</td>
                  <td data-label="动作数" className="text-mono" data-qoder-id="qel-text-mono-aab46098" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-aab46098&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:136,&quot;column&quot;:19}}">{script.actions.length}</td>
                  <td data-label="总时长" className="text-mono" data-qoder-id="qel-text-mono-abb4622b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-mono-abb4622b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;text-mono&quot;,&quot;loc&quot;:{&quot;line&quot;:137,&quot;column&quot;:19}}">{formatDuration(script.actions.reduce((s, a) => s + a.delay, 0))}</td>
                  <td data-label="最后使用" className="text-sm text-tertiary" data-qoder-id="qel-text-sm-25c6ae5b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-sm-25c6ae5b&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;text-sm&quot;,&quot;loc&quot;:{&quot;line&quot;:138,&quot;column&quot;:19}}">
                    {script.lastUsedAt ? new Date(script.lastUsedAt).toLocaleDateString('zh-CN') : '—'}
                  </td>
                  <td data-label="" data-qoder-id="qel-td-f6711404" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-td-f6711404&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;td&quot;,&quot;loc&quot;:{&quot;line&quot;:141,&quot;column&quot;:19}}">
                    <ArrowRight size={14} className="text-tertiary"  data-qoder-id="qel-text-tertiary-94c0c19c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-tertiary-94c0c19c&quot;,&quot;filePath&quot;:&quot;react-vite/src/pages/Dashboard.tsx&quot;,&quot;componentName&quot;:&quot;Dashboard&quot;,&quot;elementRole&quot;:&quot;text-tertiary&quot;,&quot;loc&quot;:{&quot;line&quot;:142,&quot;column&quot;:21}}"/>
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
