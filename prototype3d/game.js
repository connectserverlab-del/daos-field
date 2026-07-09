/* DAO'S FIELD — Human World I. Explorable cinematic 3D vertical slice.
   Plain script (uses global THREE r128 + vendored postprocessing). */
(function () {
"use strict";
var STR = window.STR;
var $ = function (id) { return document.getElementById(id); };
var TAU = Math.PI * 2;

/* ---------------- deterministic noise (seeded) ---------------- */
function hash2(x, z){ var s = Math.sin(x*127.1 + z*311.7)*43758.5453; return s - Math.floor(s); }
function vnoise(x, z){
  var xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  var a=hash2(xi,zi), b=hash2(xi+1,zi), c=hash2(xi,zi+1), d=hash2(xi+1,zi+1);
  var u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
function fbm(x, z){ var t=0,a=0.5,f=1; for(var i=0;i<4;i++){ t+=a*vnoise(x*f,z*f); f*=2; a*=0.5; } return t; }
function smoothstep(a,b,x){ x=(x-a)/(b-a); x=x<0?0:x>1?1:x; return x*x*(3-2*x); }

/* World scale: a wide explorable valley (was a small 1200 bowl). */
var WORLD = 2000;            // terrain plane size
var HALF  = WORLD/2;         // 1000
var PLAY  = 840;             // how far the player may roam from centre
var WATER_Y = -1.4;
var VILLAGE = { x: 175, z: 165, r: 105 };   // flat plateau the village sits on

/* Raw landform before local flattening. */
function baseHeight(x, z){
  var n = fbm(x*0.0032+3, z*0.0032+9)*30;            // broad landforms
  n += fbm(x*0.0075+11, z*0.0075+7)*15;              // rolling hills
  n += fbm(x*0.030, z*0.030)*3.2;                    // fine detail
  var r = Math.sqrt(x*x + z*z);
  n += Math.pow(Math.min(r,980)/720, 2.4)*160;       // distant rim rises (pushed far out)
  var river = Math.exp(-(x*x)/(2*26*26));            // gaussian channel along z
  n -= river*10.0;
  return n;
}
/* Valley heightfield with a flattened village plateau. */
function heightAt(x, z){
  var n = baseHeight(x, z);
  var vd = Math.hypot(x-VILLAGE.x, z-VILLAGE.z);
  var k = 1 - smoothstep(VILLAGE.r*0.5, VILLAGE.r*1.3, vd);
  if (k>0){ var plat = baseHeight(VILLAGE.x, VILLAGE.z) + 0.5; n = n*(1-k) + plat*k; }
  return n;
}

/* ---------------- palette / config ---------------- */
var SUN_DIR = new THREE.Vector3(-0.5, 0.55, -0.75).normalize();
var FOG_COL = new THREE.Color(0x9fb2b8);
var RACE = {
  human:       { robe:0xcdba90, aura:0x3a7ae8, name:"Human" },
  beast:       { robe:0x8a6a3a, aura:0xe0483a, name:"Beast" },
  spirit_beast:{ robe:0xbcc9c6, aura:0x3ac9c0, name:"Spirit Beast" },
  monster:     { robe:0x2f2733, aura:0x9b4ce8, name:"Monster" }
};
var chosen = "human";

/* ---------------- three basics ---------------- */
var renderer, scene, camera, composer, bloom, fxaa, sun, sky, water, playerObj, auraRing, hemiLight, ambLight;
var clock = { last: 0 };
var tex = {};
var grassMat, waterMat;
var poiList = [];
var loaded = { need: 0, done: 0 };

function makeRenderer(){
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
}

/* soft radial sprite texture (mist, glow, shadow) built procedurally */
function radialTex(inner, outer){
  var c=document.createElement("canvas"); c.width=c.height=128; var g=c.getContext("2d");
  var grd=g.createRadialGradient(64,64,0,64,64,64);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle=grd; g.fillRect(0,0,128,128);
  var t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}
/* grass-clump alpha texture — a dense bushy tuft of tapered blades (not lone sticks) */
function grassTex(){
  var W=128,H=96, c=document.createElement("canvas"); c.width=W; c.height=H; var g=c.getContext("2d");
  g.clearRect(0,0,W,H);
  var N=26;
  for(var i=0;i<N;i++){
    var base=10+Math.random()*(W-20);
    var bh=H*(0.55+Math.random()*0.45);          // blade height (some short, some tall)
    var lean=(Math.random()*2-1)*22;
    var tipx=base+lean;
    var wob=(Math.random()*2-1)*8;
    // colour: muted natural greens, darker at the root (avoids a neon look)
    var hue=90+Math.random()*38, light=24+Math.random()*15;
    var wbtm=3.4+Math.random()*2.4;
    // tapered blade as a filled triangle-ish quad
    g.beginPath();
    g.moveTo(base-wbtm, H);
    g.quadraticCurveTo(base+wob-wbtm*0.5, H-bh*0.55, tipx-0.6, H-bh);
    g.quadraticCurveTo(base+wob+wbtm*0.5, H-bh*0.55, base+wbtm, H);
    g.closePath();
    var grd=g.createLinearGradient(0,H,0,H-bh);
    grd.addColorStop(0,"hsl("+(hue-8)+",45%,"+(light*0.55)+"%)");
    grd.addColorStop(1,"hsl("+hue+",58%,"+light+"%)");
    g.fillStyle=grd; g.fill();
  }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.minFilter=THREE.LinearMipmapLinearFilter;
  t.needsUpdate=true; return t;
}

/* ---------------- sky ---------------- */
function makeSky(){
  var uni = {
    top:{value:new THREE.Color(0x2766a8)}, mid:{value:new THREE.Color(0x8fbbe0)},
    bot:{value:new THREE.Color(0xc0d8ec)}, sun:{value:SUN_DIR.clone()}
  };
  var mat = new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, uniforms:uni,
    vertexShader:"varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec3 vD; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun;"+
      "void main(){ float h=clamp(vD.y*0.5+0.5,0.0,1.0);"+
      "vec3 col = mix(bot, mid, smoothstep(0.32,0.5,h)); col = mix(col, top, smoothstep(0.5,0.9,h));"+
      "float s = pow(max(dot(normalize(vD),normalize(sun)),0.0), 8.0);"+
      "col += vec3(1.0,0.85,0.6)*s*0.6;"+
      "float halo = pow(max(dot(normalize(vD),normalize(sun)),0.0), 2.0)*0.25;"+
      "col += vec3(1.0,0.8,0.55)*halo;"+
      "gl_FragColor=vec4(col,1.0);}"
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16), mat);
  scene.add(sky);
  // photoreal cloud band around the horizon (4K sky texture) over the gradient dome
  if (tex.sky){
    tex.sky.wrapS = THREE.RepeatWrapping; tex.sky.encoding = THREE.sRGBEncoding;
    var band = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 820, 64, 1, true),
      new THREE.MeshBasicMaterial({ map:tex.sky, side:THREE.BackSide, fog:false, depthWrite:false, transparent:true, opacity:0.5 }));
    band.position.y = 150; scene.add(band);
  }
  // layered misty-mountain backdrop (C-drama atmospheric depth) sitting on the horizon
  if (tex.mist){
    tex.mist.wrapS = THREE.RepeatWrapping; tex.mist.encoding = THREE.sRGBEncoding;
    var mb = new THREE.Mesh(new THREE.CylinderGeometry(1300, 1300, 360, 96, 1, true),
      new THREE.MeshBasicMaterial({ map:tex.mist, side:THREE.BackSide, fog:false, depthWrite:false, transparent:true, opacity:0.9 }));
    mb.position.y = 55; scene.add(mb);
    var mb2 = new THREE.Mesh(new THREE.CylinderGeometry(900, 900, 260, 96, 1, true),
      new THREE.MeshBasicMaterial({ map:tex.mist, side:THREE.BackSide, fog:false, depthWrite:false, transparent:true, opacity:0.55 }));
    mb2.rotation.y = 1.7; mb2.position.y = 30; scene.add(mb2);
  }
  // sun sprite (bloom picks it up as god-ray source)
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:radialTex("rgba(255,244,214,1)","rgba(255,220,150,0)"),
    color:0xffffff, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false }));
  sp.scale.set(340,340,1); sp.position.copy(SUN_DIR.clone().multiplyScalar(1400)); scene.add(sp);
}

/* ---------------- terrain ---------------- */
function makeTerrain(){
  var SZ=WORLD, SEG=420;
  var geo = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG);
  geo.rotateX(-Math.PI/2);
  var pos = geo.attributes.position;
  for (var i=0;i<pos.count;i++){ pos.setY(i, heightAt(pos.getX(i), pos.getZ(i))); }
  geo.computeVertexNormals();
  if (tex.grass){ tex.grass.wrapS=tex.grass.wrapT=THREE.RepeatWrapping; tex.grass.repeat.set(110,110); }
  if (tex.dirt){ tex.dirt.wrapS=tex.dirt.wrapT=THREE.RepeatWrapping; }
  if (tex.rock){ tex.rock.wrapS=tex.rock.wrapT=THREE.RepeatWrapping; }
  grassMat = new THREE.MeshStandardMaterial({ map:tex.grass||null, normalMap:tex.grassN||null, roughness:1, metalness:0 });
  if (grassMat.normalMap) grassMat.normalScale.set(0.6,0.6);
  // PBR splat: blend grass / dirt / rock by slope, altitude and macro noise
  grassMat.onBeforeCompile = function(sh){
    sh.uniforms.tDirt = { value: tex.dirt||tex.grass };
    sh.uniforms.tRock = { value: tex.rock||tex.grass };
    sh.vertexShader = "varying float vWy; varying vec2 vWXZ; varying float vUp;\n" +
      sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n vec4 _wp=modelMatrix*vec4(transformed,1.0); vWy=_wp.y; vWXZ=_wp.xz; vUp=normalize(mat3(modelMatrix)*objectNormal).y;");
    sh.fragmentShader = "uniform sampler2D tDirt; uniform sampler2D tRock; varying float vWy; varying vec2 vWXZ; varying float vUp;\n" +
      sh.fragmentShader.replace("#include <map_fragment>",
        "#ifdef USE_MAP\n" +
        // sample each texture at two scales and blend by macro noise → kills obvious tiling
        " vec3 gcol = mix(texture2D( map, vUv ).rgb, texture2D( map, vUv*0.237+0.19 ).rgb, 0.5);\n" +
        " vec3 dcol = mix(texture2D( tDirt, vUv ).rgb, texture2D( tDirt, vUv*0.31+0.4 ).rgb, 0.5);\n" +
        " vec3 rcol = mix(texture2D( tRock, vUv*0.55 ).rgb, texture2D( tRock, vUv*0.17 ).rgb, 0.5);\n" +
        " float m = sin(vWXZ.x*0.03)*0.5 + sin(vWXZ.y*0.025+1.7)*0.5; m = m*0.5+0.5;\n" +
        " float steep = 1.0 - smoothstep(0.60, 0.82, vUp);\n" +
        " float high  = smoothstep(24.0, 46.0, vWy);\n" +
        " float low   = smoothstep(1.5, -1.4, vWy);\n" +
        " vec3 base = mix(gcol, dcol, clamp(low + m*0.16, 0.0, 1.0));\n" +
        " base = mix(base, rcol, clamp(max(steep, high), 0.0, 1.0));\n" +
        " base *= (0.9 + 0.13*m);\n" +
        " diffuseColor.rgb *= base;\n" +
        "#endif\n");
  };
  grassMat.customProgramCacheKey = function(){ return "daoTerrainSplat"; };
  var mesh = new THREE.Mesh(geo, grassMat); mesh.receiveShadow = true; scene.add(mesh);
}

