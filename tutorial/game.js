/* DAO'S FIELD — Tutorial Region.
   Integrates: the tested cultivation sim (../sim, reused), the Phase-2 GLB world
   (reused models), the Phase-4 character/enemy sprites (reused), into one playable
   tutorial loop: spawn → Dao Tree awakening (15 cards + aura) → Elder → forest →
   gather → fight spirit beast → alchemist pill → cultivate → first technique.
   Data-driven (./data/*.json, ./gamedata/*.json). Saves to localStorage. */
import { createCultivationEngine, makeRng } from "./sim/index.js";
import { QiEngine } from "./qi.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const log = (...a) => console.log("[daosfield]", ...a);
const SAVE_KEY = "daosfield_save_v1";

/* ---------- terrain noise (reused pattern) ---------- */
function hash2(x, z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function vnoise(x,z){ const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
  const a=hash2(xi,zi),b=hash2(xi+1,zi),c=hash2(xi,zi+1),d=hash2(xi+1,zi+1);
  const u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf); return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v; }
function fbm(x,z){ let t=0,a=0.5,f=1; for(let i=0;i<4;i++){t+=a*vnoise(x*f,z*f);f*=2;a*=0.5;} return t; }
const WATER_Y=-1.3;
function riverZ(x){ return -30 + Math.sin(x*0.02)*8; }
function heightAt(x,z){
  let n = fbm(x*0.012+5, z*0.012+2)*5.5 + fbm(x*0.045,z*0.045)*1.4;
  // mountain walls on all four sides bound a larger playable bowl (~330×330 inside the 400 plane)
  n += Math.pow(Math.max(0,(Math.abs(x)-165))/34,2)*12;
  n += Math.pow(Math.max(0,(Math.abs(z)-165))/34,2)*12;
  n -= Math.exp(-Math.pow(z-riverZ(x),2)/(2*9*9))*3.8;         // river channel
  const md=Math.hypot(x+95,z+95); n += Math.max(0,(55-md))*0.5; // NW mountain
  const md2=Math.hypot(x-140,z-120); n += Math.max(0,(46-md2))*0.42; // SE ridge (far forest backdrop)
  return n;
}

/* ---------- three basics ---------- */
let renderer, scene, camera, composer, bloom, fxaa, sun;
const tex = {};
const SUN_DIR = new THREE.Vector3(-0.5,0.62,-0.7).normalize();
function radialTex(a,b){ const c=document.createElement("canvas"); c.width=c.height=128; const g=c.getContext("2d");
  const gr=g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,a); gr.addColorStop(1,b); g.fillStyle=gr; g.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t; }
function makeRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); renderer.setSize(innerWidth,innerHeight);
  renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
}
function makeSky(){
  const uni={top:{value:new THREE.Color(0x2b4a5a)},mid:{value:new THREE.Color(0x9fb8bd)},bot:{value:new THREE.Color(0xe4cfa6)},sun:{value:SUN_DIR.clone()}};
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:uni,
    vertexShader:"varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"varying vec3 vD;uniform vec3 top;uniform vec3 mid;uniform vec3 bot;uniform vec3 sun;void main(){float h=clamp(vD.y*0.5+0.5,0.0,1.0);vec3 c=mix(bot,mid,smoothstep(0.32,0.5,h));c=mix(c,top,smoothstep(0.5,0.9,h));float s=pow(max(dot(normalize(vD),normalize(sun)),0.0),8.0);c+=vec3(1.0,0.85,0.6)*s*0.6;gl_FragColor=vec4(c,1.0);}"});
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900,32,16),mat));
  if(tex.sky){ tex.sky.wrapS=THREE.RepeatWrapping; tex.sky.encoding=THREE.sRGBEncoding;
    const band=new THREE.Mesh(new THREE.CylinderGeometry(850,850,520,64,1,true),new THREE.MeshBasicMaterial({map:tex.sky,side:THREE.BackSide,fog:false,depthWrite:false,transparent:true,opacity:0.96}));
    band.position.y=70; scene.add(band); }
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTex("rgba(255,244,214,1)","rgba(255,220,150,0)"),blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}));
  sp.scale.set(180,180,1); sp.position.copy(SUN_DIR.clone().multiplyScalar(800)); scene.add(sp);
}
function makeLights(){
  scene.add(new THREE.HemisphereLight(0xcfe0e8,0x46402f,0.72));
  sun=new THREE.DirectionalLight(0xffe4bd,1.7); sun.position.copy(SUN_DIR.clone().multiplyScalar(120)); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048); const sc=sun.shadow.camera; sc.near=1;sc.far=380;sc.left=sc.bottom=-90;sc.right=sc.top=90; sun.shadow.bias=-0.0004;
  scene.add(sun); scene.add(sun.target); scene.add(new THREE.AmbientLight(0x2c3a44,0.28));
}
let waterMat;
function makeTerrain(){
  const geo=new THREE.PlaneGeometry(400,400,260,260); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position; for(let i=0;i<pos.count;i++) pos.setY(i,heightAt(pos.getX(i),pos.getZ(i)));
  geo.computeVertexNormals();
  if(tex.grass){tex.grass.wrapS=tex.grass.wrapT=THREE.RepeatWrapping;tex.grass.repeat.set(54,54);}
  if(tex.dirt){tex.dirt.wrapS=tex.dirt.wrapT=THREE.RepeatWrapping;}
  const m=new THREE.MeshStandardMaterial({map:tex.grass||null,color:0xdfe6d2,roughness:1,metalness:0});
  m.onBeforeCompile=(sh)=>{ sh.uniforms.tDirt={value:tex.dirt||tex.grass};
    sh.vertexShader="varying float vUp;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n vUp=normalize(mat3(modelMatrix)*objectNormal).y;");
    sh.fragmentShader="uniform sampler2D tDirt;varying float vUp;\n"+sh.fragmentShader.replace("#include <map_fragment>",
      "#ifdef USE_MAP\n vec3 gc=texture2D(map,vUv).rgb;vec3 dc=texture2D(tDirt,vUv).rgb;float st=1.0-smoothstep(0.72,0.9,vUp);diffuseColor.rgb*=mix(gc,dc,st);\n#endif\n"); };
  m.customProgramCacheKey=()=>"tutTerrain";
  const mesh=new THREE.Mesh(geo,m); mesh.receiveShadow=true; scene.add(mesh);
  waterMat=new THREE.ShaderMaterial({transparent:true,uniforms:{t:{value:0}},
    vertexShader:"varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"varying vec3 vP;uniform float t;void main(){float r=sin(vP.x*0.4+t)*0.5+cos(vP.y*0.5-t*1.2)*0.5;float f=smoothstep(-1.0,1.0,r);vec3 c=mix(vec3(0.09,0.2,0.23),vec3(0.7,0.82,0.86),0.3+f*0.4);c+=vec3(1.0,0.95,0.8)*pow(max(f,0.0),6.0)*0.35;gl_FragColor=vec4(c,0.85);}"});
  const w=new THREE.Mesh(new THREE.PlaneGeometry(400,400,1,1),waterMat); w.rotation.x=-Math.PI/2; w.position.y=WATER_Y; scene.add(w);
}

/* ---------- GLB props ---------- */
const MODELS={house:"./models/house.glb",tree:"./models/tree.glb",mountain:"./models/mountain.glb",cave:"./models/cave.glb",bridge:"./models/bridge.glb"};
const src={};
function normalize(o,targetH){ o.updateMatrixWorld(true); let box=new THREE.Box3().setFromObject(o),sz=new THREE.Vector3();box.getSize(sz);
  const s=targetH/(sz.y||1);o.scale.setScalar(s);o.updateMatrixWorld(true);
  const b2=new THREE.Box3().setFromObject(o),c=new THREE.Vector3();b2.getCenter(c);o.position.x-=c.x;o.position.z-=c.z;o.position.y-=b2.min.y;return o; }
function place(key,x,z,h,rotY,yOff){ if(!src[key])return null; const o=src[key].clone(true); normalize(o,h);
  const g=new THREE.Group(); g.add(o); g.position.set(x,heightAt(x,z)-0.3+(yOff||0),z); g.rotation.y=rotY||0;
  g.traverse(n=>{ if(n.isMesh){n.castShadow=true;n.receiveShadow=true; if(n.material)n.material.metalness=0;} }); scene.add(g); return g; }
function loadModels(){ return new Promise((res)=>{ const loader=new THREE.GLTFLoader(); let n=Object.keys(MODELS).length;
  Object.keys(MODELS).forEach(k=>loader.load(MODELS[k],g=>{src[k]=g.scene;if(--n===0)res();},undefined,()=>{if(--n===0)res();})); }); }

/* ---------- sprite chroma-key (reused) ---------- */
function keySlice(img,cols){ const W=img.width,H=img.height,fw=Math.floor(W/cols),frames=[];
  for(let c=0;c<cols;c++){ const cv=document.createElement("canvas");cv.width=fw;cv.height=H;const g=cv.getContext("2d");
    g.drawImage(img,c*fw,0,fw,H,0,0,fw,H); const id=g.getImageData(0,0,fw,H),d=id.data;
    for(let i=0;i<d.length;i+=4){const r=d[i],gr=d[i+1],b=d[i+2]; if(gr>55&&gr>r*1.15&&gr>b*1.15)d[i+3]=0; else if(gr>r&&gr>b)d[i+1]=Math.max(r,b);}
    g.putImageData(id,0,0); const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.minFilter=THREE.LinearFilter;t.needsUpdate=true; frames.push({tex:t,aspect:fw/H}); }
  return frames; }
function loadImg(sc){ return new Promise(r=>{ const im=new Image(); im.onload=()=>r(im); im.onerror=()=>r(null); im.src=sc; }); }
function billboard(frames0, h){ const mat=new THREE.MeshBasicMaterial({transparent:true,alphaTest:0.35,side:THREE.DoubleSide,depthWrite:true});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat); m.geometry.translate(0,0.5,0); const o={mesh:m,mat,h:h||5.4,frames:{}};
  o.set=(f)=>{ if(!f)return; mat.map=f.tex;mat.needsUpdate=true; m.scale.set(o.h*f.aspect,o.h,1); }; if(frames0)o.set(frames0); return o; }

