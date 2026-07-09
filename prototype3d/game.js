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

/* Valley heightfield: rolling hills, a raised rim (bowl), a carved river channel at x≈0 */
var WATER_Y = -1.4;
function heightAt(x, z){
  var n = fbm(x*0.005+3, z*0.005+9)*22;              // large landforms
  n += fbm(x*0.010+11, z*0.010+7)*16;                // rolling hills
  n += fbm(x*0.045, z*0.045)*4.0;                    // fine detail
  var r = Math.sqrt(x*x + z*z);
  n += Math.pow(Math.min(r,520)/300, 2)*70;          // distant rim rises
  var river = Math.exp(-(x*x)/(2*20*20));            // gaussian channel along z
  n -= river*9.0;
  return n;
}
/* walkable ground: flat town plaza inside the river-city footprint, else the terrain */
function groundHeight(x, z){ return (city && city.near(x, z)) ? city.groundAt(x, z) : heightAt(x, z); }

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
var renderer, scene, camera, composer, bloom, fxaa, sun, sky, water, playerObj, auraRing;
var city = null;              // Yunhe Water Town district (rivercity.js)
var inCityZone = false;       // for the location-name HUD swap
var CLAMP = 260;              // playable radius (extended when the town loads)
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
/* grass-tuft alpha texture */
function grassTex(){
  var c=document.createElement("canvas"); c.width=c.height=64; var g=c.getContext("2d");
  g.clearRect(0,0,64,64);
  for(var i=0;i<7;i++){ var x=8+Math.random()*48; g.strokeStyle="rgba(120,170,90,"+(0.6+Math.random()*0.4)+")";
    g.lineWidth=2+Math.random()*2; g.beginPath(); g.moveTo(x,64);
    g.quadraticCurveTo(x+(Math.random()*10-5),34,x+(Math.random()*16-8),6+Math.random()*10); g.stroke(); }
  var t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}

/* ---------------- sky ---------------- */
function makeSky(){
  var uni = {
    top:{value:new THREE.Color(0x2b4a5a)}, mid:{value:new THREE.Color(0x9fb8bd)},
    bot:{value:new THREE.Color(0xe4cfa6)}, sun:{value:SUN_DIR.clone()}
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
      new THREE.MeshBasicMaterial({ map:tex.sky, side:THREE.BackSide, fog:false, depthWrite:false, transparent:true, opacity:0.97 }));
    band.position.y = 120; scene.add(band);
  }
  // sun sprite (bloom picks it up as god-ray source)
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:radialTex("rgba(255,244,214,1)","rgba(255,220,150,0)"),
    color:0xffffff, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false }));
  sp.scale.set(340,340,1); sp.position.copy(SUN_DIR.clone().multiplyScalar(1400)); scene.add(sp);
}

/* ---------------- terrain ---------------- */
function makeTerrain(){
  var SZ=1200, SEG=300;
  var geo = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG);
  geo.rotateX(-Math.PI/2);
  var pos = geo.attributes.position;
  for (var i=0;i<pos.count;i++){ pos.setY(i, heightAt(pos.getX(i), pos.getZ(i))); }
  geo.computeVertexNormals();
  if (tex.grass){ tex.grass.wrapS=tex.grass.wrapT=THREE.RepeatWrapping; tex.grass.repeat.set(64,64); }
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
        " vec3 gcol = texture2D( map, vUv ).rgb;\n" +
        " vec3 dcol = texture2D( tDirt, vUv ).rgb;\n" +
        " vec3 rcol = texture2D( tRock, vUv*0.55 ).rgb;\n" +
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
    transparent:true, uniforms:{ t:{value:0}, sky:{value:new THREE.Color(0xbcd0d6)}, deep:{value:new THREE.Color(0x18343a)} },
    vertexShader:"varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec3 vP; uniform float t; uniform vec3 sky; uniform vec3 deep;"+
      "void main(){ float r=sin(vP.x*0.3+t)*0.5+cos(vP.y*0.35-t*1.3)*0.5;"+
      "float f=smoothstep(-1.0,1.0,r); vec3 c=mix(deep,sky,0.35+f*0.4);"+
      "float spec=pow(max(f,0.0),6.0); c+=vec3(1.0,0.95,0.8)*spec*0.4;"+
      "gl_FragColor=vec4(c,0.82);}"
  });
  var w = new THREE.Mesh(new THREE.PlaneGeometry(60, 1200, 1, 1), waterMat);
  w.rotation.x = -Math.PI/2; w.position.y = WATER_Y; water = w; scene.add(w);
}

