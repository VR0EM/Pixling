import type { Emote } from '../sprites/emotes.ts';

/** What the buddy is doing right now. */
export type Mode = 'idle' | 'walk' | 'sleep' | 'drag' | 'fall' | 'land';

export interface Input {
  /** Cursor position in overlay pixels, or null when unknown. */
  cursor: { x: number; y: number } | null;
  /** Milliseconds since the cursor last moved. */
  idleMs: number;
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

export const WALK_SPEED = 30; // px per second
export const GRAVITY = 2600; // px per second²
export const SLEEP_AFTER_MS = 60_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The buddy's behaviour: a small state machine plus throw physics. It knows nothing about the DOM, so it
 * can be tested on its own. Positions are in overlay pixels; (x, y) is the point between the feet.
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
  private impact = 0;
  private grabDx = 0;
  private grabDy = 0;
  private trail: { x: number; y: number; t: number }[] = [];
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
    const onGround = this.y >= this.height;
    this.width = width;
    this.height = height;
    this.x = clamp(this.x, this.margin, Math.max(this.margin, width - this.margin));
    if (onGround || this.y > height) this.y = height;
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
      case 'walk':
        if (input.idleMs > SLEEP_AFTER_MS) {
          this.setMode('sleep');
          break;
        }
        if (this.mode === 'walk') this.walk(dt);
        if (this.elapsed() > this.modeLength) this.decide();
        break;
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
    this.vx = span > 0.01 ? clamp((last.x - first.x) / span, -2500, 2500) : 0;
    this.vy = span > 0.01 ? clamp((last.y - first.y) / span, -2500, 2500) : 0;
    this.impact = 0;
    this.setMode('fall');
  }

  /** A click without dragging. */
  pet(): void {
    if (this.mode === 'sleep') this.setMode('idle', 3);
    this.say('hart', 1.1);
    this.hop();
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
        if (input.cursor) {
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

  /** Picks what to do next: after a walk always rest a bit, otherwise usually go for a walk. */
  private decide(): void {
    if (this.mode === 'walk' || this.random() < 0.35) {
      this.setMode('idle', this.between(2, 6));
      return;
    }
    const roomLeft = this.x - this.margin;
    const roomRight = this.width - this.margin - this.x;
    this.dir = roomLeft < 80 ? 1 : roomRight < 80 ? -1 : this.random() < 0.5 ? -1 : 1;
    this.setMode('walk', this.between(2, 7));
  }

  private walk(dt: number): void {
    const step = WALK_SPEED * dt;
    this.x += this.dir * step;
    this.walked += step;
    if (this.x < this.margin) {
      this.x = this.margin;
      this.dir = 1;
    }
    if (this.x > this.width - this.margin) {
      this.x = this.width - this.margin;
      this.dir = -1;
    }
  }

  private fall(dt: number): void {
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
    if (this.y >= this.height) {
      this.y = this.height;
      this.impact = Math.max(this.impact, this.vy);
      if (this.vy > 500) {
        this.vy = -this.vy * 0.35;
        this.vx *= 0.7;
      } else {
        this.vx = 0;
        this.vy = 0;
        this.setMode('land');
      }
    }
  }
}
