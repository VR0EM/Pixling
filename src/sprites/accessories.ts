import type { Accessory } from './types.ts';

export const ACCESSORIES: Record<string, Accessory> = {
  feesthoed: {
    name: 'Feesthoedje',
    hat: true,
    rows: ['..yy..', '..yy..', '..mm..', '..tt..', '.mmmm.', '.tttt.', 'mmmmmm', 'tttttt'],
  },
  kroon: {
    name: 'Kroontje',
    hat: true,
    rows: ['y.yy.y', 'yyyyyy', 'yyrryy', 'YYYYYY'],
  },
  strikje: {
    name: 'Strikje',
    hat: true,
    centered: true,
    rows: ['mm...mm', 'mmm.mmm', 'mmmMmmm', 'mmm.mmm', 'mm...mm'],
  },
  wintermuts: {
    name: 'Wintermuts',
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
  slaapmuts: {
    name: 'Slaapmuts',
    hat: true,
    hidden: true,
    rows: ['.......w', '.....uuw', '...uuuu.', '.uuuuu..', 'uuuuuu..', 'wwwwww..'],
  },
  zonnebril: {
    name: 'Zonnebril',
    face: true,
    noOutline: true,
    rows: ['nnnnnnnnnnnn', 'nwnnn..nwnnn', '.nnn....nnn.'],
    // The robot's face is a screen, so its shades light up on it instead.
    variants: { robotje: { at: [10, 17], rows: ['qqqqqqqqqqqq', 'qwnnq..qwnnq', '.qqq....qqq.'] } },
  },
};
