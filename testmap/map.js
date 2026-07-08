/* DAO'S FIELD — Test Map (300×300m). Loads Higgsfield-generated GLB models
   (village house, tree, mountain, cave, bridge) into a small explorable area:
   one village, one forest, one mountain, one cave, one river. Global THREE (r128). */
(function () {
"use strict";
var $ = function (id) { return document.getElementById(id); };
var TAU = Math.PI * 2;

/* ---- noise + terrain (300x300, coords -150..150) ---- */
function hash2(x,z){ var s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function vnoise(x,z){ var xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
  var a=hash2(xi,zi),b=hash2(xi+1,zi),c=hash2(xi,zi+1),d=hash2(xi+1,zi+1);
  var u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf); return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v; }
function fbm(x,z){ var t=0,a=0.5,f=1; for(var i=0;i<4;i++){t+=a*vnoise(x*f,z*f);f*=2;a*=0.5;} return t; }
var WATER_Y=-1.3;
function riverZ(x){ return 28 + Math.sin(x*0.018)*16; }               // river meanders along x
function heightAt(x,z){
  var n = fbm(x*0.012+5, z*0.012+2)*6.5 + fbm(x*0.04, z*0.04)*1.6;
  n += Math.pow(Math.max(0,(Math.abs(x)-120))/30,2)*10;               // gentle edge rim
  var river = Math.exp(-Math.pow(z-riverZ(x),2)/(2*10*10));
  n -= river*4.0;                                                      // carve river channel
  // raise the mountain corner so the big rock sits on high ground
  var md=Math.hypot(x+95,z+95); n += Math.max(0,(60-md))*0.5;
  return n;
}

var renderer,scene,camera,composer,bloom,fxaa,sun,tex={},grassMat;
function makeRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
}
var SUN_DIR=new THREE.Vector3(-0.5,0.6,-0.7).normalize();
function radialTex(a,b){var c=document.createElement("canvas");c.width=c.height=128;var g=c.getContext("2d");
  var gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,a);gr.addColorStop(1,b);g.fillStyle=gr;g.fillRect(0,0,128,128);
  var t=new THREE.CanvasTexture(c);t.needsUpdate=true;return t;}
