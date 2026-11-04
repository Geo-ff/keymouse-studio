import type { ServiceState } from '../types';
import { formatTime } from '../data/mockData';

export type ActivityTone = 'idle' | 'running' | 'paused' | 'emergency';

export interface ActivitySummary {
  tone: ActivityTone;
  /** e.g. "运行中 · 回放「每日签到」" */
  title: string;
  /** e.g. "进度 32% · 第 1 轮" */
  detail: string;
}

function remaining(ms: number): string {
  return ms >= 60_000 ? formatTime(ms) : `${Math.ceil(ms / 1000)} 秒`;
}

/** One-glance description of what is running; shared by the mini window and the tray tooltip. */
export function describeActivity(state: ServiceState): ActivitySummary {
  if (state.runState === 'emergency') return { tone: 'emergency', title: '已急停', detail: '所有输入已停止' };
  const operation = state.snapshot.operationType;
  if (!operation || state.runState === 'idle') return { tone: 'idle', title: '空闲', detail: '没有正在运行的任务' };

  const scriptName = state.playbackScript?.name || '未命名脚本';
  const label = {
    clicker: '连点器',
    timed_click: '定时任务',
    recording: '录制',
    playback: `回放「${scriptName}」`,
  }[operation];
  const countdown = state.snapshot.state === 'countdown';
  const status = countdown ? '倒计时' : state.runState === 'paused' ? '已暂停' : '运行中';
  const tone: ActivityTone = state.runState === 'paused' ? 'paused' : 'running';

  let detail = '';
  if (countdown) {
    detail = `${state.countdownRemaining} 秒后开始`;
  } else if (operation === 'clicker') {
    detail = `已执行 ${state.clickerCount} 次`;
  } else if (operation === 'timed_click') {
    detail = state.timedClickCountdown > 0 ? `距离执行 ${remaining(state.timedClickCountdown)}` : `已执行 ${state.timedClickCount} 次`;
  } else if (operation === 'recording') {
    detail = `已录制 ${state.recordingActionCount} 个动作`;
  } else if (state.snapshot.countdownRemainingMs > 0) {
    detail = `距离开始 ${remaining(state.snapshot.countdownRemainingMs)}`;
  } else {
    detail = `进度 ${state.playbackProgress}% · 第 ${state.playbackCurrentLoop + 1} 轮`;
  }
  return { tone, title: `${status} · ${label}`, detail };
}

export function activityLine(state: ServiceState): string {
  const { title, detail } = describeActivity(state);
  return detail && title !== '空闲' ? `${title} · ${detail}` : title;
}
