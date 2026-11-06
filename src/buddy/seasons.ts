import { daysTogether, dayKey } from './diary.ts';
import type { Line } from './voice.ts';

/**
 * Holidays and birthdays: a pumpkin around Halloween, a Santa hat in December, snow on the windows in
 * winter, eggs to find at Easter, a cake on your birthday and on the day you met. Pure, so it can be
 * tested with any date.
 */

export interface Season {
  /** Worn when you didn't pick an accessory. */
  hat?: string;
  /** Held. */
  item?: string;
  /** Snow lies on top of the windows and the bottom of the screen. */
  snow: boolean;
  /** Easter: eggs are hidden on the windows. */
  eggHunt: boolean;
  /** Something to say once today. */
  say?: Line;
}

/** Easter Sunday (Gregorian), local midnight. */
export function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export interface SeasonInput {
  /** Your birthday as MM-DD. */
  birthday?: string | null;
  /** The day you met, YYYY-MM-DD. */
  metOn?: string | null;
}

export function seasonFor(date: Date, { birthday, metOn }: SeasonInput = {}): Season {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const sunday = easter(date.getFullYear()).getTime();
  const DAY = 86_400_000;

  const season: Season = {
    snow: month === 12 || month <= 2,
    eggHunt: today >= sunday - 2 * DAY && today <= sunday + DAY,
  };

  // Celebrations first: they win over holiday hats.
  if (birthday && birthday === mmdd) {
    return { ...season, hat: 'partyhat', item: 'cake', say: { key: 'birthdayYou' } };
  }
  if (metOn && metOn.slice(5) === mmdd && metOn.slice(0, 4) < String(date.getFullYear())) {
    const years = date.getFullYear() - Number(metOn.slice(0, 4));
    return { ...season, hat: 'partyhat', item: 'cake', say: { key: 'anniversary', vars: { years: years === 1 ? 'one year' : `${years} years` } } };
  }
  if (metOn) {
    const n = daysTogether(metOn, dayKey(date));
    if (n > 1 && n % 100 === 0) return { ...season, item: 'cake', say: { key: 'daysTogether', vars: { days: n } } };
  }

  if (month === 10 && day >= 24) season.hat = 'pumpkin';
  if (month === 10 && day === 31) season.say = { key: 'halloween' };
  if (month === 12 && day <= 26) season.hat = 'santahat';
  if (month === 12 && day >= 24 && day <= 26) season.say = { key: 'christmas' };
  if (month === 1 && day === 1) season.say = { key: 'newYear' };
  if (month === 2 && day === 14) season.say = { key: 'valentine' };
  if (today === sunday) season.say = { key: 'easter' };
  return season;
}
