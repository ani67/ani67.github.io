// Ship 02: an authored industrial tug, +Z forward. Shared fleet paint roles.
const Ship02=(()=>{
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
    // Long central fuselage, blunt chamfered nose and a narrow engine neck.
    hull(0,0,[[-2.9,.95,.85],[-2.4,1.5,1.18],[-.5,1.55,1.05],[.15,1.85,1.4],[2.8,1.7,1.25],[3.2,1.4,.98]],paint.body);
    engine(0,-.02,[[-4.35,.58,paint.underside],[-4.15,.6,paint.underside],[-4.08,.82,paint.wings],[-2.98,.82,paint.wings],[-2.72,.5,paint.underside]]);
    // Ring collars and spaced engine ribs, kept broad enough to read at racing scale.
    for(const z of [-4.04,-3.05])engine(0,-.02,[[z-.06,.845,paint.underside],[z+.06,.845,paint.underside]]);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;strut([.82*Math.cos(a),-.02+.82*Math.sin(a),-3.94],[.82*Math.cos(a),-.02+.82*Math.sin(a),-3.2],.025)}
    // Dorsal pod on a single rear swept pylon.
    hull(0,1.85,[[-2.55,.72,.65],[-2.1,1.15,.86],[.85,1.05,.8],[1.12,.86,.67]],paint.wings);
    support([0,.44,-1.25],[0,1.51,-1.65],1.05,.24);
    engine(0,1.85,[[-3.12,.28,paint.underside],[-2.94,.3,paint.underside],[-2.55,.23,paint.underside]]);
    // Twin lower cargo/drive pods, with open space between them and the hull.
    for(const side of [-1,1]){
      const x=side*1.18;
      hull(x,-1.05,[[-1.9,.62,.53],[-1.35,.88,.66],[2.2,.78,.57],[2.42,.66,.44]],paint.wings);
      support([side*.64,-.36,-.9],[x,-.85,-1.18],.8,.19);
      engine(x,-1.05,[[-2.18,.24,paint.underside],[-1.9,.22,paint.underside]]);
      // Front dark inset and thin accent stripe.
      box([x,-1.05,2.425],[.42,.23,.018],paint.canopy);
      box([x,-.75,1.9],[.56,.018,.09],paint.accent);
    }
    // Asymmetric cylindrical equipment pod on the starboard flank.
    engine(1.28,-.05,[[-1.95,.36,paint.underside],[-1.79,.38,paint.wings],[.6,.38,paint.wings],[.8,.29,paint.underside]]);
    // Close the equipment cylinder's forward end with a flush solid disc.
    face(Array.from({length:32},(_,i)=>{
      const angle=i/32*Math.PI*2;
      return [1.28+.29*Math.cos(angle),-.05+.29*Math.sin(angle),.801];
    }),paint.underside,[1.28,-.05,.6],3);
    support([.62,.08,-1.2],[1.28,.05,-1.4],.65,.2);
    // Large readable armour panels, a narrow cockpit slit, and sparse nose vents.
    for(const side of [-1,1]){
      for(const [z,length] of [[.65,.75],[1.65,.85]])box([side*.91,.04,z],[.025,.78,length],tint(paint.body,.91));
      box([side*.73,.33,2.98],[.025,.16,.27],paint.canopy);
      for(let j=0;j<3;j++)box([side*.82,.12-j*.17,2.62],[.025,.045,.3],paint.underside);
    }
    box([0,.66,2.55],[.75,.025,.28],paint.canopy);
    // Slim dorsal aerial and a short forward mast.
    hull(0,.97,[[1.2,.055,.58],[1.4,.055,.7]],paint.underside);
    strut([.5,.57,2.65],[.5,1.05,2.65],.025);
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