/* ---------------- water ---------------- */
function makeWater(){
  waterMat = new THREE.ShaderMaterial({
    transparent:true, uniforms:{ t:{value:0}, sky:{value:new THREE.Color(0xcbe8f4)}, deep:{value:new THREE.Color(0x1c5563)} },
    vertexShader:"varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec3 vP; uniform float t; uniform vec3 sky; uniform vec3 deep;"+
      "void main(){ float r=sin(vP.x*0.3+t)*0.5+cos(vP.y*0.35-t*1.3)*0.5;"+
      "float f=smoothstep(-1.0,1.0,r); vec3 c=mix(deep,sky,0.45+f*0.42);"+
      "float spec=pow(max(f,0.0),7.0); c+=vec3(1.0,0.97,0.85)*spec*0.55;"+
      "gl_FragColor=vec4(c,0.9);}"
  });
  var w = new THREE.Mesh(new THREE.PlaneGeometry(64, WORLD, 1, 1), waterMat);
  w.rotation.x = -Math.PI/2; w.position.y = WATER_Y; water = w; scene.add(w);
}

/* ---------------- mountains ring ---------------- */
function makeMountains(){
  var mat = new THREE.MeshStandardMaterial({ color:0xaebfce, roughness:1, metalness:0, flatShading:true, fog:true });
  var snow = new THREE.MeshStandardMaterial({ color:0xeef4f8, roughness:1, flatShading:true });
  for (var i=0;i<28;i++){
    var a = (i/28)*TAU + hash2(i,3)*0.18;
    var rad = 1550 + hash2(i,9)*360;             // far on the horizon → reads as distant, hazy range
    var h = 420 + hash2(i,5)*460;
    var geo = new THREE.ConeGeometry(240 + hash2(i,1)*180, h, 9 + (i%3), 4);
    var p = geo.attributes.position;
    for (var j=0;j<p.count;j++){ p.setX(j,p.getX(j)+(hash2(j,i)-0.5)*46); p.setZ(j,p.getZ(j)+(hash2(j+7,i)-0.5)*46); }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a)*rad, h/2 - 70, Math.sin(a)*rad);
    m.castShadow = false; scene.add(m);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(150+hash2(i,2)*90, h*0.4, 9, 1), snow);
    cap.position.set(m.position.x, h - h*0.2 - 70, m.position.z); scene.add(cap);
  }
}

/* ---------------- instanced grass with wind ----------------
   Each instance is a *clump* of three crossed quads (a bushy tuft) rather than a
   single flat plane, so grass reads as ground cover instead of stray sticks. */
function clumpGeo(){
  var geos=[], q;
  for (var i=0;i<3;i++){
    q = new THREE.PlaneGeometry(1.35, 1.7, 1, 3);    // taller tufts; segmented so wind bends smoothly
    q.translate(0, 0.85, 0);
    q.rotateY(i*Math.PI/3);
    geos.push(q);
  }
  // merge the three quads into one BufferGeometry
  var g = geos[0];
  var merged = new THREE.BufferGeometry();
  var posArr=[], uvArr=[], idxArr=[], off=0;
  geos.forEach(function(gg){
    var p=gg.attributes.position.array, u=gg.attributes.uv.array, idx=gg.index.array, cnt=gg.attributes.position.count;
    for (var k=0;k<p.length;k++) posArr.push(p[k]);
    for (var k2=0;k2<u.length;k2++) uvArr.push(u[k2]);
    for (var k3=0;k3<idx.length;k3++) idxArr.push(idx[k3]+off);
    off+=cnt;
  });
  merged.setAttribute("position", new THREE.Float32BufferAttribute(posArr,3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr,2));
  merged.setIndex(idxArr);
  merged.computeVertexNormals();
  return merged;
}
var grassWinds=[];
function grassMaterial(){
  var m = new THREE.MeshStandardMaterial({ map:(tex.blade||grassTex()), alphaTest:0.30, transparent:false,
    side:THREE.DoubleSide, color:0xffffff, roughness:1, metalness:0 });
  if(m.map){ m.map.encoding=THREE.sRGBEncoding; m.map.anisotropy=4; }
  m.onBeforeCompile = function(sh){
    sh.uniforms.t = { value:0 }; if(!grassMat._wind) grassMat._wind=sh.uniforms.t; grassWinds.push(sh.uniforms.t);
    sh.vertexShader = "uniform float t;\nvarying float vBladeH;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n vBladeH = uv.y;\n float ph = instanceMatrix[3][0]*0.32 + instanceMatrix[3][2]*0.32;\n float gust = sin(t*1.5 + ph) + 0.4*sin(t*3.1 + ph*1.7);\n float bend = position.y*position.y*0.11;\n transformed.x += gust * bend;\n transformed.z += cos(t*1.15 + ph*0.8) * bend * 0.55;");
    // darker at the root, brighter tips → lush volumetric read
    sh.fragmentShader = "varying float vBladeH;\n" + sh.fragmentShader.replace("#include <map_fragment>",
      "#include <map_fragment>\n diffuseColor.rgb *= mix(vec3(0.5,0.56,0.42), vec3(1.18,1.22,1.02), clamp(vBladeH,0.0,1.0));");
  };
  return m;
}
function makeGrass(){
  var blade = clumpGeo();
  var gmat = grassMaterial();
  var AREA = PLAY;                     // spread across the whole roamable valley
  var N = 150000, inst = new THREE.InstancedMesh(blade, gmat, N);
  var d = new THREE.Object3D(), col=new THREE.Color(), n=0;
  for (var i=0;i<N;i++){
    var x=(hash2(i,21)-0.5)*2*AREA, z=(hash2(i,57)-0.5)*2*AREA;
    var y=heightAt(x,z);
    if (y<WATER_Y+0.4 || y>66) continue;                 // no grass in water or high rock
    if (Math.abs(x) < 14 + hash2(i,11)*8) continue;      // keep the riverbank clearish
    if (onPath(x,z) > 0.5) continue;                     // don't grow through the trodden path
    var r=Math.sqrt(x*x+z*z); var dens = r<AREA*0.72 ? 1 : hash2(i,44); if(dens<0.3) continue;
    d.position.set(x,y-0.06,z); d.rotation.y=hash2(i,3)*TAU;
    var s=0.75+hash2(i,8)*0.7; d.scale.set(s,s*(1.0+hash2(i,2)*0.55),s); d.updateMatrix();
    inst.setMatrixAt(n, d.matrix);
    var dry=smoothstep(26,54,y);
    var h=0.26 - dry*0.06 + (hash2(i,5)-0.5)*0.04;
    var l=0.36 + hash2(i,6)*0.12 - dry*0.06;
    col.setHSL(h, 0.52-dry*0.14, l); inst.setColorAt(n, col);
    n++;
  }
  inst.count = n; inst.instanceColor.needsUpdate=true;
  inst.castShadow=false; inst.receiveShadow=true; inst.frustumCulled=false; scene.add(inst);
  grassMat._grassInst = inst;
  makeGrassNear(blade);
}
/* dense near-field grass that follows the player — the lush cinematic foreground */
var grassNear=null, GN=9000, GN_R=42, gnOffs=null;
function makeGrassNear(blade){
  grassNear=new THREE.InstancedMesh(blade, grassMaterial(), GN);
  grassNear.frustumCulled=false; grassNear.receiveShadow=true;
  gnOffs=new Float32Array(GN*2);
  var col=new THREE.Color(), d=new THREE.Object3D();
  for(var i=0;i<GN;i++){
    var a=hash2(i,3)*TAU, rr=Math.sqrt(hash2(i,7))*GN_R;
    gnOffs[i*2]=Math.cos(a)*rr; gnOffs[i*2+1]=Math.sin(a)*rr;
    col.setHSL(0.26+(hash2(i,5)-0.5)*0.04, 0.5, 0.36+hash2(i,6)*0.12); grassNear.setColorAt(i,col);
    d.updateMatrix(); grassNear.setMatrixAt(i,d.matrix);
  }
  grassNear.instanceColor.needsUpdate=true; scene.add(grassNear);
}
function updateGrassNear(){
  if(!grassNear) return;
  var bx=Math.round(player.pos.x/1.5)*1.5, bz=Math.round(player.pos.z/1.5)*1.5, d=new THREE.Object3D();
  for(var i=0;i<GN;i++){
    var x=bx+gnOffs[i*2], z=bz+gnOffs[i*2+1], y=heightAt(x,z);
    if((y<WATER_Y+0.4)||(y>66)||(Math.abs(x)<14)||(onPath(x,z)>0.5)){ d.position.set(x,-9999,z); d.scale.setScalar(0.0001); }
    else { var s=0.72+hash2(i,8)*0.55; d.position.set(x,y-0.06,z); d.rotation.set(0,hash2(i,4)*TAU,0); d.scale.set(s,s*1.15,s); }
    d.updateMatrix(); grassNear.setMatrixAt(i,d.matrix);
  }
  grassNear.instanceMatrix.needsUpdate=true;
}

/* ---------------- paths ----------------
   Hand-laid dirt trails linking the village, the spawn clearing and the shrines.
   PATH_DENS is the smoothed centre-line, reused by onPath() to keep grass/trees off. */
var PATH_DENS=null, PATH_HALF=3.6, windU=[];
function catmull(pts, per){
  var out=[]; function P(i){ return pts[Math.max(0,Math.min(pts.length-1,i))]; }
  for(var i=0;i<pts.length-1;i++){ var p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
    for(var j=0;j<per;j++){ var t=j/per,t2=t*t,t3=t2*t;
      out.push([
        0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]);
    }
  }
  out.push(pts[pts.length-1]); return out;
}
function onPath(x,z){
  if(!PATH_DENS) return 0; var best=1e9;
  for(var s=0;s<PATH_DENS.length;s++){ var pl=PATH_DENS[s];
    for(var i=0;i<pl.length;i++){ var dx=x-pl[i][0], dz=z-pl[i][1]; var d=dx*dx+dz*dz; if(d<best)best=d; } }
  return 1-smoothstep(PATH_HALF, PATH_HALF+2.4, Math.sqrt(best));
}
function makePath(){
  var raw=[
    [[175,165],[122,120],[70,74],[26,34],[4,6],[8,-46],[10,-96]],     // village → spawn → cloud shrine
    [[26,34],[-12,28],[-40,26],[-54,24]],                            // fork → ancient stele
    [[8,-46],[28,-42],[46,-34]]                                       // fork → spirit vein
  ];
  PATH_DENS=raw.map(function(p){ return catmull(p,14); });
  var pd = tex.dirt ? tex.dirt.clone() : null;
  if(pd){ pd.wrapS=pd.wrapT=THREE.RepeatWrapping; pd.repeat.set(1,1); pd.needsUpdate=true; }
  var pmat=new THREE.MeshStandardMaterial({ map:pd, color:0xb0a084, roughness:1, metalness:0,
    polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
  PATH_DENS.forEach(function(pl){
    var pos=[],uv=[],idx=[],vlen=0;
    for(var i=0;i<pl.length;i++){
      var a=pl[Math.max(0,i-1)], b=pl[Math.min(pl.length-1,i+1)];
      var dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz)||1; dx/=len; dz/=len;
      var nx=-dz, nz=dx, w=PATH_HALF*(0.85+0.28*Math.sin(i*0.5));
      var lx=pl[i][0]+nx*w, lz=pl[i][1]+nz*w, rx=pl[i][0]-nx*w, rz=pl[i][1]-nz*w;
      pos.push(lx, heightAt(lx,lz)+0.08, lz); pos.push(rx, heightAt(rx,rz)+0.08, rz);
      if(i>0) vlen+=Math.hypot(pl[i][0]-pl[i-1][0], pl[i][1]-pl[i-1][1]);
      uv.push(0, vlen*0.14); uv.push(1, vlen*0.14);
    }
    for(var i2=0;i2<pl.length-1;i2++){ var b0=i2*2; idx.push(b0,b0+1,b0+2, b0+1,b0+3,b0+2); }
    var geo=new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx); geo.computeVertexNormals();
    var m=new THREE.Mesh(geo, pmat); m.receiveShadow=true; scene.add(m);
  });
}