function makeSky(){
  var uni={top:{value:new THREE.Color(0x2b4a5a)},mid:{value:new THREE.Color(0x9fb8bd)},bot:{value:new THREE.Color(0xe4cfa6)},sun:{value:SUN_DIR.clone()}};
  var mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:uni,
    vertexShader:"varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"varying vec3 vD;uniform vec3 top;uniform vec3 mid;uniform vec3 bot;uniform vec3 sun;void main(){float h=clamp(vD.y*0.5+0.5,0.0,1.0);vec3 c=mix(bot,mid,smoothstep(0.32,0.5,h));c=mix(c,top,smoothstep(0.5,0.9,h));float s=pow(max(dot(normalize(vD),normalize(sun)),0.0),8.0);c+=vec3(1.0,0.85,0.6)*s*0.6;gl_FragColor=vec4(c,1.0);}"});
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900,32,16),mat));
  if(tex.sky){ tex.sky.wrapS=THREE.RepeatWrapping;tex.sky.encoding=THREE.sRGBEncoding;
    var band=new THREE.Mesh(new THREE.CylinderGeometry(850,850,520,64,1,true),new THREE.MeshBasicMaterial({map:tex.sky,side:THREE.BackSide,fog:false,depthWrite:false,transparent:true,opacity:0.96}));
    band.position.y=70; scene.add(band); }
  var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTex("rgba(255,244,214,1)","rgba(255,220,150,0)"),blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}));
  sp.scale.set(190,190,1); sp.position.copy(SUN_DIR.clone().multiplyScalar(800)); scene.add(sp);
}
function makeLights(){
  scene.add(new THREE.HemisphereLight(0xcfe0e8,0x46402f,0.75));
  sun=new THREE.DirectionalLight(0xffe4bd,1.7); sun.position.copy(SUN_DIR.clone().multiplyScalar(120)); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048); var sc=sun.shadow.camera; sc.near=1;sc.far=400;sc.left=sc.bottom=-160;sc.right=sc.top=160; sun.shadow.bias=-0.0004;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0x2c3a44,0.28));
}
function makeTerrain(){
  var geo=new THREE.PlaneGeometry(300,300,240,240); geo.rotateX(-Math.PI/2);
  var pos=geo.attributes.position;
  for(var i=0;i<pos.count;i++){ pos.setY(i, heightAt(pos.getX(i),pos.getZ(i))); }
  geo.computeVertexNormals();
  if(tex.grass){tex.grass.wrapS=tex.grass.wrapT=THREE.RepeatWrapping;tex.grass.repeat.set(40,40);}
  if(tex.dirt){tex.dirt.wrapS=tex.dirt.wrapT=THREE.RepeatWrapping;}
  grassMat=new THREE.MeshStandardMaterial({map:tex.grass||null,color:0xdfe6d2,roughness:1,metalness:0});
  // simple slope->dirt splat on the diffuse
  grassMat.onBeforeCompile=function(sh){
    sh.uniforms.tDirt={value:tex.dirt||tex.grass};
    sh.vertexShader="varying float vUp;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n vUp=normalize(mat3(modelMatrix)*objectNormal).y;");
    sh.fragmentShader="uniform sampler2D tDirt;varying float vUp;\n"+sh.fragmentShader.replace("#include <map_fragment>",
      "#ifdef USE_MAP\n vec3 gc=texture2D(map,vUv).rgb; vec3 dc=texture2D(tDirt,vUv).rgb; float st=1.0-smoothstep(0.72,0.9,vUp); diffuseColor.rgb*=mix(gc,dc,st);\n#endif\n");
  };
  grassMat.customProgramCacheKey=function(){return "tmSplat";};
  var m=new THREE.Mesh(geo,grassMat); m.receiveShadow=true; scene.add(m);
  // river water: one plane; visible only where terrain dips below it
  var wm=new THREE.ShaderMaterial({transparent:true,uniforms:{t:{value:0}},
    vertexShader:"varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"varying vec3 vP;uniform float t;void main(){float r=sin(vP.x*0.4+t)*0.5+cos(vP.y*0.5-t*1.2)*0.5;float f=smoothstep(-1.0,1.0,r);vec3 c=mix(vec3(0.09,0.2,0.23),vec3(0.7,0.82,0.86),0.3+f*0.4);c+=vec3(1.0,0.95,0.8)*pow(max(f,0.0),6.0)*0.35;gl_FragColor=vec4(c,0.85);}"});
  window._water=wm; var w=new THREE.Mesh(new THREE.PlaneGeometry(300,300,1,1),wm); w.rotation.x=-Math.PI/2; w.position.y=WATER_Y; scene.add(w);
}

/* ---- GLB models ---- */
var MODELS={ house:"./models/house.glb", tree:"./models/tree.glb", mountain:"./models/mountain.glb", cave:"./models/cave.glb", bridge:"./models/bridge.glb" };
var src={}, loadedN=0, totalN=Object.keys(MODELS).length;
function normalize(obj,targetH){
  obj.updateMatrixWorld(true);
  var box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(); box.getSize(size);
  var s=targetH/(size.y||1); obj.scale.setScalar(s);
  obj.updateMatrixWorld(true);
  var b2=new THREE.Box3().setFromObject(obj), c=new THREE.Vector3(); b2.getCenter(c);
  obj.position.x-=c.x; obj.position.z-=c.z; obj.position.y-=b2.min.y;
  return obj;
}
function place(key,x,z,targetH,rotY,extra){
  if(!src[key]) return null;
  var o=src[key].clone(true); normalize(o,targetH);
  var g=new THREE.Group(); g.add(o); g.position.set(x,heightAt(x,z)-0.3,z); g.rotation.y=rotY||0; if(extra)extra(g);
  g.traverse(function(n){ if(n.isMesh){ n.castShadow=true; n.receiveShadow=true; if(n.material){n.material.metalness=0;} } });
  scene.add(g); return g;
}
function fallbackBox(x,z,w,h,col){ var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),new THREE.MeshStandardMaterial({color:col,roughness:1})); m.position.set(x,heightAt(x,z)+h/2,z); m.castShadow=true; scene.add(m); }

