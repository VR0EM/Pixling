import type { Emote } from '../sprites/emotes.ts';
import type { Brain, Rect } from './brain.ts';
import type { Line } from './voice.ts';

/**
 * Games to play with the buddy:
 * - fetch: throw the ball with the mouse; it runs after it and brings it back to your cursor;
 * - hide and seek: it hides partly off screen or behind a window's edge; click it when you find it;
 * - basket: a hoop hangs on the screen; throw the buddy through it.
 * The positions are overlay pixels, like the brain's. No DOM here, so it can be tested.
 */

export type GameKind = 'fetch' | 'hide' | 'basket';

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Being dragged by you. */
  held: boolean;
  /** In the buddy's hands. */
  carried: boolean;
}

/** The rim of the hoop: its left end, its height, its width. */
export interface Hoop {
  x: number;
  y: number;
  w: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the hoop's backboard (with the rim and net) and its little close button are. */
export function hoopParts(h: Hoop, scale: number): { board: Box; close: Box } {
  const s = scale;
  const bx = h.x - 3 * s;
  const bw = h.w + 6 * s;
  return {
    board: { x: bx - s, y: h.y - 17 * s, w: bw + 2 * s, h: 25 * s },
    close: { x: bx + bw - 6 * s, y: h.y - 24 * s, w: 7 * s, h: 7 * s },
  };
}

const inBox = (x: number, y: number, b: Box, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

/** What happened in a game, for the app to show and count. */
export interface GameEvent {
  say?: Line;
  emote?: Emote;
  count?: 'fetches' | 'baskets' | 'finds';
  /** Confetti here. */
  confetti?: { x: number; y: number };
}

export interface Screen {
  width: number;
  height: number;
  /** Screen pixels per sprite pixel. */
  scale: number;
}

const BALL_GRAVITY = 1800;
/** Without a throw for this long, fetch ends. */
const FETCH_BORED = 45_000;
const HIDE_COUNT = 3000;
const HIDE_HINT = 25_000;
const HIDE_GIVE_UP = 75_000;
const BASKET_BORED = 120_000;

export const ballRadius = (scale: number) => 2.5 * scale;

/** Moves a free ball: gravity, bouncing off the floor and the sides, rolling to a stop. */
export function stepBall(b: Ball, dt: number, s: Screen): void {
  const r = ballRadius(s.scale);
  b.vy += BALL_GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.x < r || b.x > s.width - r) {
    b.x = Math.min(Math.max(b.x, r), s.width - r);
    b.vx = -b.vx * 0.6;
  }
  if (b.y < r) {
    b.y = r;
    b.vy = Math.abs(b.vy) * 0.5;
  }
  const floor = s.height - r;
  if (b.y >= floor) {
    b.y = floor;
    b.vy = Math.abs(b.vy) > 140 ? -Math.abs(b.vy) * 0.55 : 0;
    b.vx *= Math.pow(0.2, dt); // rolling slows it down
    if (Math.abs(b.vx) < 6) b.vx = 0;
  }
}

/** On the floor and (almost) still. */
export const resting = (b: Ball, s: Screen) => b.y >= s.height - ballRadius(s.scale) - 0.5 && b.vy === 0 && Math.abs(b.vx) < 6;

export class Games {
  kind: GameKind | null = null;
  ball: Ball | null = null;
  hoop: Hoop | null = null;
  /** While hiding behind a window's edge: nothing of the buddy shows below this line. */
  clipY: number | null = null;

  private phase = '';
  private lastAction = 0;
  private hideAt = 0;
  private hinted = false;
  private retarget = 0;
  private trail: { x: number; y: number; t: number }[] = [];
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  get active(): boolean {
    return this.kind !== null;
  }

  start(kind: GameKind, now: number, brain: Brain, s: Screen): GameEvent {
    this.stop(brain);
    this.kind = kind;
    this.lastAction = now;
    if (kind === 'fetch') {
      const x = Math.min(Math.max(brain.x + brain.dir * 60, 40), s.width - 40);
      this.ball = { x, y: s.height - ballRadius(s.scale), vx: 0, vy: 0, held: false, carried: false };
      this.phase = 'wait';
      return { say: { key: 'fetchStart' } };
    }
    if (kind === 'hide') {
      this.phase = 'counting';
      this.hideAt = now + HIDE_COUNT;
      this.hinted = false;
      return { say: { key: 'hideStart' } };
    }
    const w = 26 * s.scale;
    this.hoop = { x: Math.round(s.width * 0.72 - w / 2), y: Math.round(s.height * 0.38), w };
    return { say: { key: 'basketStart' } };
  }

