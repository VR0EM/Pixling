import { grid, stamp, stampPair } from '../grid.ts';
import type { Species } from '../types.ts';

const EAR_TOP = ['.b.', 'bbb', 'bcb'];
const EAR_BOTTOM = ['bcb', 'bcb', 'bcb', 'bcb', 'bcb', 'bbb', 'bbb'];

const HEAD = [
  '...bbbbbbbbbb...',
  '.bhhbbbbbbbbbbb.',
  'bhbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbaaaaaabbbbb',
  'bbbbbaaaaaabbbbb',
  '.bbbbbaaaabbbbb.',
  '...bbbbbbbbbb...',
];

const BODY = [
  '..bbbbbbbbbbbb..',
  '.bbbbbaaaabbbbb.',
  'bbbbbaaaaaabbbbb',
  'bbbbbaaaaaabbbbb',
  'bbbbbaaaaaabbbbb',
  'bbbbbbaaaabbbbbb',
  'sbbbbbbbbbbbbbbs',
  'sbbbbbbbbbbbbbbs',
  'ssbbbbbbbbbbbbss',
  '.ssssssssssssss.',
];

/** A sitting rabbit, seen from the front: tall ears, big hind feet. */
export const konijn: Species = {
  id: 'konijn',
  name: 'Konijn',
  palette: 'zand',
  build(o) {
    const d = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    // Every fourth tick the right ear flicks outward.
    const flick = (o.tick ?? 0) % 4 === 3 ? 1 : 0;
    const body = grid();
    const feet = grid();
    const face = grid();

    stamp(body, 8, 18, BODY);
    stamp(body, 10, 1 + d, EAR_TOP);
    stamp(body, 19 + flick, 1 + d, EAR_TOP);
    stampPair(body, 10, 4 + d, EAR_BOTTOM);
    stamp(body, 8, 9 + d, HEAD);

    stampPair(feet, 12, 23, ['bb', 'bb', 'bb']);
    stamp(feet, 5, o.walk === 0 ? 25 : 26, ['.bbbbb', 'bbbbbb', 'ssssss']);
    stamp(feet, 21, o.walk === 2 ? 25 : 26, ['bbbbb.', 'bbbbbb', 'ssssss']);

    for (const x of [12 + fx, 19 + fx]) {
      stamp(face, x, (o.blink ? 14 : 13) + d, o.blink ? ['e'] : ['e', 'e']);
    }
    stamp(face, 15 + fx, 15 + d, ['cc', 'oo', 'ww']);

    return {
      layers: [
        [body, 'o'],
        [feet, 'o'],
        [face, null],
      ],
      hat: [13, 8 + d],
      glasses: [10 + fx, 12 + d],
    };
  },
};
