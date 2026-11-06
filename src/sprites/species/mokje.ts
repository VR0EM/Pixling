import { grid, set, stamp } from '../grid.ts';
import type { Species } from '../types.ts';

const MUG = [
  '.hhhhhhhhhhhhhh.',
  'hkkkkkkkkkkkkkkh',
  'hhhhhhhhhhhhhhhh',
  'bhbbbbbbbbbbbbss',
  'bhbbbbbbbbbbbbss',
  'bhbbbbbbbbbbbbss',
  'bhbbbbbbbbbbbbss',
  'bhbbbbbbbbbbbbss',
  'bbbbbbbbbbbbbbss',
  'bbbbbbbbbbbbbbss',
  'bbbbbbbbbbbbbbss',
  'bbbbbbbbbbbbbbss',
  'sbbbbbbbbbbbbsss',
  '.sssssssssssssss',
  '..ssssssssssss..',
];

const HANDLE = ['bbb..', '..bb.', '...bb', '...bb', '...bb', '...bb', '...bb', '..bb.', 'bbb..'];

// Two curls of steam that sway between two positions.
const STEAM = [
  ['....j....j', '.j..j...j.', '.j...j..j.', '..j..j.j..', '..j...j...', '.j....j...', '.j........'],
  ['.....j..j.', '..j..j...j', '..j.j....j', '.j..j...j.', '.j...j.j..', '..j..j....', '..j.......'],
];

/** A coffee mug with a face, little legs and steam curling up. The palette colours the mug. */
export const mokje: Species = {
  id: 'mokje',
  name: 'Mokje',
  palette: 'gember',
  build(o, accessory) {
    const fx = o.faceDx ?? 0;
    // Breathing: the mug settles a pixel onto its legs.
    const d = o.frame === 'B' ? 1 : 0;
    const steam = grid();
    const legs = grid();
    const handle = grid();
    const mug = grid();
    const face = grid();

    if (!accessory?.hat) stamp(steam, 10, 3 + d, STEAM[(o.tick ?? 0) % 2]);
    stamp(legs, 11, o.walk === 0 ? 26 : 27, ['ss', 'ss']);
    stamp(legs, 19, o.walk === 2 ? 26 : 27, ['ss', 'ss']);
    stamp(handle, 24, 15 + d, HANDLE);
    stamp(mug, 8, 11 + d, MUG);

    for (const x of [12 + fx, 19 + fx]) {
      if (!o.blink) set(face, x, 17 + d, 'e');
      set(face, x, 18 + d, 'e');
    }
    stamp(face, 10 + fx, 20 + d, ['cc']);
    stamp(face, 20 + fx, 20 + d, ['cc']);
    stamp(face, 14 + fx, 20 + d, ['o..o', '.oo.']);

    return {
      layers: [
        [steam, null],
        [legs, 'o'],
        [handle, 'o'],
        [mug, 'o'],
        [face, null],
      ],
      hat: [13, 10 + d],
      glasses: [10 + fx, 16 + d],
      hand: [1, 18],
      bob: d,
    };
  },
};
