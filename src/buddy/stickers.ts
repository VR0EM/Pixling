import type { Emote } from '../sprites/emotes.ts';
import { daysTogether, type Diary } from './diary.ts';

/**
 * The sticker book: little achievements, earned by doing things together. Some unlock an accessory
 * (unless everything is unlocked in the wardrobe). Counted from the diary, so nothing extra is tracked.
 */

export interface Totals {
  pets: number;
  throws: number;
  focus: number;
  water: number;
  notes: number;
  files: number;
  climbs: number;
  meetings: number;
  fetches: number;
  baskets: number;
  finds: number;
  eggs: number;
  /** Days since you met, counting the first. */
  days: number;
  /** The sprout bloomed. */
  bloomed: number;
}

export interface Sticker {
  id: string;
  name: string;
  /** How to earn it. */
  hint: string;
  /** What's drawn on it: an emote, an item or a species. */
  icon: { emote?: Emote; item?: string; species?: string; accessory?: string };
  goal: (t: Totals) => boolean;
}

export const STICKERS: Sticker[] = [
  { id: 'pets1', name: 'Hello there', hint: 'Pet your buddy', icon: { emote: 'heart' }, goal: (t) => t.pets >= 1 },
  { id: 'pets100', name: 'Best friends', hint: 'Pet your buddy 100 times', icon: { emote: 'heart' }, goal: (t) => t.pets >= 100 },
  { id: 'pets250', name: 'Angel', hint: 'Pet your buddy 250 times (unlocks the halo)', icon: { accessory: 'halo' }, goal: (t) => t.pets >= 250 },
  { id: 'throws10', name: 'Frequent flyer', hint: 'Throw your buddy 10 times', icon: { emote: 'exclaim' }, goal: (t) => t.throws >= 10 },
  { id: 'focus1', name: 'In the zone', hint: 'Finish a focus round', icon: { item: 'book' }, goal: (t) => t.focus >= 1 },
  { id: 'focus10', name: 'Wizard of focus', hint: 'Finish 10 focus rounds (unlocks the wizard hat)', icon: { accessory: 'wizardhat' }, goal: (t) => t.focus >= 10 },
  { id: 'water25', name: 'Well watered', hint: 'Drink water together 25 times (unlocks the flower crown)', icon: { accessory: 'flowercrown' }, goal: (t) => t.water >= 25 },
  { id: 'files10', name: 'Hungry', hint: 'Feed your buddy 10 files', icon: { emote: 'question' }, goal: (t) => t.files >= 10 },
  { id: 'notes10', name: 'Note taker', hint: 'Write 10 notes', icon: { item: 'calendar' }, goal: (t) => t.notes >= 10 },
  { id: 'climbs25', name: 'Climber', hint: 'Let your buddy climb 25 windows', icon: { emote: 'note' }, goal: (t) => t.climbs >= 25 },
  { id: 'meetings10', name: 'Survivor', hint: 'Get through 10 meetings', icon: { item: 'calendar' }, goal: (t) => t.meetings >= 10 },
  { id: 'fetch10', name: 'Good buddy', hint: 'Play fetch 10 times', icon: { emote: 'heart' }, goal: (t) => t.fetches >= 10 },
  { id: 'basket5', name: 'Slam dunk', hint: 'Score 5 baskets (unlocks the cap)', icon: { accessory: 'cap' }, goal: (t) => t.baskets >= 5 },
  { id: 'finds5', name: 'Seeker', hint: 'Find your buddy 5 times in hide and seek', icon: { emote: 'exclaim' }, goal: (t) => t.finds >= 5 },
  { id: 'eggs5', name: 'Egg hunter', hint: 'Find 5 Easter eggs', icon: { emote: 'drop' }, goal: (t) => t.eggs >= 5 },
  { id: 'bloom', name: 'Green thumb', hint: 'Help the sprout bloom', icon: { species: 'sprout' }, goal: (t) => t.bloomed >= 1 },
  { id: 'days7', name: 'One week', hint: 'Be buddies for a week', icon: { item: 'cake' }, goal: (t) => t.days >= 7 },
  { id: 'days100', name: 'A hundred days', hint: 'Be buddies for 100 days', icon: { item: 'cake' }, goal: (t) => t.days >= 100 },
];

/** Everything counted in the diary, added up. */
export function totals(diary: Diary, metOn: string | null, today: string): Totals {
  const t: Totals = {
    pets: 0,
    throws: 0,
    focus: 0,
    water: 0,
    notes: 0,
    files: 0,
    climbs: 0,
    meetings: 0,
    fetches: 0,
    baskets: 0,
    finds: 0,
    eggs: 0,
    days: metOn ? daysTogether(metOn, today) : 1,
    bloomed: (diary.sprout?.growth ?? 0) >= 3 ? 1 : 0,
  };
  const counted = ['pets', 'throws', 'focus', 'water', 'notes', 'files', 'climbs', 'meetings', 'fetches', 'baskets', 'finds', 'eggs'] as const;
  for (const day of Object.values(diary.days ?? {})) {
    for (const key of counted) t[key] += Number((day as unknown as Record<string, number>)[key] ?? 0) || 0;
  }
  return t;
}

/** The ids of every sticker these totals have earned. */
export function earned(t: Totals): string[] {
  return STICKERS.filter((s) => s.goal(t)).map((s) => s.id);
}