/* ---------- data + engine ---------- */
let engine, data={};
async function loadJSON(p){ const r=await fetch(p); if(!r.ok) throw new Error("fetch "+p); return r.json(); }

/* ---------- game state ---------- */
const G = {
  save:null, cultivator:null, aura:null, dominant:null,
  hp:100, hpMax:100, qi:100, qiMax:100,
  questIndex:0, inventory:{}, techniques:[], flags:{},
  paused:false, ready:false, inDialogue:false, inAwaken:false, meditating:false,
};
let QUESTS, NPCS_D, ITEMS, TECHS, qiData, qiEngine;

/* ---------- player ---------- */
const player = { pos:new THREE.Vector3(0,0,20), yaw:Math.PI, sprite:null, speed:0, vel:new THREE.Vector3(), attacking:false, at:0, hurtFlash:0 };
let heroFrames={run:[],attack:[],idle:[]};
function makePlayer(){
  player.sprite=billboard(null,5.4); player.sprite.set(heroFrames.idle[0]||heroFrames.run[0]);
  const grp=new THREE.Group(); grp.add(player.sprite.mesh);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({map:radialTex("rgba(0,0,0,0.5)","rgba(0,0,0,0)"),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2; blob.position.y=0.05; grp.add(blob);
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.9,1.5,36),new THREE.MeshBasicMaterial({color:0x3ac9c0,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.06; grp.add(ring); player.ring=ring;
  scene.add(grp); player.group=grp;
}
function heroAttack(){ if(!heroFrames.attack.length||player.attacking)return; player.attacking=true; player.at=0; sfx("swing"); }

/* ---------- interactables ---------- */
const interactables=[]; // {id,pos:Vector3,radius,prompt,onInteract,enabled,mesh?}
function addInteractable(o){ o.pos=o.pos.clone?o.pos:new THREE.Vector3(o.pos[0],heightAt(o.pos[0],o.pos[1]),o.pos[1]); interactables.push(o); return o; }
let nearest=null;

/* ---------- world content ---------- */
let daoTree, meditationStone, herbNodes=[], beast=null, beasts=[];
function buildWorld2(){
  // Dao Tree — the reused tree.glb, scaled monumental, central
  daoTree = place("tree", 0, -8, 42, 0.3);
  if(daoTree){ daoTree.traverse(n=>{ if(n.isMesh&&n.material){ n.material=n.material.clone(); } }); }
  // faint aura motes around the tree
  const tg=new THREE.BufferGeometry(); const N=260,arr=new Float32Array(N*3);
  for(let i=0;i<N;i++){ const a=Math.random()*TAU,r=6+Math.random()*10; arr[i*3]=Math.cos(a)*r; arr[i*3+1]=2+Math.random()*30; arr[i*3+2]=-8+Math.sin(a)*r; }
  tg.setAttribute("position",new THREE.BufferAttribute(arr,3));
  daoMotes=new THREE.Points(tg,new THREE.PointsMaterial({map:radialTex("rgba(220,240,255,1)","rgba(180,220,255,0)"),size:0.5,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.6}));
  scene.add(daoMotes);
  addInteractable({ id:"dao_tree", pos:new THREE.Vector3(0,0,-8), radius:12, prompt:"Touch the Dao Tree", enabled:true,
    onInteract:()=>{ if(!G.flags.awakened) startAwakening(); else banner("The Dao Tree","Its choosing is made. Your fate is set."); } });

  // Village houses (south) + NPCs
  const hpos=[[16,50,0.3],[30,58,1.2],[-12,58,2.3],[38,46,4.6],[6,72,5.1]];
  for(const h of hpos) place("house",h[0],h[1],6,h[2]);
  // Bridge over the river (north path)
  place("bridge",0,riverZ(0),4.5,Math.PI/2,WATER_Y+0.2+0.3);
  // Mountain + cave (NW) — landmark + future content
  place("mountain",-95,-95,44,0.4); place("mountain",-120,-72,28,1.3);
  place("mountain",150,140,40,0.7); place("mountain",128,168,26,2.1); // SE massif
  place("cave",-86,-64,8,0.2); place("cave",150,120,8,1.6);            // second cave (SE)
  // Forests — several clusters spread across the enlarged map so the world feels lived-in.
  // Each cluster: a centre, a radius, a count, and a size range. Data-driven so more can be added.
  const FORESTS=[
    {cx:-10,cz:-92,r:80,n:52,h:[8,14]},   // north woods (across the river — the tutorial forest)
    {cx:120,cz:60,r:60,n:40,h:[9,15]},    // eastern deep forest
    {cx:-120,cz:70,r:55,n:34,h:[7,12]},   // western thicket
    {cx:70,cz:150,r:55,n:30,h:[10,16]},   // SE old-growth (under the massif)
    {cx:-60,cz:150,r:45,n:22,h:[6,10]},   // south copse
  ];
  let seedi=0;
  for(const F of FORESTS){
    let placed=0;
    for(let i=0;i<F.n*3 && placed<F.n;i++){ seedi++;
      const a=hash2(seedi,11)*TAU, rr=Math.sqrt(hash2(seedi,29))*F.r;
      const x=F.cx+Math.cos(a)*rr, z=F.cz+Math.sin(a)*rr;
      if(Math.abs(x)>184||Math.abs(z)>184) continue;
      if(Math.abs(z-riverZ(x))<10) continue;                 // keep the river clear
      if(heightAt(x,z)<WATER_Y+0.5) continue;                // no trees in water
      if(Math.hypot(x,z-(-8))<20) continue;                  // clearing around the Dao Tree
      place("tree",x,z,F.h[0]+hash2(seedi,3)*(F.h[1]-F.h[0]),hash2(seedi,7)*TAU); placed++;
    }
  }
  // standing stones / rock clusters as landmarks in the clearings
  for(let i=0;i<10;i++){ const x=(hash2(i+80,5)-0.5)*320, z=(hash2(i+80,9)-0.5)*320;
    if(Math.abs(x)>180||Math.abs(z)>180||heightAt(x,z)<WATER_Y+1||Math.hypot(x,z-(-8))<24) continue;
    const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(1+hash2(i+80,3)*2,0),new THREE.MeshStandardMaterial({map:tex.rock||null,color:0x8a857a,roughness:1,flatShading:true}));
    rk.position.set(x,heightAt(x,z)+0.6,z); rk.rotation.set(hash2(i,1)*TAU,hash2(i,2)*TAU,hash2(i,4)*TAU); rk.castShadow=true; rk.receiveShadow=true; scene.add(rk);
  }
  // Meditation Stone — near the Dao Tree
  meditationStone=new THREE.Mesh(new THREE.DodecahedronGeometry(1.6,0),new THREE.MeshStandardMaterial({map:tex.rock||null,color:0x8f8a80,roughness:1,flatShading:true}));
  meditationStone.position.set(22,heightAt(22,-4)+1.0,-4); meditationStone.castShadow=true; scene.add(meditationStone);
  addInteractable({ id:"meditation_stone", pos:new THREE.Vector3(22,0,-4), radius:4, prompt:"Meditate & Cultivate", enabled:true, onInteract:startMeditation });

  // Herb nodes (forest)
  for(let i=0;i<6;i++){ const x=(hash2(i+3,41)-0.5)*140, z=-58-hash2(i+3,17)*60; const y=heightAt(x,z);
    const mesh=new THREE.Mesh(new THREE.ConeGeometry(0.35,1.4,5),new THREE.MeshStandardMaterial({color:0x8fe0a0,emissive:0x2f8f5a,emissiveIntensity:0.8,roughness:0.5}));
    mesh.position.set(x,y+0.7,z); scene.add(mesh);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTex("rgba(150,240,180,0.9)","rgba(120,220,150,0)"),blending:THREE.AdditiveBlending,depthWrite:false})); glow.scale.set(3,3,1); glow.position.set(x,y+1,z); scene.add(glow);
    const node=addInteractable({ id:"herb_"+i, pos:new THREE.Vector3(x,0,z), radius:3.2, prompt:"Gather Spirit Herb", enabled:true, mesh, glow,
      onInteract:()=>gatherHerb(node) });
    herbNodes.push(node);
  }
  // Spirit beasts — the tutorial beast (blocks Q5) plus a roaming pack spread across the forests.
  // Data-driven list; tier scales hp/damage/reward so the world stays fightable, not just one duel.
  beast = spawnBeast({ x:20, z:-78, hp:60, dmg:7, tutorial:true, name:"Corrupted Spirit Beast" });
  const PACK=[
    { x:-30,z:-108, hp:48, dmg:6 }, { x:40,z:-120, hp:70, dmg:9 },
    { x:118,z:52,  hp:80, dmg:10 }, { x:140,z:80,  hp:64, dmg:8 },
    { x:-118,z:64, hp:56, dmg:7 }, { x:-132,z:88,  hp:74, dmg:9 },
    { x:74,z:150,  hp:96, dmg:12 }, { x:56,z:132,  hp:82, dmg:10 },
    { x:-58,z:150, hp:52, dmg:7 },
  ];
  for(const b of PACK) spawnBeast(b);
  // NPCs from data
  for(const npc of NPCS_D.npcs) makeNPC(npc);
}
let daoMotes;

