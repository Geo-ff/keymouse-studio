import { describe, expect, it } from 'vitest';
import type { ScriptAction } from '../types';
import { EMPTY_HISTORY, cloneWithNewIds, insertAfterSelection, recordChange, redo, undo } from './actionHistory';

const wait = (id: string, durationMs = 100): ScriptAction => ({ id, enabled: true, delayBeforeMs: 0, type: 'wait', payload: { durationMs } });

describe('editor undo / redo', () => {
  it('walks back and forth through changes', () => {
    const v1 = [wait('a')];
    const v2 = [wait('a'), wait('b')];
    const v3 = [wait('b')];
    let history = recordChange(EMPTY_HISTORY, v1);
    history = recordChange(history, v2);

    const back = undo(history, v3)!;
    expect(back.actions).toBe(v2);
    const backAgain = undo(back.history, back.actions)!;
    expect(backAgain.actions).toBe(v1);
    expect(undo(backAgain.history, backAgain.actions)).toBeNull();

    const forward = redo(backAgain.history, backAgain.actions)!;
    expect(forward.actions).toBe(v2);
    expect(redo(forward.history, forward.actions)!.actions).toBe(v3);
  });

  it('drops the redo branch on a new change and keeps a bounded history', () => {
    const history = recordChange({ past: [], future: [[wait('x')]] }, [wait('a')]);
    expect(history.future).toEqual([]);
    let long = EMPTY_HISTORY;
    for (let i = 0; i < 5; i += 1) long = recordChange(long, [wait(String(i))], 3);
    expect(long.past.map(step => step[0].id)).toEqual(['2', '3', '4']);
  });
});

describe('copy / paste', () => {
  it('pastes copies with new ids after the last selected action', () => {
    const actions = [wait('a'), wait('b'), wait('c')];
    const pasted = cloneWithNewIds([wait('a', 500)]);
    expect(pasted[0].id).not.toBe('a');
    expect(pasted[0].type === 'wait' && pasted[0].payload.durationMs).toBe(500);

    const result = insertAfterSelection(actions, new Set(['a', 'b']), pasted);
    expect(result.map(action => action.id)).toEqual(['a', 'b', pasted[0].id, 'c']);
    const appended = insertAfterSelection(actions, new Set(), pasted);
    expect(appended[appended.length - 1]).toBe(pasted[0]);
  });
});