/* ---------------- mountains ring ---------------- */
function makeMountains(){
  var mat = new THREE.MeshStandardMaterial({ map:tex.rock||null, color:0x54636b, roughness:1, metalness:0, flatShading:true });
  if (tex.rock){ tex.rock.wrapS=tex.rock.wrapT=THREE.RepeatWrapping; tex.rock.repeat.set(4,4); }
  var snow = new THREE.MeshStandardMaterial({ color:0xdfe7ea, roughness:1 });
  for (var i=0;i<16;i++){
    var a = (i/16)*TAU + hash2(i,3)*0.3;
    var rad = 430 + hash2(i,9)*120;
    var h = 150 + hash2(i,5)*230;
    var geo = new THREE.ConeGeometry(120 + hash2(i,1)*90, h, 6 + (i%3), 3);
    // jitter for craggy silhouette
    var p = geo.attributes.position;
    for (var j=0;j<p.count;j++){ p.setX(j,p.getX(j)+(hash2(j,i)-0.5)*22); p.setZ(j,p.getZ(j)+(hash2(j+7,i)-0.5)*22); }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a)*rad, h/2 - 20, Math.sin(a)*rad);
    m.castShadow = false; scene.add(m);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(60+hash2(i,2)*40, h*0.32, 6, 1), snow);
    cap.position.set(m.position.x, h - h*0.16 - 20, m.position.z); scene.add(cap);
  }
}

/* ---------------- instanced grass with wind ---------------- */
function makeGrass(){
  var blade = new THREE.PlaneGeometry(1.1, 1.5); blade.translate(0,0.75,0);
  var gmat = new THREE.MeshStandardMaterial({ map:grassTex(), alphaTest:0.35, transparent:true,
    side:THREE.DoubleSide, color:0x9dc06a, roughness:1 });
  gmat.onBeforeCompile = function(sh){
    sh.uniforms.t = { value:0 }; grassMat._wind = sh.uniforms.t;
    sh.vertexShader = "uniform float t;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n float sway = sin(t*1.6 + instanceMatrix[3][0]*0.5 + instanceMatrix[3][2]*0.5);\n transformed.x += sway * position.y * 0.28;\n transformed.z += cos(t*1.2 + instanceMatrix[3][0]*0.4) * position.y * 0.14;");
  };
  var N = 9000, inst = new THREE.InstancedMesh(blade, gmat, N);
  var d = new THREE.Object3D(), n=0;
  for (var i=0;i<N;i++){
    var x=(hash2(i,21)-0.5)*300, z=(hash2(i,57)-0.5)*300;
    var y=heightAt(x,z); if (y<WATER_Y+0.4 || y>40) continue;
    d.position.set(x,y,z); d.rotation.y=hash2(i,3)*TAU;
    var s=0.7+hash2(i,8)*0.8; d.scale.set(s,s*(0.8+hash2(i,2)*0.6),s); d.updateMatrix();
    inst.setMatrixAt(n++, d.matrix);
  }
  inst.count = n; inst.castShadow=false; inst.receiveShadow=false; scene.add(inst);
  grassMat._grassInst = inst;
}

