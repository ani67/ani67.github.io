// Ship 08: three projecting forward prongs around a compact trailing body, +Z forward. Shared fleet paint roles.
const Ship08=(()=>{
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
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++)face([rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]],paint.underside,centre);
      face(rings[0],paint.underside,centre);face(rings.at(-1),paint.underside,centre);
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
    // Compact trailing body: the forward prongs now own the silhouette.
    hull(0,0,[[-2.85,.92,.57],[-2.28,1.40,.87],[-.72,1.66,1.04],[.44,1.31,.81],[.90,.88,.50]],paint.body);
    hull(0,-.33,[[-2.52,.83,.20],[-.85,1.41,.25],[.59,.77,.16]],paint.underside);
    // Aft cockpit stays behind the upper connector's mounting footprint.
    hull(0,.46,[[-2.30,.48,.12],[-1.80,.66,.25],[-1.05,.54,.18],[-.85,.26,.06]],paint.canopy);
    for(const side of [-1,1]) {
      box([side*.59,.32,-1.56],[.10,.09,1.12],paint.wings);
      for(let i=0;i<3;i++)box([side*.73,.13,-1.65+i*.29],[.07,.10,.10],paint.underside);
    }
    // Shorten the central body and its fitted details by 30% along its length.
    for(let i=2;i<vertices.length;i+=10)vertices[i]*=.70;
    // Inverse-transpose correction preserves the lighting after the length change.
    for(let i=3;i<vertices.length;i+=10){const n=norm([vertices[i],vertices[i+1],vertices[i+2]/.70]);vertices.splice(i,3,...n);}
    function prong(x,y,angle,front) {
      const begin=vertices.length;
      // Bevelled rectangular arms, slightly fuller toward the broad capped noses.
      hull(0,0,[[.42,.62,1.05],[.94,.79,1.39],[front-.37,.90,1.51],[front,.77,1.35]],paint.body);
      hull(0,0,[[front-.43,.925,1.535],[front-.26,.925,1.535]],paint.wings);
      // Solid front armour, not an exhaust: a recessed panel with a narrow sensor slit.
      hull(0,0,[[front+.008,.61,1.15],[front+.026,.61,1.15]],paint.wings);
      box([0,.16,front+.044],[.39,.075,.025],paint.canopy);
      box([0,-.32,front+.047],[.21,.045,.025],paint.underside);
      // Slim top service plate and a pair of restrained side markings.
      box([0,.697,(front+1.1)/2],[.37,.025,.69],tint(paint.body,.90));
      for(const side of [-1,1])box([side*.393,0,front-.67],[.028,.34,.09],paint.wings);
      // Each arm has its own recessed, capped rear nozzle.
      hull(0,0,[[.23,.55,.91],[.34,.67,1.07],[.53,.60,1.00]],paint.underside);
      hull(0,0,[[.29,.68,1.08],[.35,.68,1.08]],paint.wings);
      const cap=[[.21,-.29],[.14,-.39],[-.14,-.39],[-.21,-.29],[-.21,.29],[-.14,.39],[.14,.39],[.21,.29]].map(([px,py])=>[px,py,.215]);
      face(cap,paint.accent,[0,0,.8],4);
      const c=Math.cos(angle),sn=Math.sin(angle);
      for(let i=begin;i<vertices.length;i+=10) {
        const px=vertices[i],py=vertices[i+1],nx=vertices[i+3],ny=vertices[i+4];
        vertices[i]=x+px*c-py*sn; vertices[i+1]=y+px*sn+py*c;
        vertices[i+3]=nx*c-ny*sn; vertices[i+4]=nx*sn+ny*c;
      }
    }
    // One upper arm and a lower pair, with open space between all three.
    prong(0,1.72,0,3.35);
    prong(-1.66,-.79,-.55,4.03);
    prong(1.66,-.79,.55,4.03);
    // One swept airfoil connector per arm; no second brace closes the gaps.
    support([0,.32,.10],[0,1.72,.88],.78,.28);
    support([-.55,-.12,-.28],[-1.66,-.79,.72],.91,.28);
    support([.55,-.12,-.28],[1.66,-.79,.72],.91,.28);
    return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
  }
  return {build,paintForWorld};
})();
