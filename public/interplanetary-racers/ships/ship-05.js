// Ship 05: an authored twin-fin capsule fighter, +Z forward. Shared fleet paint roles.
const Ship05=(()=>{
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
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++)face([rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]],paint.wings,centre);
      face(rings[0],paint.wings,centre);face(rings.at(-1),paint.wings,centre);
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
    // Three blocks along the forward axis: 2.4-unit front, flat neck, 0.4-unit rear.
    // The broad rear block is exactly one sixth of the front block's length.
    hull(0,0,[[-.6,1.32,1.08],[-.42,1.62,1.32],[1.58,1.62,1.32],[1.8,1.30,1.06]],paint.body);
    hull(0,0,[[-.95,1.1,.62],[-.6,1.1,.62]],paint.body);
    hull(0,0,[[-1.35,1.4,1.16],[-1.28,1.68,1.4],[-1.02,1.68,1.4],[-.95,1.4,1.16]],paint.body);
    box([0,.15,1.805],[.62,.27,.018],paint.canopy);
    // Tall rounded rectangular endplates, with gently filled faces and thin edges.
    const outline=Array.from({length:64},(_,i)=>{
      const a=i/64*Math.PI*2,rounded=v=>Math.sign(v)*Math.pow(Math.abs(v),.38);
      return [2.32*rounded(Math.cos(a)),1.0*rounded(Math.sin(a))-.37];
    });
    for(const side of [-1,1]){
      const x=side*2.12;
      for(const faceSide of [-1,1]){
        const sections=[[1,0],[.975,.055],[.91,.115],[.74,.145]];
        const rings=sections.map(([scale,offset])=>outline.map(([y,z])=>[x+faceSide*offset,y*scale,-.37+(z+.37)*scale]));
        const inside=[x,0,-.37];
        for(let j=0;j<rings.length-1;j++)for(let i=0;i<64;i++){const k=(i+1)%64;face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],paint.wings,inside,2)}
        face(rings.at(-1),paint.wings,inside,2);
      }
      // One broad airfoil connector per side, blended into the body and endplate.
      support([side*.58,-.06,-.33],[x,-.06,-.48],1.35,.46);
      // Minimal running lights on the tips, with no contrasting bands on the panels.
      for(const y of [-1.87,1.87])box([x,y,.63],[.17,.11,.055],paint.accent);
    }
    // Two stacked rear engines tucked into the stepped body, each with an opaque face.
    for(const y of [-.37,.37]){
      engine(0,y,[[-2.12,.30,paint.underside],[-1.98,.36,paint.underside],[-1.58,.32,paint.body],[-1.20,.26,paint.body]]);
      face(Array.from({length:32},(_,i)=>[.30*Math.cos(i/32*Math.PI*2),y+.30*Math.sin(i/32*Math.PI*2),-2.135]),paint.accent,[0,y,-1.8],4);
    }
    // Short swept dorsal fin on the rear block.
    hull(0,.77,[[-1.25,.06,.45],[-.92,.065,.58],[-.68,.05,.1]],paint.wings);
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