/* ---------------- geometry merge helper ---------------- */
function mergeGeos(geos){
  var pos=[],norm=[],uv=[],idx=[],off=0;
  geos.forEach(function(g){
    var p=g.attributes.position.array, no=g.attributes.normal?g.attributes.normal.array:null,
        u=g.attributes.uv?g.attributes.uv.array:null, cnt=g.attributes.position.count;
    for(var k=0;k<p.length;k++)pos.push(p[k]);
    if(no)for(var k2=0;k2<no.length;k2++)norm.push(no[k2]);
    if(u)for(var k3=0;k3<u.length;k3++)uv.push(u[k3]);
    var index=g.index?g.index.array:null;
    if(index){ for(var mm=0;mm<index.length;mm++)idx.push(index[mm]+off); }
    else { for(var mm=0;mm<cnt;mm++)idx.push(mm+off); }
    off+=cnt;
  });
  var geo=new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
  if(norm.length===pos.length) geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm,3));
  if(uv.length) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx); if(norm.length!==pos.length) geo.computeVertexNormals();
  return geo;
}
/* canopy wind: sway grows with local height above the trunk pivot */
function windify(mat, amt){
  mat.onBeforeCompile=function(sh){
    sh.uniforms.t={value:0}; windU.push(sh.uniforms.t);
    sh.vertexShader="uniform float t;\n"+sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n float wph=instanceMatrix[3][0]*0.25+instanceMatrix[3][2]*0.25;\n float wy=max(position.y-0.4,0.0);\n transformed.x += sin(t*1.1+wph)*wy*"+amt.toFixed(3)+";\n transformed.z += cos(t*0.9+wph)*wy*"+(amt*0.6).toFixed(3)+";");
  };
}

/* ---------------- unit tree prototypes (height ~1, scaled per instance) ---------------- */
function coniferGeo(){
  var cones=[]; for(var k=0;k<4;k++){ var rad=0.42-k*0.085, cy=0.42+k*0.2;
    var c=new THREE.ConeGeometry(rad, 0.42, 7); c.translate(0,cy,0); cones.push(c); }
  return mergeGeos(cones);
}
function broadleafGeo(){
  var blobs=[]; var pts=[[0,0.86,0,0.62],[0.34,0.68,0.14,0.48],[-0.32,0.72,-0.16,0.46],[0.08,1.04,-0.06,0.44],[0,0.56,0,0.54]];
  pts.forEach(function(p){ var s=new THREE.IcosahedronGeometry(p[3],1); s.translate(p[0],p[1],p[2]); blobs.push(s); });
  return mergeGeos(blobs);
}
function bambooLeafGeo(){
  var l=[]; for(var k=0;k<5;k++){ var c=new THREE.ConeGeometry(0.05,0.5,4); c.rotateZ((k-2)*0.4); c.translate((k-2)*0.06,1.0,0); l.push(c);} return mergeGeos(l);
}
/* Build one biome's worth of instanced trunks + canopies. */
function forest(type, places){
  if(!places.length) return;
  var trunkGeo, canopyGeo, trunkCol, hueA, hueB, sat, lit, canWind;
  if(type==="pine"){ trunkGeo=new THREE.CylinderGeometry(0.05,0.13,1,6); trunkCol=0x3f2e1f; canopyGeo=coniferGeo(); hueA=0.28; hueB=0.34; sat=0.42; lit=0.22; canWind=0.05; }
  else if(type==="autumn"){ trunkGeo=new THREE.CylinderGeometry(0.07,0.16,1,6); trunkCol=0x5a3a22; canopyGeo=broadleafGeo(); hueA=0.07; hueB=0.12; sat=0.62; lit=0.40; canWind=0.09; }
  else if(type==="birch"){ trunkGeo=new THREE.CylinderGeometry(0.045,0.09,1,6); trunkCol=0xd8d2c4; canopyGeo=broadleafGeo(); hueA=0.20; hueB=0.26; sat=0.5; lit=0.44; canWind=0.09; }
  else if(type==="sakura"){ trunkGeo=new THREE.CylinderGeometry(0.06,0.15,1,6); trunkCol=0x4a3526; canopyGeo=broadleafGeo(); hueA=0.92; hueB=0.99; sat=0.45; lit=0.76; canWind=0.09; }
  else { /* bamboo */ trunkGeo=new THREE.CylinderGeometry(0.045,0.06,1,6); trunkCol=0x9bab52; canopyGeo=bambooLeafGeo(); hueA=0.24; hueB=0.30; sat=0.5; lit=0.4; canWind=0.05; }
  trunkGeo.translate(0,0.5,0);
  var trunkMat=new THREE.MeshStandardMaterial({color:trunkCol,roughness:1,metalness:0});
  var canopyMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,flatShading:type!=="birch"});
  windify(canopyMat, canWind);
  var trunk=new THREE.InstancedMesh(trunkGeo, trunkMat, places.length);
  var canopy=new THREE.InstancedMesh(canopyGeo, canopyMat, places.length);
  var d=new THREE.Object3D(), col=new THREE.Color();
  for(var i=0;i<places.length;i++){ var pl=places[i];
    d.position.set(pl.x,pl.y,pl.z); d.rotation.set(0,pl.rot,0); d.scale.setScalar(pl.s); d.updateMatrix();
    trunk.setMatrixAt(i,d.matrix); canopy.setMatrixAt(i,d.matrix);
    col.setHSL(hueA+(hueB-hueA)*hash2(i,pl.seed||3), sat, lit+hash2(i,7)*0.08); canopy.setColorAt(i,col);
  }
  trunk.castShadow=true; canopy.castShadow=true; canopy.receiveShadow=false;
  if(canopy.instanceColor) canopy.instanceColor.needsUpdate=true;
  scene.add(trunk); scene.add(canopy);
}

/* ---------------- forests + rocks ---------------- */
var BIOMES=[
  {type:"pine",   cx:-330, cz:-380, r:280, count:210, base:14, top:11},
  {type:"pine",   cx: 520, cz: 300, r:230, count:150, base:12, top:10},
  {type:"autumn", cx: 430, cz:-280, r:200, count:120, base:11, top:9},
  {type:"bamboo", cx:-300, cz: 320, r:150, count:120, base:10, top:8},
  {type:"birch",  cx:-560, cz: 70,  r:180, count:110, base:12, top:9},
  {type:"sakura", cx:  70, cz: -70, r:150, count:90,  base:12, top:8},
  {type:"sakura", cx: 300, cz: 120, r:120, count:60,  base:12, top:8}
];
function scatter(){
  trees=[];
  var buckets={pine:[],autumn:[],birch:[],bamboo:[],sakura:[]};
  function ok(x,z,y){ return y>WATER_Y+1 && y<80 && Math.hypot(x-VILLAGE.x,z-VILLAGE.z)>VILLAGE.r*1.15
      && Math.hypot(x,z-10)>30 && onPath(x,z)<0.35 && Math.sqrt(x*x+z*z)<PLAY*1.05; }   // keep the spawn clearing open
  // clustered biome forests
  BIOMES.forEach(function(bi,bidx){
    for(var i=0;i<bi.count;i++){
      var ang=hash2(i,bidx*13+1)*TAU, rr=Math.sqrt(hash2(i,bidx*13+2))*bi.r;
      var x=bi.cx+Math.cos(ang)*rr, z=bi.cz+Math.sin(ang)*rr, y=heightAt(x,z);
      if(!ok(x,z,y)) continue;
      var sc=(bi.base+hash2(i,bidx*13+5)*bi.top)*(bi.type==="bamboo"?0.55:1);
      buckets[bi.type].push({x:x,y:y,z:z,rot:hash2(i,bidx*13+7)*TAU,s:sc,seed:bidx*13+9});
    }
  });
  // scattered lone trees across the whole valley
  for(var i=0;i<260;i++){
    var x=(hash2(i,71)-0.5)*2*PLAY, z=(hash2(i,33)-0.5)*2*PLAY, y=heightAt(x,z);
    if(!ok(x,z,y)) continue;
    var t=hash2(i,5)<0.7?"pine":"autumn";
    buckets[t].push({x:x,y:y,z:z,rot:hash2(i,9)*TAU,s:9+hash2(i,4)*9,seed:44});
  }
  Object.keys(buckets).forEach(function(k){ forest(k, buckets[k]); });

  // rocks scattered around the valley
  var rockMat=new THREE.MeshStandardMaterial({map:tex.rock||null,color:0x9a948a,roughness:1,flatShading:true});
  for (var j=0;j<150;j++){
    var rx=(hash2(j,12)-0.5)*2*PLAY, rz=(hash2(j,90)-0.5)*2*PLAY; var ry=heightAt(rx,rz);
    if (ry<WATER_Y || onPath(rx,rz)>0.4) continue;
    var rk=new THREE.Mesh(new THREE.IcosahedronGeometry(0.8+hash2(j,5)*2.8, 0), rockMat);
    rk.position.set(rx,ry+0.2,rz); rk.rotation.set(hash2(j,1)*TAU,hash2(j,2)*TAU,hash2(j,3)*TAU);
    rk.scale.set(1,0.6+hash2(j,7)*0.7,1); rk.castShadow=true; rk.receiveShadow=true; scene.add(rk);
  }
}

/* ================= real 3D models (Higgsfield → Meshy GLB) ================= */
var GLTF=null, heroModel=null, heroHolder=null, heroMixer=null, heroActions={}, heroActive=null,
    heroState="", modelHero=false, HERO_FACING=Math.PI, buildProtos={}, heroHandBone=null;
