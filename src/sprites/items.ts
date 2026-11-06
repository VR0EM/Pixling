import type { Built } from './types.ts';

/**
 * Things the buddy picks up by itself, depending on the app in front. Unlike accessories they aren't
 * chosen in the menu, and they combine with whatever hat the buddy wears.
 */
export interface Item {
  name: string;
  /** head: around the head (under a hat), face: on the eyes, hand: held at the side or in front. */
  slot: 'head' | 'face' | 'hand';
  outline: boolean;
  rows: string[];
  /** Top-left corner when the species has no own anchor for this slot. */
  at?: [number, number];
}

export const ITEMS: Record<string, Item> = {
  leesbril: {
    name: 'Leesbril',
    slot: 'face',
    outline: false,
    rows: ['.YYY....YYY.', 'Y...YYYY...Y', '.YYY....YYY.'],
  },
  koptelefoon: {
    name: 'Koptelefoon',
    slot: 'head',
    outline: false,
    rows: [
      '.....nnnnnn.....',
      '...nn......nn...',
      '..n..........n..',
      '.n............n.',
      '.n............n.',
      'RRR..........RRR',
      'Rrr..........rrR',
      'RRR..........RRR',
    ],
  },
  popcorn: {
    name: 'Popcorn',
    slot: 'hand',
    outline: true,
    rows: ['.y.w.', 'wywyw', 'rwrwr', 'rwrwr', 'rwrwr', '.rwr.'],
    at: [23, 19],
  },
  controller: {
    name: 'Controller',
    slot: 'hand',
    outline: true,
    rows: ['.nnnnnn.', 'nntnnrnn', 'nnnnnnnn', 'nn....nn'],
    at: [12, 21],
  },
};

/** Where an item goes on a species. */
export function itemAnchor(item: Item, built: Built): [number, number] {
  if (item.slot === 'face') return built.glasses;
  // A 16-wide band centred on the 6-wide hat anchor, resting on the head.
  if (item.slot === 'head') return [built.hat[0] - 5, built.hat[1]];
  return built.hand ?? item.at ?? [23, 19];
}
