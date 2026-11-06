import type { Emote } from '../sprites/emotes.ts';
import type { Context } from './context.ts';

/** What the buddy is doing right now. */
export type Mode = 'idle' | 'walk' | 'sleep' | 'drag' | 'fall' | 'land';

export interface Input {
  /** Cursor position in overlay pixels, or null when unknown. */
  cursor: { x: number; y: number } | null;
  /** Milliseconds since the cursor last moved. */
  idleMs: number;
  /** The user is dragging something, probably a file to feed it. */
  dragging?: boolean;
}

/** Everything the view needs to draw one frame. */
export interface Pose {
  frame: 'A' | 'B';
  walk?: number;
  blink: boolean;
  faceDx: number;
  tick: number;
  /** Extra height in sprite pixels, for little hops. */
  lift: number;
  emote: Emote | null;
  /** How far the emote has floated up, in sprite pixels. */
  emoteRise: number;
}

/** Another app's window in overlay pixels. Lists of these are ordered front to back. */
export interface Rect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WALK_SPEED = 30; // px per second
export const GRAVITY = 2600; // px per second²
export const SLEEP_AFTER_MS = 60_000;
/** How far a window may jump sideways between two looks before the buddy loses its grip. */
const SHAKE = 80;
/** Height above a window's edge at the top of a jump; low enough to land without bouncing. */
const JUMP_CLEARANCE = 40;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The buddy's behaviour: a small state machine plus physics. It knows nothing about the DOM, so it can be
 * tested on its own. Positions are in overlay pixels; (x, y) is the point between the feet. The floor is
 * the bottom of the screen or the top edge of the window it stands on.
 */
export class Brain {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  mode: Mode = 'idle';
  dir: -1 | 1 = -1;
  width: number;
  height: number;
  /** Distance from the centre to the sprite's widest edge; keeps the buddy fully on screen. */
  margin = 40;
  /** Visible height of the sprite; the ceiling when it's thrown up. */
  tall = 80;
  /** The id of the window it stands on, or null for the bottom of the screen. */
  standingOn: number | null = null;
  /** What the user is doing, judged by the app in front; changes how it behaves a little. */
  context: Context | null = null;
  /** Sits still (reading during a focus round) instead of wandering or climbing. */
  stayPut = false;
  /** Worked too long without a break: yawns now and then and walks less. */
  tired = false;
  /** The computer is working hard: wipes its brow now and then. */
  sweaty = false;
  /** Walking speed in px per second and how keen it is to walk; set from its character. */
  speed = WALK_SPEED;
  walkiness = 0.65;

  private time = 0;
  private modeStart = 0;
  private modeLength = 2;
  private walked = 0;
  private blinkAt = 2;
  private blinkUntil = 0;
  private emote: Emote | null = null;
  private emoteStart = 0;
  private emoteUntil = 0;
  private hopUntil = 0;
  private nextNoteAt = 3;
  private nextYawnAt = 0;
  private nextSweatAt = 0;
  private wasDragging = false;
  private impact = 0;
  private grabDx = 0;
  private grabDy = 0;
  private trail: { x: number; y: number; t: number }[] = [];
  private rects: Rect[] = [];
  /** The window in front, to notice when the user switches windows. */
  private frontId: number | null = null;
  /** When to try jumping onto the window that just came to the front (null: no plan). */
  private followAt: number | null = null;
  /** Where the window it stands on was last seen, to follow it when it moves. */
  private standAt = { x: 0, y: 0 };
  private readonly random: () => number;

  constructor(width: number, height: number, random: () => number = Math.random) {
    this.width = width;
    this.height = height;
    this.random = random;
    this.x = Math.round(width * 0.8);
    this.y = height;
  }

  /** The overlay changed size, e.g. because the Dock moved. */
  resize(width: number, height: number): void {
    const onGround = this.standingOn === null && this.y >= this.height;
    this.width = width;
    this.height = height;
    this.x = clamp(this.x, this.margin, Math.max(this.margin, width - this.margin));
    if (onGround || this.y > height) this.y = height;
  }

