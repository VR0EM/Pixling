import type { Built, Variant } from './types.ts';

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
  /** Always at `at`, never at the species' hand anchor (big things that stand on the ground). */
  fixed?: boolean;
  /** Species-specific versions, by species id; null leaves it off that species. */
  variants?: Record<string, Variant | null>;
}

/** Headphones drawn around each built-in head; the generic version is a boombox. */
const HEADPHONES: Record<string, Variant> = /*HP*/ {
  robotje: {
    slot: 'head',
    outline: false,
    at: [1, 8],
    rows: [
      '.........nnnnnnnnnnnn.........',
      '.......nnNNNNNNNNNNNNnn.......',
      '......nN..............Nn......',
      '.....nN................Nn.....',
      '....nN..................Nn....',
      '...nN....................Nn...',
      '...nN....................Nn...',
      '.nnnn....................nnnn.',
      'nwrrRn..................nRrrwn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      '.nnnn....................nnnn.',
    ],
  },
  spookje: {
    slot: 'head',
    outline: false,
    at: [1, 8],
    rows: [
      '...........nnnnnnnn...........',
      '.........nnNNNNNNNNnn.........',
      '........nNN........NNn........',
      '.......nN............Nn.......',
      '......nN..............Nn......',
      '.....nN................Nn.....',
      '....nN..................Nn....',
      '.nnnn....................nnnn.',
      'nwrrRn..................nRrrwn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      'nrrrRn..................nRrrrn',
      '.nnnn....................nnnn.',
    ],
  },
  paddo: {
    slot: 'head',
    outline: false,
    at: [5, 17],
    rows: [
      '.nnnn............nnnn.',
      'nwrrRn..........nRrrwn',
      'nrrrRn..........nRrrrn',
      'nrrrRn..........nRrrrn',
      'nrrrRn..........nRrrrn',
      'nrrrRn..........nRrrrn',
      '.nnnn............nnnn.',
    ],
  },
  draakje: {
    slot: 'head',
    outline: false,
    at: [2, 3],
    rows: [
      '.........nnnnnnnnnn.........',
      '........nNNNNNNNNNNn........',
      '.......nN..........Nn.......',
      '......nN............Nn......',
      '..nnnnN..............Nnnnn..',
      'nwrrRn................nRrrwn',
      'nrrrRn................nRrrrn',
      'nrrrRn................nRrrrn',
      'nrrrRn................nRrrrn',
      'nrrrRn................nRrrrn',
      '.nnnn..................nnnn.',
    ],
  },
} /*/HP*/;

/** A dark laptop seen from behind the lid, with a code sticker. */
const LAPTOP = ['.NNNNNNNNNNNNN.', '.NNNqNNNqNqNNN.', '.NNqNNNqNNNqNN.', '.NNNqNqNNNqNNN.', '.NNNNNNNNNNNNN.', 'xXXXXXXXXXXXXXx'];

/** A little boombox that stands next to the buddy. */
const BOOMBOX = ['...nnnnnn...', '...n....n...', 'NNNNNNNNNNNN', 'NXXXNqqNXXXN', 'NXnXNryNXnXN', 'NXXXNNNNXXXN', 'NNNNNNNNNNNN'];

/** An open book, pages towards the viewer. */
const BOOK = ['ww......ww', 'wwww..wwww', 'wXXXwwXXXw', 'wXXwwwwXXw', 'rrrrrrrrrr'];

export const ITEMS: Record<string, Item> = {
  laptop: {
    name: 'Laptop',
    slot: 'hand',
    outline: true,
    fixed: true,
    at: [8, 23],
    rows: LAPTOP,
    // The bean plant's eyes and the mug's mouth sit low.
    variants: { boontje: { at: [8, 24], rows: LAPTOP }, mokje: { at: [8, 24], rows: LAPTOP } },
  },
  koptelefoon: {
    name: 'Muziek',
    slot: 'hand',
    outline: true,
    fixed: true,
    at: [19, 22],
    rows: BOOMBOX,
    variants: {
      ...HEADPHONES,
      mokje: { at: [0, 22], rows: BOOMBOX },
    },
  },
  popcorn: {
    name: 'Popcorn',
    slot: 'hand',
    outline: true,
    rows: ['.y.w.', 'wywyw', 'rwrwr', 'rwrwr', 'rwrwr', '.rwr.'],
    at: [23, 19],
  },
  boek: {
    name: 'Boek',
    slot: 'hand',
    outline: true,
    fixed: true,
    rows: BOOK,
    at: [11, 23],
    variants: { boontje: { at: [11, 24], rows: BOOK } },
  },
  water: {
    name: 'Water',
    slot: 'hand',
    outline: true,
    rows: ['w..w', 'w..w', 'wttw', 'wttw', 'wwww'],
    at: [24, 19],
  },
  koffie: {
    name: 'Koffie',
    slot: 'hand',
    outline: true,
    rows: ['.w.w..', 'wkkkw.', 'wwwwww', 'wwwww.', '.www..'],
    at: [23, 20],
    variants: { mokje: null },
  },
  controller: {
    name: 'Controller',
    slot: 'hand',
    outline: true,
    fixed: true,
    rows: ['.XXXXXXXX.', 'XXNXXXXrXX', 'XNNNXXtXyX', 'XXNXXXXgXX', 'xXX....XXx'],
    at: [11, 23],
    variants: { boontje: { at: [11, 24], rows: ['.XXXXXXXX.', 'XXNXXXXrXX', 'XNNNXXtXyX', 'XXNXXXXgXX', 'xXX....XXx'] } },
  },
};

/** Where an item goes on a species. */
export function itemAnchor(item: Item, built: Built): [number, number] {
  if (item.slot === 'face') return built.glasses;
  // A 16-wide band centred on the 6-wide hat anchor, resting on the head.
  if (item.slot === 'head') return [built.hat[0] - 5, built.hat[1]];
  if (item.fixed && item.at) return item.at;
  return built.hand ?? item.at ?? [23, 19];
}
