import type { BeadStatus, GardenBead } from '../types';
import { hash, petalColor, rng, SKY, type SkyPhase } from '../lib/helpers';

export type Stage = 'sprout' | 'growing' | 'wilted' | 'ash' | 'bloom';

export function stageOf(status: BeadStatus): Stage | null {
  switch (status) {
    case 'pending': return 'sprout';
    case 'in_progress': return 'growing';
    case 'blocked': return 'wilted';
    case 'failed': return 'ash';
    case 'completed': return 'bloom';
    default: return null; // archived
  }
}

interface Plant {
  bead: GardenBead;
  nx: number;            // normalized x (0..1), stable once assigned
  ny: number;            // normalized y within meadow band
  seed: number;
  color: string;
  stage: Stage;
  grow: number;          // 0..1 entrance + height progress
  bloom: number;         // 0..1 flower openness
  wilt: number;          // 0..1 droop
  scale: number;         // size from priority
  hover: number;         // 0..1 hover lift
}

interface Firefly { x: number; y: number; vx: number; vy: number; bright: boolean; phase: number; target?: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; rot: number; vr: number; text?: string }

interface Opts {
  onHover: (bead: GardenBead | null, sx: number, sy: number) => void;
  onBloom: (count: number) => void;
}

const BAND_TOP = 0.46;
const BAND_BOT = 0.9;

export class GardenEngine {
  private ctx: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  private raf = 0; private last = 0;
  private t = 0;                 // breeze phase
  private gustAmt = 0;
  private plants = new Map<string, Plant>();
  private fireflies: Firefly[] = [];
  private particles: Particle[] = [];
  private stars: { x: number; y: number; p: number }[] = [];
  private pollen: { x: number; y: number; vx: number; vy: number; p: number }[] = [];
  private laneOf = new Map<string, number>();
  private pointer = { x: -1, y: -1 };
  private hovered: string | null = null;
  private sky: [string, string, string] = SKY.night;
  private phase: SkyPhase = 'night';
  private initialized = false;
  private bloomCount = 0;
  private readonly ambientCount = 3; // dim free-roaming wanderers, always present for ambiance