  /** Ends the game: puts the ball and hoop away and brings the buddy out of hiding. */
  stop(brain?: Brain): void {
    if (brain && this.kind === 'hide') brain.unhide();
    if (brain && this.kind === 'fetch') brain.target = null;
    this.kind = null;
    this.ball = null;
    this.hoop = null;
    this.clipY = null;
    this.phase = '';
  }

  /** Called every frame. `cursorX` is where the buddy brings the ball back to. */
  update(now: number, dt: number, brain: Brain, s: Screen, rects: Rect[], cursorX: number | null): GameEvent | undefined {
    if (this.kind === 'fetch') return this.fetchOn(now, dt, brain, s, cursorX);
    if (this.kind === 'hide') return this.hideOn(now, brain, s, rects);
    if (this.kind === 'basket' && now - this.lastAction > BASKET_BORED) this.stop(brain);
    return undefined;
  }

  private fetchOn(now: number, dt: number, brain: Brain, s: Screen, cursorX: number | null): GameEvent | undefined {
    const ball = this.ball!;
    if (ball.held) return undefined;
    if (ball.carried) {
      // In its hands, on the way back to you.
      ball.x = brain.x + brain.dir * 7 * s.scale;
      ball.y = brain.y - brain.tall * 0.35;
      if (cursorX !== null && now > this.retarget && brain.target !== null) {
        brain.target = cursorX;
        this.retarget = now + 500;
      }
      if (brain.target !== null || brain.mode === 'fall' || brain.mode === 'drag') return undefined;
      ball.carried = false;
      ball.x = Math.min(Math.max(brain.x + brain.dir * 16 * s.scale, ballRadius(s.scale)), s.width - ballRadius(s.scale));
      ball.y = s.height - ballRadius(s.scale);
      ball.vx = 0;
      ball.vy = 0;
      this.phase = 'wait';
      this.lastAction = now;
      return { count: 'fetches', ...(this.random() < 0.5 ? { say: { key: 'fetchAgain' } } : { emote: 'heart' }) };
    }
    stepBall(ball, dt, s);
    if (this.phase === 'flying' && resting(ball, s)) {
      this.phase = 'chase';
      brain.target = ball.x;
    }
    if (this.phase === 'chase') {
      if (brain.target !== null) brain.target = ball.x;
      const near = Math.abs(brain.x - ball.x) < 8 * s.scale && brain.standingOn === null && brain.mode !== 'fall';
      if (near && resting(ball, s)) {
        ball.carried = true;
        this.phase = 'return';
        brain.target = cursorX ?? brain.x - brain.dir * 120;
        return { emote: 'heart' };
      }
      if (brain.target === null && !near) brain.target = ball.x;
    }
    if (this.phase === 'wait' && now - this.lastAction > FETCH_BORED) {
      this.stop(brain);
      return { say: { key: 'fetchBored' } };
    }
    return undefined;
  }

  private hideOn(now: number, brain: Brain, s: Screen, rects: Rect[]): GameEvent | undefined {
    if (this.phase === 'counting') {
      if (now < this.hideAt || brain.mode === 'drag' || brain.mode === 'fall') return undefined;
      const spot = this.hidingSpot(brain, s, rects);
      brain.hide(spot.x, spot.y, spot.face);
      this.clipY = spot.clipY;
      this.phase = 'hiding';
      this.hideAt = now;
      return { emote: 'puff' };
    }
    if (this.phase !== 'hiding') return undefined;
    if (!this.hinted && now - this.hideAt > HIDE_HINT) {
      this.hinted = true;
      return { say: { key: 'hideHint' } };
    }
    if (now - this.hideAt > HIDE_GIVE_UP) {
      this.stop(brain);
      return { say: { key: 'hideGiveUp' } };
    }
    return undefined;
  }