var MODELS_BASE="./assets/models/";
function shortAngle(a){ while(a>Math.PI)a-=TAU; while(a<-Math.PI)a+=TAU; return a; }
function loadModels(){
  if(!THREE.GLTFLoader){ return; }
  GLTF=new THREE.GLTFLoader();
  loadHeroModel();
  loadBuildings();
}
/* --- hero: load per-animation GLBs that share the Meshy skeleton, drive one mixer --- */
function loadHeroModel(){
  var clips=[["idle","hero_idle.glb"],["walk","hero_walk.glb"],["run","hero_run.glb"],["attack","hero_attack.glb"]];
  var loaded={}, remaining=clips.length;
  clips.forEach(function(cl){
    GLTF.load(MODELS_BASE+cl[1], function(gltf){
      loaded[cl[0]]={scene:gltf.scene, clip:(gltf.animations&&gltf.animations[0])||null};
      if(--remaining===0) assembleHero(loaded);
    }, undefined, function(){ if(--remaining===0) assembleHero(loaded); });
  });
}
/* Each animation ships as its own full skinned GLB. Rather than retarget clips
   across files (which can collapse a Meshy skin to the origin), we keep all four
   meshes and just show the one whose clip we want — rock-solid and simple. */
var heroParts={}, heroCur="";
function assembleHero(loaded){
  var keys=["idle","walk","run","attack"].filter(function(k){ return loaded[k]&&loaded[k].scene; });
  if(!keys.length) return;                                 // no GLB present → keep the sprite hero
  heroHolder=new THREE.Group(); playerObj.add(heroHolder); playerObj.updateWorldMatrix(true,true);
  keys.forEach(function(k){
    var sc=loaded[k].scene, hand=null, handAny=null;
    sc.traverse(function(o){
      if(o.isMesh||o.isSkinnedMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; }
      if(o.isBone && /hand/i.test(o.name)){ handAny=handAny||o; if(/right|_r\b|rhand|hand_r|r_hand/i.test(o.name)) hand=hand||o; }
    });
    sc.visible=false; heroHolder.add(sc);
    var mixer=new THREE.AnimationMixer(sc), clip=loaded[k].clip, action=clip?mixer.clipAction(clip):null;
    if(action){ if(k==="attack"){ action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished=true; action.timeScale=2.2; } action.play(); mixer.update(0); }
    fitHero(sc, heroHolder, 5.2);                          // size by posed skeleton (clips carry a hidden armature scale)
    if(k==="attack"){ mixer.addEventListener("finished", function(){ hero.attacking=false; }); }
    heroParts[k]={scene:sc, mixer:mixer, action:action, hand:hand||handAny};
  });
  modelHero=true; if(playerSprite) playerSprite.visible=false;
  showHero(heroParts.idle?"idle":keys[0]);
}
/* Size a skinned hero clip by its *posed skeleton* bone positions (robust to the
   hidden per-clip armature scale Meshy bakes in). Feet land on the holder origin. */
function fitHero(sc, holder, targetH){
  holder.updateWorldMatrix(true,false);
  var bones=[]; sc.traverse(function(o){ if(o.isSkinnedMesh&&o.skeleton) o.skeleton.bones.forEach(function(b){ if(bones.indexOf(b)<0)bones.push(b); }); });
  function bounds(){
    var wp=new THREE.Vector3(), r={minY:1e9,maxY:-1e9,cx:0,cz:0,n:0};
    if(bones.length){ for(var i=0;i<bones.length;i++){ bones[i].updateWorldMatrix(true,false);
      wp.setFromMatrixPosition(bones[i].matrixWorld); var lp=holder.worldToLocal(wp.clone());
      r.minY=Math.min(r.minY,lp.y); r.maxY=Math.max(r.maxY,lp.y); r.cx+=lp.x; r.cz+=lp.z; r.n++; } }
    else { var bb=new THREE.Box3().setFromObject(sc), a=holder.worldToLocal(bb.min.clone()), b=holder.worldToLocal(bb.max.clone());
      r.minY=Math.min(a.y,b.y); r.maxY=Math.max(a.y,b.y); r.cx=(a.x+b.x)/2; r.cz=(a.z+b.z)/2; r.n=1; }
    return r;
  }
  sc.updateWorldMatrix(true,true);
  var b1=bounds(), h=b1.maxY-b1.minY, f=targetH/(h||1); if(!isFinite(f)||f<=0)f=1;
  sc.scale.multiplyScalar(f); sc.updateWorldMatrix(true,true);
  var b2=bounds();
  sc.position.x -= b2.cx/b2.n; sc.position.z -= b2.cz/b2.n; sc.position.y -= b2.minY;
  sc.updateWorldMatrix(true,true);
}
function showHero(name){
  if(!heroParts[name] || heroCur===name) return;
  if(heroParts[heroCur]) heroParts[heroCur].scene.visible=false;
  heroCur=name; var p=heroParts[name]; p.scene.visible=true; heroHandBone=p.hand||null;
  if(name==="attack" && p.action){ p.action.reset(); p.action.play(); }
}
function updateModels(dt,t){
  if(!modelHero) return;
  var want = hero.attacking ? "attack" : (player.speed>7 ? "run" : player.speed>1.3 ? "walk" : "idle");
  if(!heroParts[want]) want = heroParts.idle ? "idle" : heroCur;
  showHero(want);
  var cur=heroParts[heroCur]; if(cur && cur.mixer) cur.mixer.update(dt);
  if(player.speed>1.3 && heroHolder){
    var tgt=player.yaw+HERO_FACING;
    heroHolder.rotation.y += shortAngle(tgt-heroHolder.rotation.y)*Math.min(1,dt*9);
  }
}
/* --- village buildings: load a prototype GLB once, clone it onto each anchor --- */
function fitAndDrop(obj, targetH){
  var box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(); box.getSize(size);
  var s=targetH/(size.y||1); if(!isFinite(s)||s<=0) s=1;
  obj.scale.multiplyScalar(s);                             // multiply (not set) — GLB root scale may be ≠1
  box.setFromObject(obj); obj.userData.baseY=-box.min.y;   // lift so the base sits on the ground
  return obj;
}
function loadBuildings(){
  var jobs=[["house","house.glb",9.5],["pagoda","pagoda.glb",26]];
  jobs.forEach(function(j){
    GLTF.load(MODELS_BASE+j[1], function(gltf){
      var proto=gltf.scene;
      proto.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
      fitAndDrop(proto, j[2]); buildProtos[j[0]]=proto; placeBuildings(j[0]);
    }, undefined, function(){ /* GLB missing → procedural fallback already placed */ });
  });
}
function placeBuildings(kind){
  BUILD_ANCHORS.forEach(function(a){
    if(a.type!==kind || a.placed) return;
    var proto=buildProtos[kind]; if(!proto) return;
    var m=proto.clone(true); var y=heightAt(a.x,a.z);
    m.position.set(a.x, y+(proto.userData.baseY||0), a.z);
    m.rotation.y=a.rot; if(a.s) m.scale.multiplyScalar(a.s);
    scene.add(m); a.placed=true; a.mesh=m;
    if(a.fallbackMesh){ scene.remove(a.fallbackMesh); a.fallbackMesh=null; }
  });
}
/* ---------------- village (procedural dressing + building anchors) ---------------- */
var BUILD_ANCHORS=[];
function makeVillage(){
  var cx=VILLAGE.x, cz=VILLAGE.z;
  // building anchors: a central pagoda ringed by houses
  BUILD_ANCHORS.push({type:"pagoda", x:cx, z:cz-6, rot:0.2});
  var ring=[[-58,-30],[-64,34],[-6,64],[58,44],[66,-26],[10,-70],[-40,72],[44,-72]];
  ring.forEach(function(o,i){ BUILD_ANCHORS.push({type:"house", x:cx+o[0], z:cz+o[1], rot:Math.atan2(-o[0],-o[1])+ (hash2(i,3)-0.5)*0.4, s:0.85+hash2(i,7)*0.4}); });
  // packed-earth plaza disc so the village floor reads as trodden ground
  var pd = tex.dirt ? tex.dirt.clone() : null;
  if(pd){ pd.wrapS=pd.wrapT=THREE.RepeatWrapping; pd.repeat.set(10,10); pd.needsUpdate=true; }
  var plaza=new THREE.Mesh(new THREE.CircleGeometry(VILLAGE.r*0.95, 48),
    new THREE.MeshStandardMaterial({map:pd,color:0xbcae90,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  plaza.rotation.x=-Math.PI/2; plaza.position.set(cx, heightAt(cx,cz)+0.06, cz); plaza.receiveShadow=true; scene.add(plaza);
  // central well
  var stone=new THREE.MeshStandardMaterial({map:tex.rock||null,color:0x9a938a,roughness:1});
  var well=new THREE.Group();
  var ring2=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.8,1.4,16,1,true), stone); ring2.position.y=0.7; ring2.castShadow=true; well.add(ring2);
  var wtop=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,0.1,16), new THREE.MeshStandardMaterial({color:0x22333a,roughness:0.4})); wtop.position.y=1.1; well.add(wtop);
  var wpost=new THREE.MeshStandardMaterial({color:0x5a3a24,roughness:0.9});
  for(var s=-1;s<=1;s+=2){ var p=new THREE.Mesh(new THREE.BoxGeometry(0.2,3,0.2),wpost); p.position.set(s*1.5,1.6,0); p.castShadow=true; well.add(p); }
  var beam=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.2,0.2),wpost); beam.position.y=3.0; well.add(beam);
  well.position.set(cx+18, heightAt(cx+18,cz+8), cz+8); scene.add(well);
  // hanging lanterns on posts along the plaza edge (glow at night/dusk)
  villageLanterns=[];
  for(var i=0;i<10;i++){ var a=(i/10)*TAU, rr=VILLAGE.r*0.8;
    var lx=cx+Math.cos(a)*rr, lz=cz+Math.sin(a)*rr, ly=heightAt(lx,lz);
    var post=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,3.4,6), wpost); post.position.set(lx,ly+1.7,lz); post.castShadow=true; scene.add(post);
    var lan=new THREE.Mesh(new THREE.SphereGeometry(0.42,12,12), new THREE.MeshBasicMaterial({color:0xffb457}));
    lan.position.set(lx,ly+3.2,lz); scene.add(lan); villageLanterns.push(lan);
    var arm=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.1,0.1),wpost); arm.position.set(lx,ly+3.4,lz); scene.add(arm);
  }
  // simple wooden fence segments framing the plaza gaps
  var fenceMat=new THREE.MeshStandardMaterial({color:0x6a4a30,roughness:1});
  for(var f=0;f<26;f++){ var a=(f/26)*TAU; if(Math.sin(a*3)>0.3) continue;
    var fx=cx+Math.cos(a)*VILLAGE.r*0.9, fz=cz+Math.sin(a)*VILLAGE.r*0.9, fy=heightAt(fx,fz);
    var rail=new THREE.Mesh(new THREE.BoxGeometry(0.14,1.1,2.2), fenceMat);
    rail.position.set(fx,fy+0.55,fz); rail.rotation.y=a+Math.PI/2; rail.castShadow=true; scene.add(rail);
  }
  // procedural fallback huts (so the village is never empty even before GLBs load)
  placeFallbackHuts();
}
var villageLanterns=[];
function placeFallbackHuts(){
  BUILD_ANCHORS.forEach(function(a){
    if(a.type!=="house") return;
    var y=heightAt(a.x,a.z), g=new THREE.Group();
    var wall=new THREE.Mesh(new THREE.BoxGeometry(6,4,5), new THREE.MeshStandardMaterial({color:0xe8e0d0,roughness:1}));
    wall.position.y=2; wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
    var roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,2.6,4), new THREE.MeshStandardMaterial({color:0x4a4a52,roughness:1}));
    roof.rotation.y=Math.PI/4; roof.position.y=5.3; roof.castShadow=true; g.add(roof);
    g.position.set(a.x,y,a.z); g.rotation.y=a.rot; g.userData.fallback=true;
    scene.add(g); a.fallbackMesh=g;
  });
}