  /**
   * New window positions from the app. Riding along happens here rather than in update(), so it's as
   * smooth as the polling. The buddy falls off when its window closes, gets covered or is yanked away.
   */
  setWindows(rects: Rect[]): void {
    this.rects = rects;
    // A different window came to the front: go and sit on it in a moment, if it has a free top edge.
    const front = rects[0]?.id ?? null;
    if (front !== this.frontId) {
      this.frontId = front;
      this.followAt = front !== null && front !== this.standingOn ? this.time + 0.7 : null;
    }
    if (this.standingOn === null) return;
    const index = rects.findIndex((r) => r.id === this.standingOn);
    const win = rects[index];
    if (!win) return this.drop(0, 0);
    const dx = win.x - this.standAt.x;
    this.standAt = { x: win.x, y: win.y };
    if (Math.abs(dx) > SHAKE) {
      this.say('uitroep', 0.8);
      return this.drop(clamp(dx * 20, -1500, 1500), -200);
    }
    this.x += dx;
    this.y = win.y;
    const edge = this.edge();
    const offEdge = this.x < win.x + edge || this.x > win.x + win.w - edge;
    if (offEdge || win.y < this.tall || !this.uncovered(this.x, win.y, index)) this.drop(0, 0);
  }

  update(dtSeconds: number, input: Input): void {
    const dt = Math.min(dtSeconds, 0.1);
    this.time += dt;
    if (this.time > this.blinkAt) {
      this.blinkUntil = this.time + 0.15;
      this.blinkAt = this.time + this.between(2, 5.5);
    }

    switch (this.mode) {
      case 'idle':
      case 'walk': {
        if (input.idleMs > SLEEP_AFTER_MS) {
          this.setMode('sleep');
          break;
        }
        // Someone is coming to it, maybe with a file: stop and wait.
        const waiting = !!input.dragging || this.near(input);
        if (input.dragging && !this.wasDragging && this.near(input, 260)) this.say('uitroep', 0.8);
        this.wasDragging = !!input.dragging;
        if (waiting) {
          if (this.mode === 'walk') this.setMode('idle', 1);
          this.followAt = null;
          break;
        }
        if (this.context === 'muziek' && this.time > this.nextNoteAt) {
          this.say('noot', 1);
          this.nextNoteAt = this.time + this.between(3, 6);
        }
        if (this.sweaty && this.time > this.nextSweatAt) {
          this.say('zweet', 1.2);
          this.nextSweatAt = this.time + this.between(6, 10);
        }
        if (this.tired && this.time > this.nextYawnAt) {
          this.say('slaap', 1.2);
          this.nextYawnAt = this.time + this.between(8, 15);
        }
        if (this.followAt !== null && this.time >= this.followAt) {
          this.followAt = null;
          if (!this.stayPut && this.climb(true)) break;
        }
        if (this.mode === 'walk' && this.walk(dt)) break;
        if (this.elapsed() > this.modeLength) this.decide();
        break;
      }
      case 'sleep':
        if (input.idleMs < 400) {
          this.setMode('idle', this.between(2, 4));
          this.say('uitroep', 0.9);
          this.hop();
        }
        break;
      case 'fall':
        this.fall(dt);
        break;
      case 'land':
        if (this.elapsed() > 0.2) {
          this.setMode('idle', this.between(1.5, 3));
          if (this.impact > 1500) this.say('vraag', 1.4);
        }
        break;
      case 'drag':
        break;
    }
  }

  /** Starts dragging; `t` is the event time in seconds. */
  grab(px: number, py: number, t: number): void {
    this.standingOn = null;
    this.setMode('drag');
    this.grabDx = this.x - px;
    this.grabDy = this.y - py;
    this.trail = [{ x: px, y: py, t }];
    this.say('uitroep', 0.7);
  }

  dragTo(px: number, py: number, t: number): void {
    if (this.mode !== 'drag') return;
    this.x = clamp(px + this.grabDx, this.margin, this.width - this.margin);
    this.y = clamp(py + this.grabDy, this.tall, this.height);
    this.trail.push({ x: px, y: py, t });
    while (this.trail.length > 2 && t - this.trail[0].t > 0.1) this.trail.shift();
  }

  /** Lets go; the speed of the last 100 ms of dragging becomes a throw. */
  release(): void {
    if (this.mode !== 'drag') return;
    const first = this.trail[0];
    const last = this.trail[this.trail.length - 1];
    const span = last.t - first.t;
    const vx = span > 0.01 ? clamp((last.x - first.x) / span, -2500, 2500) : 0;
    const vy = span > 0.01 ? clamp((last.y - first.y) / span, -2500, 2500) : 0;
    // Let go gently in front of a window: hop up onto its top edge instead of dropping past it.
    const index = Math.hypot(vx, vy) < 400 ? this.windowAt(this.x, this.y - 4) : -1;
    const win = this.rects[index];
    if (win && this.fits(win, index)) {
      const edge = this.edge();
      this.jumpTo(clamp(this.x, win.x + edge, win.x + win.w - edge), win.y);
      return;
    }
    this.drop(vx, vy);
  }

  /** A click without dragging. */
  pet(): void {
    if (this.mode === 'sleep') this.setMode('idle', 3);
    this.say('hart', 1.1);
    this.hop();
  }

