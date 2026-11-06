import type { Accessory } from './types.ts';

export const ACCESSORIES: Record<string, Accessory> = {
  partyhat: {
    name: 'Party hat',
    hat: true,
    rows: ['..yy..', '..yy..', '..mm..', '..tt..', '.mmmm.', '.tttt.', 'mmmmmm', 'tttttt'],
  },
  crown: {
    name: 'Crown',
    hat: true,
    rows: ['y.yy.y', 'yyyyyy', 'yyrryy', 'YYYYYY'],
  },
  bow: {
    name: 'Bow',
    hat: true,
    centered: true,
    rows: ['mm...mm', 'mmm.mmm', 'mmmMmmm', 'mmm.mmm', 'mm...mm'],
  },
  beanie: {
    name: 'Beanie',
    hat: true,
    centered: true,
    rows: [
      '......ww......',
      '.....wwwX.....',
      '....rrrrrr....',
      '..rrrrrrrrrr..',
      '.rrrrrrrrrrrr.',
      '.rrrrrrrrrrrr.',
      'RrRrRrRrRrRrRr',
      'RrRrRrRrRrRrRr',
    ],
  },
  nightcap: {
    name: 'Nightcap',
    hat: true,
    hidden: true,
    rows: ['.......w', '.....uuw', '...uuuu.', '.uuuuu..', 'uuuuuu..', 'wwwwww..'],
  },
  sunglasses: {
    name: 'Sunglasses',
    face: true,
    noOutline: true,
    rows: ['nnnnnnnnnnnn', 'nwnnn..nwnnn', '.nnn....nnn.'],
    // The robot's face is a screen, so its shades light up on it instead.
    variants: { robot: { at: [10, 17], rows: ['qqqqqqqqqqqq', 'qwnnq..qwnnq', '.qqq....qqq.'] } },
  },
};
