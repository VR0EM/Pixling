import { grid, stamp } from '../grid.ts';
import { bodyMask, frameParams } from '../body.ts';
import type { Species } from '../types.ts';

export const spookje: Species = {
  id: 'spookje',
  name: 'Spookje',
  palette: 'spookwit',
  floats: true,
  build(o) {
    const f = frameParams('spook', o.frame);
    const d = f.d;
    const fx = o.faceDx ?? 0;

    const face = grid();
    for (const x of [12 + fx, 18 + fx]) {
      if (o.blink) stamp(face, x, 19 + d, ['ee']);
      else stamp(face, x, 17 + d, ['we', 'ee', 'ee']);
    }
    stamp(face, 10 + fx, 20 + d, ['cc']);
    stamp(face, 20 + fx, 20 + d, ['cc']);
    stamp(face, 15 + fx, 20 + d, ['ee', 'ee']);

    return {
      layers: [
        [bodyMask('spook', f, o.tick ?? 0), 'o'],
        [face, null],
      ],
      hat: [13, 10 + d],
      glasses: [10 + fx, 17 + d],
    };
  },
};
