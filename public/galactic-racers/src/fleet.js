// Reviewed visual fleet. Paint IDs travel with craft choices, never with race terrain.
const Fleet=(()=>{
  const models=[Ship01,Ship02,Ship03,Ship04,Ship05,Ship06,Ship07,Ship08];
  const names=['Retro saucer','Industrial tug','Orbital racer','Splitwing','Twinfin','Longtail','Twinjet','Trijet'];
  const families=['falcon','manta','needle','hulk','dune','prism','twinjet','trijet'];
  // Small silhouette corrections: sparse/thin craft get more span, dense Twinfin less.
  const visualScales=[1,1.12,1.08,1.12,.92,1.12,1.05,1];
  const entries=names.map((name,i)=>({id:'ship-'+String(i+1).padStart(2,'0'),name,visualScale:visualScales[i],family:families[i],raceIndex:i,defaultPaint:[2,3,8,1,6,15,4,5][i]}));
  const paints=[{id:1,name:'Greyscale'},...Planets.PLANETS.map((p,i)=>({id:i+2,name:p.name,planet:p.id}))];
  const palettes=new Map();
  function entry(id){return entries.find(e=>e.id===id)||entries[0]}
  function forRace(race){return (race?.id==='twinjet'?entries[6]:race?.id==='trijet'?entries[7]:entries.find(e=>e.family===race?.vehicle))||entries[0]}
  function paintId(value){return Number.isInteger(value)&&value>=1&&value<=paints.length+PALETTES.length?value:1}
  function paintName(id){return paints.find(p=>p.id===id)?.name||'Palette '+(paintId(id)-paints.length)}
  function worldForPaint(value){
    const id=paintId(value);if(palettes.has(id))return palettes.get(id);
    const p=paints.find(p=>p.id===id);
    const world=id===1?{pal5:[.12,.3,.48,.68,.88].map(v=>[v,v,v])}:World.generate('Solar-Orbit-188',Planets.planet(p?.planet||'embervale'),p?{}:{palIdx:id-paints.length-1});
    palettes.set(id,world);return world;
  }
  function recipe(id,paint=1){return {fleetId:entry(id).id,paint:paintId(paint),hull:{type:'box',len:4.4,w:1.8,h:1},parts:[],role:'junker'}}
  function build(rec){
    const e=entry(rec.fleetId),source=models[entries.indexOf(e)].build(worldForPaint(rec.paint));
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<source.vertices.length;i+=10)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],source.vertices[i+k]);hi[k]=Math.max(hi[k],source.vertices[i+k])}
    const pattern=entries.indexOf(e)+1;
    const scale=6*e.visualScale/Math.max(...hi.map((x,k)=>x-lo[k])),centre=lo.map((x,k)=>(x+hi[k])/2);
    const verts=new Float32Array(source.vertices.length/10*12);
    for(let i=0,j=0;i<source.vertices.length;i+=10,j+=12){
      const v=source.vertices;const region=v[i+9];
      const ripple=(region===0||region===5)?1+.003*Math.sin(v[i]*8.1)*Math.sin(v[i+1]*7.3+v[i+2]*4.7):1;
      for(let k=0;k<3;k++)verts[j+k]=(v[i+k]-centre[k])*scale*ripple;
      verts.set(v.subarray(i+3,i+6),j+3);
      // New part 10 packs vertex RGB in UV.xy and ex.z; ex.w carries the surface region.
      verts.set([v[i+6],v[i+7],3,10,v[i+8],v[i+9]+(rec.paint===1?100:0)+pattern*1000],j+6);
    }
    return {verts,idx:source.indices,recipe:rec,tris:source.indices.length/3};
  }
  return {entries,paints,entry,forRace,paintId,paintName,worldForPaint,recipe,build};
})();
