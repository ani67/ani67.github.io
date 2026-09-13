// A real fleet mesh above the title. Render only when shown/resized, not every game frame.
(() => {
  const canvas = document.getElementById('coverShip');
  if (!canvas) return;
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!gl) return;
  const vertex = `#version 300 es
  in vec3 position; in vec3 normal; in vec3 colour; uniform mat4 vp;
  out vec3 N; out vec3 C;
  void main(){N=normal;C=colour;gl_Position=vp*vec4(position,1.);}`;
  const fragment = `#version 300 es
  precision highp float; in vec3 N; in vec3 C; out vec4 color;
  void main(){float l=dot(normalize(N),normalize(vec3(-.4,.8,.6)));
    vec3 shade=C*vec3(.48,.55,.66);vec3 bright=min(C*1.08+.035,vec3(1.));
    vec3 paint=mix(shade,C,smoothstep(.08,.18,l));
    color=vec4(mix(paint,bright,smoothstep(.7,.8,l)),1.);}`;
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
    const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
    const vp=gl.getUniformLocation(program,'vp');gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    function draw(){
      const box=canvas.getBoundingClientRect();if(!box.width||!box.height||document.hidden)return;
      const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
      gl.viewport(0,0,canvas.width,canvas.height);
      const matrix=M.mul4(M.perspective(.55,box.width/box.height,.1,100),M.lookAt([-4,11,-12],[0,0,1],[-.15,1,0]));
      gl.uniformMatrix4fv(vp,false,matrix);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_INT,0);
    }
    new ResizeObserver(draw).observe(canvas);
    document.addEventListener('visibilitychange',draw);
  } catch(e) { console.warn('Cover ship unavailable:',e); canvas.hidden=true; }
})();