/* ---------------- trees + rocks ---------------- */
function scatter(){
  var trunkMat=new THREE.MeshStandardMaterial({color:0x4a3524,roughness:1});
  trees=[];
  for (var i=0;i<74;i++){
    var x=(hash2(i,71)-0.5)*400, z=(hash2(i,33)-0.5)*400, r=Math.sqrt(x*x+z*z);
    var y=heightAt(x,z); if (r<26 || y<WATER_Y+1 || y>72) continue;
    var g=new THREE.Group();
    var hh=8+hash2(i,4)*9;
    var tr=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.72,hh,6), trunkMat); tr.position.y=hh/2; tr.castShadow=true; g.add(tr);
    var tint=new THREE.Color().setHSL(0.27+hash2(i,9)*0.07, 0.40, 0.22+hash2(i,2)*0.09);
    var leafMat=new THREE.MeshStandardMaterial({color:tint,roughness:1,flatShading:true});
    var layers=4+(i%3);
    for (var k=0;k<layers;k++){
      var rad=(3.7 - k*(2.7/layers)) * (0.9+hash2(i+k,5)*0.35);
      var cr=new THREE.Mesh(new THREE.ConeGeometry(rad, 3.4, 7), leafMat);
      cr.position.set((hash2(i+k,3)-0.5)*0.5, hh-1.6+k*1.95, (hash2(i+k,7)-0.5)*0.5);
      cr.rotation.y=hash2(i+k,1)*TAU; cr.castShadow=true; g.add(cr);
    }
    g.position.set(x,y,z); g.rotation.z=(hash2(i,8)-0.5)*0.12; g.scale.setScalar(0.9+hash2(i,6)*0.9);
    g.userData.sway=0.015+hash2(i,4)*0.02; g.userData.ph=hash2(i,2)*TAU; g.userData.baseZ=g.rotation.z;
    scene.add(g); if (trees.length<90) trees.push(g);
  }
  var rockMat=new THREE.MeshStandardMaterial({map:tex.rock||null,color:0x9a948a,roughness:1,flatShading:true});
  for (var j=0;j<82;j++){
    var rx=(hash2(j,12)-0.5)*320, rz=(hash2(j,90)-0.5)*320; var ry=heightAt(rx,rz); if (ry<WATER_Y) continue;
    var rk=new THREE.Mesh(new THREE.IcosahedronGeometry(0.8+hash2(j,5)*2.4, 0), rockMat);
    rk.position.set(rx,ry+0.2,rz); rk.rotation.set(hash2(j,1)*TAU,hash2(j,2)*TAU,hash2(j,3)*TAU);
    rk.scale.set(1,0.6+hash2(j,7)*0.7,1); rk.castShadow=true; rk.receiveShadow=true; scene.add(rk);
  }
}

/* ---------------- particles: spirit motes + petals + mist ---------------- */
var motes, petals, mistPlanes=[], trees=[];
function makeParticles(){
  // motes rising
  var N=1400, g=new THREE.BufferGeometry(), a=new Float32Array(N*3);
  for (var i=0;i<N;i++){ a[i*3]=(Math.random()-0.5)*260; a[i*3+1]=Math.random()*40; a[i*3+2]=(Math.random()-0.5)*260; }
  g.setAttribute("position", new THREE.BufferAttribute(a,3));
  motes = new THREE.Points(g, new THREE.PointsMaterial({ map:radialTex("rgba(255,240,200,1)","rgba(255,220,150,0)"),
    size:0.7, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.8 }));
  scene.add(motes);
  // petals falling
  var M=420, g2=new THREE.BufferGeometry(), b=new Float32Array(M*3);
  for (var j=0;j<M;j++){ b[j*3]=(Math.random()-0.5)*220; b[j*3+1]=Math.random()*60; b[j*3+2]=(Math.random()-0.5)*220; }
  g2.setAttribute("position", new THREE.BufferAttribute(b,3));
  petals = new THREE.Points(g2, new THREE.PointsMaterial({ map:radialTex("rgba(255,205,220,1)","rgba(255,180,200,0)"),
    size:1.1, transparent:true, depthWrite:false, opacity:0.85 }));
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
function heroAttack(){ if(hero.attack.length && !hero.attacking){ hero.attacking=true; hero.t=0; } }
function updateHero(dt){
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
  var hemi=new THREE.HemisphereLight(0xcfe0e8, 0x46402f, 0.7); scene.add(hemi);
  sun=new THREE.DirectionalLight(0xffe4bd, 1.65);
  sun.position.copy(SUN_DIR.clone().multiplyScalar(120)); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  var sc=sun.shadow.camera; sc.near=1; sc.far=360; sc.left=sc.bottom=-90; sc.right=sc.top=90; sun.shadow.bias=-0.0004;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0x304048, 0.3));
}

