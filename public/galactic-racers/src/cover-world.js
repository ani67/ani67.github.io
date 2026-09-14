// A quiet, bounded valley for the home screen, independent of race generation.
const CoverWorld = (() => {
  function heightAt(x,z) {
    const centre = Math.sin(z*.009)*9;
    const distance = Math.abs(x-centre);
    const rise = Math.max(0,distance-28);
    const ridge = Math.pow(rise,.92)*.8;
    const folds = .72 + .22*Math.sin(z*.026+x*.015) + .13*Math.cos(z*.049-x*.029);
    const back = Math.max(0,-z-145)*.24;
    return ridge*folds + back + Math.min(1,rise/20)*Math.sin(x*.09+z*.07)*2;
  }
  function build() {
    const verts=[],idx=[],N=112,extent=280,step=extent*2/N;
    const point=(x,z)=>[x,heightAt(x,z),z];
    function triangle(a,b,c) {
      const n=M.norm(M.cross(M.sub(b,a),M.sub(c,a)));
      const h=(a[1]+b[1]+c[1])/3;
      const rock=M.smoothstep(20,95,h)*.7;
      const meadow=[.3,.36,.23],stone=[.43,.43,.36];
      const facet = .86 + .14*Math.max(0,n[1]);
      const col=meadow.map((v,i)=>(v*(1-rock)+stone[i]*rock)*facet);
      const start=verts.length/12;
      for(const p of [a,b,c]) verts.push(...p,...n,col[0],col[1],3,10,col[2],2);
      idx.push(start,start+1,start+2);
    }
    for(let z=0;z<N;z++)for(let x=0;x<N;x++) {
      const xx=-extent+x*step,zz=-extent+z*step;
      const a=point(xx,zz),b=point(xx+step,zz),c=point(xx,zz+step),d=point(xx+step,zz+step);
      triangle(a,c,b);triangle(b,c,d);
    }
    return {verts:new Float32Array(verts),idx:new Uint32Array(idx)};
  }
  function descriptor(source) {
    return {...source,sky:[[.46,.53,.55],[.66,.73,.75]],sunDir:[-.45,.75,.4],fog:.0018,stars:0,
      pal5:[[.13,.18,.15],[.22,.29,.2],[.3,.36,.23],[.43,.43,.36],[.63,.64,.57]],
      emis:[0,0,0],biome:{},waterLevel:-10000,bandAmt:0,
      look:{...source.look,colormap:0,dither:.04,edge:.18,posterize:.08}};
  }
  return {build,descriptor,heightAt};
})();
