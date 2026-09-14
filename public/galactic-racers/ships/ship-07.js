// Ship 07: a split-nose twin-engine racer, +Z forward. Shared fleet paint roles.
const Ship07=(()=>{
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
    function wing(plan,side,height,thickness,colour){
      const centre=[side*plan.reduce((s,p)=>s+p[0],0)/plan.length,height,plan.reduce((s,p)=>s+p[1],0)/plan.length];
      const edge=plan.map(([x,z])=>[side*x,height,z]);
      const ring=offset=>plan.map(([x,z])=>[centre[0]+(side*x-centre[0])*.95,height+offset,centre[2]+(z-centre[2])*.95]);
      const upper=ring(thickness/2),lower=ring(-thickness/2);
      face(upper,colour,centre,2);face(lower,colour,centre,2);
      for(let i=0;i<plan.length;i++){const j=(i+1)%plan.length;face([edge[i],edge[j],upper[j],upper[i]],colour,centre,2);face([lower[i],lower[j],edge[j],edge[i]],colour,centre,2)}
    }
    // Two broad wedge noses surround a recessed centre spine.
    hull(0,-.12,[[-1.45,2.1,.48],[.3,2.25,.4],[3.3,1.45,.18]],paint.underside);
    for(const side of [-1,1]) {
      hull(side*.79,0,[[-1.4,1.25,.55],[-.35,1.55,.72],[1.5,1.28,.42],[3.55,.98,.19]],paint.body);
      // Flush front intake and a narrow bumper on each nose.
      box([side*.79,-.01,3.56],[.72,.09,.035],paint.underside);
      for(let i=0;i<5;i++)box([side*.79+(i-2)*.115,-.008,3.585],[.026,.08,.025],paint.accent);
      box([side*1.23,-.12,2.15],[.10,.12,2.35],paint.wings);
    }
    // A short bevelled cockpit rises from the central armoured shoulder.
    hull(0,.36,[[-1.28,1.50,.48],[-.55,1.42,.78],[.45,1.12,.64],[1.35,.92,.23]],paint.body);
    hull(0,.64,[[-.62,1.14,.35],[-.35,1.18,.45],[.51,.91,.32],[1.05,.74,.10]],paint.canopy);
    box([0,.885,-.4],[.06,.025,.4],paint.body);
    box([0,.32,1.76],[.20,.025,.42],paint.wings);
    // Rear spar ties the engine nacelles and wings together.
    box([0,.10,-1.27],[4.65,.22,.53],paint.wings);
    for(const side of [-1,1]) {
      const x=side*2.03,y=.45;
      engine(x,y,[[-2.35,.49,paint.underside],[-2.13,.64,paint.underside],[-1.75,.67,paint.underside],[-1.57,.76,paint.wings],[.57,.76,paint.wings],[.78,.8,paint.body],[.88,.71,paint.body]]);
      // Recessed dark intake, concentric inner lip and a single horizontal vane.
      face(Array.from({length:32},(_,i)=>[x+.695*Math.cos(i/32*Math.PI*2),y+.695*Math.sin(i/32*Math.PI*2),.77]),paint.underside,[x,y,0],3);
      for(let i=0;i<32;i++) {
        const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;
        face([[x+.71*Math.cos(a),y+.71*Math.sin(a),.89],[x+.71*Math.cos(b),y+.71*Math.sin(b),.89],[x+.60*Math.cos(b),y+.60*Math.sin(b),.84],[x+.60*Math.cos(a),y+.60*Math.sin(a),.84]],paint.wings,[x,y,0],2);
      }
      box([x,y,.865],[1.23,.11,.14],paint.body);
      // Narrow bands and rear cooling ribs follow the engine's curvature.
      for(const z of [-1.35,-.18]) {
        for(let i=0;i<24;i++) {
          const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;
          face([[x+.772*Math.cos(a),y+.772*Math.sin(a),z-.035],[x+.772*Math.cos(b),y+.772*Math.sin(b),z-.035],[x+.772*Math.cos(b),y+.772*Math.sin(b),z+.035],[x+.772*Math.cos(a),y+.772*Math.sin(a),z+.035]],tint(paint.wings,.78),[x,y,z],2);
        }
      }
      for(let i=0;i<12;i++) {
        const angle=i/12*Math.PI*2;
        box([x+.65*Math.cos(angle),y+.65*Math.sin(angle),-1.97],[.08,.08,.45],paint.underside);
      }
      wing([[2.48,-.2],[3.10,-.39],[5.80,-1.22],[5.9,-2.32],[2.40,-1.73]],side,.08,.16,paint.body);
      box([side*4.05,.18,-1.3],[1.35,.025,.43],tint(paint.body,.9));
      hull(side*5.73,.16,[[-2.50,.26,.25],[-1.65,.37,.39],[-.95,.25,.22],[-.48,.10,.11]],paint.wings);
      // Slim wingtip sensor instead of a weapon turret.
      hull(side*5.73,.14,[[-.54,.09,.09],[.20,.065,.065],[.34,.03,.03]],paint.underside);
      box([side*5.62,.32,-2.08],[.045,.28,.59],paint.wings);
    }
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