  constructor(private canvas: HTMLCanvasElement, private opts: Opts) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    for (let i = 0; i < 70; i++) this.stars.push({ x: Math.random(), y: Math.random() * 0.5, p: Math.random() });
    for (let i = 0; i < 26; i++) this.pollen.push({ x: Math.random(), y: BAND_TOP + Math.random() * 0.4, vx: 0, vy: 0, p: Math.random() });
  }

  setSky(phase: SkyPhase) { this.phase = phase; this.sky = SKY[phase]; }

  resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  setPointer(x: number, y: number) { this.pointer.x = x; this.pointer.y = y; }

  gust() { this.gustAmt = 1; }

  // Reconcile the plant set; detect new completions -> celebrate.
  setBeads(beads: GardenBead[]) {
    // Assign project lanes for stable horizontal clustering ("garden beds").
    const projects = [...new Set(beads.map((b) => b.projectId))].sort();
    projects.forEach((p, i) => { if (!this.laneOf.has(p)) this.laneOf.set(p, (i + 0.5) / projects.length); });

    const seen = new Set<string>();
    for (const b of beads) {
      const stage = stageOf(b.status);
      if (!stage) continue;
      seen.add(b.id);
      const existing = this.plants.get(b.id);
      if (existing) {
        const was = existing.stage;
        existing.bead = b;
        existing.stage = stage;
        if (this.initialized && was !== 'bloom' && stage === 'bloom') this.celebrate(existing);
      } else {
        const seed = hash(b.id);
        const r = rng(seed);
        const lane = this.laneOf.get(b.projectId) ?? r();
        const laneW = projects.length ? 0.85 / projects.length : 0.3;
        const nx = Math.min(0.97, Math.max(0.03, lane + (r() - 0.5) * laneW));
        const ny = BAND_TOP + r() * (BAND_BOT - BAND_TOP);
        const pr = b.priority ?? 3;
        this.plants.set(b.id, {
          bead: b, nx, ny, seed, color: petalColor(b.id), stage,
          grow: this.initialized ? 0 : 1, bloom: stage === 'bloom' ? 1 : 0,
          wilt: stage === 'wilted' ? 1 : 0,
          scale: 1 + (3 - Math.min(3, pr)) * 0.09, hover: 0,
        });
      }
    }
    // Drop plants no longer present (archived / out of scope).
    for (const id of [...this.plants.keys()]) if (!seen.has(id)) this.plants.delete(id);
    this.initialized = true;
  }

  private celebrate(p: Plant) {
    this.bloomCount++;
    this.opts.onBloom(this.bloomCount);
    const { x, y } = this.plantTop(p);
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
      const sp = 40 + Math.random() * 90;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0, max: 1.1 + Math.random() * 0.7, color: p.color,
        size: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
      });
    }
    this.particles.push({ x, y: y - 6, vx: 0, vy: -28, life: 0, max: 1.4, color: '#ffe9a8', size: 14, rot: 0, vr: 0, text: '✦ bloom' });
  }

  private plantTop(p: Plant) {
    const x = p.nx * this.w;
    const baseY = p.ny * this.h;
    const depth = 0.6 + (p.ny - BAND_TOP) / (BAND_BOT - BAND_TOP) * 0.8;
    const stemH = (60 + p.scale * 22) * depth * (0.25 + 0.75 * p.grow);
    const sway = (Math.sin(this.t * 1.3 + p.seed) * (5 + this.gustAmt * 22)) * depth;
    return { x: x + sway, y: baseY - stemH, baseY, depth, stemH, sway };
  }

  hitTest(px: number, py: number): GardenBead | null {
    let best: { id: string; d: number } | null = null;
    for (const [id, p] of this.plants) {
      const { x, y, depth } = this.plantTop(p);
      const rad = (18 + (p.stage === 'bloom' ? 10 : 0)) * depth * p.scale;
      const d = Math.hypot(px - x, py - y);
      if (d < rad && (!best || d < best.d)) best = { id, d };
    }
    return best ? this.plants.get(best.id)!.bead : null;
  }

  start() { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); }
  stop() { cancelAnimationFrame(this.raf); }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.gustAmt = Math.max(0, this.gustAmt - dt * 0.7);
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // Hover detection
    const hit = this.pointer.x >= 0 ? this.hitTest(this.pointer.x, this.pointer.y) : null;
    const newHover = hit ? hit.id : null;
    if (newHover !== this.hovered) {
      this.hovered = newHover;
      this.opts.onHover(hit, this.pointer.x, this.pointer.y);
    }
    for (const p of this.plants.values()) {
      p.grow += (1 - p.grow) * Math.min(1, dt * 2.2);
      p.bloom += ((p.stage === 'bloom' ? 1 : 0) - p.bloom) * Math.min(1, dt * 3);
      p.wilt += ((p.stage === 'wilted' ? 1 : 0) - p.wilt) * Math.min(1, dt * 3);
      p.hover += ((this.hovered === p.bead.id ? 1 : 0) - p.hover) * Math.min(1, dt * 8);
    }
    this.syncFireflies();
    this.updateFireflies(dt);
    // Particles
    for (const pt of this.particles) {
      pt.life += dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += 60 * dt; pt.vx *= 0.98; pt.rot += pt.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    // Pollen drift
    for (const po of this.pollen) {
      po.p += dt * 0.3;
      po.x += (Math.sin(po.p) * 0.0006 + 0.0002);
      po.y += Math.cos(po.p * 1.3) * 0.0003;
      if (po.x > 1) po.x = 0;
      if (po.y > BAND_BOT) po.y = BAND_TOP;
    }
  }

  private syncFireflies() {
    // A few dim wanderers always drift for ambiance; beyond those, one BRIGHT firefly
    // per in-progress task — so it's clear at a glance which fireflies mark active work.
    const want = Math.min(60, this.ambientCount + this.growingPlants().length);
    while (this.fireflies.length < want) {
      this.fireflies.push({
        x: Math.random() * this.w, y: (BAND_TOP + Math.random() * 0.4) * this.h,
        vx: 0, vy: 0, bright: false, phase: Math.random() * 6,
      });
    }
    while (this.fireflies.length > want) this.fireflies.pop();
    // first `ambientCount` stay dim wanderers; the rest are bright tenders
    this.fireflies.forEach((f, i) => { f.bright = i >= this.ambientCount; });
  }

  private growingPlants(): Plant[] {
    const out: Plant[] = [];
    for (const p of this.plants.values()) if (p.stage === 'growing') out.push(p);
    return out;
  }

  private updateFireflies(dt: number) {
    const targets = this.growingPlants();
    for (let i = 0; i < this.fireflies.length; i++) {
      const f = this.fireflies[i];
      f.phase += dt;
      // bright tenders (index >= ambientCount) each hover their own in-progress plant;
      // dim wanderers (the first `ambientCount`) roam freely, attached to nothing.
      const topB = this.h * 0.3, botB = this.h * 0.92;
      const bi = i - this.ambientCount;
      const tp = bi >= 0 && targets.length ? targets[bi % targets.length] : null;
      if (tp) {
        // bright tender: hover its in-progress plant
        f.target = tp.bead.id;
        const top = this.plantTop(tp);
        const dx = top.x - f.x + Math.sin(f.phase * 1.7) * 16;
        const dy = top.y - f.y + Math.cos(f.phase * 1.3) * 16;
        f.vx += dx * dt * 1.6; f.vy += dy * dt * 1.6;
        f.vx *= 0.92; f.vy *= 0.92;
      } else {
        // dim wanderer: gentle meander that softly turns back from the edges — never
        // teleport-wraps (which used to let it build speed and streak across the screen).
        f.target = undefined;
        f.vx += Math.sin(f.phase * 0.7) * 5 * dt;
        f.vy += Math.cos(f.phase * 0.5) * 5 * dt;
        const m = 90;
        if (f.x < m) f.vx += (m - f.x) * 0.004;
        else if (f.x > this.w - m) f.vx -= (f.x - (this.w - m)) * 0.004;
        if (f.y < topB + 20) f.vy += (topB + 20 - f.y) * 0.004;
        else if (f.y > botB - 20) f.vy -= (f.y - (botB - 20)) * 0.004;
        f.vx *= 0.94; f.vy *= 0.94;
        // hard speed cap so a wanderer can never streak
        const maxV = 0.9;
        const sp = Math.hypot(f.vx, f.vy);
        if (sp > maxV) { f.vx = (f.vx / sp) * maxV; f.vy = (f.vy / sp) * maxV; }
      }
      f.x += f.vx; f.y += f.vy;
      // clamp inside the field (no edge teleporting for anyone)
      f.x = Math.max(0, Math.min(this.w, f.x));
      f.y = Math.max(topB, Math.min(botB, f.y));
    }
  }

  // ---------- drawing ----------
  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    this.drawSky();
    if (this.phase === 'night' || this.phase === 'dusk' || this.phase === 'dawn') this.drawStars();
    this.drawGround();
    for (const po of this.pollen) {
      ctx.globalAlpha = 0.18 + Math.sin(po.p) * 0.1;
      ctx.fillStyle = '#fff4cf';
      ctx.beginPath(); ctx.arc(po.x * this.w, po.y * this.h, 1.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Plants back-to-front (smaller y first)
    const ordered = [...this.plants.values()].sort((a, b) => a.ny - b.ny);
    for (const p of ordered) this.drawPlant(p);
    this.drawFireflies();
    this.drawParticles();
  }

  private drawSky() {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, this.sky[0]);
    g.addColorStop(0.62, this.sky[1]);
    g.addColorStop(1, this.sky[2]);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawStars() {
    const ctx = this.ctx;
    for (const s of this.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 0.8 + s.p * 6));
      ctx.globalAlpha = (this.phase === 'day' ? 0 : 0.8) * tw;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s.x * this.w, s.y * this.h, s.p * 1.3 + 0.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGround() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, this.h * BAND_TOP, 0, this.h);
    g.addColorStop(0, 'rgba(10,20,16,0)');
    g.addColorStop(1, 'rgba(6,14,10,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, this.h * BAND_TOP, this.w, this.h * (1 - BAND_TOP));
  }

  private drawPlant(p: Plant) {
    const ctx = this.ctx;
    const x = p.nx * this.w;
    const baseY = p.ny * this.h;
    const depth = 0.6 + (p.ny - BAND_TOP) / (BAND_BOT - BAND_TOP) * 0.8;
    const lift = p.hover * 4;
    let stemH = (60 + p.scale * 22) * depth * (0.25 + 0.75 * p.grow);
    const sway = (Math.sin(this.t * 1.3 + p.seed) * (5 + this.gustAmt * 22)) * depth;
    const droop = p.wilt;
    const topX = x + sway + droop * 6 * depth;
    const topY = baseY - stemH + droop * stemH * 0.4 - lift;

    // hover glow ring
    if (p.hover > 0.02) {
      ctx.globalAlpha = p.hover * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(topX, topY, (20 + (p.stage === 'bloom' ? 8 : 0)) * depth, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // stem
    const stemColor = p.stage === 'ash' ? '#5a5a5a' : p.stage === 'wilted' ? '#6f8a64' : '#2faa6e';
    ctx.strokeStyle = stemColor;
    ctx.lineWidth = Math.max(1.4, 2.6 * depth);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + sway * 0.5, baseY - stemH * 0.5, topX, topY);
    ctx.stroke();

    // leaves (skip ash)
    if (p.stage !== 'ash') {
      const lc = p.stage === 'wilted' ? '#7e9b6e' : '#3fd494';
      this.leaf(x + sway * 0.4, baseY - stemH * 0.45, 9 * depth, -0.5 + sway * 0.02, lc, p.grow);
      this.leaf(x + sway * 0.4, baseY - stemH * 0.62, 7 * depth, 2.4 + sway * 0.02, lc, p.grow);
    }

    // head by stage
    if (p.stage === 'bloom') this.drawFlower(topX, topY, depth * p.scale, p.color, p.bloom);
    else if (p.stage === 'growing') this.drawBud(topX, topY, depth * p.scale, true);
    else if (p.stage === 'sprout') this.drawBud(topX, topY, depth * p.scale * 0.7, false);
    else if (p.stage === 'wilted') this.drawWilt(topX, topY, depth * p.scale);
    // ash: nothing on top (broken stem)
    void stemH;
  }

  private leaf(x: number, y: number, r: number, ang: number, color: string, grow: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(grow, grow);
    ctx.fillStyle = color; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(r * 0.7, 0, r, r * 0.42, 0, 0, 7); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  private drawFlower(x: number, y: number, s: number, color: string, open: number) {
    const ctx = this.ctx;
    const petals = 6; const pr = 8 * s * (0.4 + 0.6 * open);
    // soft glow
    ctx.globalAlpha = 0.25; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, pr * 2.2, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < petals; i++) {
      const a = (Math.PI * 2 * i) / petals + this.t * 0.05;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(pr, 0, pr, pr * 0.5, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x, y, pr * 0.5, 0, 7); ctx.fill();
  }

  private drawBud(x: number, y: number, s: number, glow: boolean) {
    const ctx = this.ctx;
    if (glow) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.4 + x);
      ctx.globalAlpha = 0.28 + pulse * 0.25; ctx.fillStyle = '#9be88a';
      ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = glow ? '#7bdc7a' : '#5cc98f';
    ctx.beginPath(); ctx.ellipse(x, y, 4 * s, 6 * s, 0, 0, 7); ctx.fill();
  }

  private drawWilt(x: number, y: number, s: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#8a7d5f';
    ctx.save(); ctx.translate(x, y); ctx.rotate(1.2);
    ctx.beginPath(); ctx.ellipse(0, 0, 5 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(x + 4 * s, y + 4 * s, 1.6 * s, 0, 7); ctx.fill();
  }

  private drawFireflies() {
    const ctx = this.ctx;
    for (const f of this.fireflies) {
      const fl = 0.5 + 0.5 * Math.sin(f.phase * 4);
      // bright tenders: bigger, fuller glow. dim wanderers: small and faint.
      const r = f.bright ? 2.9 : 1.3;
      const alpha = (f.bright ? 1 : 0.28) * (0.5 + fl * 0.5);
      ctx.globalAlpha = alpha * (f.bright ? 0.5 : 0.22); ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(f.x, f.y, r * (f.bright ? 4.6 : 2.8), 0, 7); ctx.fill();
      ctx.globalAlpha = alpha; ctx.fillStyle = '#fff6d6';
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      if (p.text) {
        ctx.fillStyle = p.color; ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, 7); ctx.fill(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Live census for the HUD.
  census() {
    let sprout = 0, growing = 0, bloom = 0, wilted = 0, ash = 0;
    for (const p of this.plants.values()) {
      if (p.stage === 'sprout') sprout++;
      else if (p.stage === 'growing') growing++;
      else if (p.stage === 'bloom') bloom++;
      else if (p.stage === 'wilted') wilted++;
      else if (p.stage === 'ash') ash++;
    }
    return { sprout, growing, bloom, wilted, ash, total: this.plants.size };
  }
}
