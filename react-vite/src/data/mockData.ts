/* =========================================================================
   Mock 数据 — 示例脚本和模拟数据生成
   所有示例数据集中于此，不散落在组件中
   ========================================================================= */

import type { Script, ScriptAction, ActionType, MouseButton } from '../types';

const genId = () => Math.random().toString(36).slice(2, 11);

const KEYS = ['Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A', 'Alt+Tab', 'Win+D', 'F5', 'Delete'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomKey(): string {
  return KEYS[randInt(0, KEYS.length - 1)];
}

export function generateRandomAction(): ScriptAction {
  const types: ActionType[] = ['mouse_move', 'mouse_click', 'mouse_scroll', 'key_down', 'key_up', 'wait'];
  const type = types[randInt(0, types.length - 1)];
  const buttons: MouseButton[] = ['left', 'right', 'middle'];

  const action: ScriptAction = {
    id: genId(),
    type,
    enabled: true,
    delay: randInt(50, 500),
  };

  switch (type) {
    case 'mouse_move':
      action.x = randInt(0, 1920);
      action.y = randInt(0, 1080);
      break;
    case 'mouse_click':
      action.x = randInt(0, 1920);
      action.y = randInt(0, 1080);
      action.button = buttons[randInt(0, 2)];
      action.clickMode = Math.random() > 0.8 ? 'double' : 'single';
      break;
    case 'mouse_scroll':
      action.scrollDelta = randInt(-300, 300);
      action.x = randInt(0, 1920);
      action.y = randInt(0, 1080);
      break;
    case 'key_down':
    case 'key_up':
      action.key = KEYS[randInt(0, KEYS.length - 1)];
      break;
    case 'wait':
      action.delay = randInt(500, 3000);
      break;
  }

  return action;
}

/* --- 示例脚本 1：浏览器自动操作 --- */
const script1: Script = {
  id: 'script-001',
  name: '浏览器自动刷新页面',
  description: '打开浏览器并定时刷新当前页面',
  createdAt: Date.now() - 86400000 * 3,
  updatedAt: Date.now() - 3600000,
  lastUsedAt: Date.now() - 3600000,
  actions: [
    { id: genId(), type: 'mouse_move', enabled: true, delay: 0, x: 100, y: 100 },
    { id: genId(), type: 'mouse_click', enabled: true, delay: 200, x: 100, y: 100, button: 'left', clickMode: 'single' },
    { id: genId(), type: 'wait', enabled: true, delay: 1000 },
    { id: genId(), type: 'key_down', enabled: true, delay: 500, key: 'F5' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'F5' },
    { id: genId(), type: 'wait', enabled: true, delay: 2000 },
    { id: genId(), type: 'mouse_move', enabled: true, delay: 300, x: 960, y: 540 },
    { id: genId(), type: 'mouse_scroll', enabled: true, delay: 200, x: 960, y: 540, scrollDelta: -300 },
    { id: genId(), type: 'wait', enabled: true, delay: 500 },
    { id: genId(), type: 'mouse_click', enabled: true, delay: 200, x: 960, y: 540, button: 'left', clickMode: 'single' },
  ],
};

/* --- 示例脚本 2：表格自动填写 --- */
const script2: Script = {
  id: 'script-002',
  name: 'Excel 表格批量填写',
  description: '在 Excel 中自动填写数据并切换单元格',
  createdAt: Date.now() - 86400000 * 7,
  updatedAt: Date.now() - 86400000 * 2,
  lastUsedAt: Date.now() - 86400000 * 2,
  actions: [
    { id: genId(), type: 'mouse_click', enabled: true, delay: 0, x: 300, y: 200, button: 'left', clickMode: 'single' },
    { id: genId(), type: 'key_down', enabled: true, delay: 300, key: 'Ctrl+A' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Ctrl+A' },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Delete' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Delete' },
    { id: genId(), type: 'key_down', enabled: true, delay: 300, key: 'Space' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Space' },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Tab' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Tab' },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Enter' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Enter' },
    { id: genId(), type: 'wait', enabled: true, delay: 500 },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Ctrl+S' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Ctrl+S' },
  ],
};

/* --- 示例脚本 3：定时点击任务 --- */
const script3: Script = {
  id: 'script-003',
  name: '定时检查并点击按钮',
  description: '每 30 秒检查界面并点击指定位置按钮',
  createdAt: Date.now() - 86400000 * 14,
  updatedAt: Date.now() - 86400000 * 5,
  lastUsedAt: Date.now() - 86400000 * 5,
  actions: [
    { id: genId(), type: 'mouse_move', enabled: true, delay: 0, x: 800, y: 600 },
    { id: genId(), type: 'mouse_click', enabled: true, delay: 500, x: 800, y: 600, button: 'left', clickMode: 'single' },
    { id: genId(), type: 'wait', enabled: true, delay: 30000, comment: '等待 30 秒' },
    { id: genId(), type: 'mouse_move', enabled: true, delay: 200, x: 950, y: 500 },
    { id: genId(), type: 'mouse_click', enabled: true, delay: 300, x: 950, y: 500, button: 'left', clickMode: 'double' },
    { id: genId(), type: 'wait', enabled: true, delay: 1000 },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Escape' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Escape' },
  ],
};

/* --- 示例脚本 4：键盘快捷键序列 --- */
const script4: Script = {
  id: 'script-004',
  name: '快捷键工作流',
  description: '使用键盘快捷键完成一系列操作',
  createdAt: Date.now() - 86400000 * 1,
  updatedAt: Date.now() - 3600000 * 2,
  lastUsedAt: Date.now() - 3600000 * 2,
  actions: [
    { id: genId(), type: 'key_down', enabled: true, delay: 0, key: 'Win+D' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Win+D' },
    { id: genId(), type: 'wait', enabled: true, delay: 500 },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Ctrl+C' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Ctrl+C' },
    { id: genId(), type: 'wait', enabled: true, delay: 300 },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Alt+Tab' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Alt+Tab' },
    { id: genId(), type: 'wait', enabled: true, delay: 500 },
    { id: genId(), type: 'key_down', enabled: true, delay: 200, key: 'Ctrl+V' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Ctrl+V' },
    { id: genId(), type: 'key_down', enabled: true, delay: 300, key: 'Enter' },
    { id: genId(), type: 'key_up', enabled: true, delay: 50, key: 'Enter' },
  ],
};

/* --- 示例脚本 5：滚轮浏览 --- */
const script5: Script = {
  id: 'script-005',
  name: '网页自动滚动浏览',
  description: '模拟用户浏览网页时的滚动行为',
  createdAt: Date.now() - 86400000 * 10,
  updatedAt: Date.now() - 86400000 * 3,
  lastUsedAt: Date.now() - 86400000 * 3,
  actions: [
    { id: genId(), type: 'mouse_move', enabled: true, delay: 0, x: 960, y: 540 },
    { id: genId(), type: 'mouse_scroll', enabled: true, delay: 500, x: 960, y: 540, scrollDelta: -300 },
    { id: genId(), type: 'wait', enabled: true, delay: 800 },
    { id: genId(), type: 'mouse_scroll', enabled: true, delay: 300, x: 960, y: 540, scrollDelta: -300 },
    { id: genId(), type: 'wait', enabled: true, delay: 800 },
    { id: genId(), type: 'mouse_scroll', enabled: true, delay: 300, x: 960, y: 540, scrollDelta: -200 },
    { id: genId(), type: 'wait', enabled: true, delay: 1000 },
    { id: genId(), type: 'mouse_click', enabled: true, delay: 200, x: 1200, y: 400, button: 'left', clickMode: 'single' },
    { id: genId(), type: 'wait', enabled: true, delay: 2000 },
    { id: genId(), type: 'mouse_scroll', enabled: true, delay: 300, x: 960, y: 540, scrollDelta: 500 },
  ],
};

export const mockScripts: Script[] = [script1, script2, script3, script4, script5];

/* --- 计算脚本总时长 --- */
export function calcScriptDuration(script: Script): number {
  return script.actions.reduce((sum, a) => sum + (a.enabled ? a.delay : 0), 0);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}分${sec}秒`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}小时${min}分`;
}

export function formatTime(ms: number): string {
  const totalMs = Math.floor(ms);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(Math.floor(millis / 100))}`;
}
