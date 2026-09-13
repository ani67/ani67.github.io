// Deterministic pool of 1000 plausible racer handles. Names.list is the pool; Names.pick(rnd) draws without repeats per picker.
const Names = (() => {
  const A = ['Nova', 'Vex', 'Kiri', 'Juno', 'Orin', 'Sable', 'Tarn', 'Lux', 'Rook', 'Zephyr', 'Mira', 'Cato', 'Ilse', 'Bram', 'Ember', 'Quill', 'Dax', 'Wren', 'Suki', 'Halo', 'Ryo', 'Pax', 'Iris', 'Kell', 'Onyx', 'Vega', 'Tycho', 'Sol', 'Nyx', 'Ash', 'Faye', 'Lorne', 'Ravi', 'Tess', 'Ulric', 'Zia', 'Moss', 'Cyan', 'Brix', 'Kova', 'Lio', 'Petra', 'Sato', 'Vik', 'Yara', 'Zed', 'Aris', 'Dune', 'Echo', 'Flint'];
  const B = ['runner', 'drift', 'pilot', 'vector', 'circuit', 'orbit', 'flux', 'byte', 'comet', 'delta', 'kestrel', 'saber', 'nomad', 'signal', 'rider', 'ghost', 'spark', 'meridian', 'hollow', 'apex', 'tide', 'ember', 'skiff', 'wave', 'helix', 'prism', 'sable', 'zenith', 'motor', 'rally', 'lumen', 'tandem', 'cinder', 'karma', 'quasar', 'rogue', 'strafe', 'turbo', 'vapor', 'warden'];
  const SEP = ['', '_', '.', '-', ''];
  const rng = M.mulberry32(0x5EEDF00D);
  const seen = new Set(), list = [];
  let guard = 0;
  while (list.length < 1000 && guard++ < 100000) {
    const a = A[Math.floor(rng() * A.length)], b = B[Math.floor(rng() * B.length)], sep = SEP[Math.floor(rng() * SEP.length)];
    const form = rng();
    let name;
    if (form < 0.35) name = a + sep + b;
    else if (form < 0.6) name = a + sep + b + Math.floor(rng() * 99 + 1);
    else if (form < 0.75) name = a.toLowerCase() + sep + b + Math.floor(rng() * 9000 + 100);
    else if (form < 0.87) name = b + sep + a;
    else name = a + Math.floor(rng() * 999 + 1);
    if (!seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); list.push(name); }
  }
  function picker(rnd) {
    const used = new Set();
    return () => { for (let i = 0; i < 50; i++) { const n = list[Math.floor(rnd() * list.length)]; if (!used.has(n)) { used.add(n); return n; } } return list[Math.floor(rnd() * list.length)]; };
  }
  return { list, pick: rnd => list[Math.floor((rnd ? rnd() : Math.random()) * list.length)], picker };
})();
