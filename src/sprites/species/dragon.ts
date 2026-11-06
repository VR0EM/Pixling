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

// Spread wings while flying: up, then down.
const WING_UP = ['b.......', 'bb......', 'bsb.....', 'bssb....', '.bssbb..', '..bsssbb', '...s.s.s'];
const WING_DOWN = ['.....bbb', '...bbssb', '.bbssssb', 'bssss.sb', '.s.s..b.'];

const TAIL = ['......aa.', '.....aaaa', '......aa.', '.....bb..', '..bbbb...', 'bbbb.....'];

/** A baby dragon: a big round head with little horns, folded wings and a curled tail. */
export const dragon: Species = {
  id: 'dragon',
  name: 'Dragon',
  palette: 'moss',
  build(o) {
    const d = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    const back = grid();
    const feet = grid();
    const main = grid();
    const arms = grid();
    const face = grid();

    const flying = o.fly !== undefined;
    if (flying) stampPair(back, 0, o.fly ? 14 : 4, o.fly ? WING_DOWN : WING_UP);
    // Folded, the wings lift a pixel on every other tick.
    else stampPair(back, 4, 13 - ((o.tick ?? 0) % 2), WING);
    stamp(back, 20, 20, TAIL);
    stampPair(back, 8, 3 + d, HORN);

    // In the air the feet are tucked up.
    stamp(feet, 11, flying || o.walk === 0 ? 25 : 26, flying ? ['bbbb', 'ssss'] : ['bbbb', 'bbbb', 'ssss']);
    stamp(feet, 17, flying || o.walk === 2 ? 25 : 26, flying ? ['bbbb', 'ssss'] : ['bbbb', 'bbbb', 'ssss']);

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