/* ---------------- lotus pond + stone bridge (cinematic set-dressing) ---------------- */
function makeLotus(){
  var padMat=new THREE.MeshStandardMaterial({color:0x3f7a3a,roughness:0.85,side:THREE.DoubleSide});
  var flowerMat=new THREE.MeshStandardMaterial({color:0xf7b8d0,roughness:0.6,emissive:0x40121f,emissiveIntensity:0.18});
  var coreMat=new THREE.MeshStandardMaterial({color:0xffe08a,roughness:0.6});
  var placed=0;
  for(var i=0;i<160 && placed<90;i++){
    var x=(hash2(i,61)-0.5)*44, z=-90 + hash2(i,62)*190;
    if(Math.abs(x)>24) continue;
    if(heightAt(x,z) > WATER_Y-0.3) continue;                 // only on open water
    var g=new THREE.Group();
    var pad=new THREE.Mesh(new THREE.CircleGeometry(0.55+hash2(i,4)*0.8, 12), padMat);
    pad.rotation.x=-Math.PI/2; pad.receiveShadow=true; g.add(pad);
    if(hash2(i,7)>0.55){
      var f=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.55,7), flowerMat); f.position.y=0.3; g.add(f);
      var c=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8), coreMat); c.position.y=0.36; g.add(c);
    }
    g.position.set(x, WATER_Y+0.04, z); g.rotation.y=hash2(i,3)*TAU; scene.add(g); placed++;
  }
}
function makeBridge(){
  var stone=new THREE.MeshStandardMaterial({color:0xd8d2c4,roughness:0.9,map:tex.rock||null});
  var g=new THREE.Group(), segs=11, span=40;
  for(var i=0;i<segs;i++){
    var t=i/(segs-1)-0.5, x=t*span, arch=Math.cos(t*Math.PI)*1.7;
    var deck=new THREE.Mesh(new THREE.BoxGeometry(span/segs+0.25,0.5,5.2), stone);
    deck.position.set(x, WATER_Y+2.4+arch, 0); deck.castShadow=true; deck.receiveShadow=true; g.add(deck);
    for(var s=-1;s<=1;s+=2){
      var post=new THREE.Mesh(new THREE.BoxGeometry(0.3,1.15,0.3),stone); post.position.set(x,WATER_Y+3.3+arch,s*2.4); post.castShadow=true; g.add(post);
      var rail=new THREE.Mesh(new THREE.BoxGeometry(span/segs+0.25,0.22,0.22),stone); rail.position.set(x,WATER_Y+3.85+arch,s*2.4); g.add(rail);
    }
  }
  g.position.set(0,0,6); scene.add(g);
}

/* ---------------- foliage billboards (hydrangea, ferns) ---------------- */
function billboardClump(w,h){
  var geos=[]; for(var i=0;i<2;i++){ var q=new THREE.PlaneGeometry(w,h,1,2); q.translate(0,h*0.5,0); q.rotateY(i*Math.PI/2); geos.push(q); }
  return mergeGeos(geos);
}
function placeFoliage(texture, height, places){
  if(!texture || !places.length) return;
  texture.encoding=THREE.sRGBEncoding;
  var geo=billboardClump(height*0.95, height);
  var mat=new THREE.MeshStandardMaterial({map:texture, alphaTest:0.42, side:THREE.DoubleSide, roughness:1, metalness:0, color:0xffffff});
  windify(mat, 0.05);
  var inst=new THREE.InstancedMesh(geo, mat, places.length); inst.frustumCulled=false; inst.receiveShadow=true;
  var d=new THREE.Object3D();
  for(var i=0;i<places.length;i++){ var p=places[i]; d.position.set(p.x,p.y,p.z); d.rotation.set(0,p.rot,0); d.scale.setScalar(p.s); d.updateMatrix(); inst.setMatrixAt(i,d.matrix); }
  scene.add(inst);
}
function makeFoliage(){
  // hydrangea clusters hugging the water banks, the village and the paths
  var flowers=[];
  for(var i=0;i<420;i++){
    var side=hash2(i,2)<0.5?-1:1, x=side*(15+hash2(i,3)*13), z=-95+hash2(i,4)*205, y=heightAt(x,z);
    if(y<WATER_Y+0.1 || y>9 || onPath(x,z)>0.5) continue;
    flowers.push({x:x,y:y-0.1,z:z,rot:hash2(i,5)*TAU,s:0.7+hash2(i,6)*0.7});
  }
  for(var v=0;v<70;v++){ var a=(v/70)*TAU, rr=VILLAGE.r*(0.6+hash2(v,9)*0.35);
    var fx=VILLAGE.x+Math.cos(a)*rr, fz=VILLAGE.z+Math.sin(a)*rr, fy=heightAt(fx,fz);
    if(onPath(fx,fz)>0.5) continue; flowers.push({x:fx,y:fy,z:fz,rot:hash2(v,3)*TAU,s:0.7+hash2(v,7)*0.6}); }
  placeFoliage(tex.flower, 3.0, flowers);
  // ferns dotted loosely across the meadow and forest edges (sparse — no hedge walls)
  var ferns=[];
  for(var f=0;f<420;f++){
    if(hash2(f,12)>0.42) continue;                        // sparse scatter
    var x2=(hash2(f,71)-0.5)*2*PLAY, z2=(hash2(f,33)-0.5)*2*PLAY, y2=heightAt(x2,z2);
    if(y2<WATER_Y+1 || y2>70 || onPath(x2,z2)>0.4 || Math.hypot(x2-VILLAGE.x,z2-VILLAGE.z)<VILLAGE.r) continue;
    ferns.push({x:x2,y:y2-0.1,z:z2,rot:hash2(f,9)*TAU,s:0.6+hash2(f,4)*0.55});
  }
  placeFoliage(tex.fern, 2.4, ferns);
}

/* ---------------- particles: spirit motes + petals + mist ---------------- */
var motes, petals, mistPlanes=[], trees=[];
function makeParticles(){
  // motes rising (local cloud that follows the player across the valley)
  var N=1200, g=new THREE.BufferGeometry(), a=new Float32Array(N*3);
  for (var i=0;i<N;i++){ a[i*3]=(Math.random()-0.5)*180; a[i*3+1]=Math.random()*40; a[i*3+2]=(Math.random()-0.5)*180; }
  g.setAttribute("position", new THREE.BufferAttribute(a,3));
  motes = new THREE.Points(g, new THREE.PointsMaterial({ map:radialTex("rgba(255,240,200,1)","rgba(255,220,150,0)"),
    size:0.7, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.8 }));
  scene.add(motes);
  // petals falling
  var M=760, g2=new THREE.BufferGeometry(), b=new Float32Array(M*3);
  for (var j=0;j<M;j++){ b[j*3]=(Math.random()-0.5)*170; b[j*3+1]=Math.random()*60; b[j*3+2]=(Math.random()-0.5)*170; }
  g2.setAttribute("position", new THREE.BufferAttribute(b,3));
  petals = new THREE.Points(g2, new THREE.PointsMaterial({ map:radialTex("rgba(255,200,220,1)","rgba(255,175,200,0)"),
    size:1.5, transparent:true, depthWrite:false, opacity:0.9 }));
  scene.add(petals);
  // ground mist layers
  var mtex = radialTex("rgba(210,225,230,0.5)","rgba(210,225,230,0)");
  for (var k=0;k<7;k++){
    var pl=new THREE.Mesh(new THREE.PlaneGeometry(220,220),
      new THREE.MeshBasicMaterial({map:mtex,transparent:true,opacity:0.32,depthWrite:false}));
    pl.rotation.x=-Math.PI/2; pl.position.set((Math.random()-0.5)*160, WATER_Y+2+Math.random()*5, (Math.random()-0.5)*160);
    pl.userData.spin=(Math.random()-0.5)*0.02; mistPlanes.push(pl); scene.add(pl);
  }
}

/* ---------------- points of interest ---------------- */
function makePOI(id, x, z, build){
  var y=heightAt(x,z); var g=new THREE.Group(); g.position.set(x,y,z); build(g,y); scene.add(g);
  poiList.push({ id:id, pos:new THREE.Vector3(x,y,z), group:g, active:false });
}
function makePOIs(){
  makePOI("spirit_vein", 46, -34, function(g){
    var crystalMat=new THREE.MeshStandardMaterial({color:0x6fe0d6,emissive:0x1a8f86,emissiveIntensity:1.2,roughness:0.3,transparent:true,opacity:0.9});
    for(var i=0;i<5;i++){ var c=new THREE.Mesh(new THREE.ConeGeometry(0.5+Math.random()*0.4,2.5+Math.random()*2.5,5),crystalMat);
      c.position.set((Math.random()-0.5)*2.4,1.2,(Math.random()-0.5)*2.4); c.rotation.z=(Math.random()-0.5)*0.5; c.castShadow=true; g.add(c); }
    var beam=new THREE.Mesh(new THREE.CylinderGeometry(0.6,1.6,40,12,1,true),
      new THREE.MeshBasicMaterial({color:0x7fefe4,transparent:true,opacity:0.14,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
    beam.position.y=20; g.add(beam); g.userData.glow=beam;
  });
  makePOI("stele", -54, 24, function(g){
    var m=new THREE.MeshStandardMaterial({map:tex.rock||null,color:0x9b958a,roughness:1});
    var slab=new THREE.Mesh(new THREE.BoxGeometry(2.4,5,0.6),m); slab.position.y=2.5; slab.castShadow=true; slab.receiveShadow=true; g.add(slab);
    var base=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.6,1.6),m); base.position.y=0.3; g.add(base);
  });
  makePOI("shrine", 8, -96, function(g){
    var wood=new THREE.MeshStandardMaterial({color:0x6a2f2a,roughness:0.9});
    var stone=new THREE.MeshStandardMaterial({color:0x8a8478,roughness:1});
    for(var s=-1;s<=1;s+=2){ var col=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.4,6,8),wood); col.position.set(s*2.4,3,0); col.castShadow=true; g.add(col); }
    var roof=new THREE.Mesh(new THREE.ConeGeometry(4.6,2.2,4),wood); roof.rotation.y=Math.PI/4; roof.position.y=7; roof.castShadow=true; g.add(roof);
    var alt=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.2,1.4),stone); alt.position.y=0.6; g.add(alt);
    var lantern=new THREE.Mesh(new THREE.SphereGeometry(0.5,10,10),new THREE.MeshBasicMaterial({color:0xffcf7a}));
    lantern.position.set(0,2.0,0); g.add(lantern); g.userData.glow=lantern;
  });
}