/* ---------------- post ---------------- */
function makePost(){
  composer=new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene,camera));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), 0.5, 0.4, 0.9);
  composer.addPass(bloom);
  fxaa=new THREE.ShaderPass(THREE.FXAAShader);
  fxaa.material.uniforms["resolution"].value.set(1/innerWidth,1/innerHeight);
  fxaa.renderToScreen=true; composer.addPass(fxaa);
}

/* ---------------- input ---------------- */
var keys={}, camYaw=0.4, camPitch=0.08, camDist=9.5, dragging=false, lastX=0,lastY=0;
var touchMove={x:0,y:0,active:false,id:null,ox:0,oy:0};
var BIND={KeyW:"f",ArrowUp:"f",KeyS:"b",ArrowDown:"b",KeyA:"l",ArrowLeft:"l",KeyD:"r",ArrowRight:"r"};
function bindInput(){
  addEventListener("keydown",function(e){ if(BIND[e.code]){keys[BIND[e.code]]=1;e.preventDefault();}
    if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=1;
    if(e.code==="KeyE")tryObserve();
    if(e.code==="Space"||e.code==="KeyJ"){ heroAttack(); e.preventDefault(); } });
  addEventListener("keyup",function(e){ if(BIND[e.code])keys[BIND[e.code]]=0;
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
    var target=new THREE.Vector3(wx,0,wz).multiplyScalar(10.5*run);
    player.vel.lerp(target, 1-Math.pow(0.001,dt));
    player.yaw=Math.atan2(wx,wz);
  } else { player.vel.lerp(new THREE.Vector3(), 1-Math.pow(0.0001,dt)); }
  player.speed=player.vel.length();
  player.pos.addScaledVector(player.vel, dt);
  player.pos.x=clamp(player.pos.x,-CLAMP,CLAMP); player.pos.z=clamp(player.pos.z,-CLAMP,CLAMP);
  // building / canal / prop collision inside the town
  if(city && city.near(player.pos.x, player.pos.z)) city.resolve(player.pos);
  var gy=groundHeight(player.pos.x, player.pos.z); player.pos.y=gy;
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
  var groundC=groundHeight(cx,cz)+1.5; if(cy<groundC)cy=groundC;
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
  if(grassMat&&grassMat._wind)grassMat._wind.value=t;
  for(var ti=0;ti<trees.length;ti++){ var tg=trees[ti]; tg.rotation.z=tg.userData.baseZ+Math.sin(t*0.7+tg.userData.ph)*tg.userData.sway; }
  animParticles(dt,t);
  if(city) city.update(dt,t);   // boats, lantern flicker, canal ripple, town petals
  // location-name HUD swaps when you cross into the town
  var nowInCity = !!(city && city.near(player.pos.x, player.pos.z));
  if(nowInCity!==inCityZone){ inCityZone=nowInCity; var lc=$("loc"); if(lc){ lc.textContent=nowInCity?STR.cityName:STR.subtitle; lc.style.opacity="1"; } }
  // POI proximity
  nearPOI=null; var best=1e9;
  for(var i=0;i<poiList.length;i++){ var p=poiList[i]; var d=p.pos.distanceTo(player.pos);
    if(p.group && p.group.userData.glow){ p.group.userData.glow.material.opacity=0.5+Math.sin(t*2+i)*0.3; }
    if(d<7 && d<best){ best=d; nearPOI=p; } }
  if(loreTimer>0){ loreTimer-=dt; if(loreTimer<=0)$("lore").style.opacity="0"; }
  else { $("prompt").style.opacity= nearPOI?"1":"0";
    if(nearPOI) $("prompt").textContent = (isTouch?"tap":"E")+" · "+STR.poi[nearPOI.id].name; }
}
function animParticles(dt,t){
  var p=motes.geometry.attributes.position, ar=p.array;
  for(var i=0;i<ar.length;i+=3){ ar[i+1]+=dt*(1.2+((i)%7)*0.1); ar[i]+=Math.sin(t+i)*0.004;
    if(ar[i+1]>44){ ar[i+1]=0; ar[i]=(Math.random()-0.5)*260; ar[i+2]=(Math.random()-0.5)*260; } }
  p.needsUpdate=true;
  var q=petals.geometry.attributes.position, br=q.array;
  for(var j=0;j<br.length;j+=3){ br[j+1]-=dt*2.0; br[j]+=Math.sin(t*1.5+j)*0.03;
    if(br[j+1]<WATER_Y){ br[j+1]=60; br[j]=(Math.random()-0.5)*220; br[j+2]=(Math.random()-0.5)*220; } }
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
             // Yunhe Water Town PBR material set (Higgsfield-generated, weathered)
             ["roof","./assets/city_roof.webp"],["timber","./assets/city_timber.webp"],
             ["citystone","./assets/city_stone.webp"],["paving","./assets/city_paving.webp"],
             ["lanternpaper","./assets/city_lantern.webp"],["plaster","./assets/city_plaster.webp"]];
  var remaining=items.length;
  function done(){
    try{
      if(tex.grass&&tex.grass.image) tex.grassN=deriveNormal(tex.grass.image,1.7);
      if(tex.rock&&tex.rock.image)   tex.rockN =deriveNormal(tex.rock.image,2.6);
      if(tex.roof&&tex.roof.image)   tex.roofN =deriveNormal(tex.roof.image,3.0);
      if(tex.timber&&tex.timber.image) tex.timberN=deriveNormal(tex.timber.image,2.0);
      if(tex.citystone&&tex.citystone.image) tex.citystoneN=deriveNormal(tex.citystone.image,2.4);
      if(tex.paving&&tex.paving.image) tex.pavingN=deriveNormal(tex.paving.image,2.0);
      if(tex.plaster&&tex.plaster.image) tex.plasterN=deriveNormal(tex.plaster.image,1.4);
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
  scene=new THREE.Scene(); scene.background=new THREE.Color(0xc4d3d6); scene.fog=new THREE.FogExp2(0xc4d3d6,0.0040);
  camera=new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 3000);
  makeLights(); makeSky(); makeTerrain(); makeWater(); makeMountains(); makeGrass(); scatter(); makeParticles(); makePOIs();
  // Yunhe Water Town — build the river-city district beyond the starter field
  try {
    if (window.DAO_CITY) {
      city = window.DAO_CITY.build({ THREE:THREE, scene:scene, tex:tex, heightAt:heightAt, hash2:hash2, WATER_Y:WATER_Y });
      for (var ci=0; ci<city.pois.length; ci++){ var cp=city.pois[ci]; poiList.push({ id:cp.id, pos:cp.pos, group:null, active:false }); }
      CLAMP = 440;            // let the player walk north into the town
    }
  } catch(e){ if(window.console) console.warn("river-city build failed:", e); }
  makePlayer();
  makePost();
  camera.position.set(0, heightAt(0,20)+6, 22);
  addEventListener("resize", onResize);
  addEventListener("blur", function(){paused=true;}); addEventListener("focus", function(){paused=false;clock.last=performance.now();});
  bindInput();
  // lightweight debug/telemetry handle (harmless; used by automated smoke tests)
  window.__DAO = { player:player, get city(){return city;}, groundHeight:groundHeight,
    poiCount:function(){return poiList.length;}, teleport:function(x,z){ player.pos.set(x, groundHeight(x,z), z); } };
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
