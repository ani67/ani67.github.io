import { useEffect } from 'react';
import { useStore } from '../store/store';
import { resolveKeyDown, resolveKeyUp } from '../lib/keymap/resolver';
import { INSTRUMENT_CODES } from '../lib/keymap/grid';
import { dispatch } from '../lib/dispatch';

export function useKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!INSTRUMENT_CODES.has(e.code)) return;
      // Ctrl/Meta still bail so browser shortcuts (Cmd+R, Cmd+W, Ctrl+...) work.
      // Alt stays — it's our chord / drone modifier.
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      const s = useStore.getState();
      const a = resolveKeyDown(e, {
        root: s.root,
        baseOctave: s.baseOctave,
        octaveShift: s.octaveShift,
        tuning: s.tuning,
        mode: s.mode,
        chordScaleTET:   s.chordScaleTET,
        chordScaleSruti: s.chordScaleSruti,
      });
      if (a) void dispatch(a);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!INSTRUMENT_CODES.has(e.code)) return;
      const a = resolveKeyUp(e);
      if (a) void dispatch(a);
    };

    const onBlur = () => void dispatch({ type: 'AllNotesOff' });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
