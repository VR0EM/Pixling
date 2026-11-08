import type { Emote } from '../sprites/emotes.ts';
import type { Brain, Rect } from './brain.ts';
import type { Line } from './voice.ts';

/**
 * Two buddies together: they look at each other and say hi when they meet, play tag now and then, visit
 * each other on windows, push each other off one sometimes, and knock each other over when you throw one
 * at the other. Each buddy keeps its own brain; this only nudges them. No DOM, so it can be tested.
 */

/** Something one of the two says or shows: 0 is your buddy, 1 its friend. */
export interface SocialEvent {
  who: 0 | 1;
  say?: Line;
  emote?: Emote;
}

const MIN = 60;
/** Close enough to say hi, and far enough apart to count as having been apart again. */
const MEET = 110;
const APART = 320;
/** Close enough to tag. */
const TAG_REACH = 20;
const TAG_LENGTH = 40;
/** Thrown this fast, a buddy knocks the other one over. */
const BONK_SPEED = 600;

interface Tag {
  /** Who's it. */
  it: 0 | 1;
  until: number;
  tags: number;
  pauseUntil: number;
}

const onGround = (b: Brain) => b.standingOn === null && (b.mode === 'idle' || b.mode === 'walk');
const busy = (b: Brain) => b.stayPut || b.mode === 'sleep' || b.mode === 'drag' || b.mode === 'hide';

export class Social {
  private apart = true;
  private tag: Tag | null = null;
  private nextTag: number;
  private nextVisit: number;
  private nextPush: number;
  private bonked = false;
  private readonly random: () => number;

  constructor(now: number, random: () => number = Math.random) {
    this.random = random;
    this.nextTag = now + this.between(4, 10) * MIN;
    this.nextVisit = now + this.between(3, 8) * MIN;
    this.nextPush = now + this.between(6, 12) * MIN;
  }

  get playingTag(): boolean {
    return this.tag !== null;
  }

  private between(lo: number, hi: number): number {
    return lo + this.random() * (hi - lo);
  }

  /** Called every frame; `now` in seconds. `active`: someone is at the computer. */
  update(now: number, a: Brain, b: Brain, rects: Rect[], active: boolean): SocialEvent[] {
    const events: SocialEvent[] = [];
    const pair = [a, b] as const;
    const d = Math.abs(a.x - b.x);
    const sameFloor = a.standingOn === b.standingOn && Math.abs(a.y - b.y) < 4;

    // A thrown buddy knocks over the one it flies into.
    for (const who of [0, 1] as const) {
      const flier = pair[who];
      const other = pair[1 - who];
      const fast = flier.mode === 'fall' && Math.hypot(flier.vx, flier.vy) > BONK_SPEED;
      if (!fast) continue;
      const hit = Math.abs(flier.x - other.x) < 26 && flier.y > other.y - other.tall && flier.y < other.y + 10;
      if (hit && !this.bonked && other.mode !== 'drag' && other.mode !== 'fall') {
        this.bonked = true;
        other.bump(Math.sign(flier.vx || 1) * 320, -320);
        events.push({ who: (1 - who) as 0 | 1, say: { key: 'friendBonk' } });
      }
    }
    if (a.mode !== 'fall' && b.mode !== 'fall') this.bonked = false;

    if (this.tag) return [...events, ...this.tagOn(now, a, b, d)];

    // Meeting: they look at each other, and one says hi.
    if (this.apart && d < MEET && sameFloor && !busy(a) && !busy(b)) {
      this.apart = false;
      a.look(b.x, 3);
      b.look(a.x, 3);
      const who = this.random() < 0.5 ? 0 : 1;
      events.push({ who, emote: 'heart' });
      if (this.random() < 0.6) events.push({ who, say: { key: 'friendHello' } });
    } else if (d > APART) this.apart = true;

    if (!active || busy(a) || busy(b)) return events;

    // Standing in each other's way: one steps aside.
    if (d < 24 && sameFloor && onGround(a) && onGround(b) && a.target === null && b.target === null) {
      const side = b.x >= a.x ? 1 : -1;
      b.target = b.x + side * 60;
    }

    // Tag: one of them starts, on the ground.
    if (now > this.nextTag && onGround(a) && onGround(b)) {
      const it = this.random() < 0.5 ? 0 : 1;
      this.tag = { it, until: now + TAG_LENGTH, tags: 0, pauseUntil: now + 1 };
      events.push({ who: it, say: { key: 'tagStart' } });
      return events;
    }

    // Visiting: the one on the ground jumps up next to the one on a window.
    if (now > this.nextVisit) {
      for (const who of [0, 1] as const) {
        const up = pair[who];
        const down = pair[1 - who];
        const win = rects.find((r) => r.id === up.standingOn);
        if (!win || !onGround(down) || down.y - win.y < 60) continue;
        this.nextVisit = now + this.between(8, 16) * MIN;
        const side = up.x - win.x > win.w / 2 ? -1 : 1;
        const x = Math.min(Math.max(up.x + side * 44, win.x + 20), win.x + win.w - 20);
        down.jumpTo(x, win.y);
        events.push({ who: (1 - who) as 0 | 1, say: { key: 'friendVisit' } });
        break;
      }
    }

    // Pushing: on the same window, close together, now and then one gives the other a shove.
    if (now > this.nextPush && a.standingOn !== null && sameFloor && d < 40 && a.mode === 'idle' && b.mode === 'idle') {
      this.nextPush = now + this.between(10, 20) * MIN;
      const pusher = this.random() < 0.5 ? 0 : 1;
      const victim = pair[1 - pusher];
      const dir = victim.x >= pair[pusher].x ? 1 : -1;
      victim.bump(dir * 380, -330);
      events.push({ who: pusher, say: { key: 'friendPush' } });
    }
    return events;
  }

  /** Tag: whoever's it runs after the other, who runs away (turning back at the edges). */
  private tagOn(now: number, a: Brain, b: Brain, d: number): SocialEvent[] {
    const tag = this.tag!;
    const pair = [a, b] as const;
    const it = pair[tag.it];
    const runner = pair[1 - tag.it];
    const stop = (events: SocialEvent[]) => {
      this.stop(a, b);
      this.nextTag = now + this.between(15, 30) * MIN;
      return events;
    };
    // Picked up, thrown, called away: the game is over.
    if (busy(a) || busy(b) || (!onGround(a) && a.mode !== 'land') || (!onGround(b) && b.mode !== 'land')) return stop([]);
    if (now > tag.until || tag.tags >= 4) return stop([{ who: this.random() < 0.5 ? 0 : 1, say: { key: 'tagDone' } }]);
    if (now < tag.pauseUntil) return [];

    if (d < TAG_REACH) {
      // Tagged! Now the other one is it.
      tag.it = (1 - tag.it) as 0 | 1;
      tag.tags++;
      tag.pauseUntil = now + 1.2;
      a.target = null;
      b.target = null;
      const caught = tag.it;
      return [{ who: caught, emote: 'exclaim', ...(this.random() < 0.5 ? { say: { key: 'tagYoureIt' } } : {}) }];
    }
    it.target = runner.x;
    if (runner.target === null) {
      const away = runner.x >= it.x ? 1 : -1;
      const nearEdge = away > 0 ? runner.x > runner.width - runner.margin - 80 : runner.x < runner.margin + 80;
      runner.target = runner.x + (nearEdge ? -away : away) * 140;
    }
    return [];
  }

  /** Stops whatever game they're playing (the friend was switched off, or you took over). */
  stop(a: Brain, b: Brain): void {
    if (!this.tag) return;
    a.target = null;
    b.target = null;
    this.tag = null;
  }
}
