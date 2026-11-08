import { FIXED } from '../sprites/palettes.ts';
import type { Rect } from './brain.ts';
import { ballRadius, hoopParts, type Ball, type Hoop } from './games.ts';

/**
 * Everything drawn around the buddy rather than on it, on one transparent canvas over the whole overlay:
 * the ball and the hoop, Easter eggs, snow lying on the windows, rain or snow falling around the buddy,
 * and confetti. Drawn in the same chunky pixels as the buddy.
 */

/** An Easter egg, on a window's top edge (it moves along with it) or on the floor (window null). */
export interface Egg {
  window: number | null;
  /** From the window's left edge, or from the left of the screen on the floor. */
  dx: number;
  colours: [string, string];
  found: boolean;
}

interface Particle {
  kind: 'rain' | 'snow' | 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  colour: string;
  size: number;
}

export interface Scene {
  scale: number;
  ball: Ball | null;
  hoop: Hoop | null;
  eggs: Egg[];
  /** Snow lies on top of these windows and the floor. */
  snow: Rect[] | null;
  /** Falling around the buddy. */
  weather: 'rain' | 'snow' | null;
  buddy: { x: number; y: number; tall: number };
}

const BALL = ['.ooo.', 'owrrr', 'orrrr', 'rrrrR', '.RRR.'];
const EGG = ['.11.', '1111', '2222', '1111', '.11.'];
const OUTLINE = '#1d1a2c';
const CONFETTI = [FIXED.r, FIXED.y, FIXED.t, FIXED.m, FIXED.g, FIXED.q];

/** Where an egg is now, or null when its window is gone (it then sits on the floor). */
export function eggSpot(e: Egg, rects: Rect[], floor: number): { x: number; y: number } {
  const win = e.window === null ? undefined : rects.find((r) => r.id === e.window);
  return win ? { x: win.x + e.dx, y: win.y } : { x: e.dx, y: floor };
}

