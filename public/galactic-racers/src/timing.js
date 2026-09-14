// Bounded telemetry and render-only interpolation. No gameplay state is modified.
const Timing = (() => {
  function samples(capacity = 240) {
    const values = new Float64Array(capacity); let count = 0, index = 0;
    return {
      add(value) { if (Number.isFinite(value) && value >= 0) { values[index] = value; index = (index + 1) % capacity; count = Math.min(count + 1, capacity); } },
      clear() { count = index = 0; },
      summary() { const sorted = Array.from(values.subarray(0, count)).sort((a,b) => a-b); const at = p => sorted[Math.max(0, Math.ceil(count*p)-1)] || 0; return { count, p50: at(.5), p95: at(.95), p99: at(.99) }; },
    };
  }
  function displayClock() {
    const window = samples(120); let ticks = 0, hz = 0;
    return {
      add(ms) {
        if (ms < 4 || ms > 40) return;
        window.add(ms);
        if (++ticks % 120) return;
        const s = window.summary();
        // Only infer a refresh rate from a stable callback cadence. Slow GPU frames
        // must not silently redefine the workload target and defeat adaptation.
        if (s.p95 - s.p50 < 1.2) {
          const measured = 1000 / s.p50;
          const candidate = [60,75,90,100,120,144,165,180,240].find(n => Math.abs(n-measured) < n*.035);
          if (candidate) hz = candidate;
        }
      },
      target(cap, automatic) { return automatic && hz > 60 ? hz / Math.ceil(hz / cap) : cap; },
      get hz() { return hz; },
      reset() { window.clear(); ticks = 0; hz = 0; },
    };
  }
  function pose(c) { return { x:c.x, y:c.y, z:c.z, heading:c.heading, pitch:c.pitch, wrecks:c.wrecks }; }
  function interpolate(previous, current, alpha) {
    if (!previous || previous.wrecks !== current.wrecks || Math.hypot(current.x-previous.x,current.y-previous.y,current.z-previous.z) > 20) return current;
    const a = Math.max(0,Math.min(1,alpha)), mix = (x,y) => x+(y-x)*a;
    const angle = Math.atan2(Math.sin(current.heading-previous.heading),Math.cos(current.heading-previous.heading));
    return { x:mix(previous.x,current.x), y:mix(previous.y,current.y), z:mix(previous.z,current.z), heading:previous.heading+angle*a, pitch:mix(previous.pitch,current.pitch) };
  }
  return { samples, displayClock, pose, interpolate };
})();
