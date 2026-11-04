import { describe, expect, it } from 'vitest';
import { INITIAL_SNAPSHOT, type ServiceState, type StateSnapshot } from '../types';
import { activityLine, describeActivity } from './activityStatus';

function stateWith(snapshot: Partial<StateSnapshot>, extra: Partial<ServiceState> = {}): ServiceState {
  return {
    snapshot: { ...INITIAL_SNAPSHOT, ...snapshot },
    runState: 'running', recordingState: 'idle', clickerCount: 0, clickerRunningTime: 0, nextClickCountdown: 0,
    recordingTime: 0, recordingActionCount: 0, recordingActions: [], playbackProgress: 0, playbackCurrentIndex: -1,
    playbackCurrentLoop: 0, playbackLoopRemainingMs: 0, mousePos: { x: 0, y: 0 }, keyboardListening: false,
    countdownRemaining: 0, timedClickCount: 0, timedClickRunningTime: 0, timedClickCountdown: 0, playbackScript: null,
    ...extra,
  };
}

describe('activity summary', () => {
  it('describes idle and emergency', () => {
    expect(activityLine(stateWith({}, { runState: 'idle' }))).toBe('空闲');
    expect(describeActivity(stateWith({ operationType: 'clicker' }, { runState: 'emergency' })).tone).toBe('emergency');
  });

  it('names the script and its progress', () => {
    const state = stateWith(
      { operationType: 'playback', state: 'running' },
      { playbackProgress: 32, playbackCurrentLoop: 1, playbackScript: { id: 'a', name: '每日签到' } },
    );
    expect(activityLine(state)).toBe('运行中 · 回放「每日签到」 · 进度 32% · 第 2 轮');
  });

  it('shows waits, pauses and countdowns', () => {
    const scheduled = stateWith({ operationType: 'playback', state: 'running', countdownRemainingMs: 90_000 }, { playbackScript: { id: null, name: '' } });
    expect(activityLine(scheduled)).toBe('运行中 · 回放「未命名脚本」 · 距离开始 01:30.0');
    const paused = stateWith({ operationType: 'clicker', state: 'paused' }, { runState: 'paused', clickerCount: 12 });
    expect(describeActivity(paused)).toEqual({ tone: 'paused', title: '已暂停 · 连点器', detail: '已执行 12 次' });
    const countdown = stateWith({ operationType: 'recording', state: 'countdown' }, { countdownRemaining: 3 });
    expect(activityLine(countdown)).toBe('倒计时 · 录制 · 3 秒后开始');
  });
});
