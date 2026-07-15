import type { ActionType, MouseButton, Script, ScriptAction } from '../types';

export const genId = () => crypto.randomUUID();
const KEYS = ['Enter', 'Tab', 'Escape', 'Space', 'Backspace', 'Delete', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A', 'Ctrl+S', 'Alt+Tab', 'Win+D', 'F5'];
const buttons: MouseButton[] = ['left', 'right', 'middle'];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export const randomKey = () => KEYS[randInt(0, KEYS.length - 1)];

export function createAction(type: ActionType, delayBeforeMs = 200): ScriptAction {
  const base = { id: genId(), enabled: true, delayBeforeMs };
  switch (type) {
    case 'mouse_move': return { ...base, type, payload: { x: 0, y: 0, durationMs: 0 } };
    case 'mouse_button_down': return { ...base, type, payload: { button: 'left' } };
    case 'mouse_button_up': return { ...base, type, payload: { button: 'left' } };
    case 'mouse_click': return { ...base, type, payload: { button: 'left', clickCount: 1, x: 0, y: 0, intervalMs: 0 } };
    case 'mouse_wheel': return { ...base, type, payload: { deltaX: 0, deltaY: -100 } };
    case 'key_down': return { ...base, type, payload: { keyCode: 'Enter', scanCode: null, extended: false } };
    case 'key_up': return { ...base, type, payload: { keyCode: 'Enter', scanCode: null, extended: false } };
    case 'wait': return { ...base, type, payload: { durationMs: 1000 } };
  }
}

export function generateRandomAction(): ScriptAction {
  const types: ActionType[] = ['mouse_move', 'mouse_click', 'mouse_wheel', 'key_down', 'key_up', 'wait'];
  const type = types[randInt(0, types.length - 1)];
  const action = createAction(type, randInt(50, 500));
  switch (action.type) {
    case 'mouse_move': action.payload = { x: randInt(0, 1920), y: randInt(0, 1080), durationMs: 0 }; break;
    case 'mouse_click': action.payload = { button: buttons[randInt(0, 2)], clickCount: Math.random() > 0.8 ? 2 : 1, x: randInt(0, 1920), y: randInt(0, 1080), intervalMs: 0 }; break;
    case 'mouse_wheel': action.payload = { deltaX: 0, deltaY: randInt(-300, 300) }; break;
    case 'key_down':
    case 'key_up': action.payload = { keyCode: randomKey(), scanCode: null, extended: false }; break;
    case 'wait': action.payload = { durationMs: randInt(500, 3000) }; break;
  }
  return action;
}

const now = Date.now();
const date = (offset: number) => new Date(now - offset).toISOString();
const move = (x: number, y: number, delayBeforeMs = 0): ScriptAction => ({ id: genId(), enabled: true, delayBeforeMs, type: 'mouse_move', payload: { x, y, durationMs: 0 } });
const click = (x: number, y: number, count: 1 | 2 = 1, delayBeforeMs = 200): ScriptAction => ({ id: genId(), enabled: true, delayBeforeMs, type: 'mouse_click', payload: { button: 'left', clickCount: count, x, y, intervalMs: 0 } });
const key = (type: 'key_down' | 'key_up', keyCode: string, delayBeforeMs = 100): ScriptAction => type === 'key_down'
  ? { id: genId(), enabled: true, delayBeforeMs, type, payload: { keyCode, scanCode: null, extended: false } }
  : { id: genId(), enabled: true, delayBeforeMs, type, payload: { keyCode, scanCode: null, extended: false } };
const wait = (durationMs: number): ScriptAction => ({ id: genId(), enabled: true, delayBeforeMs: 0, type: 'wait', payload: { durationMs } });
const wheel = (deltaY: number, delayBeforeMs = 300): ScriptAction => ({ id: genId(), enabled: true, delayBeforeMs, type: 'mouse_wheel', payload: { deltaX: 0, deltaY } });
const settings = { speedMultiplier: 1, loopMode: 'count' as const, loopCount: 1, countdownMs: 3000 };

export const mockScripts: Script[] = [
  { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000001', name: '浏览器自动刷新页面', description: '打开浏览器并定时刷新当前页面', createdAt: date(259200000), updatedAt: date(3600000), settings, actions: [move(100, 100), click(100, 100), wait(1000), key('key_down', 'F5', 500), key('key_up', 'F5', 50), wait(2000), move(960, 540, 300), wheel(-300, 200), wait(500), click(960, 540)] },
  { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000002', name: 'Excel 表格批量填写', description: '在 Excel 中自动填写数据并切换单元格', createdAt: date(604800000), updatedAt: date(172800000), settings, actions: [click(300, 200, 1, 0), key('key_down', 'Ctrl+A'), key('key_up', 'Ctrl+A'), key('key_down', 'Delete'), key('key_up', 'Delete'), key('key_down', 'Tab'), key('key_up', 'Tab'), key('key_down', 'Enter'), key('key_up', 'Enter'), wait(500)] },
  { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000003', name: '定时检查并点击按钮', description: '每 30 秒检查界面并点击指定位置按钮', createdAt: date(1209600000), updatedAt: date(432000000), settings, actions: [move(800, 600), click(800, 600), wait(30000), move(950, 500), click(950, 500, 2), key('key_down', 'Escape'), key('key_up', 'Escape')] },
  { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000004', name: '快捷键工作流', description: '使用键盘快捷键完成一系列操作', createdAt: date(86400000), updatedAt: date(7200000), settings, actions: [key('key_down', 'Win+D', 0), key('key_up', 'Win+D'), wait(500), key('key_down', 'Ctrl+C'), key('key_up', 'Ctrl+C'), key('key_down', 'Alt+Tab'), key('key_up', 'Alt+Tab'), key('key_down', 'Ctrl+V'), key('key_up', 'Ctrl+V')] },
  { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000005', name: '网页自动滚动浏览', description: '模拟用户浏览网页时的滚动行为', createdAt: date(864000000), updatedAt: date(259200000), settings, actions: [move(960, 540), wheel(-300, 500), wait(800), wheel(-300), wait(800), wheel(-200), wait(1000), click(1200, 400), wait(2000), wheel(500)] },
];

export function actionDuration(action: ScriptAction): number {
  return action.delayBeforeMs + (action.type === 'wait' ? action.payload.durationMs : action.type === 'mouse_move' ? action.payload.durationMs : 0);
}

export function calcScriptDuration(script: Script): number {
  return script.actions.reduce((sum, action) => sum + (action.enabled ? actionDuration(action) : 0), 0);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分${seconds % 60}秒`;
  return `${Math.floor(minutes / 60)}小时${minutes % 60}分`;
}

export function formatTime(ms: number): string {
  const totalMs = Math.floor(ms);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${Math.floor((totalMs % 1000) / 100)}`;
}
