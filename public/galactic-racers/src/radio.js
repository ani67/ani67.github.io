// ON Dance's public HTTPS stream, as listed by the station's own player:
// https://www.0nradio.com/now_playing/0n-dance.json
const Radio = (() => {
  const stream = 'https://0n-dance.radionetz.de/0n-dance_web.mp3';
  let player = null, activated = false, pending = false;
  let volume = 0.6, muted = false;
  const status = text => {
    const label = document.getElementById('radioStatus');
    if (label) label.textContent = text;
  };

  function sync() {
    if (!player) return;
    player.volume = volume;
    player.muted = muted;
    if (muted || volume === 0 || document.hidden) {
      player.pause();
      status('Paused');
      return;
    }
    if (!activated || pending || !player.paused) return;
    // Reconnect to the live edge after a pause or failed connection.
    player.src = stream;
    pending = true;
    status('Connecting…');
    player.play().catch(error => {
      if (error.name !== 'AbortError') status('Unavailable — click to retry');
    }).finally(() => { pending = false; });
  }

  function start(settings) {
    volume = settings.music;
    muted = settings.muted;
    activated = true;
    if (!player) {
      // Use a media element directly: cross-origin radio playback does not
      // depend on the station allowing Web Audio access through CORS.
      player = document.createElement('audio');
      player.preload = 'none';
      player.addEventListener('playing', () => status('Live'));
      player.addEventListener('waiting', () => status('Buffering…'));
      player.addEventListener('error', () => status('Unavailable — click to retry'));
      document.addEventListener('visibilitychange', sync);
      window.addEventListener('pagehide', () => player.pause());
      window.addEventListener('pageshow', sync);
      window.addEventListener('online', sync);
      window.addEventListener('click', sync);
      window.addEventListener('keydown', sync);
    }
    sync();
  }

  return {
    start,
    setVolume(value) { volume = value; sync(); },
    setMuted(value) { muted = value; sync(); },
  };
})();