/* ---------- NPCs ---------- */
const npcObjs=[];
function makeNPC(npc){
  const x=npc.pos[0], z=npc.pos[1], y=heightAt(x,z);
  // simple robed figure (billboard-ish cone + head) tinted by robe color
  const grp=new THREE.Group(); grp.position.set(x,y,z);
  const robe=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.95,2.1,10),new THREE.MeshStandardMaterial({color:new THREE.Color(npc.robe||"#b8a074"),roughness:0.85}));
  robe.position.y=1.05; robe.castShadow=true; grp.add(robe);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.28,14,14),new THREE.MeshStandardMaterial({color:0xd8b48c,roughness:0.7})); head.position.y=2.4; grp.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,10,0,TAU,0,Math.PI*0.6),new THREE.MeshStandardMaterial({color:0x1a1512})); hair.position.y=2.45; grp.add(hair);
  // name tag (sprite)
  scene.add(grp); npcObjs.push({npc,grp});
  addInteractable({ id:"npc_"+npc.id, npcId:npc.id, pos:new THREE.Vector3(x,0,z), radius:3.4, prompt:"Speak with "+npc.name, enabled:true,
    onInteract:()=>talkTo(npc) });
}

/* ---------- spirit beasts (multi; reused combat pattern) ---------- */
function spawnBeast(cfg){
  const fr=heroFrames.beast; if(!fr||!fr.length) return null;
  const x=cfg.x, z=cfg.z, y=heightAt(x,z);
  const scale=6.2*(0.85+(cfg.hp||60)/120*0.5);
  const bb=billboard(fr[0],scale);
  const grp=new THREE.Group(); grp.add(bb.mesh); grp.position.set(x,y,z); scene.add(grp);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(3.5,3.5),new THREE.MeshBasicMaterial({map:radialTex("rgba(0,0,0,0.5)","rgba(0,0,0,0)"),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2; blob.position.y=0.05; grp.add(blob);
  const b={ grp, bb, frames:fr, home:new THREE.Vector3(x,y,z), pos:new THREE.Vector3(x,y,z),
    hp:cfg.hp||60, hpMax:cfg.hp||60, dmg:cfg.dmg||7, state:"idle", hurt:0, dead:false, atkCd:0,
    tutorial:!!cfg.tutorial, name:cfg.name||"Spirit Beast", status:null };
  // enemy handle consumed by the QiEngine (stable object; engine writes `status` onto it)
  b.handle={ get pos(){return b.pos;}, get alive(){return !b.dead;}, status:null,
    damage:(d,opt)=>hitBeast(b,d,opt&&opt.dot), knock:(dir,f)=>{ if(b.dead)return; b.pos.addScaledVector(dir,Math.min(f,7)*0.5); b.pos.x=clamp(b.pos.x,-184,184); b.pos.z=clamp(b.pos.z,-184,184); } };
  beasts.push(b); return b;
}

/* ---------- boot ---------- */
async function boot(){
  makeRenderer();
  if(("ontouchstart" in window)||navigator.maxTouchPoints>0) document.body.classList.add("touch");
  $("foot").textContent="Tutorial region · reuses Phase-2 world + Phase-4 combat + tested cultivation sim";
  $("hint").textContent=document.body.classList.contains("touch")?"Left stick move · ✦ interact/attack":"WASD move · Shift run · E interact · click/Space attack · Q + 1–5 Qi techniques · 6 Limitless · I bag";
  const tips=["Aura is potential, not power. A Red-aura cultivator can still surpass a White-aura genius.","The Dao Tree chooses once. Your cards are permanent.","Effort adds qi on top of your Aura's pace — the ceiling belongs to the diligent."];
  $("#veil"); $("veil").querySelector(".tip").textContent=tips[Math.floor(Math.random()*tips.length)];
  if(new URLSearchParams(location.search).has("dev")){ $("dev").style.display="block"; window._dev=true; }

  // load data + engine
  const bar=$("loadbar").firstElementChild; const setP=(p)=>bar.style.width=Math.round(p)+"%";
  const [elements,auras,realms,races,destiny,draw,quests,npcs,items,qi] = await Promise.all([
    loadJSON("./gamedata/elements.json"),loadJSON("./gamedata/auras.json"),loadJSON("./gamedata/cultivation_realms.json"),
    loadJSON("./gamedata/races.json"),loadJSON("./gamedata/destiny.json"),loadJSON("./gamedata/draw.json"),
    loadJSON("./data/quests.json"),loadJSON("./data/npcs.json"),loadJSON("./data/items.json"),loadJSON("./data/qi.json") ]);
  engine=createCultivationEngine({elements,auras,realms,races,destiny,draw});
  QUESTS=quests.quests; NPCS_D=npcs; ITEMS=items.items; TECHS=items.techniques; qiData=qi;
  data={elements,auras,realms}; setP(25);

  scene=new THREE.Scene(); scene.background=new THREE.Color(0xc4d3d6); scene.fog=new THREE.FogExp2(0xc4d3d6,0.0045);
  camera=new THREE.PerspectiveCamera(56,innerWidth/innerHeight,0.1,2000);
  makeLights();
  composer=new THREE.EffectComposer(renderer); composer.addPass(new THREE.RenderPass(scene,camera));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.42,0.5,0.88); composer.addPass(bloom);
  fxaa=new THREE.ShaderPass(THREE.FXAAShader); fxaa.material.uniforms.resolution.value.set(1/innerWidth,1/innerHeight); fxaa.renderToScreen=true; composer.addPass(fxaa);

  // textures + sprites + models in parallel
  await Promise.all([
    loadTextures(), loadHeroSprites(), loadModels()
  ]); setP(85);

  makeSky(); makeTerrain(); buildWorld2(); makePlayer(); setP(95);
  initQiEngine();
  bindInput(); initAudio();
  loadSave();                 // restores cards/aura/quest/inventory or leaves fresh
  refreshHUD();
  addEventListener("resize",onResize);
  document.addEventListener("visibilitychange",()=>{ G.paused=document.hidden; if(!G.paused)last=performance.now(); });
  requestAnimationFrame(t=>{last=t; requestAnimationFrame(tick);});
  setP(100); G.ready=true; hideVeil();
  window.__dbg=()=>({pos:[+player.pos.x.toFixed(1),+player.pos.z.toFixed(1)], near:nearest?nearest.id:null, frames:_frames, kf:keys.f||0, spd:+player.speed.toFixed(2), paused:G.paused});
  // test hooks (harmless in prod; used by the headless regression test since rAF is throttled there)
  window.__tp=(x,z)=>{ player.pos.set(x,heightAt(x,z),z); };
  window.__interact=()=>interact();
  window.__attack=()=>heroAttack();
  window.__tech=()=>castTechnique(0);
  window.__qi=(slot)=>castTechnique(slot|0);
  window.__qiState=()=>({ el:G.qiElement, rank:qiRank(), qi:Math.round(G.qi), parts:qiEngine?qiEngine.parts.length:0, proj:qiEngine?qiEngine.projectiles.length:0, decals:qiEngine?qiEngine.decals.length:0, mesh:qiEngine?qiEngine.meshFx.length:0, statuses:qiEngine?qiEngine.statuses.length:0, guard:!!G.guard });
  window.__beasts=()=>beasts.map(b=>({dead:b.dead,hp:Math.round(b.hp),st:b.handle.status?b.handle.status.id:null,tut:!!b.tutorial}));
  // dev harness hooks (used by the headless Qi regression; harmless in prod)
  window.__qidev={ unlock:()=>unlockTechnique(), setQi:(v)=>{G.qi=G.qiMax=v;}, setEl:(e)=>{G.qiElement=e;},
    setRank:(r)=>{ if(G.cultivator)G.cultivator.realmIndex=r; }, face:(y)=>{player.yaw=y;},
    beastPos:()=>beast?[+beast.pos.x.toFixed(1),+beast.pos.z.toFixed(1),Math.round(beast.hp)]:null,
    weaken:()=>{ for(const b of beasts) if(b.tutorial) b.hp=Math.min(b.hp,6); }, guard:()=>!!G.guard };
  window.__state=()=>({q:G.questIndex, quest:currentQuest()&&currentQuest().id, awakened:!!G.flags.awakened, aura:G.aura&&G.aura.tierId, dom:G.dominant, inv:{...G.inventory}, tech:[...G.techniques], hp:Math.round(G.hp), realm:G.cultivator?G.cultivator.realmIndex:-1, layer:G.cultivator?G.cultivator.layer:0, beastDead:!!(beast&&beast.dead), near:nearest?nearest.id:null, dlg:G.inDialogue, med:G.meditating});
  window.__beastPos=()=>beast?[+beast.pos.x.toFixed(1),+beast.pos.z.toFixed(1),beast.hp]:null;
  window.__step=(n=1)=>{ for(let i=0;i<n;i++) update(0.1, performance.now()/1000); };
  window.__herbs=()=>herbNodes.map(h=>[+h.pos.x.toFixed(1),+h.pos.z.toFixed(1),h.enabled]);
  log("boot complete. awakened=",!!G.flags.awakened,"quest=",G.questIndex);
}

const vfxTex={};
function loadTextures(){ return new Promise(res=>{ const l=new THREE.TextureLoader();
  const items=[["grass","./assets/grass_ground.webp"],["dirt","./assets/dirt_ground.webp"],["rock","./assets/cliff_rock.webp"],["sky","./assets/sky_dawn.webp"]];
  // Qi VFX textures (Higgsfield-generated, keyed): particle sprites + ground decals
  const vfx=[["smoke","./assets/vfx_smoke.webp"],["dust","./assets/vfx_dust.webp"],["splash","./assets/vfx_splash.webp"],["leaf","./assets/vfx_leaf.webp"],["scorch","./assets/decal_scorch.webp"],["crack","./assets/decal_crack.webp"],["hollow","./assets/vfx_hollow.webp"]];
  let n=items.length+vfx.length;
  items.forEach(it=>l.load(it[1],tx=>{tx.encoding=THREE.sRGBEncoding;tex[it[0]]=tx;if(--n===0)res();},undefined,()=>{if(--n===0)res();}));
  vfx.forEach(it=>l.load(it[1],tx=>{tx.encoding=THREE.sRGBEncoding;tx.minFilter=THREE.LinearFilter;vfxTex[it[0]]=tx;if(--n===0)res();},undefined,()=>{if(--n===0)res();})); }); }
async function loadHeroSprites(){
  const [run,atk,idle,beast]=await Promise.all([loadImg("./assets/hero_run.webp"),loadImg("./assets/hero_attack.webp"),loadImg("./assets/hero_idle.webp"),loadImg("./assets/enemy_demon_beast.webp")]);
  if(run)heroFrames.run=keySlice(run,6); if(atk)heroFrames.attack=keySlice(atk,5); if(idle)heroFrames.idle=keySlice(idle,1); if(beast)heroFrames.beast=keySlice(beast,4);
}

/* ---------- awakening (uses the tested sim) ---------- */
function startAwakening(){
  if(G.flags.awakened) return;
  const seed=(G.save&&G.save.seed) || (Math.floor(Math.random()*1e9));
  G.cultivator=engine.createCultivator({ race:"human", seed });
  G.aura=G.cultivator.aura; G.dominant=G.aura.dominantElement;
  G.flags.awakened=true; G.flags.seed=seed;
  G.hpMax=Math.min(400,80+Math.round(G.cultivator.stats.vitality)); G.hp=G.hpMax;
  G.qiMax=Math.min(400,80+Math.round(G.cultivator.stats.qi)); G.qi=G.qiMax;
  // present
  G.inAwaken=true; const ov=$("awaken"); ov.classList.add("on");
  const row=$("cardrow"); row.innerHTML="";
  const elColors={earth:"#c79a5b",fire:"#e8623a",water:"#43a6ef",wood:"#54c07a",gold:"#e8c53a",wind:"#9fe8c0",lightning:"#b56ce8",light:"#f3ecc4",dark:"#8a6ad0"};
  const glyphD={physique:"骸",spiritual_root:"根",soul:"魂",comprehension:"悟",luck:"福",destiny:"命"};
  const cards=[];
  G.cultivator.elementCards.forEach(e=>cards.push({g:"◈",n:e,c:elColors[e]||"#ccc"}));
  G.cultivator.destinyCards.forEach(d=>cards.push({g:glyphD[d.aspect]||"✦",n:d.name,c:"#e8c53a"}));
  cards.forEach((cd,i)=>{ const el=document.createElement("div"); el.className="hcard";
    el.innerHTML='<div class="g" style="color:'+cd.c+'">'+cd.g+'</div><div class="n">'+cd.n+'</div>'; row.appendChild(el);
    setTimeout(()=>el.classList.add("show"), 250+i*140); });
  const tier=G.aura.tier;
  setTimeout(()=>{ const ar=$("auraReveal"); ar.textContent=tier.id.toUpperCase()+" AURA";
    ov.style.setProperty("--ac",tier.color||"#fff"); ar.style.color=tier.color||"#fff"; ar.style.opacity="1";
    const sub=$("auraSub"); sub.style.opacity="1";
    sub.innerHTML="Dominant element: <b style='color:"+(elColors[G.dominant]||"#fff")+"'>"+G.dominant+"</b> ("+G.aura.auraCount+"× ) · cultivation ×"+tier.cultivationSpeedMult+
      "<br><span style='opacity:.85'>Aura is <b>potential</b>, not power. Grow through effort — the ceiling belongs to the diligent.</span>";
    sfx("chime");
  }, 250+cards.length*140+400);
  save();
  log("awakening: aura",G.aura.tierId,"dominant",G.dominant,"seed",seed);
}
function closeAwakening(){ $("awaken").classList.remove("on"); G.inAwaken=false; if(G.questIndex===0) advanceQuest("interact","dao_tree"); }

/* ---------- dialogue ---------- */
let dlgQueue=[], dlgCb=null;
function talkTo(npc){
  const lines=[...(npc.dialogue.default||["..."])];
  if(npc.id==="elder" && G.aura){
    const ba=npc.dialogue.byAura&&npc.dialogue.byAura[G.aura.tierId]; if(ba) lines.splice(1,0,ba);
    const be=npc.dialogue.byElement&&npc.dialogue.byElement[G.dominant]; if(be) lines.splice(2,0,be);
  }
  showDialogue(npc, lines, ()=>{
    if(npc.id==="elder") advanceQuest("talk","elder");
    if(npc.id==="alchemist" && QUESTS[G.questIndex] && QUESTS[G.questIndex].trigger.target==="alchemist"){
      addItem("foundation_pill",1); banner("Received","Foundation Pill ×1"); advanceQuest("talk","alchemist");
    }
    if(npc.id==="blacksmith" && !G.flags.gotSword){ addItem("iron_sword",1); G.flags.gotSword=true; banner("Received","Iron Sword"); save(); }
  });
}
function showDialogue(npc, lines, cb){
  G.inDialogue=true; dlgQueue=lines.slice(); dlgCb=cb; const box=$("dlg"); box.classList.add("on");
  box.querySelector(".nm").textContent=npc.name;
  const por=box.querySelector(".por"); por.style.backgroundImage=npc.portrait?("url('"+npc.portrait+"')"):"none";
  nextLine();
}
function nextLine(){ const box=$("dlg"); if(!dlgQueue.length){ box.classList.remove("on"); G.inDialogue=false; const cb=dlgCb; dlgCb=null; if(cb)cb(); return; }
  box.querySelector(".tx").textContent=dlgQueue.shift(); box.querySelector(".cont").textContent=dlgQueue.length?"▾ continue":"▾ end"; }

/* ---------- gathering ---------- */
function gatherHerb(node){ if(!node.enabled) return; node.enabled=false; if(node.mesh)node.mesh.visible=false; if(node.glow)node.glow.visible=false;
  addItem("spirit_herb",1); sfx("pickup"); banner("Gathered","Spirit Herb ×1  ("+(G.inventory.spirit_herb||0)+")");
  advanceQuest("gather","spirit_herb"); save(); }

/* ---------- combat ---------- */
function hitBeast(b,dmg,dot){ if(!b||b.dead)return; b.hp-=dmg; b.hurt=0.4;
  if(!dot){ hitstop=Math.max(hitstop,0.05); shake=Math.max(shake,0.4); sfx("hit"); spawnDamage(b.pos, dmg); }
  if(b.hp<=0) killBeast(b); }
function killBeast(b){ if(b.dead)return; b.dead=true; b.state="dead"; b.status=null; b.handle.status=null;
  setTimeout(()=>{ if(b.grp) b.grp.visible=false; }, 1200);
  if(b.tutorial){ G.flags.beastKilled=true; banner("Victory","The "+b.name+" falls."); advanceQuest("kill","spirit_beast"); save(); }
  else { banner("Beast Slain", b.name+" is scattered to qi."); } }
// back-compat: melee path calls damageBeast against the nearest live beast in range
function damageBeast(dmg){ const b=nearestBeast(player.pos,6.5); if(b) hitBeast(b,dmg,false); }
function nearestBeast(p,maxD){ let best=null,bd=maxD==null?1e9:maxD; for(const b of beasts){ if(b.dead)continue; const d=Math.hypot(p.x-b.pos.x,p.z-b.pos.z); if(d<bd){bd=d;best=b;} } return best; }
function hurtPlayer(dmg,source){ if(G.hp<=0)return;
  if(G.guard&&G.guard.time>0){ dmg*=(1-(G.guard.reduce||0));
    if(G.guard.retaliate && source && !source.dead){ hitBeast(source,G.guard.retaliate,false);
      if(G.guard.retaliateStatus){ const def=qiData.statusEffects[G.guard.retaliateStatus]; if(def){ source.status={id:G.guard.retaliateStatus,def,remaining:def.duration,tick:0}; source.handle.status=source.status; if(qiEngine&&!qiEngine.statuses.includes(source.handle))qiEngine.statuses.push(source.handle);} } } }
  G.hp=Math.max(0,G.hp-dmg); player.hurtFlash=0.4; shake=Math.max(shake,0.6); refreshHUD();
  if(G.hp<=0) playerDown(); }
function playerDown(){ banner("Defeated","Your qi scatters — you awaken back in the village. (No cards lost.)");
  setTimeout(()=>{ G.hp=G.hpMax; player.pos.set(10,0,44); refreshHUD(); }, 1400); }

/* ---------- cultivation + technique ---------- */
function startMeditation(){
  if(!G.flags.awakened){ banner("Not yet","Awaken beneath the Dao Tree first."); return; }
  if(G.meditating || !G.cultivator) return;
  G.medPill = (G.inventory.foundation_pill||0)>0; if(G.medPill) addItem("foundation_pill",-1);
  G.meditating=true; G.medT=0; G.medDur=3.2;
  banner("Cultivating","Absorbing qi… " + (G.medPill?"(Foundation Pill consumed)":""));
}
function tickMeditation(dt){    // driven by update() — deterministic, no setInterval throttling
  G.medT += dt;
  engine.cultivate(G.cultivator, 320*(G.medPill?2:1)*dt);
  G.qi = Math.min(G.qiMax, G.qi + dt*40);
  if(G.medT >= G.medDur){
    G.meditating=false;
    if(G.cultivator.readyForBreakthrough){ const r=engine.attemptBreakthrough(G.cultivator, makeRng((G.flags.seed||1)+G.cultivator.history.length), {pillBonus:0.4});
      if(r.success) banner("Breakthrough!","Ascended to "+data.realms.realms[G.cultivator.realmIndex].name); }
    G.hpMax=Math.min(500,80+Math.round(G.cultivator.stats.vitality)); G.qiMax=Math.min(500,80+Math.round(G.cultivator.stats.qi)); G.hp=G.hpMax;
    save();
    const q2=currentQuest();
    if(q2 && q2.trigger.type==="cultivate") advanceQuest("cultivate","meditation_stone");
    else banner("Cultivation","Foundation deepened. Layer "+G.cultivator.layer+".");
  }
  refreshHUD();
}
/* The player's dominant element drives a full 5-technique Qi kit (data in ./data/qi.json).
   Q / 1 = Basic · 2 = Charged · 3 = Area · 4 = Guard · 5 = Dash.
   Breakthroughs raise the upgrade rank (0→2), so cultivation deepens every technique. */
const QI_SLOTS=["basic","charged","area","defense","utility"];
function qiElementOf(){ let el=G.dominant; if(!qiData||!el||!qiData.elements[el]) el="gold"; return el; } // light/dark fall back to gold until authored
function qiRank(){ return clamp(G.cultivator?G.cultivator.realmIndex:0,0,2); }
function initQiEngine(){
  qiEngine=new QiEngine({ THREE, scene, camera, data:qiData, textures:vfxTex,
    hooks:{
      heightAt,
      sfx:(k)=>sfx(k),
      damageNumber:(p,v)=>spawnDamage(p,v),
      shake:(v)=>{ shake=Math.max(shake,v); },
      player:{ get pos(){ return player.pos; } },
      enemies:()=>beasts.filter(b=>!b.dead).map(b=>b.handle),
      dash:(dir,dist,time)=>{ player.dashDir=dir.clone().setY(0).normalize(); player.dashSpeed=dist/Math.max(0.05,time); player.dashT=time; },
      applyBuff:(buff,element,tech)=>{ G.guard={ reduce:buff.damageReduce||0, retaliate:buff.retaliate||0, retaliateStatus:buff.retaliateStatus, regen:buff.regen||0, moveBoost:buff.moveBoost||1, time:buff.duration||5 }; }
    }});
}
function unlockTechnique(){
  const el=qiElementOf(); G.qiElement=el;
  const basic=el+"_basic"; if(!G.techniques.includes(basic)) G.techniques.push(basic);
  G.activeTech=qiData.techniques[basic];
  showTechHUD();
  banner("Technique Awakened", qiData.elements[el].name+" Qi — "+G.activeTech.name); save();
}
// Limitless (JJK inheritance): press 6 after awakening to open the Six Eyes — Blue / Red / Hollow Purple.
// Purely a data-driven element swap; the same engine renders it recoloured. Toggle back to your Dao element.
function toggleLimitless(){
  if(!G.flags||!G.flags.awakened||!qiData||!qiData.elements.limitless) return;
  if(G.qiElement==="limitless"){ G.qiElement=qiElementOf(); banner("Cursed Technique Sealed","Returned to "+qiData.elements[G.qiElement].name+" Qi"); }
  else { G.qiElement="limitless"; banner("Limitless · 無下限","The Six Eyes open — 1 Blue · 2 Red · 3 Hollow Purple · 4 Infinity · 5 Blue Step"); }
  showTechHUD();
}
function showTechHUD(){ if(!G.qiElement||!qiData)return; const el=qiData.elements[G.qiElement];
  const t=(k)=>qiData.techniques[G.qiElement+"_"+k].name;
  $("tech").style.opacity="1";
  $("tech").innerHTML="<b>"+el.name+" Qi</b> · <b>Q</b>/1 "+t("basic")+" &nbsp;·&nbsp; 2 "+t("charged")+" &nbsp;·&nbsp; 3 "+t("area")+" &nbsp;·&nbsp; 4 "+t("defense")+" &nbsp;·&nbsp; 5 "+t("utility");
}
function castTechnique(slot){
  slot=slot|0;
  if(!G.qiElement){ if(G.dominant) G.qiElement=qiElementOf(); else return; }
  if(!qiEngine||!qiData) return;
  const techId=G.qiElement+"_"+(QI_SLOTS[slot]||"basic");
  const def=qiData.techniques[techId]; if(!def) return;
  if(!qiEngine.canCast(techId)){ return; }                 // on cooldown
  if(G.qi<def.qiCost){ banner("Not enough Qi","Meditate to restore qi."); return; }
  const dir=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw));
  const origin=player.pos.clone().add(dir.clone().multiplyScalar(1.7)).setY(player.pos.y+2.3);
  const res=qiEngine.cast(techId, qiRank(), origin, dir);
  if(res&&res.ok){ G.qi-=def.qiCost; refreshHUD();
    if(QUESTS[G.questIndex] && QUESTS[G.questIndex].trigger.type==="technique") advanceQuest("technique","any"); }
}
const bursts=[];
function spawnBurst(origin,col){ const N=80,g=new THREE.BufferGeometry(),a=new Float32Array(N*3),v=[];
  for(let i=0;i<N;i++){ a[i*3]=origin.x;a[i*3+1]=origin.y;a[i*3+2]=origin.z; const dir=new THREE.Vector3((Math.random()-0.5),(Math.random()-0.2),(Math.random()-0.5)).normalize().multiplyScalar(3+Math.random()*7); v.push(dir); }
  g.setAttribute("position",new THREE.BufferAttribute(a,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({map:radialTex("rgba(255,255,255,1)","rgba(255,255,255,0)"),color:col,size:0.7,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  scene.add(p); bursts.push({p,v,life:1}); }

/* ---------- damage numbers ---------- */
function spawnDamage(worldPos,val){ const el=document.createElement("div"); el.textContent=Math.round(val);
  el.style.cssText="position:fixed;z-index:9;pointer-events:none;color:#ffd86a;font:700 22px var(--serif,serif);text-shadow:0 2px 6px #000;transition:all 1s ease-out";
  document.body.appendChild(el); const v=worldPos.clone().setY(worldPos.y+4).project(camera);
  el.style.left=((v.x*0.5+0.5)*innerWidth)+"px"; el.style.top=((-v.y*0.5+0.5)*innerHeight)+"px";
  requestAnimationFrame(()=>{ el.style.top=(parseFloat(el.style.top)-50)+"px"; el.style.opacity="0"; }); setTimeout(()=>el.remove(),1000); }

/* ---------- quests ---------- */
function currentQuest(){ return QUESTS[G.questIndex]; }
function advanceQuest(type,target){
  const q=currentQuest(); if(!q) return; const tr=q.trigger; if(tr.type!==type) return;
  if(tr.target!=="any" && tr.target!==target) return;
  if(tr.count){ G._prog=(G._prog||0)+1; if(G._prog<tr.count){ refreshHUD(); return; } }
  // complete
  G._prog=0; log("quest complete:",q.id);
  banner("Objective Complete", q.title);
  // side-effects on completion
  if(q.id==="q6_alchemist"){ /* pill already given in talk */ }
  G.questIndex++; save();
  const nq=currentQuest();
  if(nq && nq.id==="q8_technique"){ unlockTechnique(); }   // unlock so player can fulfil it
  // bank an out-of-order beast kill so reaching q5 with the beast already dead can't soft-lock
  if(nq && nq.trigger.type==="kill" && G.flags.beastKilled){ refreshHUD(); return advanceQuest("kill", nq.trigger.target); }
  if(!nq){ banner("Tutorial Complete","The first steps of cultivation are yours. The open world awaits."); }
  refreshHUD();
}
// reach-forest check runs in update()

/* ---------- inventory ---------- */
function addItem(id,n){ G.inventory[id]=Math.max(0,(G.inventory[id]||0)+n); refreshInv(); }
function refreshInv(){ const list=$("invlist"); const defs=Object.fromEntries(ITEMS.map(i=>[i.id,i]));
  const keys=Object.keys(G.inventory).filter(k=>G.inventory[k]>0);
  list.innerHTML = keys.length ? keys.map(k=>{const d=defs[k]||{name:k,icon:"•"};return '<div class="it"><span>'+(d.icon||"•")+' '+d.name+'</span><span class="q">×'+G.inventory[k]+'</span></div>';}).join("")
    : '<div class="it" style="opacity:.6">Empty — gather herbs in the forest.</div>'; }

/* ---------- HUD ---------- */
function refreshHUD(){
  const q=currentQuest(); const tr=$("tracker");
  if(q){ tr.querySelector(".qt").textContent="Objective"; tr.querySelector(".qo").textContent=q.objective;
    tr.querySelector(".qp").textContent = q.trigger.count ? (Math.min(G._prog||0,q.trigger.count)+" / "+q.trigger.count) : ""; }
  else { tr.querySelector(".qt").textContent="Complete"; tr.querySelector(".qo").textContent="The tutorial is done — explore freely."; tr.querySelector(".qp").textContent=""; }
  $("vitals").querySelector(".hp>i").style.width=(G.hp/G.hpMax*100)+"%";
  $("vitals").querySelector(".qi>i").style.width=(G.qi/G.qiMax*100)+"%";
  if(G.aura){ const r=data.realms.realms[G.cultivator.realmIndex]; $("badge").innerHTML="<b>"+G.aura.tier.id.toUpperCase()+"</b> aura · "+G.dominant+" · <b>"+r.name+"</b> L"+G.cultivator.layer; }
  else $("badge").textContent="Unawakened — seek the Dao Tree";
}
function banner(k,t){ const b=$("banner"); b.querySelector(".bk").textContent=k; b.querySelector(".bt").textContent=t; b.style.opacity="1"; clearTimeout(banner._t); banner._t=setTimeout(()=>b.style.opacity="0",2200); }

/* ---------- save / load ---------- */
function save(){ try{ const s={ v:1, seed:G.flags.seed, awakened:!!G.flags.awakened, questIndex:G.questIndex,
    inventory:G.inventory, techniques:G.techniques, flags:G.flags,
    cultivation: G.cultivator?{realmIndex:G.cultivator.realmIndex,layer:G.cultivator.layer,progress:G.cultivator.progress,ready:G.cultivator.readyForBreakthrough}:null,
    pos:[player.pos.x,player.pos.z] };
  localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){ log("save failed",e); } }
function loadSave(){ let s=null; try{ s=JSON.parse(localStorage.getItem(SAVE_KEY)||"null"); }catch(e){}
  G.save=s; if(!s){ log("no save — fresh soul"); return; }
  G.flags=s.flags||{}; G.flags.seed=s.seed; G.flags.awakened=!!s.awakened; G.questIndex=s.questIndex||0;
  G.inventory=s.inventory||{}; G.techniques=s.techniques||[];
  if(s.awakened && s.seed!=null){
    G.cultivator=engine.createCultivator({race:"human",seed:s.seed});
    if(s.cultivation){ G.cultivator.realmIndex=s.cultivation.realmIndex; G.cultivator.layer=s.cultivation.layer; G.cultivator.progress=s.cultivation.progress; G.cultivator.readyForBreakthrough=s.cultivation.ready; G.cultivator.stats=engine.deriveStats(G.cultivator); }
    G.aura=G.cultivator.aura; G.dominant=G.aura.dominantElement;
    G.hpMax=Math.min(500,80+Math.round(G.cultivator.stats.vitality)); G.hp=G.hpMax; G.qiMax=Math.min(500,80+Math.round(G.cultivator.stats.qi)); G.qi=G.qiMax;
  }
  if(G.flags.awakened && G.dominant){ G.qiElement=qiElementOf(); if(G.techniques.length){ G.activeTech=qiData.techniques[G.qiElement+"_basic"]; showTechHUD(); } }
  if(s.pos){ player.pos.set(s.pos[0],0,s.pos[1]); }
  refreshInv(); log("save loaded: quest",G.questIndex,"awakened",G.flags.awakened);
}
function resetSoul(){ if(!confirm("Forge a NEW soul? This erases your Heavenly Cards and progress.")) return; localStorage.removeItem(SAVE_KEY); location.reload(); }

/* ---------- input ---------- */
const keys={}; let camYaw=Math.PI, camPitch=0.16, camDist=8.5, drag=false, lx=0, ly=0;
const touchMove={x:0,y:0,active:false,id:null,ox:0,oy:0,look:null};
const BIND={KeyW:"f",ArrowUp:"f",KeyS:"b",ArrowDown:"b",KeyA:"l",ArrowLeft:"l",KeyD:"r",ArrowRight:"r"};
function interact(){ if(G.inAwaken){ closeAwakening(); return; } if(G.inDialogue){ nextLine(); return; } if(nearest&&nearest.enabled) nearest.onInteract(); }
function bindInput(){
  addEventListener("keydown",e=>{ if(BIND[e.code]){keys[BIND[e.code]]=1;} if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=1;
    if(e.code==="KeyE"){ interact(); }
    if(e.code==="Space"||e.code==="Enter"){ if(G.inDialogue){nextLine();} else if(G.inAwaken){closeAwakening();} else heroAttack(); e.preventDefault(); }
    if(e.code==="KeyQ") castTechnique(0);
    if(e.code>="Digit1" && e.code<="Digit5"){ castTechnique(+e.code.slice(5)-1); }
    if(e.code==="Digit6") toggleLimitless();
    if(e.code==="KeyI"){ const p=$("inv"); p.classList.toggle("on"); }
  });
  addEventListener("keyup",e=>{ if(BIND[e.code])keys[BIND[e.code]]=0; if(e.code==="ShiftLeft"||e.code==="ShiftRight")keys.run=0; });
  const cv=renderer.domElement;
  cv.addEventListener("mousedown",e=>{drag=true;lx=e.clientX;ly=e.clientY;});
  addEventListener("mouseup",()=>drag=false);
  addEventListener("mousemove",e=>{ if(!drag)return; camYaw-=(e.clientX-lx)*0.005; camPitch=clamp(camPitch-(e.clientY-ly)*0.004,-0.2,1.0); lx=e.clientX;ly=e.clientY; });
  addEventListener("wheel",e=>{camDist=clamp(camDist+e.deltaY*0.01,4,16);},{passive:true});
  cv.addEventListener("click",()=>{ if(G.inAwaken||G.inDialogue)return; heroAttack(); });
  // touch
  const st=$("stickL");
  addEventListener("touchstart",e=>{ for(const t of e.changedTouches){ if(t.clientX<innerWidth*0.5&&!touchMove.active){touchMove.active=true;touchMove.id=t.identifier;touchMove.ox=t.clientX;touchMove.oy=t.clientY;} else {drag=true;lx=t.clientX;ly=t.clientY;touchMove.look=t.identifier;} } },{passive:true});
  addEventListener("touchmove",e=>{ for(const t of e.changedTouches){ if(t.identifier===touchMove.id){touchMove.x=clamp((t.clientX-touchMove.ox)/46,-1,1);touchMove.y=clamp((t.clientY-touchMove.oy)/46,-1,1);st.querySelector(".nub").style.transform="translate("+touchMove.x*26+"px,"+touchMove.y*26+"px)";} else if(t.identifier===touchMove.look){camYaw-=(t.clientX-lx)*0.006;camPitch=clamp(camPitch-(t.clientY-ly)*0.005,-0.2,1.0);lx=t.clientX;ly=t.clientY;} } },{passive:true});
  addEventListener("touchend",e=>{ for(const t of e.changedTouches){ if(t.identifier===touchMove.id){touchMove.active=false;touchMove.x=0;touchMove.y=0;st.querySelector(".nub").style.transform="";} if(t.identifier===touchMove.look){drag=false;touchMove.look=null;} } },{passive:true});
  $("actBtn").addEventListener("touchstart",e=>{ e.preventDefault(); if(nearest||G.inDialogue||G.inAwaken) interact(); else heroAttack(); },{passive:false});
  $("awakenClose").onclick=closeAwakening;
  $("dlg").onclick=()=>{ if(G.inDialogue) nextLine(); };
  $("audioBtn").onclick=toggleAudio; $("invBtn").onclick=()=>$("inv").classList.toggle("on"); $("resetBtn").onclick=resetSoul;
}

/* ---------- audio (WebAudio SFX + music) ---------- */
let actx, music, musicOn=false, masterGain;
function initAudio(){ music=new Audio("./assets/ambient_score.m4a"); music.loop=true; music.volume=0; }
function ensureCtx(){ if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); masterGain=actx.createGain(); masterGain.gain.value=0.5; masterGain.connect(actx.destination);}catch(e){} } }
function sfx(kind){ ensureCtx(); if(!actx)return; const t=actx.currentTime; const o=actx.createOscillator(),g=actx.createGain(); o.connect(g); g.connect(masterGain);
  if(kind==="swing"){o.type="triangle";o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(180,t+0.15);g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.16);o.start(t);o.stop(t+0.17);}
  else if(kind==="hit"){o.type="square";o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(60,t+0.12);g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.13);o.start(t);o.stop(t+0.14);}
  else if(kind==="pickup"){o.type="sine";o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(880,t+0.12);g.gain.setValueAtTime(0.16,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.16);o.start(t);o.stop(t+0.17);}
  else if(kind==="chime"){[523,659,784,1046].forEach((f,i)=>{const oo=actx.createOscillator(),gg=actx.createGain();oo.type="sine";oo.frequency.value=f;oo.connect(gg);gg.connect(masterGain);gg.gain.setValueAtTime(0,t+i*0.12);gg.gain.linearRampToValueAtTime(0.14,t+i*0.12+0.02);gg.gain.exponentialRampToValueAtTime(0.001,t+i*0.12+0.5);oo.start(t+i*0.12);oo.stop(t+i*0.12+0.6);}); return; }
  else if(kind==="cast"){o.type="sawtooth";o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(900,t+0.25);g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);o.start(t);o.stop(t+0.31);}
}
function toggleAudio(){ ensureCtx(); if(actx&&actx.state==="suspended")actx.resume(); if(!music)return;
  if(musicOn){music.pause();musicOn=false;$("audioBtn").textContent="♪ Muted";}
  else music.play().then(()=>{musicOn=true;$("audioBtn").textContent="♪ Music";const s=performance.now();(function f(n){const k=Math.min(1,(n-s)/1500);music.volume=0.42*k;if(k<1)requestAnimationFrame(f);})(s);}).catch(()=>{}); }

