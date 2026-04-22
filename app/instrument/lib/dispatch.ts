import type { Action } from './types';
import { useStore } from '../store/store';
import { ensureRunning, isRunning } from './audio/context';
import { synthNoteOn, synthNoteOff, synthAllNotesOff } from './audio/synth';

/**
 * The single funnel: Action → state mutation + audio side effect.
 * Every dispatch also tries to unlock the AudioContext (first call = gesture).
 */
export async function dispatch(action: Action): Promise<void> {
  if (!isRunning()) {
    const ok = await ensureRunning();
    useStore.getState().setAudioReady(ok);
    if (!ok) return;
  }

  const st = useStore.getState();

  switch (action.type) {
    case 'NoteOn':
      st.noteOn(action.code);
      synthNoteOn(action);
      return;

    case 'NoteOff':
      st.noteOff(action.code);
      synthNoteOff(action);
      return;

    case 'SetRoot':
      st.setRoot(action.pitchClass);
      return;

    case 'ShiftOctave':
      st.shiftOctave(action.delta);
      return;

    case 'AllNotesOff':
      st.allNotesOff();
      synthAllNotesOff();
      return;
  }
}
