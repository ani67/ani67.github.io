'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Maximize, Minimize, X } from 'lucide-react';
import { Flame } from '@/app/components/layout/Flame';
import { playTimerCue } from './audio';
import { cldUrl } from '@/lib/cloudinary';
import { track } from '@/lib/analytics';
import { INITIAL_TIMER, finishTimer, formatTime, remainingAt, restoreTimer, type TimerMode, type TimerState } from '@/lib/pomodoro';

const STORAGE_KEY = 'ani-pomodoro-v1';
const SCENES = [
  { name: 'Rooftop evenings', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021948/web/nov%20rain/rooftops_eoqhkb.webp', color: '#318baa' },
  { name: 'Monsoon daydreams', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021990/web/nov%20rain/monsoon_ntvpwq.webp', color: '#526e58' },
  { name: 'Somewhere by the sea', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021994/web/nov%20rain/sunset_q3bvqs.webp', color: '#bb7c72' },
  { name: 'Kyoto mornings', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021983/web/nov%20rain/kyoto_tzax7d.webp', color: '#53746b' },
  { name: 'Lisbon afternoons', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021986/web/nov%20rain/lisbon_ua0xzn.webp', color: '#c79465' },
  { name: 'Alpine stillness', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021979/web/nov%20rain/alps_emtauv.webp', color: '#809ca6' },
  { name: 'Marrakech dusk', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021988/web/nov%20rain/marrakech_ihvigz.webp', color: '#b57b78' },
  { name: 'Brooklyn blue hour', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021992/web/nov%20rain/new-york_nd4euz.webp', color: '#666a91' },
  { name: 'Cape Town light', image: 'https://res.cloudinary.com/duw0custw/image/upload/v1790021981/web/nov%20rain/cape-town_kbpya1.webp', color: '#718f8c' },
];

export function Pomodoro() {
  const [timer, setTimer] = useState<TimerState>(INITIAL_TIMER);
  const [remaining, setRemaining] = useState(INITIAL_TIMER.remaining);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const current = useRef<TimerState>(INITIAL_TIMER);
  const audio = useRef<AudioContext | null>(null);
  const root = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const durationButton = useRef<HTMLButtonElement>(null);

  function commit(next: TimerState) {
    current.current = next;
    setTimer(next);
    setRemaining(remainingAt(next, Date.now()));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Timer still works without storage. */ }
  }

  function unlockAudio() {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch { /* Sound is optional. */ }
  }

  useEffect(() => {
    const originalTitle = document.title;
    function complete() {
      const t = current.current;
      commit(finishTimer(t));
      setNotice(t.mode === 'focus' ? 'Nice work. Time for a little break.' : 'Fresh start. Ready when you are.');
      track('pomodoro_complete', { mode: t.mode, duration_minutes: t[t.mode] });
      if (audio.current) void playTimerCue(audio.current, 'complete');
    }
    function tick() {
      const t = current.current;
      const left = remainingAt(t, Date.now());
      setRemaining(left);
      if (t.deadline !== null && left === 0) complete();
      document.title = `${formatTime(left)} · ${t.mode === 'focus' ? 'Focus' : 'Break'} — Pomodoro`;
    }
    const init = window.setTimeout(() => {
      let saved = { ...INITIAL_TIMER };
      let hasSavedScene = false;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        saved = restoreTimer(raw);
        hasSavedScene = raw !== null;
      } catch { /* Randomize even when storage is unavailable. */ }
      // Pick a fresh scene without disturbing an in-progress session. When
      // possible, skip the previous scene so a reload visibly changes it.
      const pick = Math.floor(Math.random() * (SCENES.length - (hasSavedScene ? 1 : 0)));
      const scene = hasSavedScene && pick >= saved.scene ? pick + 1 : pick;
      commit({ ...saved, scene });
      setReady(true);
      tick();
    }, 0);
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pageshow', tick);
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      clearTimeout(init); clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('pageshow', tick);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.title = originalTitle;
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [settings]);

  function switchMode(mode: TimerMode) {
    if (mode === timer.mode) return;
    commit({ ...current.current, mode, deadline: null, remaining: current.current[mode] * 60_000 });
    setNotice('');
  }
  function toggle() {
    const t = current.current;
    unlockAudio();
    if (t.deadline !== null) {
      const left = remainingAt(t, Date.now());
      commit(left === 0 ? finishTimer(t) : { ...t, deadline: null, remaining: left });
      track('pomodoro_pause', { mode: t.mode });
    } else {
      const left = t.remaining || t[t.mode] * 60_000;
      commit({ ...t, remaining: left, deadline: Date.now() + left });
      setNotice('');
      if (audio.current) void playTimerCue(audio.current, 'start');
      track('pomodoro_start', { mode: t.mode, duration_minutes: t[t.mode] });
    }
  }
  function reset() {
    const t = current.current;
    commit({ ...t, deadline: null, remaining: t[t.mode] * 60_000 });
    setNotice('');
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch { setNotice('Fullscreen is not available in this browser.'); }
  }
  const progress = Math.min(100, Math.max(0, (1 - remaining / (timer[timer.mode] * 60_000)) * 100));
  const display = formatTime(remaining);
  return (
    <main ref={root} className="pomodoro" aria-label="Pomodoro timer" onPointerDownCapture={unlockAudio} onKeyDownCapture={unlockAudio}>
      {SCENES.map((scene, i) => <div key={scene.name} className={`pomo-scene ${ready && timer.scene === i ? 'is-active' : ''}`} style={{ backgroundImage: `url(${cldUrl(scene.image, 1600)})` }} aria-hidden="true" />)}
      <div className="pomo-shade" aria-hidden="true" />
      <h1 className="sr-only">Pomodoro — a little time to focus</h1>
      <header className="pomo-header">
        <Link href="/" className="pomo-icon pomo-home" aria-label="Back to Ani Dalal’s portfolio"><Flame className="pomo-flame" /></Link>
        <nav className="pomo-modes" aria-label="Timer mode">
          <button aria-pressed={timer.mode === 'focus'} onClick={() => switchMode('focus')} disabled={!ready}>Focus</button>
          <button aria-pressed={timer.mode === 'break'} onClick={() => switchMode('break')} disabled={!ready}>Break</button>
        </nav>
        <span className="pomo-header-spacer" aria-hidden="true" />
      </header>
      <section className="pomo-center" aria-label="Countdown controls">
        <div className="pomo-controls">
          <button onClick={reset} disabled={!ready}>Reset</button>
          <button ref={durationButton} onClick={() => setSettings(true)} disabled={!ready} aria-haspopup="dialog" aria-label={`Change duration, currently ${timer[timer.mode]} minutes`}>{timer[timer.mode]} min sesh</button>
          <button onClick={toggle} disabled={!ready}>{timer.deadline !== null ? 'Pause' : remaining === 0 ? 'Again' : remaining < timer[timer.mode] * 60_000 ? 'Resume' : 'Start'}</button>
        </div>
        <div className={`pomo-digits ${display.length > 5 ? 'pomo-long' : ''}`} role="timer" aria-label={`${Math.floor(Math.ceil(remaining / 1000) / 60)} minutes ${Math.ceil(remaining / 1000) % 60} seconds remaining`} aria-live="off">
          {display.split('').map((digit, i) => <span key={i} className={digit === ':' ? 'pomo-colon' : ''} aria-hidden="true">{digit}</span>)}
        </div>
        <div className="pomo-progress" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }} /></div>
        <p className="pomo-notice" role="status">{notice || (timer.deadline === null && remaining === timer[timer.mode] * 60_000 ? (timer.mode === 'focus' ? 'A little time. One thing at a time.' : 'Stretch a little. Take a breath.') : '\u00a0')}</p>
        {remaining === 0 && <button className="pomo-next" onClick={() => switchMode(timer.mode === 'focus' ? 'break' : 'focus')}>{timer.mode === 'focus' ? 'Take a break' : 'Back to focus'} →</button>}
      </section>
      <footer className="pomo-footer">
        <p className="pomo-sessions">{timer.completed > 0 ? `${timer.completed} ${timer.completed === 1 ? 'sesh' : 'sessions'} well spent` : 'Make a little room.'}</p>
        <div className="pomo-scenes" role="group" aria-label="Choose a scene">{SCENES.map((scene, i) => <button key={scene.name} aria-label={scene.name} title={scene.name} aria-pressed={timer.scene === i} disabled={!ready} style={{ backgroundColor: scene.color, backgroundImage: `url(${cldUrl(scene.image, 120)})` }} onClick={() => commit({ ...current.current, scene: i })} />)}</div>
        <button className="pomo-icon pomo-fullscreen" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>
      </footer>
      <dialog ref={dialog} className="pomo-dialog" aria-labelledby="pomo-settings-title" onCancel={() => setSettings(false)} onClose={() => { setSettings(false); durationButton.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) setSettings(false); }}>
        <form key={`${timer.focus}-${timer.break}-${settings}`} onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const focus = Number(data.get('focus')), rest = Number(data.get('break'));
          if (![focus, rest].every(n => Number.isInteger(n) && n >= 1 && n <= 120)) return;
          const t = current.current;
          const changed = focus !== t.focus || rest !== t.break;
          if (changed) { commit({ ...t, focus, break: rest, deadline: null, remaining: (t.mode === 'focus' ? focus : rest) * 60_000 }); setNotice(''); }
          setSettings(false);
        }}>
          <div className="pomo-dialog-heading"><h2 id="pomo-settings-title">Make time.</h2><button type="button" className="pomo-icon" aria-label="Close settings" onClick={() => setSettings(false)}><X size={20} /></button></div>
          <p>A little focus. A little breathing room.</p>
          <div className="pomo-fields"><label>Focus<input name="focus" type="number" min="1" max="120" required defaultValue={timer.focus} /><span>minutes</span></label><label>Break<input name="break" type="number" min="1" max="120" required defaultValue={timer.break} /><span>minutes</span></label></div>
          <p className="pomo-settings-note">Changing durations resets the current session.</p>
          <button className="pomo-save" type="submit">Set my rhythm →</button>
        </form>
      </dialog>
    </main>
  );
}
