import { grid, set, stamp, stampPair } from '../grid.ts';
import type { Species } from '../types.ts';

const HEAD = [
  '...bbbbbbbbbb...',
  '.bhhbbbbbbbbbbb.',
  'bhbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbs',
  'bbbbbaaaaaabbbbs',
  'bbbbaaaaaaaabbss',
  '.bbbbaaaaaabbbs.',
  '...bbbbbbbbbs...',
];

const BODY = [
  '.bbbbbbbb.',
  'bbbbbbbbbs',
  'bbaaaaaabs',
  'baaaaaaaas',
  'baaaaaaaas',
  'baaaaaaaas',
  'bbaaaaaabs',
  'bbbaaaabss',
  'sbbbbbbbss',
  '.ssssssss.',
];

const HORN = ['a..', 'aa.', '.aa', '..a'];

const WING = ['b......', 'bb.....', 'bsb....', 'bssb...', 'bsssbb.', 'bssssbb', '.s.s.s.'];

const TAIL = ['......aa.', '.....aaaa', '......aa.', '.....bb..', '..bbbb...', 'bbbb.....'];

/** A baby dragon: a big round head with little horns, folded wings and a curled tail. */
export const draakje: Species = {
  id: 'draakje',
  name: 'Draakje',
  palette: 'mos',
  build(o) {
    const d = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    const back = grid();
    const feet = grid();
    const main = grid();
    const arms = grid();
    const face = grid();

    // The wings lift a pixel on every other tick.
    stampPair(back, 4, 13 - ((o.tick ?? 0) % 2), WING);
    stamp(back, 20, 20, TAIL);
    stampPair(back, 8, 3 + d, HORN);

    stamp(feet, 11, o.walk === 0 ? 25 : 26, ['bbbb', 'bbbb', 'ssss']);
    stamp(feet, 17, o.walk === 2 ? 25 : 26, ['bbbb', 'bbbb', 'ssss']);

    stamp(main, 11, 16, BODY);
    stamp(main, 8, 6 + d, HEAD);
    stampPair(arms, 9, 19, ['bb', 'bs']);

    for (const x of [11 + fx, 19 + fx]) {
      if (o.blink) stamp(face, x, 11 + d, ['ee']);
      else stamp(face, x, 9 + d, ['we', 'ee', 'ee']);
    }
    set(face, 9 + fx, 11 + d, 'c');
    set(face, 22 + fx, 11 + d, 'c');
    set(face, 14 + fx, 13 + d, 'o');
    set(face, 17 + fx, 13 + d, 'o');

    return {
      layers: [
        [back, 'o'],
        [feet, 'o'],
        [main, 'o'],
        [arms, 'o'],
        [face, null],
      ],
      hat: [13, 5 + d],
      glasses: [10 + fx, 9 + d],
      hand: [22, 19],
      bob: d,
    };
  },
};
