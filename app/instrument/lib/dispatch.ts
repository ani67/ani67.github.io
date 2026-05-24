import type { Action } from './types';
import { useStore } from '../store/store';
import { ensureRunning, isRunning } from './audio/context';
import { synthNoteOn, synthNoteOff, synthAllNotesOff } from './audio/synth';
import { lookupVoice } from './audio/voices';

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
    case 'NoteOn': {
      st.noteOn(action.code);
      // Resolution order:
      //   1. Action-supplied voice (used by picker hover preview).
      //   2. Editor draft (when editor is open, every key plays the in-progress voice).
      //   3. Store voice (built-in or user-saved).
      const voice = action.voice
        ? lookupVoice(action.voice, st.userVoices)
        : st.voiceEditor ?? lookupVoice(st.voice, st.userVoices);
      synthNoteOn({ code: action.code, freqs: action.freqs, voice });
      return;
    }

    case 'NoteOff':
      st.noteOff(action.code);
      synthNoteOff(action);
      return;

    case 'SetRoot':
      st.setRoot(action.pitchClass);
      return;

    case 'ShiftPeriod':
      st.shiftPeriod(action.delta);
      return;

    case 'AllNotesOff':
      st.allNotesOff();
      synthAllNotesOff();
      return;
  }
}
