/** A short upward cue to begin; a slower, two-phrase bell when time is up. */
export async function playTimerCue(context: AudioContext, cue: 'start' | 'complete') {
  try {
    if (context.state === 'closed') return;
    await context.resume();
    const notes = cue === 'start'
      ? [[523.25, 0], [783.99, 0.14]]
      : [[783.99, 0], [659.25, 0.28], [523.25, 0.56], [783.99, 1.5], [659.25, 1.78], [523.25, 2.06]];
    const duration = cue === 'start' ? 0.55 : 1.3;
    for (const [frequency, offset] of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(cue === 'start' ? 0.1 : 0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + duration + 0.05);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  } catch { /* Audio availability never blocks the timer. */ }
}
