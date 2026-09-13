// A real fleet mesh above the title. Render only when shown/resized, not every game frame.
(() => {
  const canvas = document.getElementById('coverShip');
  if (!canvas) return;
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!gl) return;
  const vertex = `#version 300 es
  in vec3 position; in vec3 normal; in vec3 colour; in float surface; uniform mat4 vp;
  out vec3 N; out vec3 C; out vec3 P; flat out int region;
  void main(){N=normal;C=colour;P=position*.6276;region=int(surface+.5);gl_Position=vp*vec4(position,1.);}`;
  const fragment = `#version 300 es
  precision highp float; in vec3 N; in vec3 C; in vec3 P; flat in int region; out vec4 color;
  float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){float l=dot(normalize(N),normalize(vec3(-.4,.8,.6)));
    vec3 base=C;
    // Match the Longtail's static hull treatment in the racing renderer.
    if(region==0||region==5){
      vec3 an=abs(N);vec2 uv=an.x>max(an.y,an.z)?P.zy:(an.y>an.z?P.xz:P.xy);
      vec2 cells=uv*1.4,local=fract(cells),edge=min(local,1.-local);
      float aa=max(max(fwidth(cells.x),fwidth(cells.y)),.004);
      float seam=1.-smoothstep(.012,.012+aa,min(edge.x,edge.y));
      float panelTone=(hash21(floor(cells))-.5)*.12;
      float ribs=-.07*smoothstep(.91,.98,sin(uv.y*22.));
      float marking=step(.77,hash21(floor(cells)+17.))*step(.13,local.x)*step(local.x,.36)*step(.16,local.y)*step(local.y,.20);
      base*=1.+ribs+panelTone-seam*.24;
      base=mix(base,vec3(.88,.89,.86),marking*.7);
    }
    vec3 shade=base*vec3(.50,.57,.70)+vec3(.015,.019,.028);
    vec3 bright=min(base*vec3(1.08,1.04,.95)+vec3(.025,.02,.012),vec3(1.));
    vec3 paint=mix(shade,base,smoothstep(.10,.14,l));
    paint=mix(paint,bright,smoothstep(.72,.76,l)*.8);
    if(region==4)paint=base;
    color=vec4(paint,1.);}`;
  function shader(type, source) {
    const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  try {
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const mesh=Ship06.build(null,{body:[.78,.83,.85],wings:[.91,.27,.09],canopy:[.025,.055,.075],underside:[.15,.20,.24],accent:[.3,.85,1]});
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
    for (const [i,name] of ['position','normal','colour'].entries()) {const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,40,i*12);}
    const surface=gl.getAttribLocation(program,'surface');gl.enableVertexAttribArray(surface);gl.vertexAttribPointer(surface,1,gl.FLOAT,false,40,36);
    const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
    const vp=gl.getUniformLocation(program,'vp');gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    function draw(){
      const box=canvas.getBoundingClientRect();if(!box.width||!box.height||document.hidden)return;
      const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
      gl.viewport(0,0,canvas.width,canvas.height);
      const matrix=M.mul4(M.perspective(.55,box.width/box.height,.1,100),M.lookAt([6,12,-13],[0,0,1],[.15,1,0]));
      gl.uniformMatrix4fv(vp,false,matrix);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_INT,0);
    }
    new ResizeObserver(draw).observe(canvas);
    document.addEventListener('visibilitychange',draw);
  } catch(e) { console.warn('Cover ship unavailable:',e); canvas.hidden=true; }
})();