  /** Somewhere to hide: sunk behind a window's top edge, below the bottom of the screen, or past a side. */
  private hidingSpot(brain: Brain, s: Screen, rects: Rect[]): { x: number; y: number; face: number; clipY: number | null } {
    const sink = brain.tall * 0.55;
    const spots: { x: number; y: number; face: number; clipY: number | null }[] = [
      { x: 40 + this.random() * (s.width - 80), y: s.height + sink, face: 0, clipY: s.height },
      { x: -brain.margin * 0.15, y: s.height, face: 1, clipY: null },
      { x: s.width + brain.margin * 0.15, y: s.height, face: -1, clipY: null },
    ];
    rects.forEach((r, i) => {
      if (r.w < 200 || r.y < brain.tall + 40 || r.y > s.height - 40) return;
      const x = r.x + 60 + this.random() * (r.w - 120);
      const hidden = rects.slice(0, i).some((f) => x >= f.x && x <= f.x + f.w && r.y - 2 >= f.y && r.y - 2 <= f.y + f.h);
      if (!hidden) spots.push({ x, y: r.y + sink, face: 0, clipY: r.y });
    });
    return spots[Math.floor(this.random() * spots.length)];
  }

  /** The buddy was clicked: in hide and seek that means you found it. */
  buddyClicked(brain: Brain): GameEvent | undefined {
    if (this.kind !== 'hide' || this.phase !== 'hiding') return undefined;
    this.stop(brain);
    return { say: { key: 'hideFound' }, emote: 'heart', count: 'finds' };
  }

  /** Called every frame while the buddy flies through the air: did it drop through the hoop? */
  checkBasket(prevY: number, brain: Brain, now: number): GameEvent | undefined {
    const h = this.hoop;
    if (this.kind !== 'basket' || !h || brain.mode !== 'fall' || brain.vy <= 0) return undefined;
    const through = prevY < h.y && brain.y >= h.y && brain.x > h.x + 4 && brain.x < h.x + h.w - 4;
    if (!through) return undefined;
    this.lastAction = now;
    return { say: { key: 'basketScore' }, emote: 'heart', count: 'baskets', confetti: { x: brain.x, y: h.y } };
  }

  /** Is this point on the hoop's close button, on the hoop itself (to drag it), or neither? */
  hoopHit(x: number, y: number, s: Screen): 'close' | 'board' | null {
    if (!this.hoop) return null;
    const parts = hoopParts(this.hoop, s.scale);
    if (inBox(x, y, parts.close, 4)) return 'close';
    return inBox(x, y, parts.board) ? 'board' : null;
  }

  /** Moves the hoop so its rim's left end is at (x, y), keeping all of it on screen. */
  moveHoop(x: number, y: number, s: Screen, now: number): void {
    const h = this.hoop;
    if (!h) return;
    h.x = Math.round(Math.min(Math.max(x, 6 * s.scale), s.width - h.w - 6 * s.scale));
    h.y = Math.round(Math.min(Math.max(y, 26 * s.scale), s.height - 10 * s.scale));
    this.lastAction = now;
  }

  /** Is this point on the ball (with a little room to grab it)? */
  ballHit(x: number, y: number, s: Screen): boolean {
    const b = this.ball;
    return !!b && Math.hypot(x - b.x, y - b.y) < ballRadius(s.scale) + 10;
  }

  grabBall(x: number, y: number, t: number, brain: Brain): void {
    if (!this.ball) return;
    this.ball.held = true;
    if (this.ball.carried) brain.target = null;
    this.ball.carried = false;
    this.trail = [{ x, y, t }];
    this.dragBall(x, y, t);
  }

  dragBall(x: number, y: number, t: number): void {
    if (!this.ball?.held) return;
    this.ball.x = x;
    this.ball.y = y;
    this.trail.push({ x, y, t });
    while (this.trail.length > 2 && t - this.trail[0].t > 100) this.trail.shift();
  }

  /** Lets go: the speed of the last 100 ms becomes the throw. `t` is in ms. */
  releaseBall(now: number): void {
    const b = this.ball;
    if (!b?.held) return;
    const first = this.trail[0];
    const last = this.trail[this.trail.length - 1];
    const span = (last.t - first.t) / 1000;
    b.vx = span > 0.01 ? Math.max(-2200, Math.min(2200, (last.x - first.x) / span)) : 0;
    b.vy = span > 0.01 ? Math.max(-2200, Math.min(2200, (last.y - first.y) / span)) : 0;
    b.held = false;
    this.phase = 'flying';
    this.lastAction = now;
  }
}
