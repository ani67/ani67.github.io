import { useEffect } from 'react';
import { useStore } from '../store/store';
import { resolveKeyDown, resolveKeyUp } from '../lib/keymap/resolver';
import { CODE_TO_ROW, INSTRUMENT_CODES } from '../lib/keymap/grid';
import { dispatch } from '../lib/dispatch';

const PICKER_LEADER = 'Equal';
const PICKER_TIMEOUT_MS = 1500;

/**
 * Editable text targets — when one of these is focused, the instrument
 * keyboard listener stops intercepting so the user can type names, blurbs,
 * etc. into form fields normally. Escape is excluded from this guard above
 * so it can still bubble to per-component handlers.
 */
function isTextEditingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return t.isContentEditable;
}

export function useKeyboard(): void {
  useEffect(() => {
    let armTimer: ReturnType<typeof setTimeout> | null = null;
    const clearArmTimer = () => {
      if (armTimer) { clearTimeout(armTimer); armTimer = null; }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Esc closes the picker / disarms.
      if (e.code === 'Escape') {
        const s = useStore.getState();
        if (s.pickerCode || s.pickerArmed) {
          clearArmTimer();
          s.closePicker();
          s.disarmPicker();
          e.preventDefault();
        }
        return;
      }

      // When the user is typing in a text field, keep our hands off — no
      // note-plays, no preventDefault, no picker-arming. Lets the voice
      // editor's name / blurb inputs (and any future inputs) just work.
      if (isTextEditingTarget(e.target)) return;

      // The leader key — arm picker for the next instrument keypress.
      if (e.code === PICKER_LEADER && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.repeat) { e.preventDefault(); return; }
        const s = useStore.getState();
        s.armPicker();
        clearArmTimer();
        armTimer = setTimeout(() => useStore.getState().disarmPicker(), PICKER_TIMEOUT_MS);
        e.preventDefault();
        return;
      }

      if (!INSTRUMENT_CODES.has(e.code)) return;
      // Ctrl/Meta still bail so browser shortcuts (Cmd+R, Cmd+W, Ctrl+...) work.
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      const s = useStore.getState();

      // Picker takeover: if armed and this is a remappable key, consume it.
      if (s.pickerArmed && CODE_TO_ROW.has(e.code)) {
        clearArmTimer();
        s.openPicker(e.code);
        return;
      }

      // While the picker is open, swallow other instrument keys.
      if (s.pickerCode) return;

      const evt = s.optionLock
        ? { code: e.code, shiftKey: e.shiftKey, altKey: true, repeat: e.repeat }
        : e;
      const a = resolveKeyDown(evt, {
        root: s.root,
        baseOctave: s.baseOctave,
        octaveShift: s.octaveShift,
        tuning: s.tuning,
        mode: s.mode,
        chordScaleTET:   s.chordScaleTET,
        chordScaleSruti: s.chordScaleSruti,
        customMapTET:    s.customMapTET,
        customMapSruti:  s.customMapSruti,
      });
      if (a) void dispatch(a);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isTextEditingTarget(e.target)) return;
      if (!INSTRUMENT_CODES.has(e.code)) return;
      const a = resolveKeyUp(e);
      if (a) void dispatch(a);
    };

    const onBlur = () => {
      clearArmTimer();
      useStore.getState().disarmPicker();
      void dispatch({ type: 'AllNotesOff' });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      clearArmTimer();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