var FEATURES=[]; // {name, x, z, el}
function buildProps(){
  // MOUNTAIN (+ a couple more crags for a small range) at NW corner
  if(src.mountain){ place("mountain",-95,-95,46,0.4); place("mountain",-125,-72,30,1.3); place("mountain",-72,-122,34,2.2); }
  else fallbackBox(-95,-95,40,46,0x6b6f74);
  FEATURES.push({name:"Mountain",x:-95,z:-95});
  // CAVE at the mountain's front base
  if(src.cave) place("cave",-86,-64,8,0.2); else fallbackBox(-86,-64,7,7,0x4a4a4a);
  FEATURES.push({name:"Cave",x:-86,z:-64});
  // FOREST — scatter trees (east + a western grove), avoid river + village + mountain
  var placed=0;
  for(var i=0;i<120 && placed<40;i++){
    var x=(hash2(i,11)-0.5)*280, z=(hash2(i,29)-0.5)*280;
    if(Math.abs(z-riverZ(x))<14) continue;                 // not in river
    if(Math.hypot(x-28,z-58)<34) continue;                 // not in village
    if(Math.hypot(x+95,z+95)<48) continue;                 // not in mountain
    if(heightAt(x,z)<WATER_Y+0.6) continue;
    if(src.tree) place("tree",x,z,9+hash2(i,3)*5,hash2(i,7)*TAU,function(g){g.scale.multiplyScalar(0.9+hash2(i,5)*0.5);});
    else fallbackBox(x,z,2,10,0x35502f);
    placed++;
  }
  FEATURES.push({name:"Forest",x:70,z:-70});
  // VILLAGE — house cluster south of the river
  var vpos=[[10,58,0.2],[26,52,1.1],[42,60,2.4],[18,72,0.6],[36,74,3.5],[52,50,4.6],[30,64,5.4]];
  for(var v=0;v<vpos.length;v++){ if(src.house) place("house",vpos[v][0],vpos[v][1],6,vpos[v][2]); else fallbackBox(vpos[v][0],vpos[v][1],5,5,0x8a6a3a); }
  FEATURES.push({name:"Village",x:28,z:62});
  // RIVER + BRIDGE (bridge spans the channel near the village)
  var bx=8, bz=riverZ(bx);
  if(src.bridge) place("bridge",bx,bz,4.5,0,function(g){g.scale.multiplyScalar(1.4);g.position.y=WATER_Y+0.2;});
  else fallbackBox(bx,bz,12,2,0x6a2f2a);
  FEATURES.push({name:"River",x:bx-30,z:riverZ(bx-30)});
  // labels
  var wrap=$("labels");
  FEATURES.forEach(function(f){ var el=document.createElement("div"); el.className="label"; el.innerHTML="◈ "+f.name; wrap.appendChild(el); f.el=el; f.anchor=new THREE.Vector3(f.x,heightAt(f.x,f.z)+8,f.z); });
  ready=true; hideVeil();
}
function loadModels(){
  var loader=new THREE.GLTFLoader(); var prog=$("#bar");
  Object.keys(MODELS).forEach(function(k){
    loader.load(MODELS[k], function(g){ src[k]=g.scene; step(); },
      undefined, function(e){ console.warn("GLB load failed:",k,e&&e.message); step(); });
  });
  function step(){ loadedN++; $("bar").firstElementChild.style.width=Math.round(loadedN/totalN*100)+"%";
    $("loadtxt").textContent=loadedN+" / "+totalN+" models"; if(loadedN>=totalN) buildProps(); }
}

