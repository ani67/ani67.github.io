// Ship 03: an authored orbital ring racer, +Z forward. Shared fleet paint roles.
const Ship03=(()=>{
  const paintForWorld=world=>Ship01.paintForWorld(world);
  function build(world,customPaint=null){
    const paint=customPaint||paintForWorld(world),vertices=[],indices=[];
    const sub=(a,b)=>a.map((x,i)=>x-b[i]);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l)};
    const tint=(c,s)=>c.map(x=>x*s);
    function face(pts,colour,inside,region=5){
      let n=norm(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])));
      const mid=pts[0].map((_,k)=>pts.reduce((sum,p)=>sum+p[k],0)/pts.length);
      if(inside&&n.reduce((sum,x,i)=>sum+x*(mid[i]-inside[i]),0)<0)n=n.map(x=>-x);
      const ids=pts.map(p=>{const id=vertices.length/10;vertices.push(...p,...n,...colour,region);return id});
      for(let i=1;i<ids.length-1;i++)indices.push(ids[0],ids[i],ids[i+1]);
    }
    // Eight-sided bevelled section, lofted along the ship's length.
    function hull(x,y,slices,colour){
      const poly=[[1,-.7],[.7,-1],[-.7,-1],[-1,-.7],[-1,.7],[-.7,1],[.7,1],[1,.7]];
      const rings=slices.map(([z,w,h])=>poly.map(([a,b])=>[x+a*w/2,y+b*h/2,z]));
      const centre=[x,y,(slices[0][0]+slices.at(-1)[0])/2];
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++)face([rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]],colour,centre);
      face(rings[0],tint(colour,.8),centre);face(rings.at(-1),colour,centre);
    }
    function box(c,size,colour){hull(c[0],c[1],[[c[2]-size[2]/2,size[0],size[1]],[c[2]+size[2]/2,size[0],size[1]]],colour)}
    function strut(a,b,r=.045){
      const d=norm(sub(b,a)),u=norm(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),v=cross(d,u),centre=a.map((x,i)=>(x+b[i])/2);
      const rings=[a,b].map(c=>Array.from({length:6},(_,i)=>{const t=i/6*Math.PI*2;return c.map((x,k)=>x+r*(u[k]*Math.cos(t)+v[k]*Math.sin(t)))}));
      for(let i=0;i<6;i++)face([rings[0][i],rings[0][(i+1)%6],rings[1][(i+1)%6],rings[1][i]],paint.underside,centre);
    }
    // Swept, tapered airfoil supports replace the exposed triangular rod frames.
    function support(a,b,chord=.8,thickness=.18){
      const axis=norm(sub(b,a)),across=norm(cross(axis,[0,0,1])),along=norm(cross(across,axis));
      const section=[[1,0],[.6,.65],[.05,1],[-.65,.5],[-1,0],[-.65,-.5],[.05,-1],[.6,-.65]];
      const slices=[[0,1.12],[.12,1],[.85,.78],[1,.72]];
      const rings=slices.map(([t,scale])=>section.map(([z,x])=>a.map((v,k)=>v+(b[k]-v)*t+along[k]*z*chord*.5*scale+across[k]*x*thickness*.5*scale)));
      const centre=a.map((v,k)=>(v+b[k])*.5);
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++)face([rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]],tint(paint.body,.82),centre);
      face(rings[0],tint(paint.body,.82),centre);face(rings.at(-1),tint(paint.body,.82),centre);
    }
    function engine(x,y,profile){
      const centre=[x,y,(profile[0][0]+profile.at(-1)[0])/2],seg=32;
      for(let j=0;j<profile.length-1;j++)for(let i=0;i<seg;i++){
        const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,p=profile[j],q=profile[j+1];
        const point=(s,t)=>[x+s[1]*Math.cos(t),y+s[1]*Math.sin(t),s[0]];
        face([point(p,a),point(p,b),point(q,b),point(q,a)],q[2],centre);
      }
      const end=profile[0],pts=Array.from({length:seg},(_,i)=>[x+end[1]*.78*Math.cos(i/seg*Math.PI*2),y+end[1]*.78*Math.sin(i/seg*Math.PI*2),end[0]-.012]);
      face(pts,paint.accent,[x,y,end[0]+1],4);
    }
    // Broad bevelled orbital ring in the X/Y plane, open around the central hub.
    const radius=2.75,ringZ=-.65,segments=96;
    const section=[[.13,-.23],[.19,-.16],[.19,.16],[.13,.23],[-.13,.23],[-.19,.16],[-.19,-.16],[-.13,-.23]];
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const at=(angle,[r,z])=>[(radius+r)*Math.cos(angle),(radius+r)*Math.sin(angle),ringZ+z];
      const inside=[radius*Math.cos((a+b)/2),radius*Math.sin((a+b)/2),ringZ];
      for(let j=0;j<8;j++){
        const k=(j+1)%8;
        const colour=j>=4&&j<=6?paint.underside:paint.wings;
        face([at(a,section[j]),at(b,section[j]),at(b,section[k]),at(a,section[k])],colour,inside);
      }
    }
    // Compact hub, with a raised cockpit and a long tapered forward boom.
    hull(0,0,[[-1.65,.9,.7],[-1.1,1.25,.95],[.65,1.15,.85],[1.02,.72,.6]],paint.body);
    hull(0,.62,[[-.78,.7,.52],[-.3,.85,.73],[.22,.65,.57],[.45,.55,.4]],paint.body);
    box([0,.99,-.1],[.52,.025,.36],paint.canopy);
    box([0,.69,.443],[.37,.2,.018],paint.canopy);
    hull(0,.03,[[.62,.72,.58],[1.32,.63,.47],[4.15,.49,.39],[4.65,.36,.29]],paint.wings);
    box([0,.03,4.655],[.22,.16,.015],paint.canopy);
    box([0,.244,3.88],[.36,.018,.08],paint.accent);
    // Two opposite pod stations with a single swept support each.
    for(const side of [-1,1]){
      const x=0,y=side*2.75;
      support([0,side*.25,-.35],[x,y,-.65],.85,.25);
      hull(x,y,[[-1.3,.52,.6],[-.96,.7,.76],[.22,.66,.68],[.43,.48,.51]],paint.body);
      box([x,y,.435],[.33,.37,.018],paint.canopy);
      engine(x,y,[[-1.66,.27,paint.underside],[-1.45,.3,paint.underside],[-1.24,.24,paint.underside]]);
      // Broad rearward stabiliser: a closed bevelled blade, not a loose rod.
      hull(x,y-.05,[[-2.55,.32,.10],[-2.1,.52,.14],[-1.21,.58,.18]],paint.wings);
    }
    // Twin capped boosters flank the hub at its centre height.
    for(const side of [-1,1]){
      const x=side*.8;
      hull(x,0,[[-1.56,.42,.45],[-.95,.52,.56],[.08,.43,.42]],paint.body);
      engine(x,0,[[-1.83,.19,paint.underside],[-1.56,.22,paint.underside]]);
      box([x,0,.083],[.28,.25,.015],paint.underside);
    }
    // Sparse hub detail: two service panels and a short dorsal aerial.
    for(const side of [-1,1])box([side*.63,.08,-.45],[.018,.36,.48],tint(paint.body,.85));
    strut([.25,.88,-.55],[.25,1.3,-.55],.027);
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
