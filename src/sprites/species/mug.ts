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
export const mug: Species = {
  id: 'mug',
  name: 'Mug',
  palette: 'ginger',
  build(o, accessory) {
    const fx = o.faceDx ?? 0;
    // Breathing: the mug settles a pixel onto its legs.
    const d = o.frame === 'B' ? 1 : 0;
    const steam = grid();
    const legs = grid();
    const handle = grid();
    const mug = grid();
    const face = grid();

    // Fresh coffee steams; it cools down and runs out (fill 3 to 0) until someone refills it.
    const fill = o.fill ?? 3;
    const tick = o.tick ?? 0;
    if (!accessory?.hat && fill === 3) stamp(steam, 10, 3 + d, STEAM[tick % 2]);
    if (!accessory?.hat && fill === 2 && tick % 2) stamp(steam, 10, 6 + d, STEAM[1].slice(3));
    stamp(legs, 11, o.walk === 0 ? 26 : 27, ['ss', 'ss']);
    stamp(legs, 19, o.walk === 2 ? 26 : 27, ['ss', 'ss']);
    stamp(handle, 24, 15 + d, HANDLE);
    stamp(mug, 8, 11 + d, fill === 0 ? MUG.map((r, i) => (i === 1 ? 'hssssssssssssssh' : r)) : MUG);

    for (const x of [12 + fx, 19 + fx]) {
      if (!o.blink) set(face, x, 17 + d, 'e');
      set(face, x, 18 + d, 'e');
    }
    stamp(face, 10 + fx, 20 + d, ['cc']);
    stamp(face, 20 + fx, 20 + d, ['cc']);
    stamp(face, 14 + fx, 20 + d, fill === 0 ? ['.oo.', 'o..o'] : fill === 1 ? ['....', 'oooo'] : ['o..o', '.oo.']);

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