/* ---------------- player (robed cultivator) ---------------- */
var player = { pos:new THREE.Vector3(0, 0, 8), yaw:0, vel:new THREE.Vector3(), speed:0 };
/* ---- hero: Nano-Banana spritesheet, chroma-keyed, billboarded ---- */
var playerSprite, heroMat, HERO_H=5.6;
var hero = { run:[], attack:[], idle:[], attacking:false, t:0 };
function keySlice(img, cols){
  var W=img.width, H=img.height, fw=Math.floor(W/cols), frames=[];
  for(var c=0;c<cols;c++){
    var cv=document.createElement("canvas"); cv.width=fw; cv.height=H; var g=cv.getContext("2d");
    g.drawImage(img, c*fw,0,fw,H, 0,0,fw,H);
    var id=g.getImageData(0,0,fw,H), d=id.data;
    for(var i=0;i<d.length;i+=4){ var r=d[i],gr=d[i+1],b=d[i+2];
      if(gr>55 && gr>r*1.15 && gr>b*1.15){ d[i+3]=0; }        // key green screen + ghosts
      else if(gr>r && gr>b){ d[i+1]=Math.max(r,b); }          // de-spill green fringe
    }
    g.putImageData(id,0,0);
    var t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.minFilter=THREE.LinearFilter; t.needsUpdate=true;
    frames.push({ tex:t, aspect:fw/H });
  }
  return frames;
}
function loadHero(cb){
  var jobs=[["./assets/hero_run.webp",6,"run"],["./assets/hero_attack.webp",5,"attack"],["./assets/hero_idle.webp",1,"idle"]], n=jobs.length;
  jobs.forEach(function(j){ var im=new Image();
    im.onload=function(){ try{ hero[j[2]]=keySlice(im,j[1]); }catch(e){} if(--n===0&&cb)cb();
      if(playerSprite && (j[2]==="idle")) setHeroFrame(hero.idle[0]); };
    im.onerror=function(){ if(--n===0&&cb)cb(); }; im.src=j[0]; });
}
function setHeroFrame(f){ if(!f||!heroMat)return; heroMat.map=f.tex; heroMat.needsUpdate=true; playerSprite.scale.set(HERO_H*f.aspect, HERO_H, 1); }
function heroAttack(){ if(!hero.attacking && (modelHero ? !!heroParts.attack : hero.attack.length)){ hero.attacking=true; hero.t=0; } }
function updateHero(dt){
  if(modelHero) return;                                    // GLB hero drives itself in updateModels()
  if(!heroMat) return;
  var moving = player.speed>1.3;
  if(hero.attacking){
    hero.t+=dt; var idx=Math.floor(hero.t/0.085);
    if(idx>=hero.attack.length){ hero.attacking=false; hero.t=0; } else setHeroFrame(hero.attack[idx]);
  }
  if(!hero.attacking){
    if(moving && hero.run.length){ hero.t+=dt*(2.4+player.speed*0.16); setHeroFrame(hero.run[Math.floor(hero.t)%hero.run.length]); }
    else if(hero.idle.length){ hero.t=0; setHeroFrame(hero.idle[0]); }
    else if(hero.run.length){ setHeroFrame(hero.run[0]); }
  }
  playerSprite.rotation.y = Math.atan2(camera.position.x-player.pos.x, camera.position.z-player.pos.z); // Y billboard
}
function makePlayer(){
  var R=RACE[chosen];
  playerObj = new THREE.Group();
  heroMat = new THREE.MeshBasicMaterial({ transparent:true, alphaTest:0.35, side:THREE.DoubleSide, depthWrite:true });
  playerSprite = new THREE.Mesh(new THREE.PlaneGeometry(1,1), heroMat);
  playerSprite.geometry.translate(0,0.5,0);                 // feet at group origin
  playerSprite.scale.set(HERO_H*0.42, HERO_H, 1);
  playerObj.add(playerSprite);
  if(hero.idle.length) setHeroFrame(hero.idle[0]); else if(hero.run.length) setHeroFrame(hero.run[0]);
  auraRing = new THREE.Mesh(new THREE.RingGeometry(0.9,1.5,40),
    new THREE.MeshBasicMaterial({color:R.aura,transparent:true,opacity:0.28,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  auraRing.rotation.x=-Math.PI/2; auraRing.position.y=0.06; playerObj.add(auraRing);
  var blob=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.0), new THREE.MeshBasicMaterial({map:radialTex("rgba(0,0,0,0.55)","rgba(0,0,0,0)"),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2; blob.position.y=0.05; playerObj.add(blob);
  scene.add(playerObj);
  player.pos.set(0, heightAt(0,8), 8);
}

/* ---------------- lights ---------------- */
function makeLights(){
  hemiLight=new THREE.HemisphereLight(0xcfe0e8, 0x46402f, 0.7); scene.add(hemiLight);
  sun=new THREE.DirectionalLight(0xffe4bd, 1.65);
  sun.position.copy(SUN_DIR.clone().multiplyScalar(120)); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  var sc=sun.shadow.camera; sc.near=1; sc.far=420; sc.left=sc.bottom=-110; sc.right=sc.top=110; sun.shadow.bias=-0.0004;
  scene.add(sun); scene.add(sun.target);
  ambLight=new THREE.AmbientLight(0x304048, 0.3); scene.add(ambLight);
}

/* ---------------- post ---------------- */
/* cinematic C-drama colour grade: soft teal shadows, warm highlights, bloom-friendly */
var GRADE_SHADER = {
  uniforms:{ tDiffuse:{value:null} },
  vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:
    "uniform sampler2D tDiffuse; varying vec2 vUv;"+
    "void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;"+
    "  c=(c-0.5)*1.04+0.5;"+                                   // gentle contrast
    "  float l=dot(c,vec3(0.299,0.587,0.114));"+
    "  vec3 shadowT=vec3(0.88,0.99,1.03), highT=vec3(1.03,1.0,0.96);"+  // teal shadows / warm highs
    "  c*=mix(shadowT, highT, smoothstep(0.15,0.85,l));"+
    "  c=mix(vec3(l), c, 1.08);"+                              // saturation lift
    "  vec2 d=vUv-0.5; float vig=smoothstep(0.92,0.32,length(d));"+
    "  c*=mix(0.8,1.0,vig);"+                                  // vignette
    "  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0); }"
};
function makePost(){
  composer=new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene,camera));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), 0.34, 0.42, 0.9);
  composer.addPass(bloom);
  fxaa=new THREE.ShaderPass(THREE.FXAAShader);
  fxaa.material.uniforms["resolution"].value.set(1/innerWidth,1/innerHeight);
  composer.addPass(fxaa);
  var grade=new THREE.ShaderPass(GRADE_SHADER);
  grade.renderToScreen=true; composer.addPass(grade);
}

/* ---------------- input ---------------- */
var keys={}, camYaw=0.4, camPitch=0.08, camDist=9.5, dragging=false, lastX=0,lastY=0;
var touchMove={x:0,y:0,active:false,id:null,ox:0,oy:0};
var BIND={KeyW:"f",ArrowUp:"f",KeyS:"b",ArrowDown:"b",KeyA:"l",ArrowLeft:"l",KeyD:"r",ArrowRight:"r"};
function bindInput(){
  addEventListener("keydown",function(e){ if(BIND[e.code]){keys[BIND[e.code]]=1;e.preventDefault();}
    if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=1;
    if(e.code==="KeyR")keys.up=1; if(e.code==="KeyF")keys.down=1;
    if(e.code==="KeyE")tryObserve();
    if(e.code==="Space"||e.code==="KeyJ"){ heroAttack(); e.preventDefault(); } });
  addEventListener("keyup",function(e){ if(BIND[e.code])keys[BIND[e.code]]=0;
    if(e.code==="KeyR")keys.up=0; if(e.code==="KeyF")keys.down=0;
    if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=0; });
  var cv=renderer.domElement;
  cv.addEventListener("mousedown",function(e){dragging=true;lastX=e.clientX;lastY=e.clientY;});
  addEventListener("mouseup",function(){dragging=false;});
  addEventListener("mousemove",function(e){ if(!dragging)return;
    camYaw-=(e.clientX-lastX)*0.005; camPitch=clamp(camPitch-(e.clientY-lastY)*0.004,-0.2,1.0); lastX=e.clientX;lastY=e.clientY; });
  addEventListener("wheel",function(e){ camDist=clamp(camDist+e.deltaY*0.01,4,16); },{passive:true});
  // touch
  var stick=$("stickL");
  addEventListener("touchstart",function(e){
    for(var i=0;i<e.changedTouches.length;i++){ var t=e.changedTouches[i];
      if(t.clientX<innerWidth*0.5 && !touchMove.active){ touchMove.active=true;touchMove.id=t.identifier;touchMove.ox=t.clientX;touchMove.oy=t.clientY; }
      else { dragging=true; lastX=t.clientX; lastY=t.clientY; touchMove._look=t.identifier; } }
  },{passive:true});
  addEventListener("touchmove",function(e){
    for(var i=0;i<e.changedTouches.length;i++){ var t=e.changedTouches[i];
      if(t.identifier===touchMove.id){ touchMove.x=clamp((t.clientX-touchMove.ox)/50,-1,1); touchMove.y=clamp((t.clientY-touchMove.oy)/50,-1,1);
        stick.querySelector(".nub").style.transform="translate("+touchMove.x*30+"px,"+touchMove.y*30+"px)"; }
      else if(t.identifier===touchMove._look){ camYaw-=(t.clientX-lastX)*0.006; camPitch=clamp(camPitch-(t.clientY-lastY)*0.005,-0.2,1.0); lastX=t.clientX;lastY=t.clientY; } }
  },{passive:true});
  addEventListener("touchend",function(e){
    for(var i=0;i<e.changedTouches.length;i++){ var t=e.changedTouches[i];
      if(t.identifier===touchMove.id){ touchMove.active=false;touchMove.x=0;touchMove.y=0; $("stickL").querySelector(".nub").style.transform=""; }
      if(t.identifier===touchMove._look){ dragging=false; touchMove._look=null; } }
    if(!e.touches.length){ /* tap = observe if near */ }
  },{passive:true});
  // tap to observe (center tap)
  cv.addEventListener("click",function(){ if(nearPOI) tryObserve(); else heroAttack(); });
}
function padPoll(){
  var gp=(navigator.getGamepads&&navigator.getGamepads()[0]); if(!gp)return;
  var lx=gp.axes[0]||0, ly=gp.axes[1]||0, rx=gp.axes[2]||0, ry=gp.axes[3]||0;
  if(Math.abs(lx)>0.15||Math.abs(ly)>0.15){ touchMove.active=true; touchMove.x=lx; touchMove.y=ly; }
  else if(touchMove.id===null){ touchMove.active=false; touchMove.x=0; touchMove.y=0; }
  camYaw-=rx*0.04; camPitch=clamp(camPitch-ry*0.03,-0.2,1.0);
  keys.run = gp.buttons[0]&&gp.buttons[0].pressed?1:keys.run;
  if(gp.buttons[2]&&gp.buttons[2].pressed) tryObserve();
}
function clamp(v,a,b){return v<a?a:v>b?b:v;}