  /** Shows an emote for a moment, e.g. surprise when a file is dragged over it. */
  notice(emote: Emote, seconds = 0.8): void {
    this.say(emote, seconds);
  }

  /** Leaps up to a higher spot, such as a window's top edge, and lands there on the way down. */
  jumpTo(x: number, top: number): void {
    const rise = this.y - top + JUMP_CLEARANCE;
    if (rise <= JUMP_CLEARANCE) return;
    const flight = Math.sqrt((2 * rise) / GRAVITY) + Math.sqrt((2 * JUMP_CLEARANCE) / GRAVITY);
    this.drop((x - this.x) / flight, -Math.sqrt(2 * GRAVITY * rise));
  }

  pose(input: Input): Pose {
    const t = this.time;
    let frame: 'A' | 'B' = Math.floor(t / 0.55) % 2 ? 'B' : 'A';
    let walk: number | undefined;
    let faceDx = 0;
    switch (this.mode) {
      case 'walk':
        walk = Math.floor(this.walked / 5) % 4;
        frame = walk % 2 ? 'B' : 'A';
        faceDx = this.dir;
        break;
      case 'sleep':
        frame = Math.floor(t / 1.1) % 2 ? 'B' : 'A';
        break;
      case 'drag':
        walk = Math.floor(t / 0.12) % 4; // kicking its feet
        frame = 'A';
        break;
      case 'fall':
        frame = 'A';
        break;
      case 'land':
        frame = 'B';
        break;
      case 'idle':
        if (this.tired) frame = Math.floor(t / 0.9) % 2 ? 'B' : 'A'; // slow, heavy breathing
        if (this.context === 'muziek') frame = Math.floor(t / 0.3) % 2 ? 'B' : 'A'; // bobbing along
        if (input.cursor && this.context !== 'video') {
          const dx = input.cursor.x - this.x;
          if (Math.abs(dx) > 60) faceDx = Math.sign(dx);
        }
        break;
    }

    let emote = t < this.emoteUntil ? this.emote : null;
    let emoteRise = emote ? Math.min(3, Math.floor((t - this.emoteStart) / 0.25)) : 0;
    if (this.mode === 'sleep' && !emote) {
      emote = 'slaap';
      emoteRise = Math.floor(t / 0.5) % 4;
    }

    return {
      frame,
      walk,
      blink: this.mode === 'sleep' || t < this.blinkUntil,
      faceDx,
      tick: Math.floor(t / 0.65) % 4,
      lift: t < this.hopUntil ? 2 : 0,
      emote,
      emoteRise,
    };
  }

  private setMode(mode: Mode, length = 0): void {
    this.mode = mode;
    this.modeStart = this.time;
    this.modeLength = length;
  }

  private elapsed(): number {
    return this.time - this.modeStart;
  }

  private between(lo: number, hi: number): number {
    return lo + this.random() * (hi - lo);
  }

  private say(emote: Emote, seconds: number): void {
    this.emote = emote;
    this.emoteStart = this.time;
    this.emoteUntil = this.time + seconds;
  }

  private hop(): void {
    this.hopUntil = this.time + 0.25;
  }

  /** Is the cursor close to it (within `reach` pixels sideways, around its height)? */
  private near(input: Input, reach = 110): boolean {
    const c = input.cursor;
    return !!c && Math.abs(c.x - this.x) < reach && c.y > this.y - this.tall - reach && c.y < this.y + 40;
  }

  /** How close to a window's corner the feet may get. */
  private edge(): number {
    return Math.max(8, this.margin * 0.45);
  }

  /** Left and right limits of whatever it stands on. */
  private floor(): [number, number] {
    let left = this.margin;
    let right = this.width - this.margin;
    const win = this.standingOn === null ? undefined : this.rects.find((r) => r.id === this.standingOn);
    if (win) {
      left = Math.max(left, win.x + this.edge());
      right = Math.min(right, win.x + win.w - this.edge());
    }
    return [left, right];
  }

  /** Is the top edge of rects[index] free at x, i.e. not hidden behind a window in front of it? */
  private uncovered(x: number, top: number, index: number): boolean {
    for (let i = 0; i < index; i++) {
      const r = this.rects[i];
      if (x >= r.x && x <= r.x + r.w && top - 2 >= r.y && top - 2 <= r.y + r.h) return false;
    }
    return true;
  }

  private drop(vx: number, vy: number): void {
    this.standingOn = null;
    this.vx = vx;
    this.vy = vy;
    this.impact = 0;
    this.setMode('fall');
  }

