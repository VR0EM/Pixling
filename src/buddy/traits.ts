import type { Emote } from '../sprites/emotes.ts';
import type { RenderOptions } from '../sprites/types.ts';
import type { Line } from './voice.ts';

/**
 * What makes each built-in buddy itself, beyond its looks: the mug's coffee goes cold and runs out, the
 * robot's battery drains and it plugs itself in, the sprout gets thirsty and grows when watered, the shroom
 * glows at night and sneezes spores. (The dragon's flying and the ghost's vanishing live in the brain,
 * because they move the buddy.) Pure logic with times in milliseconds, so it can be tested without waiting.
 */

const MIN = 60_000;
/** Time at the computer per level of coffee: hot, warm, cold, empty. */
export const MUG_COOLS = 20 * MIN;
/** Time at the computer per percent of the robot's battery. */
export const ROBOT_DRAIN = 30_000;
/** Battery percent gained per second while charging. */
const ROBOT_CHARGE_RATE = 2;
/** How long the robot races around after a full charge. */
const ZOOMIES = 30_000;
/** Time at the computer before the sprout gets thirsty, and between its reminders. */
export const SPROUT_THIRSTY = 40 * MIN;
const SPROUT_REMINDS = 20 * MIN;

/** The sprout's growth is kept in the diary, so it keeps growing across days. */
export interface SproutSave {
  /** 0 a sprout, 1 taller, 2 a bud, 3 in bloom. */
  growth: number;
  /** The last day it was watered (YYYY-MM-DD); it grows once per day it's watered. */
  wateredOn: string | null;
}

/** How a trait changes the buddy right now. */
export interface TraitLook {
  render: Partial<RenderOptions>;
  /** Sits still (the robot while charging). */
  stayPut: boolean;
  /** Walking speed, as a factor. */
  speed: number;
}

/** Something to say or show because of a trait. */
export interface Reaction {
  say?: Line;
  emote?: Emote;
}

export class Traits {
  readonly species: string;
  readonly sprout: SproutSave;

  private fill = 3;
  private cooled = 0;
  private refilledOn: string | null = null;

  private battery = 100;
  private drained = 0;
  private charging = false;
  private warnedLow = false;
  private zoomUntil = 0;

  private thirst = 0;
  private remindedAt = -Infinity;

  constructor(species: string, sprout: SproutSave = { growth: 0, wateredOn: null }) {
    this.species = species;
    this.sprout = { ...sprout };
  }

  /** Called once a second; `active` means someone is at the computer. Returns a reaction when something changed. */
  tick(now: number, active: boolean, today: string, hour: number): Reaction | undefined {
    switch (this.species) {
      case 'mug': {
        // A fresh mug in the morning.
        if (active && hour >= 6 && hour < 11 && this.refilledOn !== today && this.fill < 3) return this.refill(today);
        if (!active) return undefined;
        this.cooled += 1000;
        const level = Math.max(0, 3 - Math.floor(this.cooled / MUG_COOLS));
        if (level >= this.fill) return undefined;
        this.fill = level;
        if (level === 1) return { say: { key: 'mugCold' } };
        if (level === 0) return { say: { key: 'mugEmpty' } };
        return undefined;
      }
      case 'robot': {
        if (this.charging) {
          this.battery = Math.min(100, this.battery + ROBOT_CHARGE_RATE);
          if (this.battery < 100) return undefined;
          this.charging = false;
          this.warnedLow = false;
          this.zoomUntil = now + ZOOMIES;
          return { say: { key: 'robotCharged' }, emote: 'bolt' };
        }
        if (!active) return undefined;
        this.drained += 1000;
        while (this.drained >= ROBOT_DRAIN) {
          this.drained -= ROBOT_DRAIN;
          this.battery = Math.max(0, this.battery - 1);
        }
        if (this.battery <= 10) return this.plugIn();
        if (this.battery <= 20 && !this.warnedLow) {
          this.warnedLow = true;
          return { say: { key: 'robotLow' } };
        }
        return undefined;
      }
      case 'sprout': {
        if (!active) return undefined;
        this.thirst += 1000;
        if (this.thirst < SPROUT_THIRSTY || now - this.remindedAt < SPROUT_REMINDS) return undefined;
        this.remindedAt = now;
        return { say: { key: 'sproutThirsty' }, emote: 'drop' };
      }
      default:
        return undefined;
    }
  }

  look(now: number, hour: number): TraitLook {
    const look: TraitLook = { render: {}, stayPut: false, speed: 1 };
    switch (this.species) {
      case 'mug':
        look.render.fill = this.fill;
        break;
      case 'robot':
        look.render.charge = this.battery / 100;
        look.render.charging = this.charging;
        look.stayPut = this.charging;
        look.speed = this.battery <= 20 ? 0.6 : now < this.zoomUntil ? 1.7 : 1;
        break;
      case 'sprout':
        look.render.growth = this.sprout.growth;
        look.render.wilt = this.thirst >= SPROUT_THIRSTY;
        break;
      case 'shroom':
        look.render.glow = hour >= 21 || hour < 6;
        break;
    }
    return look;
  }

  /** The buddy was clicked. Returns a reaction when that meant something to it: a refill, a charge, water. */
  click(today: string, random: () => number = Math.random): Reaction | undefined {
    switch (this.species) {
      case 'mug':
        return this.fill < 3 ? this.refill(today) : undefined;
      case 'robot':
        return !this.charging && this.battery <= 30 ? this.plugIn() : undefined;
      case 'sprout':
        return this.thirst >= SPROUT_THIRSTY || this.sprout.wateredOn !== today ? this.water(today) : undefined;
      case 'shroom':
        if (random() >= 0.35) return undefined;
        return random() < 0.5 ? { emote: 'spores', say: { key: 'shroomSpores' } } : { emote: 'spores' };
      default:
        return undefined;
    }
  }

  /** The water reminder was answered: the sprout drinks along. */
  watered(today: string): Reaction | undefined {
    return this.species === 'sprout' ? this.water(today) : undefined;
  }

  /** The computer was plugged in: the robot charges along. */
  powered(): Reaction | undefined {
    return this.species === 'robot' && !this.charging && this.battery < 90 ? this.plugIn() : undefined;
  }

  private refill(today: string): Reaction {
    this.fill = 3;
    this.cooled = 0;
    this.refilledOn = today;
    return { say: { key: 'mugRefilled' }, emote: 'heart' };
  }

  private plugIn(): Reaction {
    this.charging = true;
    return { say: { key: 'robotCharging' }, emote: 'bolt' };
  }

  private water(today: string): Reaction {
    this.thirst = 0;
    this.remindedAt = -Infinity;
    if (this.sprout.wateredOn !== today) {
      this.sprout.wateredOn = today;
      if (this.sprout.growth < 3) {
        this.sprout.growth += 1;
        return { say: { key: this.sprout.growth === 3 ? 'sproutBloomed' : 'sproutGrew' }, emote: 'drop' };
      }
    }
    return { say: { key: 'sproutWatered' }, emote: 'drop' };
  }
}