/* ---------------- observe / lore ---------------- */
var nearPOI=null, loreTimer=0;
function tryObserve(){ if(!nearPOI)return; var d=STR.poi[nearPOI.id];
  var el=$("lore"); el.querySelector(".ln").textContent=STR.subtitle; el.querySelector(".lt").textContent=d.name;
  el.querySelector(".lb").textContent=d.lore; el.style.opacity="1"; loreTimer=6.5; $("prompt").style.opacity="0"; }

/* ---------------- loop ---------------- */
var paused=false, devOn=false, frames=0, fpsT=0;
function tick(now){
  requestAnimationFrame(tick);
  if(paused)return;
  var dt=Math.min(0.05,(now-clock.last)/1000||0.016); clock.last=now;
  update(dt, now/1000);
  composer.render();
  if(devOn){ frames++; if(now-fpsT>=500){ $("dev").textContent=Math.round(frames*1000/(now-fpsT))+" fps"; frames=0; fpsT=now; } }
}
function update(dt, t){
  padPoll();
  // movement in camera space
  var mx=0,mz=0;
  if(keys.f)mz-=1; if(keys.b)mz+=1; if(keys.l)mx-=1; if(keys.r)mx+=1;
  if(touchMove.active){ mx+=touchMove.x; mz+=touchMove.y; }
  var len=Math.hypot(mx,mz);
  var moving=len>0.08;
  if(moving){ mx/=len||1; mz/=len||1;
    var cos=Math.cos(camYaw), sin=Math.sin(camYaw);
    var wx=mx*cos - mz*sin, wz=mx*sin + mz*cos;
    var run=keys.run?1.9:1;
    var target=new THREE.Vector3(wx,0,wz).multiplyScalar(10.5*run*DEV.speedMul);
    player.vel.lerp(target, 1-Math.pow(0.001,dt));
    player.yaw=Math.atan2(wx,wz);
  } else { player.vel.lerp(new THREE.Vector3(), 1-Math.pow(0.0001,dt)); }
  player.speed=player.vel.length();
  player.pos.addScaledVector(player.vel, dt);
  player.pos.x=clamp(player.pos.x,-PLAY,PLAY); player.pos.z=clamp(player.pos.z,-PLAY,PLAY);
  var gy=heightAt(player.pos.x, player.pos.z);
  if(DEV.fly){ if(keys.up)flyH+=dt*24; if(keys.down)flyH-=dt*24; if(flyH<0)flyH=0; player.pos.y=gy+flyH; }
  else { flyH=0; player.pos.y=gy; }
  // place player, hover + bob + sway
  var bob=Math.sin(t*11)*0.05*Math.min(1,player.speed*0.14);
  playerObj.position.set(player.pos.x, player.pos.y+bob, player.pos.z);
  playerObj.rotation.set(0,0,0);
  if(auraRing){ auraRing.material.opacity=(hero.attacking?0.5:0.16)+Math.sin(t*2)*0.08; auraRing.scale.setScalar(1+Math.sin(t*2)*0.06); }
  updateHero(dt);
  // camera third-person, cinematic
  var desiredDist=camDist+(keys.run&&moving?1.5:0);
  var cx=player.pos.x - Math.sin(camYaw)*Math.cos(camPitch)*desiredDist;
  var cz=player.pos.z - Math.cos(camYaw)*Math.cos(camPitch)*desiredDist;
  var cy=player.pos.y + 4.3 + Math.sin(camPitch)*desiredDist*1.05;
  var groundC=heightAt(cx,cz)+1.5; if(cy<groundC)cy=Math.min(groundC, player.pos.y+7.0);  // cap lift so the view stays behind, not overhead
  camera.position.lerp(new THREE.Vector3(cx,cy,cz), 1-Math.pow(0.0015,dt));
  var look=new THREE.Vector3(player.pos.x, player.pos.y+2.4, player.pos.z);
  camera.lookAt(look);
  // subtle cinematic breathing + fov kick
  camera.position.y+=Math.sin(t*1.3)*0.05;
  var fovT=52+(player.speed*0.5); camera.fov+=(fovT-camera.fov)*0.05; camera.updateProjectionMatrix();
  // sun target follows player so shadows stay crisp
  sun.position.copy(SUN_DIR.clone().multiplyScalar(120)).add(player.pos); sun.target.position.copy(player.pos);
  // water + grass + particles animation
  if(waterMat)waterMat.uniforms.t.value=t;
  for(var gw=0;gw<grassWinds.length;gw++) grassWinds[gw].value=t;
  for(var wi=0;wi<windU.length;wi++) windU[wi].value=t;
  updateGrassNear();
  updateModels(dt,t);
  updateVfx(dt,t);
  animParticles(dt,t);
  // POI proximity
  nearPOI=null; var best=1e9;
  for(var i=0;i<poiList.length;i++){ var p=poiList[i]; var d=p.pos.distanceTo(player.pos);
    if(p.group.userData.glow){ p.group.userData.glow.material.opacity=0.5+Math.sin(t*2+i)*0.3; }
    if(d<7 && d<best){ best=d; nearPOI=p; } }
  if(loreTimer>0){ loreTimer-=dt; if(loreTimer<=0)$("lore").style.opacity="0"; }
  else { $("prompt").style.opacity= nearPOI?"1":"0";
    if(nearPOI) $("prompt").textContent = (isTouch?"tap":"E")+" · "+STR.poi[nearPOI.id].name; }
}
function animParticles(dt,t){
  // keep the ambient clouds centred on the player so atmosphere travels with you
  if(motes) motes.position.set(player.pos.x,0,player.pos.z);
  if(petals) petals.position.set(player.pos.x,0,player.pos.z);
  var p=motes.geometry.attributes.position, ar=p.array;
  for(var i=0;i<ar.length;i+=3){ ar[i+1]+=dt*(1.2+((i)%7)*0.1); ar[i]+=Math.sin(t+i)*0.004;
    if(ar[i+1]>44){ ar[i+1]=0; ar[i]=(Math.random()-0.5)*180; ar[i+2]=(Math.random()-0.5)*180; } }
  p.needsUpdate=true;
  var q=petals.geometry.attributes.position, br=q.array;
  for(var j=0;j<br.length;j+=3){ br[j+1]-=dt*2.0; br[j]+=Math.sin(t*1.5+j)*0.03;
    if(br[j+1]<WATER_Y){ br[j+1]=60; br[j]=(Math.random()-0.5)*170; br[j+2]=(Math.random()-0.5)*170; } }
  q.needsUpdate=true;
  for(var k=0;k<mistPlanes.length;k++){ mistPlanes[k].rotation.z+=mistPlanes[k].userData.spin*dt; }
}

/* ---------------- assets loading ---------------- */
var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints>0;
/* derive a tangent-space normal map from an albedo's luminance (Sobel, downscaled) */
function deriveNormal(img, strength){
  var S=512, c=document.createElement("canvas"); c.width=c.height=S;
  var g=c.getContext("2d"); g.drawImage(img,0,0,S,S);
  var src=g.getImageData(0,0,S,S).data, out=g.createImageData(S,S), d=out.data;
  function L(x,y){ x=(x+S)%S; y=(y+S)%S; var i=(y*S+x)*4; return (src[i]*0.299+src[i+1]*0.587+src[i+2]*0.114)/255; }
  for(var y=0;y<S;y++)for(var x=0;x<S;x++){
    var dx=(L(x-1,y)-L(x+1,y))*strength, dy=(L(x,y-1)-L(x,y+1))*strength, nz=1.0;
    var l=Math.sqrt(dx*dx+dy*dy+nz*nz), i=(y*S+x)*4;
    d[i]=(dx/l*0.5+0.5)*255; d[i+1]=(dy/l*0.5+0.5)*255; d[i+2]=(nz/l*0.5+0.5)*255; d[i+3]=255;
  }
  g.putImageData(out,0,0);
  var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.needsUpdate=true; return t;
}
function loadTextures(cb){
  var loader=new THREE.TextureLoader();
  var items=[["grass","./assets/grass_ground.webp"],["rock","./assets/cliff_rock.webp"],
             ["dirt","./assets/dirt_ground.webp"],["sky","./assets/sky_dawn.webp"],
             ["blade","./assets/grass_blade.png"],["flower","./assets/flower_hydrangea.png"],
             ["fern","./assets/fern_bush.png"],["mist","./assets/mist_mountains.webp"]];
  var remaining=items.length;
  function done(){
    try{
      if(tex.grass&&tex.grass.image) tex.grassN=deriveNormal(tex.grass.image,1.7);
      if(tex.rock&&tex.rock.image)   tex.rockN =deriveNormal(tex.rock.image,2.6);
    }catch(e){}
    cb();
  }
  if(!remaining)return done();
  items.forEach(function(it){
    loader.load(it[1], function(tx){ tx.encoding=THREE.sRGBEncoding; tex[it[0]]=tx; if(--remaining===0)done(); },
      undefined, function(){ if(--remaining===0)done(); });
  });
}

/* ---------------- world build + boot ---------------- */
function buildWorld(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0xafcadf); scene.fog=new THREE.FogExp2(0xafcadf,0.0016);
  camera=new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 3000);
  makeLights(); makeSky(); makeTerrain(); makeWater(); makeMountains();
  makePath(); makeGrass(); scatter(); makeVillage(); makeLotus(); makeBridge(); makeFoliage(); makeParticles(); makePOIs(); makePlayer();
  loadModels();
  makePost();
  camera.position.set(0, heightAt(0,20)+6, 22);
  rebuildGrantOrbs(); setDaylight(DEV.day);
  addEventListener("resize", onResize);
  addEventListener("blur", function(){paused=true;}); addEventListener("focus", function(){paused=false;clock.last=performance.now();});
  bindInput();
  requestAnimationFrame(function(t){clock.last=t; requestAnimationFrame(tick);});
}
function onResize(){
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight);
  if(fxaa)fxaa.material.uniforms["resolution"].value.set(1/innerWidth,1/innerHeight);
}

/* audio */
var audio, audioOn=false;
function initAudio(){ audio=new Audio("./assets/ambient_score.m4a"); audio.loop=true; audio.volume=0; }
function toggleAudio(){ if(!audio)return; if(audioOn){audio.pause();audioOn=false;$("audioBtn").textContent=STR.audioOff;}
  else{ audio.play().then(function(){audioOn=true;$("audioBtn").textContent=STR.audioOn; fade(audio,0.55,1200);}).catch(function(){}); } }
function fade(a,to,ms){ var s=a.volume,st=performance.now(); (function step(n){ var k=Math.min(1,(n-st)/ms); a.volume=s+(to-s)*k; if(k<1)requestAnimationFrame(step); })(st); }

/* ================= developer panel + element attunement + hand VFX ================= */
var DEV={speedMul:1, fly:false, day:0.58}, grantedSet={}, attunedId=null,
    grantOrbs=[], handGlow=null, vfxProj=[], flyH=0, _tmpCol=new THREE.Color(), _spark=null;
