// Ship 04: an authored twin-hull swept-wing racer, +Z forward. Shared fleet paint roles.
const Ship04=(()=>{
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
    // A broad, shallow wing with a crisp leading edge and softly filled faces.
    const plan=[[.95,1.35],[2.1,1.13],[5.7,-1.15],[5.18,-1.94],[2.5,-1.8],[.95,-1.25]];
    for(const side of [-1,1]){
      const centre=[side*2.7,.05,-.5];
      const perimeter=plan.map(([x,z])=>[side*x,.04,z]);
      const top=plan.map(([x,z])=>[side*(2.7+(x-2.7)*.95),.19,-.5+(z+.5)*.95]);
      const bottom=plan.map(([x,z])=>[side*(2.7+(x-2.7)*.97),-.13,-.5+(z+.5)*.97]);
      face(top,paint.wings,centre);face(bottom,paint.underside,centre);
      for(let i=0;i<plan.length;i++){const j=(i+1)%plan.length;face([perimeter[i],perimeter[j],top[j],top[i]],paint.wings,centre);face([bottom[i],bottom[j],perimeter[j],perimeter[i]],paint.underside,centre)}
      // A tapered trailing armour rail, blended straight into the wing.
      hull(side*3.3,.27,[[-1.94,1.42,.25],[-1.1,1.5,.3],[-.67,1.15,.2]],paint.body);
      box([side*3.32,.435,-1.26],[.75,.015,.31],tint(paint.body,.87));
      // Three compact tanks nestled between the central hull and outer rail.
      for(let j=0;j<3;j++){
        const tx=side*(1.62+j*.26);
        engine(tx,.24,[[-1.25,.115,paint.underside],[-1.14,.14,paint.accent],[-.48,.14,paint.accent],[-.37,.10,paint.underside]]);
        face(Array.from({length:20},(_,i)=>[tx+.10*Math.cos(i/20*Math.PI*2),.24+.10*Math.sin(i/20*Math.PI*2),-.365]),paint.underside,[tx,.24,-.6],3);
      }
      // Shallow circular service cover on the outer armour, without a glossy spot.
      const hx=side*4.37,hz=-1.24;
      for(const [radius,y,colour] of [[.29,.205,paint.underside],[.23,.21,paint.accent],[.15,.215,paint.body]]){
        face(Array.from({length:32},(_,i)=>[hx+radius*Math.cos(i/32*Math.PI*2),y,hz+radius*Math.sin(i/32*Math.PI*2)]),colour,[hx,0,hz],3);
      }
      // Small fin along the trailing rail; no exposed rod framework.
      hull(side*2.83,.43,[[-1.8,.065,.58],[-1.2,.075,.47],[-.77,.055,.12]],paint.underside);
      box([side*2.92,.224,-.22],[.65,.015,.07],paint.accent);
    }
    // Unified bevelled block, broad through the rear and subtly tapered at the nose.
    hull(0,.08,[[-1.435,1.8,1.05],[-1.155,2.5,1.55],[.805,2.15,1.4],[1.365,1.55,.95]],paint.body);
    // Single inset-style cockpit on the forward shoulder.
    box([0,.80,.595],[.58,.08,.42],paint.canopy);
    // One central rear jet with a sealed, palette-coloured exhaust face.
    hull(0,.08,[[-1.86,.9,.72],[-1.63,1.04,.84],[-1.22,1.14,.9]],paint.underside);
    face([[-.33,-.16,-1.872],[.33,-.16,-1.872],[.33,.32,-1.872],[-.33,.32,-1.872]],paint.accent,[0,.08,-1.5],4);
    // Stand the entire craft upright around its forward axis, including normals.
    for(let i=0;i<vertices.length;i+=10){
      const x=vertices[i],nx=vertices[i+3];
      vertices[i]=vertices[i+1];vertices[i+1]=-x;
      vertices[i+3]=vertices[i+4];vertices[i+4]=-nx;
    }
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
