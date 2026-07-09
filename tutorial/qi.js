/* DAO'S FIELD — QiEngine
   A modular, data-driven elemental Qi attack system. This file contains NO
   per-element or per-attack logic: it is a generic interpreter of ./data/qi.json.
   Elements declare a palette + an environmental "signature" (how the world reacts);
   techniques declare a mechanical shape (kind/damage/range/status) and a list of
   environment tags. The engine turns that data into grounded, world-reacting VFX:
   particle bursts (embers/smoke/dust/splash/leaves/sparks), ground decals
   (scorch/crack/wet), expanding shock rings & ripples, flung debris & lifted stones,
   growing roots, branching lightning arcs, dome barriers, dynamic lights, camera
   shake and sound. Add an element or technique in the JSON and it "just works".

   Deliberately NOT here (this is a browser WebGL build): true volumetric fog,
   screen-space refraction, GPU heat-distortion, foliage vertex sway. Those are the
   UE5/Niagara targets — see the mapping table in README. Every layer below has a
   1:1 Niagara/decal/GAS equivalent, which is why the DATA is the real deliverable. */

export class QiEngine {
  constructor(opts) {
    this.THREE = opts.THREE || window.THREE;
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.data = opts.data;                 // parsed qi.json
    this.textures = opts.textures || {};   // { smoke, dust, splash, leaf, scorch, crack } -> THREE.Texture
    this.hooks = opts.hooks || {};         // heightAt, sfx, damageNumber, dash, applyBuff, player, enemies
    this.parts = [];      // particle bursts (THREE.Points)
    this.decals = [];     // ground decals (planes)
    this.meshFx = [];     // debris / rings / roots / barriers / arcs (closure-updated)
    this.lights = [];     // dynamic point lights
    this.projectiles = []; // in-flight projectiles
    this.pending = [];    // scheduled resolves (area telegraph, thunder delay)
    this.statuses = [];   // active enemy statuses
    this.cooldowns = {};  // techId -> seconds remaining
    this._texCache = {};
    this.MAX_DECALS = 44;
    this._makeProceduralTex();
  }

  /* ---------- procedural textures (glow / spark / wet) ---------- */
  _makeProceduralTex() {
    const T = this.THREE;
    const soft = document.createElement("canvas"); soft.width = soft.height = 128;
    let g = soft.getContext("2d"); let gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.65)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this._texCache.glow = new T.CanvasTexture(soft);