function sparkTex(){ if(!_spark)_spark=radialTex("rgba(255,255,255,1)","rgba(255,255,255,0)"); return _spark; }
function elById(id){ for(var i=0;i<ELEMENTS.length;i++) if(ELEMENTS[i].id===id) return ELEMENTS[i]; return null; }
function attunedColor(){ var e=attunedId&&elById(attunedId); return e?_tmpCol.setHex(e.color):_tmpCol.setHex(RACE[chosen].aura); }
function makeSprite(col,size){
  var m=new THREE.SpriteMaterial({map:sparkTex(),color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:1});
  var s=new THREE.Sprite(m); s.scale.set(size,size,1); return s;
}
/* world-space position of the hero's hand — attacks are *channelled from here*, never the feet */
function getHandPos(target){
  if(heroHandBone){ heroHandBone.updateWorldMatrix(true,false); target.setFromMatrixPosition(heroHandBone.matrixWorld); return true; }
  var fwd=new THREE.Vector3(Math.sin(player.yaw+HERO_FACING),0,Math.cos(player.yaw+HERO_FACING));
  target.copy(playerObj.position).add(new THREE.Vector3(0,3.3,0)).addScaledVector(fwd,0.9);  // chest/hand height fallback
  return false;
}
function spawnBurst(pos,col){ var s=makeSprite(col,1.5); s.position.copy(pos); scene.add(s); vfxProj.push({o:s,v:new THREE.Vector3(),life:0,max:0.32,kind:"burst"}); }
function fireElementAttack(){
  if(!scene) return;
  var hp=new THREE.Vector3(); getHandPos(hp);
  var col=attunedColor().clone();
  spawnBurst(hp, col);                                          // flash gathered in the hand
  var yaw=(modelHero?player.yaw+HERO_FACING:player.yaw);
  var fwd=new THREE.Vector3(Math.sin(yaw),0.05,Math.cos(yaw)).normalize();
  var sp=makeSprite(col, 2.3); sp.position.copy(hp); scene.add(sp);
  vfxProj.push({o:sp, v:fwd.multiplyScalar(34), life:0, max:0.8, kind:"proj"});
  // three sparkling trailers spiralling from the hand
  for(var i=0;i<3;i++){ var t2=makeSprite(col,1.0); t2.position.copy(hp);
    var f2=fwd.clone().applyAxisAngle(new THREE.Vector3(0,1,0),(i-1)*0.25).multiplyScalar(22+i*4); f2.y=1.5-i;
    scene.add(t2); vfxProj.push({o:t2,v:f2,life:0,max:0.6,kind:"burst"}); }
}
function updateVfx(dt,t){
  if(!scene) return;
  // fire the elemental bolt partway through the attack swing (hand strike moment)
  if(hero.attacking){ hero._at=(hero._at||0)+dt; if(hero._at>0.55 && !hero._fired){ fireElementAttack(); hero._fired=true; } }
  else { hero._at=0; hero._fired=false; }
  for(var i=vfxProj.length-1;i>=0;i--){ var p=vfxProj[i]; p.life+=dt; var k=p.life/p.max;
    if(k>=1){ scene.remove(p.o); vfxProj.splice(i,1); continue; }
    p.o.position.addScaledVector(p.v,dt);
    if(p.kind==="proj"){ var sc=2.3*(1+k*0.7); p.o.scale.set(sc,sc,1); p.o.material.opacity=1-k; p.v.y-=dt*7; }
    else { var s2=1.5*(1+k*2.2); p.o.scale.set(s2,s2,1); p.o.material.opacity=(1-k)*0.9; }
  }
  // channel glow held in the hand (visible energy / "hand sign")
  if(!handGlow){ handGlow=makeSprite(0xffffff,0.8); handGlow.material.opacity=0; scene.add(handGlow); }
  var hp=new THREE.Vector3(); getHandPos(hp); handGlow.position.copy(hp);
  handGlow.material.color.copy(attunedColor());
  var wantOp = hero.attacking?0.95:(attunedId?0.4:0.0);
  handGlow.material.opacity += (wantOp-handGlow.material.opacity)*Math.min(1,dt*8);
  var pulse=0.85+Math.sin(t*6)*0.15, gs=(hero.attacking?1.9:0.7)*pulse; handGlow.scale.set(gs,gs,1);
  // orbiting granted-element motes
  for(var g=0;g<grantOrbs.length;g++){ var ob=grantOrbs[g], a=t*1.1+ob.userData.ph;
    ob.position.set(player.pos.x+Math.cos(a)*1.8, player.pos.y+2.5+Math.sin(t*2+ob.userData.ph)*0.25, player.pos.z+Math.sin(a)*1.8); }
  if(auraRing) auraRing.material.color.copy(attunedColor());
}
function rebuildGrantOrbs(){
  grantOrbs.forEach(function(o){ if(o.parent)o.parent.remove(o); }); grantOrbs=[];
  if(!scene) return; var ids=Object.keys(grantedSet), n=Math.max(1,ids.length);
  ids.forEach(function(id,idx){ var e=elById(id); if(!e)return; var s=makeSprite(e.color,0.75); s.userData.ph=idx*(TAU/n); scene.add(s); grantOrbs.push(s); });
}
function refreshEls(){ [].forEach.call(document.querySelectorAll("#dpElements .el"),function(c){ var id=c.getAttribute("data-id");
  c.classList.toggle("on",!!grantedSet[id]); c.classList.toggle("att",attunedId===id); }); }
function refreshHUD(){ var h=$("granted"); if(!h)return; h.innerHTML="";
  Object.keys(grantedSet).forEach(function(id){ var e=elById(id); if(!e)return; var d=document.createElement("div"); d.className="gchip";
    d.innerHTML='<span class="gd" style="color:'+cssHex(e.color)+';background:'+cssHex(e.color)+'"></span>'+e.name+(attunedId===id?" ✦":""); h.appendChild(d); }); }
function grantElement(id){ if(!elById(id))return; grantedSet[id]=true; rebuildGrantOrbs(); refreshHUD(); }
function revokeElement(id){ delete grantedSet[id]; if(attunedId===id)attunedId=null; rebuildGrantOrbs(); refreshHUD(); }
function setAttuned(id){ attunedId=id; refreshHUD(); }
function teleport(x,z){ player.pos.set(x,heightAt(x,z),z); player.vel.set(0,0,0); flyH=0; }
function setDaylight(v){
  if(sun) sun.intensity=0.5+v*1.5;
  if(hemiLight) hemiLight.intensity=0.35+v*0.5;
  if(ambLight) ambLight.intensity=0.18+v*0.22;
  if(renderer) renderer.toneMappingExposure=0.8+v*0.4;   // keep highlights from blowing out
}
function toggleDev(){ var p=$("devPanel"); if(p) p.classList.toggle("open"); }
function buildDevPanel(){
  var host=$("dpElements"); if(!host||!window.ELEMENTS) return;
  (window.RARITY_ORDER||["common","rare","epic","legendary","mythic"]).forEach(function(rar){
    var els=ELEMENTS.filter(function(e){return e.rarity===rar;}); if(!els.length)return;
    var lab=document.createElement("div"); lab.className="dp-rar"; lab.textContent=rar; host.appendChild(lab);
    var row=document.createElement("div"); row.style.cssText="display:flex;flex-wrap:wrap;gap:6px"; host.appendChild(row);
    els.forEach(function(e){ var c=document.createElement("div"); c.className="el"; c.setAttribute("data-id",e.id); c.title=e.desc;
      c.innerHTML='<span class="ed" style="color:'+cssHex(e.color)+';background:'+cssHex(e.color)+'"></span>'+e.name;
      c.onclick=function(){
        if(!grantedSet[e.id]){ grantElement(e.id); setAttuned(e.id); }
        else if(attunedId!==e.id){ setAttuned(e.id); }
        else { revokeElement(e.id); }
        refreshEls();
      };
      row.appendChild(c);
    });
  });
  $("devBtn").onclick=toggleDev; $("dpClose").onclick=toggleDev;
  $("dpAll").onclick=function(){ ELEMENTS.forEach(function(e){grantElement(e.id);}); if(!attunedId)setAttuned("fire"); refreshEls(); };
  $("dpClear").onclick=function(){ grantedSet={}; attunedId=null; rebuildGrantOrbs(); refreshHUD(); refreshEls(); };
  var tps=[["Village",VILLAGE.x-14,VILLAGE.z+62],["Spawn",0,10],["Spirit Vein",46,-34],["Stele",-54,24],["Shrine",10,-96]];
  var th=$("dpTeleport"); tps.forEach(function(tp){ var b=document.createElement("span"); b.className="tp"; b.textContent=tp[0];
    b.onclick=function(){ if(scene) teleport(tp[1],tp[2]); }; th.appendChild(b); });
  $("dpSpeed").oninput=function(){ DEV.speedMul=parseFloat(this.value); };
  $("dpDay").oninput=function(){ DEV.day=parseFloat(this.value); setDaylight(DEV.day); };
  $("dpFly").onclick=function(){ DEV.fly=!DEV.fly; this.textContent="Fly: "+(DEV.fly?"on":"off"); };
  $("dpFace").onclick=function(){ HERO_FACING+=Math.PI; };
  $("dpFps").onclick=function(){ devOn=!devOn; $("dev").style.display=devOn?"block":"none"; this.textContent="FPS: "+(devOn?"on":"off"); };
  addEventListener("keydown",function(e){ if(e.code==="Backquote"){ toggleDev(); e.preventDefault(); } });
}

/* ---------------- UI wiring ---------------- */
function boot(){
  makeRenderer(); if(isTouch)document.body.classList.add("touch");
  // title text
  $("vkick").textContent=STR.subtitle; $("vtitle").textContent=STR.title; $("vsub").textContent=STR.enterSub||"A cultivation open world";
  $("vorigin").textContent=STR.chooseOrigin; $("enter").textContent=STR.enter; $("load").textContent="";
  $("foot").textContent=STR.vsNote; $("audioBtn").textContent=STR.audioOff;
  $("hint").textContent=isTouch?STR.hintTouch:STR.hintDesktop;
  if(new URLSearchParams(location.search).has("dev")){ devOn=true; $("dev").style.display="block"; }
  // origins
  var wrap=$("origins");
  Object.keys(RACE).forEach(function(k){ var b=document.createElement("div"); b.className="origin"+(k===chosen?" sel":"");
    b.innerHTML='<span class="d" style="color:'+cssHex(RACE[k].aura)+';background:'+cssHex(RACE[k].aura)+'"></span>'+STR.races[k];
    b.onclick=function(){ chosen=k; [].forEach.call(wrap.children,function(c){c.classList.remove("sel");}); b.classList.add("sel"); };
    wrap.appendChild(b); });
  $("enter").classList.add("ready");
  initAudio(); $("audioBtn").onclick=toggleAudio;
  buildDevPanel();
  // preload textures, then allow enter
  loadTextures(function(){ /* ready */ });
  loadHero(function(){ /* hero frames ready */ });
  $("enter").onclick=function(){
    buildWorld();
    var v=$("veil"); v.classList.add("gone");
    setTimeout(function(){ v.style.display="none";
      $("loc").textContent=STR.subtitle; $("loc").style.opacity="1"; $("hint").style.opacity="0.85";
      setTimeout(function(){$("hint").style.opacity="0";},8000);
    }, 1000);
    if(!audioOn) toggleAudio();
  };
}
function cssHex(n){ return "#"+("000000"+n.toString(16)).slice(-6); }

if(!window.THREE){ $("load")&&($("load").textContent="WebGL engine failed to load"); }
else boot();
})();