export class World {
  private readonly ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private dirty = true;

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * ratio);
    this.canvas.height = Math.round(window.innerHeight * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.dirty = true;
  }

  /** A burst of confetti, for a basket or a birthday. */
  confetti(x: number, y: number): void {
    for (let i = 0; i < 28; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 250 + Math.random() * 350;
      this.particles.push({
        kind: 'confetti',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.4,
        colour: CONFETTI[i % CONFETTI.length],
        size: 1,
      });
    }
  }

  /** Is this point on an egg that hasn't been found yet? Returns its index, or -1. */
  eggAt(x: number, y: number, eggs: Egg[], rects: Rect[], floor: number, scale: number): number {
    return eggs.findIndex((e) => {
      if (e.found) return false;
      const p = eggSpot(e, rects, floor);
      return Math.abs(x - p.x) < 4 * scale + 6 && y > p.y - 7 * scale && y < p.y + 6;
    });
  }

  draw(scene: Scene, rects: Rect[], dt: number): void {
    const s = scene.scale;
    this.updateParticles(scene, dt);
    const empty = !scene.ball && !scene.hoop && !scene.eggs.some((e) => !e.found) && !scene.snow && !this.particles.length;
    if (empty && !this.dirty) return;
    const c = this.ctx;
    c.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.dirty = !empty;
    const floor = window.innerHeight;

    if (scene.snow) this.drawSnow(scene.snow, floor, s);
    if (scene.hoop) this.drawHoop(scene.hoop, s);
    for (const e of scene.eggs) {
      if (e.found) continue;
      const p = eggSpot(e, rects, floor);
      this.sprite(EGG, p.x - 2 * s, p.y - 5 * s, s, { '1': e.colours[0], '2': e.colours[1] });
    }
    if (scene.ball) {
      const r = ballRadius(s);
      this.sprite(BALL, scene.ball.x - r, scene.ball.y - r, s, { o: FIXED.w, w: FIXED.w, r: FIXED.r, R: FIXED.R });
    }
    for (const p of this.particles) {
      c.globalAlpha = Math.min(1, p.life * 2);
      c.fillStyle = p.colour;
      c.fillRect(Math.round(p.x), Math.round(p.y), p.size * s, (p.kind === 'rain' ? 2 : 1) * s);
    }
    c.globalAlpha = 1;
  }

  /** Rain or snow keeps falling around the buddy; confetti flies and falls. */
  private updateParticles(scene: Scene, dt: number): void {
    const { x, y, tall } = scene.buddy;
    if (scene.weather) {
      const rate = scene.weather === 'rain' ? 40 : 12;
      for (let n = rate * dt; n > 0; n--) {
        if (n < 1 && Math.random() > n) break;
        const rain = scene.weather === 'rain';
        this.particles.push({
          kind: rain ? 'rain' : 'snow',
          x: x + (Math.random() - 0.5) * 160,
          y: y - tall - 60 - Math.random() * 40,
          vx: rain ? -20 : (Math.random() - 0.5) * 30,
          vy: rain ? 420 : 45 + Math.random() * 25,
          life: rain ? 0.6 : 3,
          colour: rain ? FIXED.t : FIXED.w,
          size: rain ? 0.5 : 1,
        });
      }
    }
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.kind === 'confetti') p.vy += 900 * dt;
      if (p.kind === 'snow') p.vx += Math.sin(p.y / 20) * 4 * dt * 60; // snow sways
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < window.innerHeight);
  }

  /** A layer of snow along the visible part of each window's top edge, and along the floor. */
  private drawSnow(rects: Rect[], floor: number, s: number): void {
    const c = this.ctx;
    const step = s * 2;
    const lump = (x: number) => 1 + (((Math.floor(x / step) * 7919) % 5) > 2 ? 1 : 0);
    c.fillStyle = '#f7fbff';
    rects.forEach((r, i) => {
      for (let x = r.x + step; x < r.x + r.w - step; x += step) {
        const covered = rects.slice(0, i).some((f) => x >= f.x && x <= f.x + f.w && r.y - 2 >= f.y && r.y - 2 <= f.y + f.h);
        if (covered) continue;
        const h = lump(x) * s;
        c.fillRect(x, r.y - h, step, h);
      }
    });
    for (let x = 0; x < window.innerWidth; x += step) c.fillRect(x, floor - lump(x) * s, step, lump(x) * s);
  }

  private drawHoop(h: Hoop, s: number): void {
    const c = this.ctx;
    const px = (x: number, y: number, w: number, hh: number, colour: string) => {
      c.fillStyle = colour;
      c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh));
    };
    // The backboard behind the rim, with its square.
    const bx = h.x - 3 * s;
    const bw = h.w + 6 * s;
    px(bx - s, h.y - 17 * s, bw + 2 * s, 17 * s, OUTLINE);
    px(bx, h.y - 16 * s, bw, 15 * s, FIXED.w);
    px(h.x + h.w / 2 - 5 * s, h.y - 10 * s, 10 * s, 8 * s, FIXED.r);
    px(h.x + h.w / 2 - 4 * s, h.y - 9 * s, 8 * s, 6 * s, FIXED.w);
    // The net, narrowing downwards.
    for (let row = 0; row < 7; row++) {
      const inset = row * s * 0.9;
      for (let x = h.x + inset; x < h.x + h.w - inset; x += 2 * s) px(x + ((row % 2) * s), h.y + (row + 1) * s, s, s, FIXED.w);
    }
    // The rim.
    px(h.x - s, h.y - s, h.w + 2 * s, 3 * s, OUTLINE);
    px(h.x, h.y, h.w, s, FIXED.O);
    // A little × above the corner to put the hoop away.
    const close = hoopParts(h, s).close;
    px(close.x, close.y, close.w, close.h, OUTLINE);
    px(close.x + s, close.y + s, close.w - 2 * s, close.h - 2 * s, FIXED.r);
    for (const [cx, cy] of [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]]) px(close.x + (cx + 1) * s, close.y + (cy + 1) * s, s, s, FIXED.w);
  }

  /** Draws a little pixel map with a dark outline, its top-left at (x, y). */
  private sprite(rows: string[], x: number, y: number, s: number, colours: Record<string, string>): void {
    const c = this.ctx;
    const filled = (cx: number, cy: number) => (rows[cy]?.[cx] ?? '.') !== '.';
    for (let cy = -1; cy <= rows.length; cy++) {
      for (let cx = -1; cx <= rows[0].length; cx++) {
        if (filled(cx, cy)) continue;
        if (filled(cx - 1, cy) || filled(cx + 1, cy) || filled(cx, cy - 1) || filled(cx, cy + 1)) {
          c.fillStyle = OUTLINE;
          c.fillRect(Math.round(x + cx * s), Math.round(y + cy * s), s, s);
        }
      }
    }
    rows.forEach((row, cy) =>
      [...row].forEach((k, cx) => {
        if (k === '.') return;
        c.fillStyle = colours[k] ?? FIXED[k] ?? '#ff00ff';
        c.fillRect(Math.round(x + cx * s), Math.round(y + cy * s), s, s);
      }),
    );
  }
}
