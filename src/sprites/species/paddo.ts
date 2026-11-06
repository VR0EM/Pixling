import { grid, set, stamp } from '../grid.ts';
import type { Species } from '../types.ts';

// The cap, 26 wide from x 3; spots and shading are added on top.
const CAP = [
  '........bbbbbbbbbb........',
  '.....bbhhbbbbbbbbbbbb.....',
  '...bbhhbbbbbbbbbbbbbbbb...',
  '..bbhbbbbbbbbbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbbbbbs.',
  'bbbbbbbbbbbbbbbbbbbbbbbbss',
  'bbbbbbbbbbbbbbbbbbbbbbbbss',
  'sbbbbbbbbbbbbbbbbbbbbbbsss',
  '.ssssssssssssssssssssssss.',
  '....ssssssssssssssssss....',
];

// White spots, as [x, y, rows].
const SPOTS: [number, number, string[]][] = [
  [8, 9, ['ww', 'ww']],
  [14, 7, ['.ww.', 'wwww']],
  [21, 10, ['ww', 'ww']],
  [4, 13, ['w', 'w']],
  [26, 13, ['w', 'w']],
  [12, 12, ['w']],
  [18, 13, ['ww']],
];

const STEM = [
  'vvvvvvvvvV',
  'vvvvvvvvvV',
  'vvvvvvvvvV',
  'vvvvvvvvvV',
  'vvvvvvvvvV',
  'vvvvvvvvvV',
  'vvvvvvvvvV',
  'vvvvvvvvVV',
  'vvvvvvvvVV',
  '.vvvvvvVV.',
];

/** A mushroom: a spotted cap on top, a little face on its cream stem. The palette colours the cap. */
export const paddo: Species = {
  id: 'paddo',
  name: 'Paddo',
  palette: 'rood',
  build(o) {
    const d = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    const feet = grid();
    const stem = grid();
    const cap = grid();
    const face = grid();

    stamp(feet, 11, o.walk === 0 ? 26 : 27, ['VVVV', 'VVVV']);
    stamp(feet, 17, o.walk === 2 ? 26 : 27, ['VVVV', 'VVVV']);
    stamp(stem, 11, 16, STEM);
    stamp(cap, 3, 6 + d, CAP);
    for (const [x, y, rows] of SPOTS) stamp(cap, x, y + d, rows);

    for (const x of [12 + fx, 18 + fx]) {
      if (o.blink) stamp(face, x, 19 + d, ['ee']);
      else stamp(face, x, 17 + d, ['we', 'ee', 'ee']);
    }
    set(face, 11 + fx, 20 + d, 'c');
    set(face, 20 + fx, 20 + d, 'c');
    stamp(face, 14 + fx, 20 + d, ['e..e', '.ee.']);

    return {
      layers: [
        [feet, 'o'],
        [stem, 'o'],
        [cap, 'o'],
        [face, null],
      ],
      hat: [13, 5 + d],
      glasses: [10 + fx, 17 + d],
      hand: [22, 18],
      bob: d,
    };
  },
};
