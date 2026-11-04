import type { ScriptAction } from '../types';

/** Undo / redo stacks of the editor's action list. */
export interface ActionHistory {
  past: ScriptAction[][];
  future: ScriptAction[][];
}

export const EMPTY_HISTORY: ActionHistory = { past: [], future: [] };
export const HISTORY_LIMIT = 100;

/** Remember `previous` before a change; a new change discards anything that could be redone. */
export function recordChange(history: ActionHistory, previous: ScriptAction[], limit = HISTORY_LIMIT): ActionHistory {
  return { past: [...history.past, previous].slice(-limit), future: [] };
}

export function undo(history: ActionHistory, current: ScriptAction[]): { history: ActionHistory; actions: ScriptAction[] } | null {
  const previous = history.past[history.past.length - 1];
  if (!previous) return null;
  return { actions: previous, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } };
}

export function redo(history: ActionHistory, current: ScriptAction[]): { history: ActionHistory; actions: ScriptAction[] } | null {
  const [next, ...rest] = history.future;
  if (!next) return null;
  return { actions: next, history: { past: [...history.past, current], future: rest } };
}

/** Copies of actions with fresh ids, for paste (ids must stay unique within a script). */
export function cloneWithNewIds(actions: ScriptAction[]): ScriptAction[] {
  return actions.map(action => ({ ...structuredClone(action), id: crypto.randomUUID() }));
}

/** Insert `pasted` after the last selected action, or at the end when nothing is selected. */
export function insertAfterSelection(actions: ScriptAction[], selectedIds: Set<string>, pasted: ScriptAction[]): ScriptAction[] {
  let index = -1;
  actions.forEach((action, position) => { if (selectedIds.has(action.id)) index = position; });
  const at = index < 0 ? actions.length : index + 1;
  return [...actions.slice(0, at), ...pasted, ...actions.slice(at)];
}