/* ---- camera controller (walk on terrain / fly) ---- */
var cam={pos:new THREE.Vector3(0,0,120),yaw:Math.PI,pitch:-0.12,fly:false,vy:0};
var keys={},drag=false,lx=0,ly=0,touchMove={x:0,y:0,active:false,id:null,ox:0,oy:0,look:null},sens=1;
var BIND={KeyW:"f",ArrowUp:"f",KeyS:"b",ArrowDown:"b",KeyA:"l",ArrowLeft:"l",KeyD:"r",ArrowRight:"r"};
function bindInput(){
  addEventListener("keydown",function(e){ if(BIND[e.code]){keys[BIND[e.code]]=1;e.preventDefault();}
    if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=1; if(e.code==="Space")keys.up=1; if(e.code==="KeyC")keys.dn=1;
    if(e.code==="KeyF")toggleFly(); });
  addEventListener("keyup",function(e){ if(BIND[e.code])keys[BIND[e.code]]=0; if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=0; if(e.code==="Space")keys.up=0; if(e.code==="KeyC")keys.dn=0; });
  var cv=renderer.domElement;
  cv.addEventListener("mousedown",function(e){drag=true;lx=e.clientX;ly=e.clientY;});
  addEventListener("mouseup",function(){drag=false;});
  addEventListener("mousemove",function(e){ if(!drag)return; cam.yaw-=(e.clientX-lx)*0.004*sens; cam.pitch=clamp(cam.pitch-(e.clientY-ly)*0.003*sens,-1.3,1.3); lx=e.clientX;ly=e.clientY; });
  var st=$("stickL");
  addEventListener("touchstart",function(e){ for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];
    if(t.clientX<innerWidth*0.5&&!touchMove.active){touchMove.active=true;touchMove.id=t.identifier;touchMove.ox=t.clientX;touchMove.oy=t.clientY;}
    else {drag=true;lx=t.clientX;ly=t.clientY;touchMove.look=t.identifier;} } },{passive:true});
  addEventListener("touchmove",function(e){ for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];
    if(t.identifier===touchMove.id){touchMove.x=clamp((t.clientX-touchMove.ox)/48,-1,1);touchMove.y=clamp((t.clientY-touchMove.oy)/48,-1,1);st.querySelector(".nub").style.transform="translate("+touchMove.x*28+"px,"+touchMove.y*28+"px)";}
    else if(t.identifier===touchMove.look){cam.yaw-=(t.clientX-lx)*0.005*sens;cam.pitch=clamp(cam.pitch-(t.clientY-ly)*0.004*sens,-1.3,1.3);lx=t.clientX;ly=t.clientY;} } },{passive:true});
  addEventListener("touchend",function(e){ for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];
    if(t.identifier===touchMove.id){touchMove.active=false;touchMove.x=0;touchMove.y=0;st.querySelector(".nub").style.transform="";}
    if(t.identifier===touchMove.look){drag=false;touchMove.look=null;} } },{passive:true});
  $("flyBtn").onclick=toggleFly;
}
function toggleFly(){ cam.fly=!cam.fly; $("flyBtn").textContent="Fly: "+(cam.fly?"On":"Off"); }
function clamp(v,a,b){return v<a?a:v>b?b:v;}

var ready=false,paused=false,last=0,devOn=false,frames=0,fpsT=0;
function tick(now){ requestAnimationFrame(tick); if(paused)return;
  var dt=Math.min(0.05,(now-last)/1000||0.016); last=now; update(dt,now/1000); composer.render();
  if(devOn){frames++; if(now-fpsT>=500){$("dev").textContent=Math.round(frames*1000/(now-fpsT))+" fps";frames=0;fpsT=now;}}
}
function update(dt,t){
  var mx=0,mz=0; if(keys.f)mz-=1;if(keys.b)mz+=1;if(keys.l)mx-=1;if(keys.r)mx+=1;
  if(touchMove.active){mx+=touchMove.x;mz+=touchMove.y;}
  var sp=(keys.run?46:20);
  var cos=Math.cos(cam.yaw),sin=Math.sin(cam.yaw);
  var wx=mx*cos-mz*sin, wz=mx*sin+mz*cos;
  cam.pos.x=clamp(cam.pos.x+wx*sp*dt,-148,148); cam.pos.z=clamp(cam.pos.z+wz*sp*dt,-148,148);
  if(cam.fly){ if(keys.up)cam.pos.y+=sp*dt; if(keys.dn)cam.pos.y-=sp*dt; cam.pos.y=clamp(cam.pos.y,heightAt(cam.pos.x,cam.pos.z)+1.5,180); }
  else { cam.pos.y=heightAt(cam.pos.x,cam.pos.z)+1.75; }
  camera.position.copy(cam.pos);
  var dir=new THREE.Vector3(Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(cam.yaw)*Math.cos(cam.pitch));
  camera.lookAt(cam.pos.clone().add(dir));
  if(window._water)window._water.uniforms.t.value=t;
  if(sun){sun.position.copy(SUN_DIR.clone().multiplyScalar(120)).add(cam.pos);sun.target.position.copy(cam.pos);}
  // project feature labels
  if(ready){ for(var i=0;i<FEATURES.length;i++){ var f=FEATURES[i]; var v=f.anchor.clone().project(camera);
    if(v.z<1 && v.z>-1){ f.el.style.opacity="1"; f.el.style.left=((v.x*0.5+0.5)*innerWidth)+"px"; f.el.style.top=((-v.y*0.5+0.5)*innerHeight)+"px"; }
    else f.el.style.opacity="0"; } }
}

