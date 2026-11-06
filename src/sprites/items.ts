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
  /** Animation: one drawing per tick, used instead of `rows`. */
  frames?: string[][];
  /** Where the buddy looks while holding it (-1 left, 1 right), when it isn't walking. */
  gaze?: number;
}

/** Headphones drawn around each built-in head; the generic version is a boombox. */
const HEADPHONES: Record<string, Variant> = /*HP*/ {
  robot: {
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
  ghost: {
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
  shroom: {
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
  dragon: {
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

/** Code that appears on the laptop line by line, in syntax colours ('p' is the dark screen). */
const CODE = ['rrpyy', 'pqqqq', 'pptgg'];

/** An open laptop next to the buddy. Frame n has typed n lines and half of the next one, with a cursor. */
function laptopFrame(n: number): string[] {
  const line = (i: number) => {
    const text = i < n ? CODE[i] : i === n ? CODE[i].slice(0, 3) + 'w' : '';
    return `.Np${text.padEnd(5, 'p')}N.`;
  };
  return ['.NNNNNNNN.', '.NppppppN.', ...[0, 1, 2].map(line), '.NNNNNNNN.', '.XxXxXxXx.', 'xxxxxxxxxx'];
}

const LAPTOP = [0, 1, 2, 3].map(laptopFrame);

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
    at: [21, 21],
    rows: LAPTOP[3],
    frames: LAPTOP,
    gaze: 1,
    // The mug's handle is on the right, so its laptop stands on the left.
    variants: { mug: { at: [1, 21], gaze: -1 } },
  },
  headphones: {
    name: 'Music',
    slot: 'hand',
    outline: true,
    fixed: true,
    at: [19, 22],
    rows: BOOMBOX,
    variants: {
      ...HEADPHONES,
      mug: { at: [0, 22], rows: BOOMBOX },
    },
  },
  umbrella: {
    name: 'Umbrella',
    slot: 'hand',
    outline: true,
    fixed: true,
    at: [20, 4],
    rows: [
      '....rrr....',
      '..rrrrrrr..',
      '.rrrrrrrrr.',
      'rrrrrrrrrrr',
      'rRrRrRrRrRr',
      '.....k.....',
      '.....k.....',
      '.....k.....',
      '.....k.....',
      '.....k.....',
      '.....k.k...',
      '......k....',
    ],
    // The mug's handle is on the right, so it holds the umbrella on the left.
    variants: { mug: { at: [1, 4] } },
  },
  cake: {
    name: 'Cake',
    slot: 'hand',
    outline: true,
    rows: ['..y..', '..r..', 'wwwww', 'wmwmw', 'mmmmm', 'kkkkk'],
    at: [23, 21],
  },
  calendar: {
    name: 'Calendar',
    slot: 'hand',
    outline: true,
    rows: ['.n..n.', 'rnrrnr', 'rrrrrr', 'wwwwww', 'wnwnww', 'wwwwww', 'wnwrww', 'wwwwww'],
    at: [23, 18],
  },
  popcorn: {
    name: 'Popcorn',
    slot: 'hand',
    outline: true,
    rows: ['.y.w.', 'wywyw', 'rwrwr', 'rwrwr', 'rwrwr', '.rwr.'],
    at: [23, 19],
  },
  book: {
    name: 'Book',
    slot: 'hand',
    outline: true,
    fixed: true,
    rows: BOOK,
    at: [11, 23],
    variants: { sprout: { at: [11, 24], rows: BOOK } },
  },
  water: {
    name: 'Water',
    slot: 'hand',
    outline: true,
    rows: ['w..w', 'w..w', 'wttw', 'wttw', 'wwww'],
    at: [24, 19],
  },
  coffee: {
    name: 'Coffee',
    slot: 'hand',
    outline: true,
    rows: ['.w.w..', 'wkkkw.', 'wwwwww', 'wwwww.', '.www..'],
    at: [23, 20],
    variants: { mug: null },
  },
  controller: {
    name: 'Controller',
    slot: 'hand',
    outline: true,
    fixed: true,
    rows: ['.XXXXXXXX.', 'XXNXXXXrXX', 'XNNNXXtXyX', 'XXNXXXXgXX', 'xXX....XXx'],
    at: [11, 23],
    variants: { sprout: { at: [11, 24], rows: ['.XXXXXXXX.', 'XXNXXXXrXX', 'XNNNXXtXyX', 'XXNXXXXgXX', 'xXX....XXx'] } },
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
