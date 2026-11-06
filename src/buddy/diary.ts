import type { Character } from './voice.ts';

/** What happened on one day; the diary turns it into a sentence. */
export interface DayStats {
  aai: number;
  gegooid: number;
  focus: number;
  water: number;
  notities: number;
  bestanden: number;
  vensters: number;
}

export interface DiaryDay extends DayStats {
  /** The sentence, written once the day is over. */
  zin?: string;
}

/** Stored in diary.json: one entry per day, keyed by date (YYYY-MM-DD). */
export interface Diary {
  days: Record<string, DiaryDay>;
}

export const emptyDay = (): DiaryDay => ({ aai: 0, gegooid: 0, focus: 0, water: 0, notities: 0, bestanden: 0, vensters: 0 });

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

/** The day in a few words, most remarkable things first, at most three of them. */
function facts(s: DayStats): string[] {
  const all: [number, string][] = [
    [s.focus * 3, plural(s.focus, 'focusronde', 'focusrondes')],
    [s.bestanden * 2, `${plural(s.bestanden, 'bestand', 'bestanden')} opgegeten`],
    [s.notities * 2, plural(s.notities, 'notitie', 'notities')],
    [s.water * 2, `${s.water}× water`],
    [s.vensters, `${s.vensters}× op een venster geklommen`],
    [s.gegooid, `${s.gegooid}× door de lucht gevlogen`],
    [s.aai * 0.5, `${s.aai}× geaaid`],
  ];
  return all
    .filter(([weight]) => weight > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .map(([, text]) => text);
}

const join = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} en ${parts[parts.length - 1]}`);

/** One sentence about the day, in the buddy's character. */
export function sentence(stats: DayStats, character: Character): string {
  const list = facts(stats);
  if (list.length === 0) {
    return {
      lief: 'Een stille dag samen. Ook gezellig.',
      druk: 'Er gebeurde NIKS vandaag. Saai!',
      rustig: 'Een rustige dag. Fijn zo.',
      brutaal: 'Je liet me de hele dag links liggen.',
    }[character];
  }
  const what = join(list);
  return {
    lief: `Vandaag: ${what}. Wat een fijne dag!`,
    druk: `Wat een dag! ${what}! Morgen nog meer!`,
    rustig: `Vandaag ${what}.`,
    brutaal: `${what[0].toUpperCase()}${what.slice(1)}. En ik kreeg niet eens een koekje.`,
  }[character];
}
