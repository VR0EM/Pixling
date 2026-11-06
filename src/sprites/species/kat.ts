import { grid, set, stamp, stampPair } from '../grid.ts';
import type { Species } from '../types.ts';

const EAR = ['b.....', 'bb....', 'bab...', 'baab..', 'baaab.', 'bbbbbb'];

const HEAD = [
  '..bbbbbbbbbbbbbbbb..',
  '.bhhbbbsbssbsbbbbbb.',
  'bhbbbbbsbbbbsbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbbbbbbb.',
  '..bbbbbbbbbbbbbbbb..',
  '....bbbbbbbbbbbb....',
];

const BODY = [
  '.bbbaaaaaabbb.',
  'sbbbaaaaaabbbs',
  'bbbbaaaaaabbbb',
  'sbbbbaaaabbbbs',
  'bbbbbbbbbbbbbb',
  'sbbbbbbbbbbbbs',
  'sbbbbbbbbbbbbs',
  'ssbbbbbbbbbbss',
  '.ssssssssssss.',
];

const TAIL = ['...bb.', '....bb', '....bb', '....ss', '....bb', '...ss.', '..bbb.', '.bbb..', 'bbb...'];
const TAIL_UP = ['....bb', '....bb', '....bb', '....ss', '....bb', '...ss.', '..bbb.', '.bbb..', 'bbb...'];

/** A sitting cat, seen from the front, with its tail curled up along its right side. */
export const kat: Species = {
  id: 'kat',
  name: 'Kat',
  palette: 'gember',
  build(o) {
    const d = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    const tail = grid();
    const body = grid();
    const paws = grid();
    const face = grid();

    stamp(tail, 21, 18, (o.tick ?? 0) % 2 ? TAIL_UP : TAIL);

    stamp(body, 9, 19, BODY);
    stampPair(body, 7, 4 + d, EAR);
    stamp(body, 6, 9 + d, HEAD);

    stamp(paws, 11, o.walk === 0 ? 25 : 26, ['bbb', 'bbb', 'bbb']);
    stamp(paws, 18, o.walk === 2 ? 25 : 26, ['bbb', 'bbb', 'bbb']);

    for (const x of [11 + fx, 20 + fx]) {
      if (!o.blink) set(face, x, 13 + d, 'e');
      set(face, x, 14 + d, 'e');
    }
    stamp(face, 15 + fx, 15 + d, ['cc']);
    set(face, 14 + fx, 16 + d, 'o');
    set(face, 17 + fx, 16 + d, 'o');

    return {
      layers: [
        [tail, 'o'],
        [body, 'o'],
        [paws, 'o'],
        [face, null],
      ],
      hat: [13, 8 + d],
      glasses: [10 + fx, 12 + d],
    };
  },
};
