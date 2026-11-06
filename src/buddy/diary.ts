import type { SproutSave } from './traits.ts';
import type { Character } from './voice.ts';

/** What happened on one day; the diary turns it into a sentence. */
export interface DayStats {
  pets: number;
  throws: number;
  focus: number;
  water: number;
  notes: number;
  files: number;
  climbs: number;
  /** Meetings from the calendar that ended. Older days may not have it. */
  meetings?: number;
}

export interface DiaryDay extends DayStats {
  /** The sentence, written once the day is over. */
  sentence?: string;
}

/** Stored in diary.json: one entry per day, keyed by date (YYYY-MM-DD), and how far the sprout has grown. */
export interface Diary {
  days: Record<string, DiaryDay>;
  sprout?: SproutSave;
}

export const emptyDay = (): DiaryDay => ({ pets: 0, throws: 0, focus: 0, water: 0, notes: 0, files: 0, climbs: 0 });

/** Local date as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days between two YYYY-MM-DD dates, counting the first day as day 1. */
export function daysTogether(metOn: string, today: string): number {
  const ms = Date.parse(`${today}T12:00:00`) - Date.parse(`${metOn}T12:00:00`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** The day in a few words, most remarkable things first, at most three of them. */
function facts(s: DayStats): string[] {
  const all: [number, string][] = [
    [s.focus * 3, plural(s.focus, 'focus round', 'focus rounds')],
    [(s.meetings ?? 0) * 2, `${plural(s.meetings ?? 0, 'meeting', 'meetings')} survived`],
    [s.files * 2, `${plural(s.files, 'file', 'files')} eaten`],
    [s.notes * 2, plural(s.notes, 'note', 'notes')],
    [s.water * 2, `water ${times(s.water)}`],
    [s.climbs, `climbed a window ${times(s.climbs)}`],
    [s.throws, `flew through the air ${times(s.throws)}`],
    [s.pets * 0.5, `petted ${times(s.pets)}`],
  ];
  return all
    .filter(([weight]) => weight > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .map(([, text]) => text);
}

const join = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** One sentence about the day, in the buddy's character. */
export function sentence(stats: DayStats, character: Character): string {
  const list = facts(stats);
  if (list.length === 0) {
    return {
      sweet: 'A quiet day together. Cosy too.',
      hyper: 'NOTHING happened today. Boring!',
      calm: 'A calm day. Good.',
      cheeky: 'You ignored me all day.',
    }[character];
  }
  const what = join(list);
  return {
    sweet: `Today: ${what}. What a lovely day!`,
    hyper: `What a day! ${what}! More tomorrow!`,
    calm: `Today: ${what}.`,
    cheeky: `${what[0].toUpperCase()}${what.slice(1)}. And I didn’t even get a cookie.`,
  }[character];
}
