/* DAO'S FIELD — Yunhe Water Town (云河水镇).
   A hyperreal ancient-Chinese river-city district that plugs into the Human World I
   valley (game.js) WITHOUT touching the existing gameplay systems. It builds a flat
   stone plaza straddling a carved canal at the north head of the valley — "another
   section beyond the starter field" — with modular timber buildings, a great arched
   stone bridge, wooden footbridges, docks, boats, lanterns, cherry trees, market
   props and interactable NPC markers.

   Integration surface (all optional, all namespaced):
     var city = DAO_CITY.build({ THREE, scene, tex, heightAt, hash2, WATER_Y });
     city.near(x,z)      -> is (x,z) inside/near the town footprint
     city.groundAt(x,z)  -> walkable ground height (flat plaza, blended to terrain at edges)
     city.resolve(pos)   -> push player out of buildings / canal (mutates pos.x,z)
     city.pois           -> [{id,pos}] NPC + landmark markers for the host POI system
     city.spawn          -> suggested spawn Vector3 at the south gate
     city.update(dt,t)   -> animate boats, lantern flicker, drifting petals
   Plain script; relies only on the global THREE r128 already loaded by index.html. */
(function () {
"use strict";

window.DAO_CITY = {
  build: function (opts) {
    var THREE = opts.THREE;
    var scene = opts.scene;
    var tex   = opts.tex || {};
    var heightAt = opts.heightAt || function () { return 0; };
    var hash = opts.hash2 || function (a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    var TAU = Math.PI * 2;

    /* ---- footprint & levels (world units) ---------------------------------- */
    var C = {
      cx: 0, cz: -250,          // town centre, north along the river channel
      halfW: 96, z0: -158, z1: -362, // walkable footprint (south gate .. north wall)
      margin: 20,               // terrain-blend band around the edge
      canalHalf: 15,            // half-width of the water channel (along x=0)
      y: 0, waterY: 0           // filled below from terrain sample
    };
    C.y = heightAt(0, C.z0) + 0.6;   // plaza height keyed to the south entrance
    C.waterY = C.y - 2.6;            // canal surface sits below the embankments

    var colliders = [];   // {type:'box',x,z,hw,hd} | {type:'cyl',x,z,r}
    var pois = [];
    var lanterns = [];    // emissive lantern meshes (flicker)
    var lights = [];      // the few real point-lights (hero pools of light)
    var boats = [];       // {grp, path?, t, spd}
    var root = new THREE.Group(); scene.add(root);

    /* ---- material helpers -------------------------------------------------- */
    function clone(t) { if (!t) return null; var c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; return c; }
    function mat(map, color, rough, rx, ry, normal, ns) {
      var m = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, roughness: rough == null ? 0.95 : rough, metalness: 0 });
      if (map) { var c = clone(map); c.repeat.set(rx || 1, ry || 1); if (map.encoding) c.encoding = map.encoding; m.map = c; }
      if (normal) { var n = clone(normal); n.repeat.set(rx || 1, ry || 1); m.normalMap = n; m.normalScale = new THREE.Vector2(ns || 0.7, ns || 0.7); }
      return m;
    }
    // shared, weather-textured materials (generated maps with graceful colour fallback)
    var M = {
      roof:    mat(tex.roof,    0x2b2b30, 0.9,  3, 3, tex.roofN,  0.9),
      timber:  mat(tex.timber,  0x5a2b26, 0.85, 1, 2, tex.timberN, 0.8),
      timberD: mat(tex.timber,  0x3a231b, 0.9,  1, 2, tex.timberN, 0.8),
      stone:   mat(tex.citystone, 0x8a857b, 1, 2, 2, tex.citystoneN, 0.9),
      paving:  mat(tex.paving,  0x76736c, 1, 10, 10, tex.pavingN, 0.7),
      plaster: mat(tex.plaster, 0xd8cfba, 0.95, 2, 2, tex.plasterN, 0.6),
      wood:    mat(tex.timber,  0x6b4a2e, 0.9, 1, 1, tex.timberN, 0.6),
      dark:    new THREE.MeshStandardMaterial({ color: 0x181410, roughness: 1 })
    };
    M.roof.side = THREE.DoubleSide;
    var lanternPaper = new THREE.MeshStandardMaterial({
      color: 0xffd58a, emissive: 0xff9d3c, emissiveIntensity: 1.15, roughness: 0.8,
      map: tex.lanternpaper ? clone(tex.lanternpaper) : null,
      emissiveMap: tex.lanternpaper ? clone(tex.lanternpaper) : null, transparent: true, opacity: 0.96
    });
    var windowGlow = new THREE.MeshBasicMaterial({ color: 0xffc873, transparent: true, opacity: 0.92 });

    /* ---- 1. plaza + canal + retaining walls -------------------------------- */
    function buildGround() {
      var w = C.halfW * 2, d = C.z1 - C.z0; // d negative
      var len = Math.abs(d);
      // two bank plazas (west & east of the canal)
      [-1, 1].forEach(function (s) {
        var bw = C.halfW - C.canalHalf;
        var g = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.2, len), M.paving);
        g.position.set(s * (C.canalHalf + bw / 2), C.y - 0.6, C.cz);
        g.receiveShadow = true; root.add(g);
        // embankment retaining wall facing the canal (stone, mossy waterline)
        var wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, len), M.stone);
        wall.position.set(s * C.canalHalf, C.y - 1.0, C.cz); wall.receiveShadow = true; wall.castShadow = true; root.add(wall);
      });
      // canal water strip (own animated shader-lite material)
      var wmat = new THREE.MeshStandardMaterial({ color: 0x223a38, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.9 });
      wmat.onBeforeCompile = function (sh) {
        sh.uniforms.wt = { value: 0 }; M._water = sh.uniforms.wt;
        sh.vertexShader = "varying vec2 vW;\n" + sh.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\n vW = position.xz;");
        sh.fragmentShader = "uniform float wt; varying vec2 vW;\n" + sh.fragmentShader.replace("#include <color_fragment>",
          "#include <color_fragment>\n float r = sin(vW.x*0.5+wt)*0.5 + cos(vW.y*0.22 - wt*1.2)*0.5;\n diffuseColor.rgb += vec3(0.10,0.16,0.15)*smoothstep(-1.0,1.0,r);\n");
      };
      M._waterMat = wmat;
      var water = new THREE.Mesh(new THREE.PlaneGeometry(C.canalHalf * 2, len, 8, 60), wmat);
      water.rotation.x = -Math.PI / 2; water.position.set(0, C.waterY, C.cz); root.add(water);
      // canal bed
      var bed = new THREE.Mesh(new THREE.BoxGeometry(C.canalHalf * 2, 1, len), M.dark);
      bed.position.set(0, C.waterY - 1.4, C.cz); root.add(bed);
      // block the player from the water: a wall along each bank, with gaps at bridges
      var bridgeZ = [C.cz + 40, C.cz - 20, C.cz - 84]; // where crossings are (entrance / mid / far)
      var seg = 8;
      for (var i = 0; i < len / seg; i++) {
        var z = C.z0 - i * seg - seg / 2; if (z < C.z1) break;
        var onBridge = bridgeZ.some(function (bz) { return Math.abs(z - bz) < 8; });
        if (onBridge) continue;
        colliders.push({ type: 'box', x: -C.canalHalf - 0.4, z: z, hw: 1.2, hd: seg / 2 + 0.2 });
        colliders.push({ type: 'box', x: C.canalHalf + 0.4, z: z, hw: 1.2, hd: seg / 2 + 0.2 });
      }
      C.bridgeZ = bridgeZ;
    }

    /* ---- curved Chinese hip roof (parametric) ------------------------------ */
    function curvedRoof(w, d, h, flare) {
      var seg = 12, g = new THREE.PlaneGeometry(w, d, seg, seg); g.rotateX(-Math.PI / 2);
      var p = g.attributes.position;
      for (var i = 0; i < p.count; i++) {
        var u = p.getX(i) / (w / 2), v = p.getZ(i) / (d / 2);
        var m = Math.max(Math.abs(u), Math.abs(v));           // hip distance
        var y = h * (1 - m);                                  // pyramid slope
        y += flare * Math.pow(m, 7);                          // upturned flared eaves
        p.setY(i, y);
      }
      g.computeVertexNormals();
      var roof = new THREE.Mesh(g, M.roof); roof.castShadow = true; roof.receiveShadow = true;
      var grp = new THREE.Group(); grp.add(roof);
      // dark underside so eaves read solid
      var under = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.3, d * 0.98), M.dark);
      under.position.y = -0.1; grp.add(under);
      // ridge beam
      var ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.35, 0.4), M.dark);
      ridge.position.y = h + 0.05; grp.add(ridge);
      return grp;
    }

    /* ---- a modular timber building ---------------------------------------- */
    // opts: w,d, floors, wallMat, sign, balcony, glow(bool)
    function building(x, z, rot, o) {
      var g = new THREE.Group(); g.position.set(x, C.y, z); g.rotation.y = rot; root.add(g);
      var w = o.w, d = o.d, floors = o.floors || 1, fh = 3.6;
      var wallMat = o.wallMat || M.plaster;
      // stone plinth
      var plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1.0, d + 1.2), M.stone);
      plinth.position.y = 0.5; plinth.receiveShadow = true; plinth.castShadow = true; g.add(plinth);
      for (var f = 0; f < floors; f++) {
        var yb = 1.0 + f * fh;
        // corner posts (aged red timber)
        for (var sx = -1; sx <= 1; sx += 2) for (var sz = -1; sz <= 1; sz += 2) {
          var post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, fh, 8), M.timber);
          post.position.set(sx * w / 2, yb + fh / 2, sz * d / 2); post.castShadow = true; g.add(post);
        }
        // body (slightly inset upper floors)
        var inset = f * 0.5;
        var body = new THREE.Mesh(new THREE.BoxGeometry(w - inset, fh, d - inset), wallMat);
        body.position.y = yb + fh / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
        // lattice windows glowing warm on the long faces
        for (var wf = -1; wf <= 1; wf += 2) {
          var nWin = Math.max(1, Math.floor((w - 2) / 2.4));
          for (var wi = 0; wi < nWin; wi++) {
            var wx = -w / 2 + 1.4 + wi * ((w - 2.6) / Math.max(1, nWin - 1 || 1));
            if (nWin === 1) wx = 0;
            var win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), windowGlow);
            win.position.set(wx, yb + fh * 0.55, wf * (d / 2 - inset / 2 + 0.02));
            if (wf > 0) win.rotation.y = 0; else win.rotation.y = Math.PI;
            g.add(win);
            var frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.9, 0.12), M.timberD);
            frame.position.set(wx, yb + fh * 0.55, wf * (d / 2 - inset / 2)); g.add(frame);
          }
        }
        // mid-roof eave between floors (except top handled after)
        if (f < floors - 1) {
          var eave = curvedRoof(w + 2.2, d + 2.2, 0.7, 0.9);
          eave.position.y = yb + fh; eave.scale.y = 0.7; g.add(eave);
        }
      }
      // crowning roof
      var topY = 1.0 + floors * fh;
      var roof = curvedRoof(w + 3.0, d + 3.0, 2.4 + w * 0.05, 1.6);
      roof.position.y = topY; g.add(roof);
      // corner up-turn ornaments
      for (var cx = -1; cx <= 1; cx += 2) for (var cz2 = -1; cz2 <= 1; cz2 += 2) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 5), M.dark);
        horn.position.set(cx * (w / 2 + 1.2), topY + 1.0, cz2 * (d / 2 + 1.2));
        horn.rotation.z = -cx * 0.7; g.add(horn);
      }
      // hanging entrance lanterns
      if (o.glow !== false) {
        addLantern(g, -1.2, 1.0 + fh * 0.9, d / 2 + 0.4, 0.5);
        addLantern(g, 1.2, 1.0 + fh * 0.9, d / 2 + 0.4, 0.5);
      }
      // shop sign board
      if (o.sign) {
        var sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 0.16), M.timberD);
        sign.position.set(w / 2 + 0.5, 1.0 + fh * 0.7, d / 2 - 0.6); g.add(sign);
      }
      // collider (world-space AABB approximated as box aligned to rotation-agnostic bounds)
      var hw = Math.abs(Math.cos(rot)) * (w / 2 + 0.6) + Math.abs(Math.sin(rot)) * (d / 2 + 0.6);
      var hd = Math.abs(Math.sin(rot)) * (w / 2 + 0.6) + Math.abs(Math.cos(rot)) * (d / 2 + 0.6);
      colliders.push({ type: 'box', x: x, z: z, hw: hw, hd: hd });
      return g;
    }

    /* ---- lanterns ---------------------------------------------------------- */
    function addLantern(parent, x, y, z, r) {
      r = r || 0.55;
      var lg = new THREE.Group(); lg.position.set(x, y, z);
      var body = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), lanternPaper);
      body.scale.y = 1.25; lg.add(body);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.5, 0.18, 8), M.dark);
      cap.position.y = r * 1.25; lg.add(cap);
      var tassel = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0xb23a2a }));
      tassel.position.y = -r * 1.25 - 0.2; lg.add(tassel);
      parent.add(lg);
      lanterns.push({ mesh: body, base: 1.15, ph: hash(x * 7.3, z * 3.1) * TAU });
      return lg;
    }
    function addPointLight(x, y, z, color, intensity, dist) {
      if (lights.length >= 12) return;                 // budget the real lights
      var l = new THREE.PointLight(color || 0xffb15a, intensity || 1.1, dist || 26, 2.0);
      l.position.set(x, y, z); root.add(l); lights.push(l);
    }

    /* ---- lantern posts lining the streets ---------------------------------- */
    function lanternPost(x, z, hero) {
      var g = new THREE.Group(); g.position.set(x, C.y, z); root.add(g);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 8), M.timberD);
      pole.position.y = 2.1; pole.castShadow = true; g.add(pole);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), M.timberD);
      arm.position.set(0.5, 4.0, 0); g.add(arm);
      addLantern(g, 1.0, 3.5, 0, 0.5);
      if (hero) addPointLight(x + 1.0, C.y + 3.5, z, 0xffb15a, 1.2, 24);
      colliders.push({ type: 'cyl', x: x, z: z, r: 0.4 });
    }

    /* ---- docks / piers ----------------------------------------------------- */
    function dock(side, z, len) {
      var g = new THREE.Group(); root.add(g);
      var x0 = side * C.canalHalf;
      var deckY = C.waterY + 0.6;
      var deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, len), M.wood);
      deck.position.set(x0 - side * (2.2), deckY, z); deck.receiveShadow = true; g.add(deck);
      for (var i = -1; i <= 1; i += 1) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.4, 7), M.timberD);
        post.position.set(x0 - side * 4.0, deckY - 0.9, z + i * (len / 2 - 0.5)); g.add(post);
        var rope = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 10), M.dark);
        rope.position.copy(post.position); rope.position.y = deckY + 0.2; rope.rotation.x = Math.PI / 2; g.add(rope);
      }
      // steps down from plaza to dock
      for (var s = 0; s < 4; s++) {
        var st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.0), M.stone);
        st.position.set(x0 - side * 0.6, C.y - 0.3 - s * 0.5, z - (len / 2) - 0.8 - s * 0.9); g.add(st);
      }
    }

    /* ---- boats ------------------------------------------------------------- */
    function makeBoat(covered) {
      var g = new THREE.Group();
      // tapered flat-bottom hull from a box with pinched ends
      var hull = new THREE.BoxGeometry(2.4, 1.0, 7.0, 1, 1, 6);
      var hp = hull.attributes.position;
      for (var i = 0; i < hp.count; i++) {
        var z = hp.getZ(i), t = Math.abs(z) / 3.5;        // taper toward bow/stern
        hp.setX(i, hp.getX(i) * (1 - t * 0.85));
        if (hp.getY(i) > 0) hp.setY(i, hp.getY(i) + t * 0.7); // raised ends
      }
      hull.computeVertexNormals();
      var hullMesh = new THREE.Mesh(hull, M.wood); hullMesh.position.y = 0.2; hullMesh.castShadow = true; g.add(hullMesh);
      var floor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 5.8), M.timberD); floor.position.y = 0.55; g.add(floor);
      if (covered) {
        var canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 12, 1, true, 0, Math.PI), M.roof);
        canopy.rotation.z = Math.PI / 2; canopy.position.set(0, 1.3, 0); g.add(canopy);
        addLantern(g, 0, 1.6, 2.0, 0.4);
      } else {
        // oar
        var oar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), M.wood);
        oar.position.set(1.1, 0.9, -1.5); oar.rotation.z = 0.5; oar.rotation.x = 0.3; g.add(oar);
      }
      root.add(g); return g;
    }
    function placeBoats() {
      // one drifting covered ferry on a slow up-and-down canal path
      var ferry = makeBoat(true); ferry.position.set(-4, C.waterY + 0.5, C.cz + 30);
      boats.push({ grp: ferry, z0: C.cz + 60, z1: C.cz - 88, t: 0, spd: 4.5, dir: -1, x: -4 });
      // docked boats
      var d1 = makeBoat(false); d1.position.set(-C.canalHalf + 3.2, C.waterY + 0.5, C.cz + 30); d1.rotation.y = 0.1; boats.push({ grp: d1 });
      var d2 = makeBoat(true); d2.position.set(C.canalHalf - 3.4, C.waterY + 0.5, C.cz - 16); d2.rotation.y = Math.PI + 0.1; boats.push({ grp: d2 });
      var d3 = makeBoat(false); d3.position.set(-C.canalHalf + 3.0, C.waterY + 0.5, C.cz - 72); d3.rotation.y = -0.2; boats.push({ grp: d3 });
    }

    /* ---- great arched stone bridge + wooden footbridges -------------------- */
    function archBridge(z) {
      var g = new THREE.Group(); g.position.set(0, C.y, z); root.add(g);
      var span = C.canalHalf * 2 + 6, rise = 4.2, seg = 16;
      // arch ring (voussoir stones) under the deck
      for (var i = 0; i <= seg; i++) {
        var a = Math.PI * (i / seg);
        var vx = -Math.cos(a) * (span / 2);
        var vy = Math.sin(a) * rise;
        var stone = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 5.6), M.stone);
        stone.position.set(vx, vy - 2.6, 0); stone.rotation.z = a - Math.PI / 2; stone.castShadow = true; g.add(stone);
      }
      // flat-ish walkable deck following a gentle arch, at ~plaza level (crossing stays traversable)
      var deckSeg = 20, dg = new THREE.PlaneGeometry(span + 2, 5.4, deckSeg, 1); dg.rotateX(-Math.PI / 2);
      var dp = dg.attributes.position;
      for (var j = 0; j < dp.count; j++) { var u = dp.getX(j) / ((span + 2) / 2); dp.setY(j, (1 - u * u) * 1.1); }
      dg.computeVertexNormals();
      var deck = new THREE.Mesh(dg, M.stone); deck.receiveShadow = true; g.add(deck);
      // carved railings + lantern pavilions on the crown
      for (var s = -1; s <= 1; s += 2) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(span + 2, 1.0, 0.3), M.timber);
        rail.position.set(0, 1.4, s * 2.5); g.add(rail);
        for (var b = -2; b <= 2; b++) {
          var baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 6), M.timberD);
          baluster.position.set(b * (span / 5), 0.9, s * 2.5); g.add(baluster);
        }
      }
      // little roofed pavilion crowning the bridge (the reference's covered bridge)
      var pav = new THREE.Group(); pav.position.set(0, 1.5, 0); g.add(pav);
      for (var px = -1; px <= 1; px += 2) for (var pz = -1; pz <= 1; pz += 2) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.2, 8), M.timber);
        col.position.set(px * 3.4, 1.6, pz * 1.8); pav.add(col);
      }
      var pavRoof = curvedRoof(9, 6, 1.8, 1.2); pavRoof.position.y = 3.4; pav.add(pavRoof);
      addLantern(pav, -3.4, 2.8, 1.8, 0.5); addLantern(pav, 3.4, 2.8, 1.8, 0.5);
      addLantern(pav, -3.4, 2.8, -1.8, 0.5); addLantern(pav, 3.4, 2.8, -1.8, 0.5);
      addPointLight(0, C.y + 3.5, z, 0xffb15a, 1.4, 34);
    }
    function footBridge(z) {
      var g = new THREE.Group(); g.position.set(0, C.y, z); root.add(g);
      var span = C.canalHalf * 2 + 4, dg = new THREE.PlaneGeometry(span, 3.2, 16, 1); dg.rotateX(-Math.PI / 2);
      var dp = dg.attributes.position;
      for (var j = 0; j < dp.count; j++) { var u = dp.getX(j) / (span / 2); dp.setY(j, (1 - u * u) * 1.4); }
      dg.computeVertexNormals();
      var deck = new THREE.Mesh(dg, M.wood); deck.receiveShadow = true; deck.castShadow = true; g.add(deck);
      for (var s = -1; s <= 1; s += 2) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.14, 0.14), M.timberD);
        rail.position.set(0, 1.4, s * 1.5); rail.geometry.translate(0, 0, 0); g.add(rail);
        for (var b = -3; b <= 3; b++) {
          var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), M.timberD);
          var u2 = b / 3; post.position.set(b * (span / 7), 0.7 + (1 - u2 * u2) * 1.4 - 0.2, s * 1.5); g.add(post);
        }
      }
    }

    /* ---- cherry trees, pines, bamboo, reeds -------------------------------- */
    var petalSources = [];
    function cherryTree(x, z, scale) {
      var g = new THREE.Group(); g.position.set(x, C.y, z); g.scale.setScalar(scale || 1); root.add(g);
      var barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3b33, roughness: 1 });
      // irregular trunk + a few boughs
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.5, 5, 7), barkMat);
      trunk.position.y = 2.5; trunk.rotation.z = (hash(x, z) - 0.5) * 0.18; trunk.castShadow = true; g.add(trunk);
      var blossomMat = new THREE.MeshStandardMaterial({ color: 0xe08bab, emissive: 0x4a2030, emissiveIntensity: 0.25, roughness: 1, flatShading: true });
      var blossomMat2 = new THREE.MeshStandardMaterial({ color: 0xf0a9c2, emissive: 0x502436, emissiveIntensity: 0.2, roughness: 1, flatShading: true });
      var nB = 6 + Math.floor(hash(x, z + 1) * 3);
      for (var i = 0; i < nB; i++) {
        var ang = (i / nB) * TAU + hash(i, x) * 0.6;
        var rr = 1.6 + hash(i, z) * 1.4;
        var bx = Math.cos(ang) * rr, bz = Math.sin(ang) * rr, by = 4.4 + hash(i, x + z) * 1.8;
        // bough
        var bough = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, rr * 1.6, 5), barkMat);
        bough.position.set(bx * 0.5, 3.6 + by * 0.15, bz * 0.5);
        bough.rotation.set(Math.PI / 2 - 0.6, 0, -ang); g.add(bough);
        // rounder, softer blossom clusters (detail-1 icosphere) with slight overlap
        var cl = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + hash(i, x) * 0.7, 1), i % 3 ? blossomMat : blossomMat2);
        cl.position.set(bx, by, bz); cl.scale.set(1.05, 0.8, 1.05); cl.castShadow = true; g.add(cl);
        var cl2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + hash(i, z) * 0.5, 1), i % 2 ? blossomMat2 : blossomMat);
        cl2.position.set(bx * 0.7, by + 0.6, bz * 0.7); cl2.scale.y = 0.8; g.add(cl2);
      }
      // top canopy
      var top = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), blossomMat2); top.position.y = 6.2; top.scale.y = 0.72; top.castShadow = true; g.add(top);
      petalSources.push({ x: x, z: z, y: C.y + 5 });
      // scattered fallen petals ring on the ground
      var pmat = new THREE.MeshBasicMaterial({ color: 0xf0c0cf, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      for (var p = 0; p < 10; p++) {
        var pt = new THREE.Mesh(new THREE.CircleGeometry(0.5 + hash(p, x) * 0.5, 6), pmat);
        pt.rotation.x = -Math.PI / 2; pt.position.set((hash(p, x) - 0.5) * 5, 0.05, (hash(p, z) - 0.5) * 5); g.add(pt);
      }
      colliders.push({ type: 'cyl', x: x, z: z, r: 0.6 * (scale || 1) });
    }
    function bamboo(x, z) {
      var g = new THREE.Group(); g.position.set(x, C.y, z); root.add(g);
      var caneMat = new THREE.MeshStandardMaterial({ color: 0x7a8a3c, roughness: 0.8 });
      var leafMat = new THREE.MeshStandardMaterial({ color: 0x5f7a34, roughness: 1, flatShading: true });
      for (var i = 0; i < 6; i++) {
        var h = 5 + hash(i, x) * 4;
        var cane = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 6), caneMat);
        cane.position.set((hash(i, x) - 0.5) * 1.4, h / 2, (hash(i, z) - 0.5) * 1.4);
        cane.rotation.z = (hash(i, z) - 0.5) * 0.14; g.add(cane);
        var tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), leafMat);
        tuft.position.set(cane.position.x, h, cane.position.z); tuft.scale.y = 0.5; g.add(tuft);
      }
    }

    /* ---- market props ------------------------------------------------------ */
    function crate(x, z, s) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), M.wood);
      m.position.set(x, C.y + s / 2, z); m.rotation.y = hash(x, z) * 0.4; m.castShadow = true; root.add(m);
      colliders.push({ type: 'cyl', x: x, z: z, r: s * 0.6 });
    }
    function jar(x, z, s) {
      var jarMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.7 });
      var body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), jarMat);
      body.scale.y = 1.3; body.position.set(x, C.y + s * 1.1, z); body.castShadow = true; root.add(body);
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.6, s * 0.5, 8), jarMat);
      neck.position.set(x, C.y + s * 2.0, z); root.add(neck);
      colliders.push({ type: 'cyl', x: x, z: z, r: s * 1.0 });
    }
    function stall(x, z, rot) {
      var g = new THREE.Group(); g.position.set(x, C.y, z); g.rotation.y = rot; root.add(g);
      for (var sx = -1; sx <= 1; sx += 2) for (var sz = -1; sz <= 1; sz += 2) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), M.timberD);
        post.position.set(sx * 1.6, 1.5, sz * 1.1); g.add(post);
      }
      var awn = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), new THREE.MeshStandardMaterial({ color: 0x9c3b2f, roughness: 1 }));
      awn.position.y = 3.0; awn.rotation.x = 0.08; g.add(awn);
      var table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 1.6), M.wood); table.position.set(0, 1.1, 0.4); g.add(table);
      addLantern(g, 1.4, 2.6, 0, 0.4);
      colliders.push({ type: 'box', x: x, z: z, hw: 2.0, hd: 1.4 });
    }
    function banner(x, z) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5, 6), M.timberD);
      pole.position.set(x, C.y + 2.5, z); root.add(pole);
      var cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 3.2), new THREE.MeshStandardMaterial({ color: 0xb23a2a, roughness: 1, side: THREE.DoubleSide }));
      cloth.position.set(x + 0.5, C.y + 3.0, z); root.add(cloth);
      colliders.push({ type: 'cyl', x: x, z: z, r: 0.3 });
    }

    /* ---- distant sect pagoda on the valley head (landmark, not reachable) --- */
    function pagoda() {
      var px = 40, pz = C.z1 - 90;
      var base = heightAt(px, pz);
      var g = new THREE.Group(); g.position.set(px, base, pz); root.add(g);
      var floors = 7, r = 7;
      for (var f = 0; f < floors; f++) {
        var fr = r * (1 - f * 0.1), fy = f * 7;
        var body = new THREE.Mesh(new THREE.CylinderGeometry(fr * 0.8, fr * 0.85, 5.5, 8), M.timber);
        body.position.y = fy + 3; g.add(body);
        var roof = curvedRoof(fr * 2.4, fr * 2.4, 1.6, 1.4); roof.position.y = fy + 6; g.add(roof);
      }
      var spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 8), M.dark); spire.position.y = floors * 7 + 2; g.add(spire);
      // glowing top so it beckons across the mist
      var top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      top.position.y = floors * 7 + 5; g.add(top); lanterns.push({ mesh: top, base: 1.0, ph: 0 });
    }

    /* ---- assemble the town -------------------------------------------------- */
    buildGround();

    // south entry gate (paifang-style) with the town name plaque
    (function gate() {
      var z = C.z0 + 2, g = new THREE.Group(); g.position.set(0, C.y, z); root.add(g);
      for (var s = -1; s <= 1; s += 2) {
        if (Math.abs(s * (C.canalHalf + 6)) < C.canalHalf) continue;
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 10), M.timber);
        col.position.set(s * (C.canalHalf + 9), 4.5, 0); col.castShadow = true; g.add(col);
        colliders.push({ type: 'cyl', x: s * (C.canalHalf + 9), z: z, r: 0.7 });
      }
      var beam = new THREE.Mesh(new THREE.BoxGeometry((C.canalHalf + 9) * 2 + 2, 1.6, 1.2), M.timberD);
      beam.position.y = 8.4; g.add(beam);
      var roof = curvedRoof((C.canalHalf + 9) * 2 + 6, 4, 1.6, 1.3); roof.position.y = 9.6; g.add(roof);
      var plaque = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x1c1a16, roughness: 0.6 }));
      plaque.position.set(0, 8.4, 0.7); g.add(plaque);
      addLantern(g, -C.canalHalf - 9, 6.5, 0.6, 0.6); addLantern(g, C.canalHalf + 9, 6.5, 0.6, 0.6);
      addPointLight(0, C.y + 7, z, 0xffb15a, 1.0, 28);
    })();

    // WEST BANK — tea house (near gate) → alchemist → merchant → residences (distributed within footprint)
    var teahouse = building(-46, C.cz + 74, Math.PI / 2, { w: 16, d: 12, floors: 3, wallMat: M.timber, sign: true });
    building(-50, C.cz + 36, Math.PI / 2, { w: 12, d: 10, floors: 2, wallMat: M.plaster, sign: true });   // alchemist
    building(-50, C.cz - 2,  Math.PI / 2, { w: 13, d: 10, floors: 2, wallMat: M.timber, sign: true });    // merchant hall
    building(-52, C.cz - 40, Math.PI / 2, { w: 11, d: 9,  floors: 1, wallMat: M.plaster });               // residence
    building(-48, C.cz - 78, Math.PI / 2, { w: 12, d: 10, floors: 2, wallMat: M.plaster });               // residence

    // EAST BANK — blacksmith (near gate) → inn → residences
    var smith = building(48, C.cz + 66, -Math.PI / 2, { w: 14, d: 11, floors: 1, wallMat: M.timber, sign: true }); // blacksmith
    building(50, C.cz + 28, -Math.PI / 2, { w: 13, d: 11, floors: 2, wallMat: M.timber, sign: true });    // inn
    building(50, C.cz - 14, -Math.PI / 2, { w: 12, d: 10, floors: 3, wallMat: M.plaster });               // tall residence
    building(52, C.cz - 54, -Math.PI / 2, { w: 11, d: 9,  floors: 1, wallMat: M.plaster });               // residence
    building(48, C.cz - 90, -Math.PI / 2, { w: 12, d: 10, floors: 2, wallMat: M.timber });                // residence

    // riverside pavilion (NPC meeting spot) on the west bank near the water
    (function pavilion() {
      var x = -C.canalHalf - 5, z = C.cz - 30, g = new THREE.Group(); g.position.set(x, C.y, z); root.add(g);
      var floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 8), M.wood); floor.position.y = 0.2; g.add(floor);
      for (var sx = -1; sx <= 1; sx += 2) for (var sz = -1; sz <= 1; sz += 2) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4, 8), M.timber);
        col.position.set(sx * 3.4, 2.4, sz * 3.4); g.add(col);
      }
      var roof = curvedRoof(11, 11, 2.4, 1.5); roof.position.y = 4.4; g.add(roof);
      addLantern(g, 0, 3.6, 0, 0.6);
      colliders.push({ type: 'box', x: x, z: z, hw: 4, hd: 4 });
    })();

    // blacksmith forge detail (soot + fire glow) beside the smithy
    (function forge() {
      var x = 40, z = C.cz + 66;
      var furnace = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.2, 8), M.stone);
      furnace.position.set(x, C.y + 1.1, z); root.add(furnace);
      var ember = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
      ember.position.set(x, C.y + 1.9, z); root.add(ember); lanterns.push({ mesh: ember, base: 1.6, ph: 1.3 });
      addPointLight(x, C.y + 2.2, z, 0xff7a2a, 1.6, 16);
      var anvil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.7), M.dark); anvil.position.set(x + 2.4, C.y + 0.7, z); root.add(anvil);
      colliders.push({ type: 'cyl', x: x, z: z, r: 1.5 });
    })();

    // alchemist herb racks + medicine furnace smoke marker
    (function alchemy() {
      var x = -44, z = C.cz + 36;
      var rack = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 0.6), M.wood); rack.position.set(x, C.y + 1.3, z); root.add(rack);
      for (var i = 0; i < 6; i++) jar(x - 1.2 + (i % 3) * 1.2, z + 1.4, 0.35 + (i > 2 ? 0.05 : 0));
    })();

    // bridges: great arched bridge + two footbridges
    archBridge(C.bridgeZ[0]);
    footBridge(C.bridgeZ[1]);
    footBridge(C.bridgeZ[2]);

    // docks
    dock(-1, C.cz + 30, 12); dock(1, C.cz - 16, 12); dock(-1, C.cz - 72, 10);
    placeBoats();

    // lantern posts lining both banks (every ~14u), hero lights sparse
    for (var lz = C.z0 - 10; lz > C.z1 + 6; lz -= 14) {
      lanternPost(-C.canalHalf - 3, lz, (lz % 42 | 0) === 0);
      lanternPost(C.canalHalf + 3, lz, ((lz + 21) % 42 | 0) === 0);
    }

    // market clutter along the lantern street (kept clear of the walk line down the bank)
    crate(-30, C.cz + 58, 1.4); crate(-31, C.cz + 60, 1.1); crate(-32, C.cz + 56, 1.0);
    jar(-28, C.cz + 50, 0.6); jar(-27, C.cz + 48, 0.5);
    stall(-30, C.cz + 40, 0.2); stall(-31, C.cz + 6, -0.1); stall(32, C.cz + 34, Math.PI - 0.1);
    banner(-24, C.cz + 64); banner(26, C.cz + 52); banner(-24, C.cz - 6); banner(27, C.cz - 40);
    crate(30, C.cz - 30, 1.3); crate(31, C.cz - 32, 1.0);

    // greenery: cherry trees along the banks, bamboo & pines at the fringes
    cherryTree(-24, C.cz + 60, 1.1); cherryTree(25, C.cz + 50, 1.0); cherryTree(-22, C.cz + 8, 1.2);
    cherryTree(24, C.cz - 4, 1.0); cherryTree(-25, C.cz - 48, 1.1); cherryTree(25, C.cz - 60, 1.0);
    cherryTree(-22, C.cz - 82, 0.9);
    bamboo(-38, C.cz - 78); bamboo(42, C.cz - 84); bamboo(-40, C.cz + 70);

    pagoda();

    /* ---- NPC + landmark markers (host POI system draws the prompt) --------- */
    function marker(id, x, z, color) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, C.y + 0.08, z); root.add(m);
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 6, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(x, C.y + 3, z); root.add(beam);
      pois.push({ id: id, pos: new THREE.Vector3(x, C.y, z), glow: m, beam: beam });
    }
    marker("village_elder", 0, C.z0 - 8, 0xffd27a);        // just inside the gate plaza
    marker("alchemist", -44, C.cz + 36, 0x7fe0a0);         // by the alchemist's herb racks
    marker("blacksmith", 42, C.cz + 66, 0xff8a5a);         // at the forge
    marker("merchant", -30, C.cz + 34, 0xffcf7a);          // among the market stalls
    marker("sect_recruiter", -C.canalHalf - 5, C.cz - 30, 0x9bb8ff); // riverside pavilion

    /* ---- localized dusk mist over the canal --------------------------------- */
    (function cityMist() {
      var mtex = (function () {
        var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
        var grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, "rgba(200,215,220,0.45)"); grd.addColorStop(1, "rgba(200,215,220,0)");
        g.fillStyle = grd; g.fillRect(0, 0, 128, 128); var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
      })();
      for (var k = 0; k < 8; k++) {
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(70, 70),
          new THREE.MeshBasicMaterial({ map: mtex, transparent: true, opacity: 0.3, depthWrite: false }));
        pl.rotation.x = -Math.PI / 2;
        pl.position.set((hash(k, 3) - 0.5) * 30, C.waterY + 1.2 + hash(k, 7) * 2, C.cz - k * 22);
        pl.userData.spin = (hash(k, 1) - 0.5) * 0.02; M._mist = M._mist || []; M._mist.push(pl); root.add(pl);
      }
    })();

    /* ---- drifting town petals (localized particle system) ------------------ */
    var townPetals = (function () {
      var N = 260, g = new THREE.BufferGeometry(), a = new Float32Array(N * 3);
      for (var i = 0; i < N; i++) {
        a[i * 3] = (hash(i, 2) - 0.5) * C.halfW * 2;
        a[i * 3 + 1] = C.y + hash(i, 5) * 16;
        a[i * 3 + 2] = C.cz + (hash(i, 9) - 0.5) * Math.abs(C.z1 - C.z0);
      }
      g.setAttribute("position", new THREE.BufferAttribute(a, 3));
      var pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf3c6d4, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false }));
      root.add(pts); return pts;
    })();

    /* ---- public API -------------------------------------------------------- */
    function inBox(x, z) {
      var zlo = Math.min(C.z0, C.z1) - C.margin, zhi = Math.max(C.z0, C.z1) + C.margin;
      return x > -C.halfW - C.margin && x < C.halfW + C.margin && z > zlo && z < zhi;
    }
    function edgeBlend(x, z) {
      // 1 well inside footprint -> 0 at (and beyond) the margin
      var zlo = Math.min(C.z0, C.z1), zhi = Math.max(C.z0, C.z1);
      var dx = Math.min(C.halfW - Math.abs(x), 1e9);
      var dz = Math.min(z - zlo, zhi - z);
      var d = Math.min(dx, dz);
      return Math.max(0, Math.min(1, d / C.margin));
    }
    var api = {
      C: C,
      spawn: new THREE.Vector3(0, C.y, C.z0 - 6),
      pois: pois,
      near: inBox,
      groundAt: function (x, z) {
        var b = edgeBlend(x, z);
        var t = heightAt(x, z);
        return t + (C.y - t) * (b * b * (3 - 2 * b)); // smoothstep blend to flat plaza
      },
      resolve: function (pos) {
        // canal keep-out: the player may only cross the water on a bridge
        var zlo = Math.min(C.z0, C.z1), zhi = Math.max(C.z0, C.z1);
        if (pos.z > zlo - 2 && pos.z < zhi + 2 && Math.abs(pos.x) < C.canalHalf + 0.5) {
          var onBridge = false;
          for (var bi = 0; bi < C.bridgeZ.length; bi++) if (Math.abs(pos.z - C.bridgeZ[bi]) < 7) onBridge = true;
          if (!onBridge) pos.x = (pos.x >= 0 ? 1 : -1) * (C.canalHalf + 0.5);
        }
        for (var i = 0; i < colliders.length; i++) {
          var c = colliders[i];
          if (c.type === 'cyl') {
            var dx = pos.x - c.x, dz = pos.z - c.z, dd = Math.hypot(dx, dz);
            if (dd < c.r && dd > 1e-4) { var pu = c.r / dd; pos.x = c.x + dx * pu; pos.z = c.z + dz * pu; }
          } else { // box AABB
            var lx = pos.x - c.x, lz = pos.z - c.z;
            if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) {
              var ox = c.hw - Math.abs(lx), oz = c.hd - Math.abs(lz);
              if (ox < oz) pos.x = c.x + (lx < 0 ? -c.hw : c.hw);
              else pos.z = c.z + (lz < 0 ? -c.hd : c.hd);
            }
          }
        }
      },
      update: function (dt, t) {
        if (M._water) M._water.value = t;
        // lantern flicker
        for (var i = 0; i < lanterns.length; i++) {
          var L = lanterns[i];
          L.mesh.material.emissiveIntensity !== undefined
            ? (L.mesh.material.emissiveIntensity = L.base + Math.sin(t * 3 + L.ph) * 0.18 + (hash(i, (t * 6 | 0)) - 0.5) * 0.1)
            : 0;
        }
        // marker glow pulse
        for (var m = 0; m < pois.length; m++) {
          var pg = pois[m]; if (pg.glow) pg.glow.material.opacity = 0.4 + Math.sin(t * 2 + m) * 0.2;
        }
        // boats
        for (var b = 0; b < boats.length; b++) {
          var bt = boats[b]; if (!bt.path && bt.z0 === undefined) { bt.grp.position.y = C.waterY + 0.5 + Math.sin(t + b) * 0.05; continue; }
          if (bt.spd) {
            bt.grp.position.z += bt.dir * bt.spd * dt;
            if (bt.grp.position.z < bt.z1) bt.dir = 1; if (bt.grp.position.z > bt.z0) bt.dir = -1;
            bt.grp.rotation.y = bt.dir < 0 ? Math.PI : 0;
            bt.grp.position.y = C.waterY + 0.5 + Math.sin(t * 1.5 + b) * 0.06;
            bt.grp.rotation.z = Math.sin(t * 1.2 + b) * 0.03;
          }
        }
        // petals
        var pa = townPetals.geometry.attributes.position, ar = pa.array;
        for (var p = 0; p < ar.length; p += 3) {
          ar[p + 1] -= dt * 1.6; ar[p] += Math.sin(t * 1.3 + p) * 0.02;
          if (ar[p + 1] < C.y) { ar[p + 1] = C.y + 16; }
        }
        pa.needsUpdate = true;
        if (M._mist) for (var k = 0; k < M._mist.length; k++) M._mist[k].rotation.z += M._mist[k].userData.spin * dt;
      }
    };
    return api;
  }
};
})();
