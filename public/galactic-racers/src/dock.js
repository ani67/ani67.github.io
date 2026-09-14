// Minimal dark display: one angled circuit panel and a quiet scale outline.
const Dock = (() => {
  function build({ landscape = false } = {}) {
    const verts = [], idx = [];
    function box(c, size, grey, transform = null, flat = false) {
      const faces = [[0,1,1,2],[0,-1,2,1],[1,1,2,0],[1,-1,0,2],[2,1,0,1],[2,-1,1,0]];
      for (const [axis, sign, u, v] of faces) {
        const start = verts.length / 12;
        for (const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
          const p = [...c], n = [0,0,0];
          p[axis] += sign*size[axis]/2; p[u] += a*size[u]/2; p[v] += b*size[v]/2; n[axis] = sign;
          const point = transform ? transform(p, false) : p;
          const normal = transform ? transform(n, true) : n;
          verts.push(...point,...normal,grey,grey,3,10,grey,flat ? 104 : 102);
        }
        idx.push(start,start+1,start+2,start,start+2,start+3);
      }
    }
    // A single flat backdrop removes the floor horizon and world scenery.
    if (!landscape) box([0,0,-70],[600,600,.2],.025,null,true);
    // Subtle, compact footprint. The tint is precomposited against the flat backdrop.
    for (const x of [-3.4,3.4]) box([x,-3.15,0],[.035,.012,6.8],.085,null,true);
    for (const z of [-3.4,3.4]) box([0,-3.15,z],[6.8,.012,.035],.085,null,true);
    // Compact service equipment sits off to the rear-right, leaving the craft visible.
    // Low plinth, thick cabinet, inset displays and a slim side panel read as a small diorama.
    const yaw = -.3;
    function stationTransform(p, normal) {
      return [p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw)+(normal?0:3.2),p[1],-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)+(normal?0:-3.3)];
    }
    const panel = (c,size,grey) => box(c,size,grey,stationTransform);
    panel([0,-3.05,0],[3.5,.22,2.1],.095);
    panel([.6,-1,0],[1.7,3.9,1.05],.18);
    panel([.6,1.05,0],[1.95,.3,1.25],.28);
    panel([.6,.08,.56],[1.27,1.3,.1],.035);
    panel([.6,.36,.63],[.99,.45,.035],.3);
    panel([.23,-.13,.64],[.17,.17,.04],.42);
    panel([.59,-.13,.64],[.17,.17,.04],.26);
    panel([.95,-.13,.64],[.17,.17,.04],.16);
    for(let i=0;i<6;i++) panel([.6,-1.02-i*.18,.56],[1.15,.055,.04],.05);
    // Narrow angled circuit/service panel beside the cabinet, not a wall behind the ship.
    panel([-1.2,-.65,-.2],[.12,4.65,.85],.13);
    panel([-1.2,-.65,.29],[1.05,4.65,.16],.12);
    for(let i=0;i<4;i++) {
      const x=-1.55+i*.18, y=.9-i*.45;
      panel([x,-.4,.39],[.025,2.6-i*.28,.025],.3);
      panel([(x-.87)/2,y,.39],[-.87-x,.025,.025],.3);
      panel([-.87,y,.41],[.10,.10,.035],.4);
    }
    panel([-1.15,-1.7,.4],[.56,.65,.12],.035);
    // Two articulated service arms suggest machinery without surrounding the ship.
    panel([1.55,-.1,.6],[.18,.75,.18],.07);
    panel([1.55,-.55,1.05],[.18,.18,1.1],.085);
    panel([1.1,-.55,1.55],[1.05,.18,.18],.12);
    panel([-1.8,-2.45,.45],[.15,1.1,.15],.2);
    panel([-1.8,-1.95,.8],[.15,.15,.85],.2);
    if (landscape) for (let i=0;i<verts.length;i+=12) {
      verts[i+1] += 3.3;
      const grey=verts[i+6];
      verts[i+6]=grey*1.03; verts[i+7]=grey*1.1; verts[i+10]=grey*.87;
      verts[i+11] = verts[i+11] % 100;
    }
    return {verts:new Float32Array(verts),idx:new Uint32Array(idx)};
  }
  function descriptor(source) {
    return {...source,sky:[[.019,.019,.019],[.019,.019,.019]],fog:0,stars:0,
      sunDir:[-.4,.8,.45],pal5:[[.08,.08,.08],[.15,.15,.15],[.25,.25,.25],[.4,.4,.4],[.65,.65,.65]],
      emis:[0,0,0],biome:{},waterLevel:-10000,bandAmt:0,
      look:{...source.look,colormap:0,dither:0,edge:.16,posterize:0}};
  }
  return {build,descriptor};
})();