  /** Picks what to do next: rest, walk, now and then climb a window, or hop down from one. */
  private decide(): void {
    if (this.context === 'video' || this.stayPut) {
      this.setMode('idle', this.between(3, 8)); // watching along, or reading
      return;
    }
    const roll = this.random();
    if (this.mode === 'idle' && roll < 0.3 && this.climb()) return;
    if (this.mode === 'idle' && this.standingOn !== null && roll < 0.25) {
      this.drop(this.dir * 80, -300);
      return;
    }
    const walkChance = this.tired ? 0.2 : this.context === 'code' ? this.walkiness * 0.55 : this.walkiness;
    if (this.mode === 'walk' || this.random() > walkChance) {
      this.setMode('idle', this.between(2, 6));
      return;
    }
    const [left, right] = this.floor();
    this.dir = this.x - left < 60 ? 1 : right - this.x < 60 ? -1 : this.random() < 0.5 ? -1 : 1;
    this.setMode('walk', this.between(2, 7));
  }

  /**
   * Jumps onto the frontmost window edge that is higher up and has a free spot, preferring the spot
   * closest to where it stands. With `frontOnly` it only tries the window in front.
   */
  private climb(frontOnly = false): boolean {
    for (let i = 0; i < (frontOnly ? Math.min(1, this.rects.length) : this.rects.length); i++) {
      const r = this.rects[i];
      if (r.id === this.standingOn || !this.fits(r, i) || r.y > this.y - 60) continue;
      const x = this.freeSpot(r, i);
      if (x === null) continue;
      this.jumpTo(x, r.y);
      return true;
    }
    return false;
  }

  /** Can the buddy stand on this window's top edge at all? Maximised windows leave no room above them. */
  private fits(r: Rect, index: number): boolean {
    return r.w >= 2 * (this.edge() + 20) && r.y >= this.tall + JUMP_CLEARANCE + 20 && this.freeSpot(r, index) !== null;
  }

  /** The visible spot on a window's top edge closest to the buddy, or null when all of it is hidden. */
  private freeSpot(r: Rect, index: number): number | null {
    const edge = this.edge() + 20;
    const lo = Math.max(r.x + edge, this.margin);
    const hi = Math.min(r.x + r.w - edge, this.width - this.margin);
    if (lo > hi) return null;
    const start = clamp(this.x, lo, hi);
    for (let d = 0; d <= hi - lo; d += 16) {
      for (const x of [start - d, start + d]) {
        if (x >= lo && x <= hi && this.uncovered(x, r.y, index)) return x;
      }
    }
    return null;
  }

  /** Index of the frontmost window under this point, or -1. */
  private windowAt(x: number, y: number): number {
    return this.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  /** Moves along; returns true when it hopped off the edge of a window. */
  private walk(dt: number): boolean {
    const step = this.speed * dt;
    this.x += this.dir * step;
    this.walked += step;
    const [left, right] = this.floor();
    if (this.x >= left && this.x <= right) return false;
    this.x = clamp(this.x, left, right);
    if (this.standingOn !== null && this.random() < 0.4) {
      this.drop(this.dir * 90, -250);
      return true;
    }
    this.dir = this.x <= left ? 1 : -1;
    return false;
  }

  private fall(dt: number): void {
    const prevY = this.y;
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < this.margin) {
      this.x = this.margin;
      this.vx = Math.abs(this.vx) * 0.5;
    }
    if (this.x > this.width - this.margin) {
      this.x = this.width - this.margin;
      this.vx = -Math.abs(this.vx) * 0.5;
    }
    if (this.y - this.tall < 0) {
      this.y = this.tall;
      this.vy = Math.abs(this.vy) * 0.3;
    }
    if (this.vy > 0) {
      // The highest window edge passed on the way down catches it.
      const edge = this.edge();
      let hit: Rect | undefined;
      this.rects.forEach((r, i) => {
        const crossed = prevY <= r.y && this.y >= r.y;
        const onTop = this.x >= r.x + edge && this.x <= r.x + r.w - edge;
        if (crossed && onTop && r.y > this.tall && this.uncovered(this.x, r.y, i) && (!hit || r.y < hit.y)) hit = r;
      });
      if (hit) return this.touchDown(hit);
    }
    if (this.y >= this.height) this.touchDown(null);
  }

  /** Arrives on a window (or the ground when null): bounces if it came down hard, otherwise lands. */
  private touchDown(win: Rect | null): void {
    this.y = win ? win.y : this.height;
    this.impact = Math.max(this.impact, this.vy);
    if (this.vy > 500) {
      this.vy = -this.vy * 0.35;
      this.vx *= 0.7;
      return;
    }
    this.vx = 0;
    this.vy = 0;
    this.standingOn = win ? win.id : null;
    if (win) this.standAt = { x: win.x, y: win.y };
    this.setMode('land');
  }
}