    const sp = document.createElement("canvas"); sp.width = sp.height = 64;
    g = sp.getContext("2d"); gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.9)"); gr.addColorStop(0.6, "rgba(255,255,255,0.15)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this._texCache.spark = new T.CanvasTexture(sp);

    const wet = document.createElement("canvas"); wet.width = wet.height = 128;
    g = wet.getContext("2d"); gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.7, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this._texCache.wet = new T.CanvasTexture(wet);
  }
  _tex(name) {
    if (this._texCache[name]) return this._texCache[name];
    if (this.textures[name]) return this.textures[name];
    return this._texCache.glow;
  }

  /* ---------- resolve a technique at an upgrade rank ---------- */
  techAt(techId, rank) {
    const base = this.data.techniques[techId];
    if (!base) return null;
    const el = this.data.elements[base.element];
    const ranks = base.upgrade && base.upgrade.ranks;
    const r = ranks ? ranks[Math.min(rank | 0, ranks.length - 1)] : null;
    const m = Object.assign({}, base);
    if (r) {
      for (const k of ["damage", "radius", "knockback", "dashDist", "speed", "range"]) if (r[k] != null) m[k] = r[k];
      if (typeof r.status === "number") m.status = Object.assign({}, base.status, { chance: r.status });
      if (base.buff) {
        m.buff = Object.assign({}, base.buff);
        for (const k of ["damageReduce", "retaliate", "regen", "moveBoost", "duration"]) if (r[k] != null) m.buff[k] = r[k];
      }
      m._add = r.add || [];
    } else m._add = [];
    // per-technique palette / colour override (lets e.g. Limitless recolour Blue / Red / Purple
    // from the SAME engine, no code) — build an element view with the technique's overrides merged in
    if (base.color || base.color2 || base.palette) {
      m._el = Object.assign({}, el, {
        color: base.color || el.color,
        color2: base.color2 || el.color2,
        palette: {
          core: Object.assign({}, el.palette.core, base.palette && base.palette.core),
          trail: Object.assign({}, el.palette.trail, base.palette && base.palette.trail),
          impact: Object.assign({}, el.palette.impact, base.palette && base.palette.impact)
        }
      });
    } else m._el = el;
    m._id = techId;
    return m;
  }

  canCast(techId) { return !(this.cooldowns[techId] > 0); }
  cooldownFrac(techId) {
    const b = this.data.techniques[techId]; if (!b || !b.cooldown) return 0;
    return Math.max(0, (this.cooldowns[techId] || 0) / b.cooldown);
  }

  /* ---------- cast ---------- */
  cast(techId, rank, origin, dir, opts) {
    const t = this.techAt(techId, rank || 0);
    if (!t) return { ok: false, reason: "unknown" };
    if (this.cooldowns[techId] > 0) return { ok: false, reason: "cooldown" };
    this.cooldowns[techId] = t.cooldown || 0.4;
    // hold-to-charge scaling (0..1): bigger, harder-hitting, more knockback + a fiercer flash
    const charge = opts && opts.charge ? Math.max(0, Math.min(1, opts.charge)) : 0;
    t._charge = charge;
    if (charge > 0) {
      if (t.damage) t.damage *= 1 + charge;
      if (t.radius) t.radius *= 1 + charge * 0.7;
      if (t.knockback) t.knockback *= 1 + charge * 0.6;
      if (t.light) t.light = Object.assign({}, t.light, { intensity: (t.light.intensity || 4) * (1 + charge * 0.9), range: (t.light.range || 10) * (1 + charge * 0.5) });
      if (t.camera) t.camera = Object.assign({}, t.camera, { shake: (t.camera.shake || 0) * (1 + charge * 0.6) });
    }
    dir = dir.clone().setY(0).normalize();
    const el = t._el;
    if (t.sound || (el && el.sound)) this._sfx(t.sound || el.sound);

    if (t.camera) this._shake(t.camera.shake || 0);
    // muzzle / cast flash at the origin (every element blooms qi at the hand)
    this._castFlash(origin, t);

    if (t.kind === "projectile") this._spawnProjectile(origin, dir, t);
    else if (t.kind === "area") this._castArea(origin, dir, t);
    else if (t.kind === "buff") this._castBuff(origin, t);
    else if (t.kind === "dash") this._castDash(origin, dir, t);
    return { ok: true, tech: t };
  }

  _castFlash(origin, t) {
    const el = t._el, pal = el.palette;
    this.emit(origin, new this.THREE.Vector3(0, 1, 0), {
      tex: pal.core.tex, count: 14, size: 0.7, life: 0.4, speed: 3.5, speedVar: 0.8, spread: 1,
      mode: "radial", gravity: -1, drag: 3, color: pal.core.color, color2: pal.core.color2,
      blend: pal.core.blend, grow: 1.8, fade: "out"
    });
    if (t.light) this._spawnLight(origin, t.light, el);
  }

  /* ---------- projectiles ---------- */
  _spawnProjectile(origin, dir, t) {
    const T = this.THREE, el = t._el, pal = el.palette;
    const cg = 1 + (t._charge || 0) * 0.9;   // charged bolts fly bigger
    const grp = new T.Group();
    const core = new T.Mesh(
      new T.SphereGeometry(0.28 * (t.radius ? Math.min(1.6, t.radius / 2.4) : 1) * cg, 12, 12),
      new T.MeshBasicMaterial({ color: new T.Color(pal.core.color), transparent: true, blending: T.AdditiveBlending, depthWrite: false })
    );
    grp.add(core);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: this._tex(pal.core.tex), color: new T.Color(pal.core.color2), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(1.6 * cg); grp.add(halo);
    const pos = origin.clone(); grp.position.copy(pos); this.scene.add(grp);
    const light = new T.PointLight(new T.Color(el.color).getHex(), (t.light && t.light.intensity) || 4, (t.light && t.light.range) || 10);
    grp.add(light);
    this.projectiles.push({ grp, core, pos, dir, t, el, travelled: 0, speed: t.speed || 30, trailAcc: 0, alive: true });
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = p.speed * dt;
      p.pos.addScaledVector(p.dir, step); p.travelled += step;
      p.pos.y = this.hooks.heightAt(p.pos.x, p.pos.z) + 1.6;
      p.grp.position.copy(p.pos);
      // trail (element signature, streaming behind the core)
      p.trailAcc += dt;
      if (p.trailAcc > 0.03) {
        p.trailAcc = 0;
        const pal = p.el.palette;
        this.emit(p.pos, p.dir.clone().negate(), {
          tex: pal.trail.tex, count: 2, size: 0.55, life: 0.5, speed: 1.2, spread: 0.5,
          mode: "back", gravity: pal.trail.blend === "add" ? -0.5 : 1.2, drag: 1.5,
          color: pal.trail.color, color2: pal.trail.color2, blend: pal.trail.blend, grow: 1.6, fade: "out"
        });
      }
      // hit test
      let hit = null;
      const enemies = this._enemies();
      for (const e of enemies) {
        if (this._dist2(e.pos, p.pos) < Math.pow((p.t.radius || 2) + 1.4, 2)) { hit = e; break; }
      }
      if (hit || p.travelled >= (p.t.range || 24)) {
        this._impact(p.pos.clone(), p.dir, p.t, hit);
        this.scene.remove(p.grp); p.alive = false; this.projectiles.splice(i, 1);
      }
    }
  }

  /* ---------- area (telegraph -> resolve) ---------- */
  _castArea(origin, dir, t) {
    // aim at nearest enemy within range, else a point ahead
    let target = null, best = 1e9;
    for (const e of this._enemies()) { const d = this._dist2(e.pos, origin); if (d < best && d < Math.pow(t.range || 10, 2)) { best = d; target = e; } }
    const gp = target ? target.pos.clone() : origin.clone().addScaledVector(dir, t.range || 8);
    gp.y = this.hooks.heightAt(gp.x, gp.z);
    // telegraph ring
    const el = t._el;
    this._telegraphRing(gp, t.radius || 6, el.color, t.telegraph || 0.35);
    this.pending.push({ t: t.telegraph || 0.35, fn: () => this._resolveArea(gp, t) });
  }
  _resolveArea(gp, t) {
    const el = t._el;
    if (t.camera) this._shake((t.camera.shake || 0.6) * 1.1);
    // shock ring + full environmental signature at the ground point
    this._envList(t.environment, gp, new this.THREE.Vector3(0, 1, 0), el, 1.4);
    for (const fx of (t._add || [])) this._envList([this._upgradeFx(fx)], gp, new this.THREE.Vector3(0, 1, 0), el, 1.4);
    if (t.light) this._spawnLight(gp.clone().setY(gp.y + 1.5), t.light, el);
    // damage everyone in radius, with falloff + knockback outward
    const r = t.radius || 6;
    for (const e of this._enemies()) {
      const d = Math.sqrt(this._dist2(e.pos, gp));
      if (d <= r) {
        const fall = 1 - 0.5 * (d / r);
        // knock outward, or (Lapse: Blue) drag inward toward the collapse point
        const kd = t.pull ? gp.clone().sub(e.pos).setY(0).normalize() : e.pos.clone().sub(gp).setY(0).normalize();
        this._hitEnemy(e, (t.damage || 10) * fall, t, kd);
      }
    }
  }

  /* ---------- buff (self) ---------- */
  _castBuff(origin, t) {
    const el = t._el;
    if (this.hooks.applyBuff) this.hooks.applyBuff(t.buff || {}, el.name.toLowerCase(), t);
    this._spawnBarrier(el, (t.buff && t.buff.duration) || 5);
    this._envList((t.environment || []).filter(x => x !== "barrier"), origin, new this.THREE.Vector3(0, 1, 0), el, 1.0);
    if (t.light) this._spawnLight(origin.clone().setY(origin.y + 1.2), Object.assign({}, t.light), el);
  }

  /* ---------- dash (utility) ---------- */
  _castDash(origin, dir, t) {
    const el = t._el;
    if (this.hooks.dash) this.hooks.dash(dir, t.dashDist || 12, t.dashTime || 0.2);
    // lay the element's signature along the path + a travelling light
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const p = origin.clone().addScaledVector(dir, (t.dashDist || 12) * (s / steps));
      p.y = this.hooks.heightAt(p.x, p.z);
      this.pending.push({ t: (t.dashTime || 0.2) * (s / steps), fn: () => this._envList(t.environment, p, dir, el, 0.8) });
    }
    // some dashes strike on arrival (gold/lightning)
    if (t.damage) this.pending.push({
      t: t.dashTime || 0.2, fn: () => {
        const gp = origin.clone().addScaledVector(dir, t.dashDist || 12);
        for (const e of this._enemies()) if (this._dist2(e.pos, gp) < Math.pow((t.radius || 2.5) + 1.4, 2)) this._hitEnemy(e, t.damage, t, dir);
      }
    });
  }

  /* ---------- impact resolution ---------- */
  _impact(pos, dir, t, enemy) {
    const el = t._el;
    if (t.camera) this._shake(t.camera.shake || 0.3);
    this._envList(t.environment, pos, dir, el, 1.0);
    for (const fx of (t._add || [])) this._envList([this._upgradeFx(fx)], pos, dir, el, 1.0);
    if (t.light) this._spawnLight(pos.clone(), t.light, el);
    // impact bloom
    const pal = el.palette;
    this.emit(pos, dir, { tex: pal.impact.tex, count: 20, size: 0.7, life: 0.5, speed: 6, speedVar: 0.8, spread: 1, mode: "radial", gravity: pal.impact.blend === "add" ? -1 : 3, drag: 2.2, color: pal.impact.color, color2: pal.impact.color2, blend: pal.impact.blend, grow: 1.6, fade: "out" });
    if (enemy) this._hitEnemy(enemy, t.damage || 10, t, dir);
  }

  _hitEnemy(e, dmg, t, dir) {
    if (!e || !e.alive) return;
    const mult = (e.status && e.status.def) ? (e.status.def.damageTaken || 1) : 1;
    e.damage(Math.round(dmg * mult), { dot: false });
    if (t.knockback && e.knock && dir) e.knock(dir, t.knockback);
    if (t.status && Math.random() < (t.status.chance || 0)) {
      const def = this.data.statusEffects[t.status.apply];
      if (def) { e.status = { id: t.status.apply, def, remaining: def.duration, tick: 0 }; if (!this.statuses.includes(e)) this.statuses.push(e); }
    }
  }

  /* ---------- ENVIRONMENT REACTION VOCABULARY ----------
     Each tag maps to concrete, grounded effects. Interpreted generically so any
     technique's `signature`/`environment`/`add` list composes without code. */
  _envList(list, pos, dir, el, scale) {
    if (!list) return;
    for (const tag of list) this._env(tag, pos, dir, el, scale || 1);
  }
  _env(tag, pos, dir, el, scale) {
    const T = this.THREE, pal = el.palette, c = el.color, c2 = el.color2;
    switch (tag) {
      case "embers": return this.emit(pos, null, { tex: "spark", count: 16 * scale, size: 0.34, life: 1.3, speed: 2.4, spread: 0.7, mode: "up", gravity: -1.6, drag: 0.6, color: "#ffca66", color2: c, blend: "add", grow: 0.5, fade: "in-out" });
      case "smoke": return this.emit(pos, null, { tex: "smoke", count: 9 * scale, size: 1.5, life: 2.2, speed: 1.6, spread: 0.6, mode: "up", gravity: -0.7, drag: 1.1, color: "#6a5a52", color2: "#2a2420", blend: "normal", grow: 2.4, fade: "in-out", opacity: 0.7 });
      case "heatShimmer": return this.emit(pos, null, { tex: "glow", count: 5 * scale, size: 2.2, life: 0.7, speed: 0.6, spread: 0.4, mode: "up", gravity: -0.5, drag: 1, color: "#ffb877", color2: "#ff8a4a", blend: "add", grow: 2.6, fade: "in-out", opacity: 0.35 });
      case "scorch": return this._decal("scorch", pos, 3.2 * scale, 14, "#2a2020", "normal", 0.85);
      case "dust": return this.emit(pos, dir, { tex: "dust", count: 14 * scale, size: 1.7, life: 1.6, speed: 3.2, spread: 0.9, mode: "out", gravity: 1.2, drag: 1.6, color: "#d8b884", color2: "#8a6a44", blend: "normal", grow: 2.2, fade: "in-out", opacity: 0.8 });
      case "crack": return this._decal("crack", pos, 4 * scale, 22, "#3a2c1e", "normal", 0.9);
      case "debris": return this._debris(pos, dir, 9 * scale, "#8a6a44", false);
      case "liftStones": return this._liftStones(pos, 5 * scale, "#7a6a54");
      case "mist": return this.emit(pos, null, { tex: "smoke", count: 8 * scale, size: 2.2, life: 2.6, speed: 1, spread: 0.9, mode: "out", gravity: -0.2, drag: 1.4, color: "#dfeefc", color2: "#a9c8e0", blend: "normal", grow: 2.6, fade: "in-out", opacity: 0.4 });
      case "splash": return this.emit(pos, dir, { tex: "splash", count: 18 * scale, size: 0.9, life: 0.9, speed: 5, spread: 0.9, mode: "out", gravity: 9, drag: 0.8, color: "#dff2ff", color2: "#5aa6e0", blend: "normal", grow: 1.2, fade: "out", opacity: 0.95 });
      case "wet": return this._decal("wet", pos, 3.4 * scale, 10, "#22303a", "normal", 0.5);
      case "ripple": return this._ring(pos, 3 * scale, "#bfe6ff", 0.9, "add", 0.05, 0.5);
      case "leaves": return this.emit(pos, dir, { tex: "leaf", count: 12 * scale, size: 0.85, life: 1.8, speed: 3, spread: 1, mode: "out", gravity: 1.4, drag: 1.2, color: c2, color2: c, blend: "normal", grow: 1, fade: "in-out", opacity: 0.95 });
      case "roots": return this._roots(pos, 6 * scale, c);
      case "growth": return this.emit(pos, null, { tex: "spark", count: 12 * scale, size: 0.3, life: 1.4, speed: 2, spread: 0.7, mode: "up", gravity: -1, drag: 0.8, color: "#c8f0a0", color2: c, blend: "add", grow: 0.6, fade: "in-out" });
      case "sparks": return this.emit(pos, dir, { tex: "spark", count: 20 * scale, size: 0.3, life: 0.6, speed: 8, spread: 0.9, mode: "out", gravity: 8, drag: 0.6, color: "#fff2c0", color2: c, blend: "add", grow: 0.5, fade: "out" });
      case "fragments": return this._debris(pos, dir, 10 * scale, c2, true);
      case "ringing": return this.emit(pos, null, { tex: "spark", count: 6 * scale, size: 0.5, life: 0.5, speed: 1, spread: 1, mode: "radial", gravity: 0, drag: 3, color: "#fff4cc", color2: c, blend: "add", grow: 2, fade: "out" });
      case "gust": this._ring(pos, 4 * scale, "#eafff6", 0.6, "add", 0.05, 0.35); return this.emit(pos, dir, { tex: "dust", count: 12 * scale, size: 1.2, life: 1, speed: 6, spread: 1, mode: "out", gravity: -0.2, drag: 1.4, color: "#e8f2ec", color2: "#b0c8bc", blend: "normal", grow: 1.8, fade: "out", opacity: 0.55 });
      case "arc": return this._arc(pos, dir, el);
      case "flash": return this._spawnLight(pos.clone().setY(pos.y + 2), { intensity: 16 * scale, range: 34, life: 0.16, flicker: 0.9, color: el.color2 }, el);
      case "thunder": return this.pending.push({ t: 0.28 + Math.random() * 0.15, fn: () => this._sfx("thunder") });
      case "shockRing": return this._ring(pos, (scale > 1 ? 6 : 4) * scale, c, 1, el.palette.core.blend === "add" ? "add" : "normal", 0.1, 0.55);
      case "implode": return this._implode(pos, el, scale);
      case "barrier": return this._spawnBarrier(el, 5);
      // status tick micro-effects
      case "drip": return this.emit(pos, null, { tex: "splash", count: 3, size: 0.5, life: 0.6, speed: 1, spread: 0.5, mode: "up", gravity: 8, drag: 1, color: "#bfe6ff", color2: "#5aa6e0", blend: "normal", grow: 1, fade: "out" });
      case "dustpuff": return this.emit(pos, null, { tex: "dust", count: 4, size: 0.9, life: 0.7, speed: 1.4, spread: 0.9, mode: "out", gravity: 1, drag: 1.5, color: "#caa670", color2: "#8a6a44", blend: "normal", grow: 1.6, fade: "out", opacity: 0.6 });
      case "leafmote": return this.emit(pos, null, { tex: "leaf", count: 3, size: 0.6, life: 1, speed: 1.4, spread: 1, mode: "out", gravity: 1, drag: 1.2, color: c2, color2: c, blend: "normal", grow: 1, fade: "out" });
      case "glint": return this.emit(pos, null, { tex: "spark", count: 4, size: 0.35, life: 0.4, speed: 2, spread: 1, mode: "radial", gravity: 0, drag: 2, color: "#fff4cc", color2: c, blend: "add", grow: 1, fade: "out" });
      case "gustmote": return this.emit(pos, null, { tex: "dust", count: 3, size: 0.7, life: 0.6, speed: 2, spread: 1, mode: "out", gravity: -0.2, drag: 1.5, color: "#e0efe8", color2: "#b0c8bc", blend: "normal", grow: 1.4, fade: "out", opacity: 0.5 });
      case "spark": return this.emit(pos, null, { tex: "spark", count: 4, size: 0.28, life: 0.35, speed: 3, spread: 1, mode: "radial", gravity: 2, drag: 1, color: "#eaddff", color2: c, blend: "add", grow: 0.6, fade: "out" });
      default: return; // unknown upgrade flourish -> ignored, never crashes
    }
  }
  _upgradeFx(name) {
    // map marquee upgrade "add" flourishes onto known primitives; unknown -> passthrough (ignored)
    const map = {
      ember_trail: "embers", fire_pillar: "shockRing", fire_wave: "shockRing", fire_trail_dmg: "scorch",
      water_pierce: "splash", cleanse: "mist", chain: "arc", after_shock: "arc", double_step: "gust",
      quake: "shockRing", seed_burst: "growth", lifesteal: "growth", twin_edge: "sparks", pierce_all: "sparks", reflect: "shockRing"
    };
    return map[name] || name;
  }

  /* ---------- particle bursts ---------- */
  emit(origin, dir, o) {
    const T = this.THREE, N = Math.max(1, o.count | 0);
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
    const c1 = new T.Color(o.color), c2 = new T.Color(o.color2 || o.color);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = origin.x; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z;
      const v = this._dirFor(o.mode, dir, o.spread == null ? 0.6 : o.spread).multiplyScalar((o.speed || 3) * (1 + (Math.random() - 0.5) * (o.speedVar == null ? 0.6 : o.speedVar)));
      vel.push(v);
      const cc = c1.clone().lerp(c2, Math.random());
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    const mat = new T.PointsMaterial({
      map: this._tex(o.tex), size: o.size || 0.6, vertexColors: true, transparent: true, depthWrite: false,
      blending: o.blend === "add" ? T.AdditiveBlending : T.NormalBlending, opacity: o.opacity == null ? 1 : o.opacity
    });
    const p = new T.Points(geo, mat); this.scene.add(p);
    this.parts.push({ p, vel, life: o.life || 1, max: o.life || 1, gravity: o.gravity || 0, drag: o.drag == null ? 0.9 : o.drag, grow: o.grow || 1, base: o.size || 0.6, baseOp: o.opacity == null ? 1 : o.opacity, fade: o.fade || "out" });
  }
  _dirFor(mode, dir, spread) {
    const T = this.THREE, j = () => (Math.random() - 0.5) * 2 * spread;
    if (mode === "up") return new T.Vector3(j() * 0.6, 0.7 + Math.random() * 0.6, j() * 0.6).normalize();
    if (mode === "down") return new T.Vector3(j() * 0.6, -0.7 - Math.random() * 0.4, j() * 0.6).normalize();
    if (mode === "out" || mode === "radial") { const a = Math.random() * Math.PI * 2; return new T.Vector3(Math.cos(a), 0.15 + Math.random() * 0.4 * spread, Math.sin(a)).normalize(); }
    if (mode === "back" && dir) return dir.clone().add(new T.Vector3(j() * 0.4, j() * 0.4, j() * 0.4)).normalize();
    if (dir) return dir.clone().add(new T.Vector3(j(), j() * 0.5, j())).normalize();
    return new T.Vector3(j(), Math.random(), j()).normalize();
  }
  _updateParts(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const b = this.parts[i]; b.life -= dt;
      if (b.life <= 0) { this.scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); this.parts.splice(i, 1); continue; }
      const a = b.p.geometry.attributes.position.array;
      for (let j = 0; j < b.vel.length; j++) {
        const v = b.vel[j]; const f = Math.max(0, 1 - b.drag * dt); v.multiplyScalar(f);
        a[j * 3] += v.x * dt; a[j * 3 + 1] += v.y * dt - b.gravity * dt; a[j * 3 + 2] += v.z * dt;
      }
      b.p.geometry.attributes.position.needsUpdate = true;
      const k = b.life / b.max; // 1 -> 0
      const op = b.fade === "in-out" ? Math.sin((1 - k) * Math.PI) : k;
      b.p.material.opacity = Math.max(0, op) * b.baseOp;
      b.p.material.size = b.base * (1 + (b.grow - 1) * (1 - k));
    }
  }

  /* ---------- ground decals ---------- */
  _decal(name, pos, size, life, color, blend, opacity) {
    const T = this.THREE, h = this.hooks.heightAt;
    const n = this._groundNormal(pos.x, pos.z);
    const m = new T.MeshBasicMaterial({ map: this._tex(name), color: new T.Color(color), transparent: true, depthWrite: false, blending: blend === "add" ? T.AdditiveBlending : T.NormalBlending, opacity, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new T.Mesh(new T.PlaneGeometry(size, size), m);
    mesh.position.set(pos.x, h(pos.x, pos.z) + 0.05, pos.z);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.scene.add(mesh);
    this.decals.push({ mesh, life, max: life, op: opacity });
    while (this.decals.length > this.MAX_DECALS) { const d = this.decals.shift(); this.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
  }
  _updateDecals(dt) {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]; d.life -= dt;
      if (d.life <= 0) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); this.decals.splice(i, 1); continue; }
      const k = d.life / d.max;
      d.mesh.material.opacity = d.op * (k > 0.3 ? 1 : k / 0.3); // hold, then fade out last 30%
    }
  }
  _groundNormal(x, z) {
    const T = this.THREE, h = this.hooks.heightAt, e = 0.7;
    return new T.Vector3(h(x - e, z) - h(x + e, z), 2 * e, h(x, z - e) - h(x, z + e)).normalize();
  }

  /* ---------- rings (shock / ripple / telegraph) ---------- */
  _ring(pos, radius, color, opacity, blend, thick, life) {
    const T = this.THREE, h = this.hooks.heightAt;
    const m = new T.MeshBasicMaterial({ color: new T.Color(color), transparent: true, depthWrite: false, side: T.DoubleSide, blending: blend === "add" ? T.AdditiveBlending : T.NormalBlending, opacity });
    const mesh = new T.Mesh(new T.RingGeometry(0.72 - thick, 0.9, 54), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, h(pos.x, pos.z) + 0.08, pos.z);
    this.scene.add(mesh);
    const L = life || 0.55;
    this.meshFx.push({ obj: mesh, life: L, max: L, upd: (e) => { const k = 1 - e.life / e.max; const s = 0.5 + k * radius; e.obj.scale.set(s, s, s); e.obj.material.opacity = opacity * (1 - k); } });
  }
  _telegraphRing(pos, radius, color, life) {
    const T = this.THREE, h = this.hooks.heightAt;
    const m = new T.MeshBasicMaterial({ color: new T.Color(color), transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, opacity: 0.5 });
    const mesh = new T.Mesh(new T.RingGeometry(radius * 0.86, radius, 54), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, h(pos.x, pos.z) + 0.06, pos.z);
    this.scene.add(mesh);
    this.meshFx.push({ obj: mesh, life, max: life, upd: (e) => { e.obj.material.opacity = 0.25 + 0.4 * Math.abs(Math.sin(e.life * 18)); } });
  }

  /* ---------- debris & fragments ---------- */
  _debris(pos, dir, count, color, shiny) {
    const T = this.THREE, h = this.hooks.heightAt;
    for (let i = 0; i < count; i++) {
      const s = 0.12 + Math.random() * 0.22;
      const geo = shiny ? new T.OctahedronGeometry(s, 0) : new T.TetrahedronGeometry(s, 0);
      const mat = new T.MeshStandardMaterial({ color: new T.Color(color), roughness: shiny ? 0.3 : 0.95, metalness: shiny ? 0.8 : 0, flatShading: true });
      const mesh = new T.Mesh(geo, mat); mesh.position.copy(pos); mesh.castShadow = false;
      this.scene.add(mesh);
      const vel = new T.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2).add(dir ? dir.clone().multiplyScalar(1.5) : new T.Vector3()).multiplyScalar(2.4);
      const spin = new T.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      const L = 1.4 + Math.random() * 0.5;
      this.meshFx.push({
        obj: mesh, life: L, max: L, vel, spin, upd: (e, dt) => {
          e.vel.y -= 12 * dt; e.obj.position.addScaledVector(e.vel, dt);
          const gy = h(e.obj.position.x, e.obj.position.z) + s;
          if (e.obj.position.y < gy) { e.obj.position.y = gy; e.vel.set(0, 0, 0); }
          e.obj.rotation.x += e.spin.x * dt; e.obj.rotation.y += e.spin.y * dt;
          if (e.life < 0.5) { e.obj.material.transparent = true; e.obj.material.opacity = e.life / 0.5; }
        }
      });
    }
  }
  _liftStones(pos, count, color) {
    const T = this.THREE, h = this.hooks.heightAt;
    for (let i = 0; i < count; i++) {
      const s = 0.3 + Math.random() * 0.5, a = Math.random() * Math.PI * 2, r = Math.random() * 2.2;
      const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r, gy = h(x, z);
      const mesh = new T.Mesh(new T.DodecahedronGeometry(s, 0), new T.MeshStandardMaterial({ color: new T.Color(color), roughness: 1, flatShading: true }));
      mesh.position.set(x, gy, z); this.scene.add(mesh);
      const rise = 1 + Math.random() * 1.6, L = 1.3;
      this.meshFx.push({
        obj: mesh, life: L, max: L, upd: (e, dt) => {
          const k = 1 - e.life / e.max; const y = gy + Math.sin(k * Math.PI) * rise; e.obj.position.y = y;
          e.obj.rotation.x += dt * 2; e.obj.rotation.y += dt * 1.4;
          if (e.life < 0.4) { e.obj.material.transparent = true; e.obj.material.opacity = e.life / 0.4; }
        }
      });
    }
  }
  _roots(pos, count, color) {
    const T = this.THREE, h = this.hooks.heightAt;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5, r = 0.5 + Math.random() * 2;
      const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r, gy = h(x, z);
      const len = 1.2 + Math.random() * 1.6;
      const mesh = new T.Mesh(new T.CylinderGeometry(0.06, 0.16, len, 6), new T.MeshStandardMaterial({ color: new T.Color(color), roughness: 0.9 }));
      mesh.position.set(x, gy, z); mesh.rotation.z = (Math.random() - 0.5) * 0.8; mesh.rotation.x = (Math.random() - 0.5) * 0.8;
      mesh.scale.y = 0.01; this.scene.add(mesh);
      const L = 2.2;
      this.meshFx.push({
        obj: mesh, life: L, max: L, upd: (e, dt) => {
          const k = 1 - e.life / e.max; const grow = Math.min(1, k * 4);
          e.obj.scale.y = grow; e.obj.position.y = gy + (len * grow) / 2 * Math.cos(e.obj.rotation.z);
          if (e.life < 0.6) { e.obj.material.transparent = true; e.obj.material.opacity = e.life / 0.6; }
        }
      });
    }
  }

  /* ---------- implosion (Limitless / Lapse: Blue) — particles rush inward ---------- */
  _implode(pos, el, scale) {
    const T = this.THREE, N = Math.round(24 * (scale || 1));
    const posA = new Float32Array(N * 3), colA = new Float32Array(N * 3), vel = [];
    const c1 = new T.Color(el.color), c2 = new T.Color(el.color2);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, rr = 3.5 + Math.random() * 3;
      const px = pos.x + Math.cos(a) * rr, py = pos.y + 0.5 + Math.random() * 3, pz = pos.z + Math.sin(a) * rr;
      posA[i * 3] = px; posA[i * 3 + 1] = py; posA[i * 3 + 2] = pz;
      vel.push(new T.Vector3(pos.x - px, (pos.y + 1) - py, pos.z - pz).normalize().multiplyScalar(6 + Math.random() * 5));
      const cc = c1.clone().lerp(c2, Math.random()); colA[i * 3] = cc.r; colA[i * 3 + 1] = cc.g; colA[i * 3 + 2] = cc.b;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(posA, 3));
    geo.setAttribute("color", new T.BufferAttribute(colA, 3));
    const p = new T.Points(geo, new T.PointsMaterial({ map: this._tex("spark"), size: 0.42, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.scene.add(p);
    this.parts.push({ p, vel, life: 0.7, max: 0.7, gravity: 0, drag: 0.15, grow: 0.5, base: 0.42, baseOp: 1, fade: "out" });
  }

  /* ---------- branching lightning arc ---------- */
  _arc(pos, dir, el) {
    const T = this.THREE, from = pos.clone().setY(pos.y + 3.5), to = pos.clone();
    const pts = [], seg = 7;
    for (let i = 0; i <= seg; i++) {
      const p = from.clone().lerp(to, i / seg);
      if (i > 0 && i < seg) { p.x += (Math.random() - 0.5) * 1.1; p.z += (Math.random() - 0.5) * 1.1; p.y += (Math.random() - 0.5) * 0.6; }
      pts.push(p);
    }
    // a couple of forks
    for (let f = 0; f < 2; f++) { const b = 2 + ((Math.random() * (seg - 3)) | 0); const base = pts[b].clone(); pts.push(base); pts.push(base.clone().add(new T.Vector3((Math.random() - 0.5) * 2, -Math.random() * 1.5, (Math.random() - 0.5) * 2))); }
    const geo = new T.BufferGeometry().setFromPoints(pts);
    const line = new T.Line(geo, new T.LineBasicMaterial({ color: new T.Color(el.color2), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    this.scene.add(line);
    const L = 0.18;
    this.meshFx.push({ obj: line, life: L, max: L, upd: (e) => { e.obj.material.opacity = Math.random() * 0.6 + 0.4 * (e.life / e.max); } });
  }

  /* ---------- dome barrier (follows caster) ---------- */
  _spawnBarrier(el, dur) {
    const T = this.THREE;
    const mat = new T.MeshBasicMaterial({ color: new T.Color(el.color), transparent: true, opacity: 0.18, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false, wireframe: false });
    const mesh = new T.Mesh(new T.SphereGeometry(2.6, 20, 16), mat);
    this.scene.add(mesh);
    this.meshFx.push({
      obj: mesh, life: dur, max: dur, follow: true, upd: (e, dt) => {
        const pl = this.hooks.player && this.hooks.player.pos; if (pl) e.obj.position.set(pl.x, pl.y + 1.6, pl.z);
        const k = e.life / e.max; e.obj.material.opacity = (0.12 + 0.06 * Math.sin(e.life * 6)) * Math.min(1, k * 3);
        e.obj.rotation.y += dt * 0.6;
      }
    });
    return mesh;
  }

  /* ---------- lights ---------- */
  _spawnLight(pos, spec, el) {
    const T = this.THREE;
    const light = new T.PointLight(new T.Color(spec.color || el.color).getHex(), spec.intensity || 4, spec.range || 12);
    light.position.copy(pos); this.scene.add(light);
    this.lights.push({ light, life: spec.life || 0.5, max: spec.life || 0.5, base: spec.intensity || 4, flicker: spec.flicker || 0 });
  }
  _updateLights(dt) {
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i]; l.life -= dt;
      if (l.life <= 0) { this.scene.remove(l.light); this.lights.splice(i, 1); continue; }
      const k = l.life / l.max;
      l.light.intensity = l.base * k * (1 + l.flicker * (Math.random() - 0.5));
    }
  }

  /* ---------- statuses (DoT / slow, with tick VFX) ---------- */
  _updateStatuses(dt) {
    for (let i = this.statuses.length - 1; i >= 0; i--) {
      const e = this.statuses[i];
      if (!e.alive || !e.status) { if (e) e.status = null; this.statuses.splice(i, 1); continue; }
      const s = e.status; s.remaining -= dt; s.tick += dt;
      if (s.def.dps && e.damage) { e.damage(s.def.dps * dt, { dot: true }); }
      if (s.tick >= 0.5) { s.tick = 0; const p = e.pos.clone().setY(e.pos.y + 1.4); for (const tg of (s.def.tick || [])) this._env(tg, p, null, this.data.elements[this._elementOfStatus(s.id)] || this.data.elements.fire, 1); }
      if (s.remaining <= 0) { e.status = null; this.statuses.splice(i, 1); }
    }
  }
  _elementOfStatus(id) { for (const k in this.data.elements) if (this.data.elements[k].status === id) return k; return "fire"; }

  /* ---------- helpers ---------- */
  _enemies() { return (this.hooks.enemies ? this.hooks.enemies() : []).filter(e => e && e.alive); }
  _dist2(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; }
  _shake(v) { if (this.hooks.shake) this.hooks.shake(v); }
  _sfx(k) { if (this.hooks.sfx) this.hooks.sfx(k); }

  /* ---------- main update (called from game loop) ---------- */
  update(dt) {
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { p.fn(); this.pending.splice(i, 1); } }
    this._updateProjectiles(dt);
    this._updateParts(dt);
    this._updateDecals(dt);
    this._updateLights(dt);
    this._updateStatuses(dt);
    for (let i = this.meshFx.length - 1; i >= 0; i--) {
      const e = this.meshFx[i]; e.life -= dt; if (e.upd) e.upd(e, dt);
      if (e.life <= 0) { this.scene.remove(e.obj); if (e.obj.geometry) e.obj.geometry.dispose(); if (e.obj.material) e.obj.material.dispose(); this.meshFx.splice(i, 1); }
    }
  }
}
