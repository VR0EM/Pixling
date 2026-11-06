import { emotePixels } from '../sprites/emotes.ts';
import { render, type RenderOptions } from '../sprites/index.ts';
import type { Pose } from './brain.ts';

/** Sprite size in sprite pixels. */
const SPRITE = 32;
/** Empty rows above the sprite on the canvas, for emotes. */
const HEADROOM = 12;
/** The sprite row where the feet meet the ground. */
const GROUND_ROW = 30;

export interface Look {
  species: string;
  palette: string;
  accessory: string;
  scale: number;
}

/** Draws the buddy on its little canvas and moves that canvas around the overlay. */
export class View {
  private readonly ctx: CanvasRenderingContext2D;
  private key = '';
  private left = 0;
  private top = 0;
  private scale = 3;
  private box = { x0: 0, y0: 0, x1: SPRITE - 1, y1: SPRITE - 1 };
  private bubbleUntil = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly bubble: HTMLElement;

  constructor(canvas: HTMLCanvasElement, bubble: HTMLElement) {
    this.canvas = canvas;
    this.bubble = bubble;
    canvas.width = SPRITE;
    canvas.height = SPRITE + HEADROOM;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is niet beschikbaar');
    this.ctx = ctx;
  }

  /** Distance from the buddy's centre to its widest visible edge, in overlay pixels. */
  get halfWidth(): number {
    return Math.max(SPRITE / 2 - this.box.x0, this.box.x1 + 1 - SPRITE / 2) * this.scale;
  }

  /** Height of the visible sprite above the ground, in overlay pixels. */
  get height(): number {
    return (GROUND_ROW - this.box.y0) * this.scale;
  }

  draw(look: Look, pose: Pose, x: number, y: number, now: number): void {
    const options: RenderOptions = {
      palette: look.palette === 'eigen' ? undefined : look.palette,
      accessory: look.accessory === 'geen' ? undefined : look.accessory,
      frame: pose.frame,
      tick: pose.tick,
      blink: pose.blink,
      faceDx: pose.faceDx,
      walk: pose.walk,
    };
    const key = `${look.species}${JSON.stringify(options)}${pose.emote}${pose.emoteRise}`;
    if (key !== this.key) {
      this.key = key;
      const sprite = render(look.species, options);
      this.box = sprite.box;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.paint(sprite.pixels, 0, HEADROOM);
      if (pose.emote) {
        const icon = emotePixels(pose.emote);
        const ey = Math.max(0, HEADROOM + sprite.box.y0 - icon.length - pose.emoteRise);
        this.paint(icon, SPRITE - icon[0].length - 2, ey);
      }
    }

    const s = look.scale;
    if (s !== this.scale) this.scale = s;
    this.canvas.style.width = `${SPRITE * s}px`;
    this.canvas.style.height = `${(SPRITE + HEADROOM) * s}px`;
    this.left = Math.round(x - (SPRITE / 2) * s);
    this.top = Math.round(y - (HEADROOM + GROUND_ROW + pose.lift) * s);
    this.canvas.style.transform = `translate(${this.left}px, ${this.top}px)`;

    if (!this.bubble.hidden) {
      if (now > this.bubbleUntil) this.bubble.hidden = true;
      else {
        const headTop = this.top + (HEADROOM + this.box.y0) * s;
        const bx = Math.round(Math.min(Math.max(8, x - 24), window.innerWidth - this.bubble.offsetWidth - 8));
        const by = Math.round(Math.max(8, headTop - this.bubble.offsetHeight - 10));
        this.bubble.style.transform = `translate(${bx}px, ${by}px)`;
      }
    }
  }

  /** Is this overlay point on (or right next to) the visible part of the buddy? */
  hit(px: number, py: number, padding = 6): boolean {
    const s = this.scale;
    const x0 = this.left + this.box.x0 * s - padding;
    const x1 = this.left + (this.box.x1 + 1) * s + padding;
    const y0 = this.top + (HEADROOM + this.box.y0) * s - padding;
    const y1 = this.top + (HEADROOM + this.box.y1 + 1) * s + padding;
    return px >= x0 && px <= x1 && py >= y0 && py <= y1;
  }

  /** Shows a short text balloon above the buddy. */
  say(text: string, ms: number, now: number): void {
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    this.bubbleUntil = now + ms;
  }

  private paint(pixels: (string | null)[][], x0: number, y0: number): void {
    pixels.forEach((row, y) =>
      row.forEach((colour, x) => {
        if (!colour) return;
        this.ctx.fillStyle = colour;
        this.ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }),
    );
  }
}
