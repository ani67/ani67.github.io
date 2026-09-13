// Ship 06: an authored long-nose delta racer, +Z forward. Shared fleet paint roles.
const Ship06=(()=>{
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
    // Long tapered fuselage: widest at the rear, fine bevelled nose at +Z.
    hull(0,0,[[-3.22,1.1,.62],[-2.72,1.58,.94],[-1.8,1.47,.92],[.2,.97,.7],[2.6,.61,.48],[4.8,.32,.3],[5.9,.12,.16]],paint.body);
    // A raised narrow cockpit fairing integrated into the upper spine.
    hull(0,.36,[[-.5,.52,.24],[.2,.56,.36],[1.45,.39,.28],[2.05,.19,.12]],paint.body);
    hull(0,.53,[[.12,.35,.12],[.42,.39,.17],[1.32,.25,.11],[1.6,.10,.05]],paint.canopy);
    // Long inset nose panel: a solid material region, not a reflective spot.
    hull(0,.17,[[3.48,.28,.10],[4.7,.22,.095],[5.45,.10,.05]],paint.underside);
    function wing(plan,side,height,thickness,colour){
      const centre=[side*plan.reduce((s,p)=>s+p[0],0)/plan.length,height,plan.reduce((s,p)=>s+p[1],0)/plan.length];
      const edge=plan.map(([x,z])=>[side*x,height,z]);
      const ring=offset=>plan.map(([x,z])=>[centre[0]+(side*x-centre[0])*.95,height+offset,centre[2]+(z-centre[2])*.95]);
      const upper=ring(thickness/2),lower=ring(-thickness/2);
      face(upper,colour,centre,2);face(lower,colour,centre,2);
      for(let i=0;i<plan.length;i++){const j=(i+1)%plan.length;face([edge[i],edge[j],upper[j],upper[i]],colour,centre,2);face([lower[i],lower[j],edge[j],edge[i]],colour,centre,2)}
    }
    for(const side of [-1,1]){
      // Broad aft delta wings with clipped tips and a slim bevelled section.
      wing([[.4,1.15],[.85,.55],[1.94,-1.36],[2.88,-1.82],[2.74,-2.65],[.43,-2.88]],side,-.10,.19,paint.wings);
      // Short forward canards, without pylons or gun barrels.
      wing([[.26,2.0],[1.0,1.55],[.96,1.3],[.28,1.46]],side,.03,.075,paint.wings);
      // Low rear shoulder fairings and one short upright stabiliser on each wing.
      hull(side*.64,.02,[[-3.1,.35,.40],[-2.5,.44,.53],[-1.45,.26,.26]],paint.body);
      hull(side*2.22,.13,[[-2.56,.055,.48],[-2.14,.07,.57],[-1.83,.04,.07]],paint.wings);
      box([side*2.77,-.1,-2.22],[.035,.10,.22],paint.underside);
      // Sparse flush service panel on the broad wing, retaining its single paint shade.
      box([side*1.29,.006,-1.72],[.32,.015,.49],tint(paint.wings,.91));
    }
    // One centreline exhaust recessed into the rear body, with an opaque indicator.
    engine(0,-.06,[[-3.65,.34,paint.underside],[-3.49,.43,paint.underside],[-3.07,.39,paint.underside],[-2.9,.28,paint.body]]);
    face(Array.from({length:32},(_,i)=>[.34*Math.cos(i/32*Math.PI*2),-.06+.34*Math.sin(i/32*Math.PI*2),-3.66]),paint.accent,[0,-.06,-3.2],4);
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
