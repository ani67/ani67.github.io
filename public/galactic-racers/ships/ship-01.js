// Ship 01 blockout: a convex lens-shaped disc and a centred hemisphere, with colours drawn from the generated world palette.
// Coordinates: +Z forward, +Y up. Independent of the legacy ship generator.
const Ship01 = (() => {
  function paintForWorld(world) {
    const palette=world?.pal5 || [[.12,.14,.16],[.25,.28,.3],[.42,.46,.48],[.64,.68,.7],[.85,.87,.88]];
    const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
    const chroma=c=>Math.max(...c)-Math.min(...c);
    const accent=[...palette].sort((a,b)=>chroma(b)-chroma(a))[0];
    // Keep neutral paint neutral; use the world's strongest pigment for coloured liveries.
    if (chroma(accent)<.035) return {body:palette[3], underside:palette[1], canopy:palette[0], wings:palette[2], accent:palette[4]};
    const body=mix(accent,palette[4],.18);
    const contrasting=[...palette].sort((a,b)=>a.reduce((sum,v,i)=>sum+(v-body[i])**2,0)-b.reduce((sum,v,i)=>sum+(v-body[i])**2,0)).pop();
    return {body, underside:mix(palette[0],[.08,.09,.11],.55), canopy:mix(palette[0],[.025,.04,.055],.8), wings:mix(contrasting,palette[2],.16), accent:mix(palette[4],[1,.95,.78],.22)};
  }
  function build(world, customPaint=null) {
    const paint=customPaint || paintForWorld(world);
    let surface=0; // disc, dome, fins: material regions for cel shading and sparse seams.
    const vertices = [], indices = [], segments = 96;
    function vertex(p, n, colour=paint.body) { const id = vertices.length / 10; vertices.push(...p, ...n, ...colour, surface); return id; }
    function connect(a, b) {
      for (let i = 0; i < segments; i++) indices.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1);
    }
    // Oblate ellipsoid: both faces swell towards the centre and meet at a soft rim.
    const discRadius=3, discHalfHeight=.55, profile=[];
    for(let j=0;j<=48;j++) {
      const t=-Math.PI/2+j/48*Math.PI, r=discRadius*Math.cos(t), y=discHalfHeight*Math.sin(t);
      const nr=Math.cos(t)/discRadius, ny=Math.sin(t)/discHalfHeight, length=Math.hypot(nr,ny);
      profile.push([r,y,nr/length,ny/length]);
    }
    let previous;
    // Duplicate colour-boundary rings so the enamel bands stay crisp.
    for(let j=0;j<profile.length-1;j++) {
      const midY=(profile[j][1]+profile[j+1][1])/2;
      const colour=midY>.075?paint.body:midY<-.075?paint.underside:paint.accent;
      previous=undefined;
      for(const [r,y,nr,ny] of [profile[j],profile[j+1]]) {
        const start=vertices.length/10;
        for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;vertex([r*Math.cos(a),y,r*Math.sin(a)],[nr*Math.cos(a),ny,nr*Math.sin(a)],colour)}
        if(previous!==undefined)connect(previous,start);
        previous=start;
      }
    }
    surface=1;
    // True hemisphere: radius and height both 1.35, base slightly recessed into the curved upper surface.
    const radius=1.35, rings=32;
    const domeBase=discHalfHeight*Math.sqrt(1-(radius/discRadius)**2)-.2;
    previous=undefined;
    for(let j=0;j<=rings;j++) {
      const t=j/rings*Math.PI/2, start=vertices.length/10;
      for(let i=0;i<=segments;i++) { const a=i/segments*Math.PI*2,n=[Math.cos(t)*Math.cos(a),Math.sin(t),Math.cos(t)*Math.sin(a)];vertex([radius*n[0],domeBase+radius*n[1],radius*n[2]],n,paint.canopy); }
      if(previous!==undefined)connect(previous,start);
      previous=start;
    }
    surface=2;
    // Two upright cursor-shaped fins beside the dome, both pointing forward (+Z).
    // Lower corners seat into the disc; full cheeks taper to a sharp perimeter.
    function face(points, hint, colour=paint.wings) {
      const u=points[1].map((v,i)=>v-points[0][i]),v=points[2].map((v,i)=>v-points[0][i]);
      let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const length=Math.hypot(...n)||1;n=n.map(x=>x/length);
      if(n.reduce((sum,x,i)=>sum+x*hint[i],0)<0)n=n.map(x=>-x);
      const ids=points.map(p=>vertex(p,n,colour));
      for(let i=1;i<ids.length-1;i++)indices.push(ids[0],ids[i],ids[i+1]);
    }
    // Outline in the Y/Z plane: nose, upper rear, trailing notch, lower rear.
    const rearEdge=-Math.sqrt(discRadius**2-1.65**2);
    const outline=[[.46,0],[1.65,rearEdge+.1],[.7,rearEdge+.6],[0,rearEdge]];
    for(const side of [-1,1]) {
      const centre=[.7025,(3*rearEdge+.7)/4];
      const ring=(inset,offset)=>outline.map(([y,z])=>[
        side*1.65+offset,
        centre[0]+(y-centre[0])*inset,
        centre[1]+(z-centre[1])*inset
      ]);
      // Both faces swell gently to a flattened central panel. The shared outer
      // ring has zero thickness, preserving pointed tips instead of clipped bevels.
      const sections=[[1,0],[.975,.024],[.9,.075],[.78,.125],[.64,.15],[.52,.155]];
      for(const faceSide of [-1,1]) {
        const rings=sections.map(([inset,thickness])=>ring(inset,faceSide*thickness));
        for(let k=0;k<rings.length-1;k++)for(let i=0;i<4;i++) {
          const j=(i+1)%4;
          face([rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i]],
            [faceSide,0,0],paint.wings);
        }
        const panel=rings[rings.length-1];
        face([panel[0],panel[1],panel[2]],[faceSide,0,0]);
        face([panel[0],panel[2],panel[3]],[faceSide,0,0]);
      }
    }
    // Doubled exhaust recessed so 0.12 of its 1.2 length projects past the rear rim.
    surface=3;
    const nozzleSegments=32;
    const nozzle=[[-2.78,.14,paint.underside],[-2.95,.16,paint.underside],[-3.38,.25,paint.underside],[-3.38,.20,paint.underside],[-3.08,.115,paint.canopy],[-3.08,0,paint.canopy]];
    for(let j=0;j<nozzle.length-1;j++) {
      const a=nozzle[j],b=nozzle[j+1],dz=b[0]-a[0],dr=b[1]-a[1],length=Math.hypot(dz,dr)||1;
      const start=vertices.length/10;
      for(const [z,r] of [a,b])for(let i=0;i<=nozzleSegments;i++) {
        const t=i/nozzleSegments*Math.PI*2;
        vertex([2*r*Math.cos(t),2*r*Math.sin(t),-1.92+2*(z+2.78)],[-dz/length*Math.cos(t),-dz/length*Math.sin(t),dr/length],b[2]);
      }
      for(let i=0;i<nozzleSegments;i++) {
        const v=start+i,w=v+nozzleSegments+1;
        indices.push(v,w,v+1,v+1,w,w+1);
      }
    }
    // Opaque circular exhaust face, just outside the lip to seal the opening.
    // Separate material region allows thrust indication without exposing the interior.
    surface=4;
    const capZ=-3.122,capRadius=.402;
    const capCentre=vertex([0,0,capZ],[0,0,-1],paint.accent);
    const capStart=vertices.length/10;
    for(let i=0;i<=nozzleSegments;i++){
      const t=i/nozzleSegments*Math.PI*2;
      vertex([capRadius*Math.cos(t),capRadius*Math.sin(t),capZ],[0,0,-1],paint.accent);
    }
    for(let i=0;i<nozzleSegments;i++)indices.push(capCentre,capStart+i+1,capStart+i);
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
