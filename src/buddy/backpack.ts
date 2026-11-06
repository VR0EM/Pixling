/**
 * The backpack: small helpers that work through the buddy's behaviour rather than notifications.
 * A focus timer, a water reminder and a break reminder. Pure logic with times in milliseconds, so it
 * can be tested without waiting.
 */

export interface BackpackSettings {
  water: boolean;
  breaks: boolean;
  focusMinutes: number;
  breakMinutes: number;
}

export type Phase = 'uit' | 'focus' | 'pauze';

/** What the buddy should do right now because of the backpack. */
export interface Advice {
  /** An item to hold (wins over items from the app in front). */
  item?: string;
  /** Sit still instead of wandering or climbing. */
  stayPut: boolean;
  /** Tired: yawns now and then. */
  tired: boolean;
  /** Text for the balloon, given once when something starts. */
  say?: string;
  /** Text next to the menu bar icon, or null for none. */
  trayTitle: string | null;
}

const MIN = 60_000;
export const WATER_EVERY = 45 * MIN;
/** How long the glass of water stays up if it isn't clicked. */
const WATER_SHOWN = 3 * MIN;
/** Working this long without a real break makes the buddy tired... */
export const TIRED_AFTER = 60 * MIN;
/** ...and after this much longer it says so. */
const TIRED_SAYS = 5 * MIN;
/** Not touching the mouse this long counts as a break. */
export const BREAK_COUNTS = 5 * MIN;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class Backpack {
  phase: Phase = 'uit';
  private phaseEnd = 0;
  private waterDue: number;
  private waterUntil: number | null = null;
  private activeSince: number | null = null;
  private saidTired = false;
  private pending: string | undefined;

  constructor(now: number) {
    this.waterDue = now + WATER_EVERY;
  }

  startFocus(now: number, settings: BackpackSettings): void {
    this.phase = 'focus';
    this.phaseEnd = now + settings.focusMinutes * MIN;
    this.pending = `Focus! ${settings.focusMinutes} minuten, ik lees wel even.`;
  }

  stopFocus(): void {
    if (this.phase === 'uit') return;
    this.phase = 'uit';
    this.pending = 'Gestopt. Goed gedaan!';
  }

  /** The buddy was clicked: that answers a water or break reminder. Returns true if it did. */
  answer(now: number): boolean {
    if (this.waterUntil !== null) {
      this.waterUntil = null;
      this.waterDue = now + WATER_EVERY;
      this.pending = 'Proost!';
      return true;
    }
    if (this.activeSince !== null && now - this.activeSince > TIRED_AFTER) {
      this.activeSince = now; // snooze: it starts counting again
      this.saidTired = false;
      this.pending = 'Oké, nog even dan.';
      return true;
    }
    return false;
  }

  update(now: number, idleMs: number, settings: BackpackSettings): Advice {
    // Focus and break phases.
    if (this.phase !== 'uit' && now >= this.phaseEnd) {
      if (this.phase === 'focus') {
        this.phase = 'pauze';
        this.phaseEnd = now + settings.breakMinutes * MIN;
        this.pending = 'Pauze! Even rekken en strekken.';
        this.activeSince = null;
      } else {
        this.phase = 'uit';
        this.pending = 'Pauze voorbij. Nog een ronde?';
      }
    }

    // Time at the computer without a real break.
    if (idleMs > BREAK_COUNTS) {
      this.activeSince = null;
      this.saidTired = false;
    } else if (this.activeSince === null && this.phase !== 'pauze') {
      this.activeSince = now - idleMs;
    }
    const worked = this.activeSince === null ? 0 : now - this.activeSince;
    const tired = settings.breaks && this.phase === 'uit' && worked > TIRED_AFTER;
    if (tired && !this.saidTired && worked > TIRED_AFTER + TIRED_SAYS) {
      this.saidTired = true;
      this.pending = 'Even pauze nemen? Ik word er moe van.';
    }

    // Water, never in the middle of a focus round, and only when someone is there to drink it.
    if (!settings.water) this.waterUntil = null;
    else if (this.waterUntil !== null && now > this.waterUntil) {
      this.waterUntil = null;
      this.waterDue = now + WATER_EVERY;
    } else if (this.waterUntil === null && now >= this.waterDue && this.phase !== 'focus' && idleMs < MIN) {
      this.waterUntil = now + WATER_SHOWN;
      this.pending = 'Slokje water?';
    }

    const say = this.pending;
    this.pending = undefined;
    let item: string | undefined;
    if (this.phase === 'focus') item = 'boek';
    else if (this.waterUntil !== null) item = 'water';
    return {
      item,
      stayPut: this.phase === 'focus',
      tired,
      say,
      trayTitle:
        this.phase === 'focus'
          ? clock(this.phaseEnd - now)
          : this.phase === 'pauze'
            ? `Pauze ${clock(this.phaseEnd - now)}`
            : null,
    };
  }
}
