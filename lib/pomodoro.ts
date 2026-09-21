export type TimerMode = 'focus' | 'break';
export interface TimerState {
  mode: TimerMode;
  focus: number;
  break: number;
  remaining: number;
  deadline: number | null;
  completed: number;
  scene: number;
}
export const INITIAL_TIMER: TimerState = {
  mode: 'focus', focus: 20, break: 5, remaining: 20 * 60_000,
  deadline: null, completed: 0, scene: 0,
};
export function remainingAt(timer: TimerState, now: number): number {
  return Math.max(0, timer.deadline === null ? timer.remaining : timer.deadline - now);
}
export function restoreTimer(raw: string | null): TimerState {
  try {
    const t = JSON.parse(raw || 'null');
    if (!t || !['focus', 'break'].includes(t.mode)
      || ![t.focus, t.break].every(n => Number.isInteger(n) && n >= 1 && n <= 120)
      || !Number.isFinite(t.remaining) || t.remaining < 0 || t.remaining > 120 * 60_000
      || !(t.deadline === null || (Number.isFinite(t.deadline) && t.deadline > 0))
      || !Number.isInteger(t.completed) || t.completed < 0
      || !Number.isInteger(t.scene) || t.scene < 0 || t.scene > 8) return { ...INITIAL_TIMER };
    return t;
  } catch { return { ...INITIAL_TIMER }; }
}
export function finishTimer(timer: TimerState): TimerState {
  return { ...timer, deadline: null, remaining: 0, completed: timer.completed + (timer.mode === 'focus' ? 1 : 0) };
}
export function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