/* audio */
var audio,audioOn=false;
function initAudio(){audio=new Audio("./assets/ambient_score.m4a");audio.loop=true;audio.volume=0;}
function toggleAudio(){ if(!audio)return; if(audioOn){audio.pause();audioOn=false;$("audioBtn").textContent="♪ Muted";}
  else audio.play().then(function(){audioOn=true;$("audioBtn").textContent="♪ Music";var s=performance.now();(function f(n){var k=Math.min(1,(n-s)/1200);audio.volume=0.5*k;if(k<1)requestAnimationFrame(f);})(s);}).catch(function(){}); }

function hideVeil(){ var v=$("veil"); v.classList.add("gone"); setTimeout(function(){v.style.display="none";},1000); if(!audioOn)toggleAudio(); }
function onResize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); if(fxaa)fxaa.material.uniforms.resolution.value.set(1/innerWidth,1/innerHeight); }

function loadTextures(cb){ var l=new THREE.TextureLoader(); var items=[["grass","./assets/grass_ground.webp"],["dirt","./assets/dirt_ground.webp"],["sky","./assets/sky_dawn.webp"]]; var n=items.length;
  items.forEach(function(it){ l.load(it[1],function(tx){tx.encoding=THREE.sRGBEncoding;tex[it[0]]=tx;if(--n===0)cb();},undefined,function(){if(--n===0)cb();}); }); }

function boot(){
  if(!window.THREE){ $("loadtxt").textContent="WebGL failed to load"; return; }
  if(("ontouchstart" in window)||navigator.maxTouchPoints>0) document.body.classList.add("touch");
  $("vk").textContent="Phase 2 · Test Map"; $("vt").textContent="DAO'S FIELD"; $("vs").textContent="300 × 300 m · village · forest · mountain · cave · river";
  $("title").textContent="Test Map — 300 × 300 m"; $("hint").textContent=(document.body.classList.contains("touch")?"Left stick move · right side look · Fly toggle":"WASD move · drag look · Shift run · F fly (Space/C up-down)");
  $("foot").textContent="Higgsfield-generated 3D models · Phase 2 test map";
  if(new URLSearchParams(location.search).has("dev")){devOn=true;$("dev").style.display="block";}
  makeRenderer();
  scene=new THREE.Scene(); scene.background=new THREE.Color(0xc4d3d6); scene.fog=new THREE.FogExp2(0xc4d3d6,0.0042);
  camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,0.1,2000);
  makeLights();
  composer=new THREE.EffectComposer(renderer); composer.addPass(new THREE.RenderPass(scene,camera));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.4,0.5,0.9); composer.addPass(bloom);
  fxaa=new THREE.ShaderPass(THREE.FXAAShader); fxaa.material.uniforms.resolution.value.set(1/innerWidth,1/innerHeight); fxaa.renderToScreen=true; composer.addPass(fxaa);
  initAudio(); $("audioBtn").onclick=toggleAudio;
  addEventListener("resize",onResize);
  addEventListener("blur",function(){paused=true;}); addEventListener("focus",function(){paused=false;last=performance.now();});
  loadTextures(function(){ makeSky(); makeTerrain(); bindInput(); loadModels(); requestAnimationFrame(function(t){last=t;requestAnimationFrame(tick);}); });
}
boot();
})();
