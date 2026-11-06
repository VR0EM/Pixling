import { grid, set, stamp, stampPair } from '../grid.ts';
import type { Species } from '../types.ts';

const WING = [
  'b.........',
  '.b........',
  '.bb.......',
  '.bsbb.....',
  '.bssbb....',
  '.bsssbbb..',
  '.bsssssbb.',
  '..ssssssbb',
  '..s.s.ssbb',
  '.......sbb',
  '........bb',
];

const TAIL = ['.....aa.', '....aaaa', '.....bb.', '.....bb.', '....bbb.', '..bbbb..', 'bbbb....'];

const HEAD = [
  '..bbbbbbbbbb..',
  '.bhhbbbbbbbbb.',
  'bhbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  'bbbaaaaaaaabbb',
  '.bbaaaaaaaabb.',
  '..bbaaaaaabb..',
  '....bbbbbb....',
];

const BODY = [
  '.bbbbbbbbbb.',
  'bbbaaaaaabbb',
  'bbbaaaaaabbb',
  'bbbssssssbbb',
  'bbbaaaaaabbb',
  'bbbssssssbbb',
  'bbbaaaaaabbb',
  'bbbbaaaabbbb',
  'sbbbbbbbbbbs',
  'ssbbbbbbbbss',
  '.ssssssssss.',
];

/** A little dragon standing up, wings spread behind it and a spade-tipped tail. */
export const draakje: Species = {
  id: 'draakje',
  name: 'Draakje',
  palette: 'mos',
  build(o) {
    const d = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    const flap = (o.tick ?? 0) % 2;
    const back = grid();
    const main = grid();
    const limbs = grid();
    const face = grid();

    stampPair(back, 1, 6 + flap, WING);
    stamp(back, 21, 19, TAIL);

    stamp(main, 10, 16, BODY);
    stampPair(main, 9, 3 + d, ['a..', 'aa.', '.aa', '..a']);
    stamp(main, 9, 7 + d, HEAD);

    stampPair(limbs, 8, 18, ['bb', 'bb', 'bb']);
    stamp(limbs, 10, o.walk === 0 ? 25 : 26, ['bbbb', 'bbbb', 'bbbb']);
    stamp(limbs, 18, o.walk === 2 ? 25 : 26, ['bbbb', 'bbbb', 'bbbb']);

    for (const x of [12 + fx, 19 + fx]) {
      if (!o.blink) set(face, x, 10 + d, 'e');
      set(face, x, 11 + d, 'e');
    }
    set(face, 14 + fx, 14 + d, 'o');
    set(face, 17 + fx, 14 + d, 'o');

    return {
      layers: [
        [back, 'o'],
        [main, 'o'],
        [limbs, 'o'],
        [face, null],
      ],
      hat: [13, 6 + d],
      glasses: [10 + fx, 9 + d],
    };
  },
};