/* ---------- loop ---------- */
let last=0, hitstop=0, shake=0, _frames=0;
function tick(now){ requestAnimationFrame(tick); _frames++; if(G.paused)return;
  let dt=Math.min(0.05,(now-last)/1000||0.016); last=now;
  if(hitstop>0){ hitstop-=dt; dt=0; }
  update(dt, now/1000); composer.render();
  if(window._dev){ $("dev").textContent=Math.round(1/Math.max(0.001,(now-(tick._l||now))/1000))+" fps"; tick._l=now; }
}
function update(dt,t){
  if(qiEngine) qiEngine.update(dt);              // advance all Qi VFX / projectiles / status ticks
  if(G.meditating){ tickMeditation(dt); }
  // guard buff (defensive techniques): decay, regen, expire
  if(G.guard&&G.guard.time>0){ G.guard.time-=dt; if(G.guard.regen&&G.hp<G.hpMax){ G.hp=Math.min(G.hpMax,G.hp+G.guard.regen*dt); refreshHUD(); } if(G.guard.time<=0)G.guard=null; }
  const frozen = G.inDialogue||G.inAwaken||G.meditating;
  let moving=false;
  // dash (movement techniques) overrides normal locomotion for its brief window
  if(player.dashT>0 && !frozen){ player.dashT-=dt; player.pos.addScaledVector(player.dashDir,player.dashSpeed*dt);
    player.yaw=Math.atan2(player.dashDir.x,player.dashDir.z); player.speed=player.dashSpeed; moving=true;
    player.pos.x=clamp(player.pos.x,-184,184); player.pos.z=clamp(player.pos.z,-184,184); player.pos.y=heightAt(player.pos.x,player.pos.z);
    player.group.position.set(player.pos.x,player.pos.y,player.pos.z);
  } else {
  // movement
  let mx=0,mz=0; if(!frozen){ if(keys.f)mz-=1;if(keys.b)mz+=1;if(keys.l)mx-=1;if(keys.r)mx+=1; if(touchMove.active){mx+=touchMove.x;mz+=touchMove.y;} }
  const len=Math.hypot(mx,mz); moving=len>0.08 && !player.attacking;
  const boost=(G.guard&&G.guard.moveBoost)?G.guard.moveBoost:1;
  if(moving){ mx/=len;mz/=len; const cos=Math.cos(camYaw),sin=Math.sin(camYaw); const wx=mx*cos-mz*sin,wz=-mx*sin-mz*cos;
    const sp=(keys.run?15:8)*boost; player.vel.lerp(new THREE.Vector3(wx,0,wz).multiplyScalar(sp),1-Math.pow(0.001,dt)); player.yaw=Math.atan2(wx,wz);
  } else player.vel.lerp(new THREE.Vector3(),1-Math.pow(0.0001,dt));
  player.speed=player.vel.length();
  player.pos.addScaledVector(player.vel,dt);
  player.pos.x=clamp(player.pos.x,-184,184); player.pos.z=clamp(player.pos.z,-184,184);
  player.pos.y=heightAt(player.pos.x,player.pos.z);
  }
  player.group.position.set(player.pos.x,player.pos.y+Math.sin(t*11)*0.05*Math.min(1,player.speed*0.15),player.pos.z);
  player.ring.material.opacity=(G.aura?0.16:0.08)+Math.sin(t*2)*0.06;
  // hero anim
  if(player.attacking){ player.at+=dt; const idx=Math.floor(player.at/0.08); if(idx>=heroFrames.attack.length){player.attacking=false;player.at=0;} else player.sprite.set(heroFrames.attack[idx]);
    if(Math.floor((player.at-dt)/0.08)!==idx && idx===2){ damageBeast(18+Math.round((G.cultivator?G.cultivator.stats.attack:20)*0.1)); }
  } else if(moving && heroFrames.run.length){ player._ap=(player._ap||0)+dt*(2.4+player.speed*0.2); player.sprite.set(heroFrames.run[Math.floor(player._ap)%heroFrames.run.length]); }
  else player.sprite.set(heroFrames.idle[0]||heroFrames.run[0]);
  player.sprite.mesh.rotation.y=Math.atan2(camera.position.x-player.pos.x,camera.position.z-player.pos.z);
  if(player.hurtFlash>0){ player.hurtFlash-=dt; player.sprite.mat.color.setRGB(1,1-player.hurtFlash,1-player.hurtFlash); } else player.sprite.mat.color.setRGB(1,1,1);
  // camera
  const cx=player.pos.x-Math.sin(camYaw)*Math.cos(camPitch)*camDist, cz=player.pos.z-Math.cos(camYaw)*Math.cos(camPitch)*camDist;
  let cy=player.pos.y+3.6+Math.sin(camPitch)*camDist; const gc=heightAt(cx,cz)+1.6; if(cy<gc)cy=gc;
  let sx=0,sy=0; if(shake>0){ shake-=dt*2; sx=(Math.random()-0.5)*shake; sy=(Math.random()-0.5)*shake; }
  camera.position.lerp(new THREE.Vector3(cx+sx,cy+sy,cz),1-Math.pow(0.002,dt));
  camera.lookAt(player.pos.x,player.pos.y+2.4,player.pos.z);
  // sun follows
  sun.position.copy(SUN_DIR.clone().multiplyScalar(120)).add(player.pos); sun.target.position.copy(player.pos);
  if(waterMat)waterMat.uniforms.t.value=t;
  if(daoMotes){ const p=daoMotes.geometry.attributes.position,a=p.array; for(let i=1;i<a.length;i+=3){a[i]+=dt*0.8; if(a[i]>34)a[i]=2;} p.needsUpdate=true; daoMotes.rotation.y+=dt*0.05; }
  // bursts
  for(let i=bursts.length-1;i>=0;i--){ const b=bursts[i]; b.life-=dt*1.6; const a=b.p.geometry.attributes.position.array;
    for(let j=0;j<b.v.length;j++){ a[j*3]+=b.v[j].x*dt;a[j*3+1]+=b.v[j].y*dt-dt*2;a[j*3+2]+=b.v[j].z*dt; } b.p.geometry.attributes.position.needsUpdate=true; b.p.material.opacity=Math.max(0,b.life);
    if(b.life<=0){ scene.remove(b.p); bursts.splice(i,1); } }
  // beasts AI (multi) — aggro within range, status slows the chase, distant ones drift home
  for(const b of beasts){
    if(b.dead){ b.bb.set(b.frames[3]||b.frames[0]); b.grp.position.copy(b.pos); continue; }
    b.bb.mesh.rotation.y=Math.atan2(camera.position.x-b.pos.x,camera.position.z-b.pos.z);
    const stt=b.handle.status, slow=stt?(stt.def.slow||0):0;
    const d=player.pos.distanceTo(b.pos);
    if(b.hurt>0){ b.hurt-=dt; b.bb.set(b.frames[2]||b.frames[0]); }
    else if(d<24 && d>3.4){ const dir=player.pos.clone().sub(b.pos).setY(0).normalize(); b.pos.addScaledVector(dir,4*(1-slow)*dt); b.bb.set(b.frames[1]||b.frames[0]); }
    else { b.bb.set(b.frames[0]);
      if(d>=24){ const dh=b.home.distanceTo(b.pos); if(dh>1.5){ const dir=b.home.clone().sub(b.pos).setY(0).normalize(); b.pos.addScaledVector(dir,1.6*dt); } } }
    b.pos.y=heightAt(b.pos.x,b.pos.z); b.grp.position.copy(b.pos);
    b.atkCd-=dt; if(d<3.6 && b.atkCd<=0 && b.hurt<=0){ b.atkCd=1.6; hurtPlayer(b.dmg,b); }
  }
  // interaction detection
  nearest=null; let best=1e9;
  for(const it of interactables){ if(!it.enabled)continue; const d=Math.hypot(player.pos.x-it.pos.x,player.pos.z-it.pos.z); if(d<it.radius && d<best){best=d;nearest=it;} }
  const pr=$("prompt");
  if(nearest && !frozen){ pr.style.opacity="1"; pr.textContent=(document.body.classList.contains("touch")?"✦ ":"E · ")+nearest.prompt; }
  else pr.style.opacity="0";
  // reach-forest quest
  const q=currentQuest();
  if(q && q.trigger.type==="reach" && q.trigger.target==="forest" && player.pos.z < -42){ advanceQuest("reach","forest"); }
  // qi regen
  if(!G.meditating && G.qiMax){ G.qi=Math.min(G.qiMax,G.qi+dt*3); if((t|0)!==update._q){update._q=t|0; refreshHUD();} }
}

/* ---------- misc ---------- */
function onResize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); if(fxaa)fxaa.material.uniforms.resolution.value.set(1/innerWidth,1/innerHeight); }
function hideVeil(){ const v=$("veil"); v.classList.add("gone"); setTimeout(()=>v.style.display="none",1000); if(!musicOn)toggleAudio(); }

boot().catch(e=>{ console.error(e); const v=$("veil"); if(v){ v.querySelector(".tip").textContent="Failed to start: "+e.message; } });
