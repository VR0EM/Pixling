import { grid, stamp, stampPair } from '../grid.ts';
import { bodyMask, feetMask, frameParams } from '../body.ts';
import type { Layer, Species } from '../types.ts';

const SCREEN = [
  '.pppppppppp.',
  'pppppppppppp',
  'pppppppppppp',
  'pppppppppppp',
  'pppppppppppp',
  'pppppppppppp',
  'pppppppppppp',
  '.pppppppppp.',
];

export const robotje: Species = {
  id: 'robotje',
  name: 'Robotje',
  palette: 'hemel',
  build(o, accessory) {
    const f = frameParams('robot', o.frame);
    const d = f.d;
    const tick = o.tick ?? 0;
    const fx = o.faceDx ?? 0;
    const layers: Layer[] = [];

    const bolts = grid();
    stampPair(bolts, 4, 17 + d, ['ss', 'ss', 'ss', 'ss']);
    layers.push([bolts, 'o']);

    if (!accessory?.hat) {
      const light = Math.floor(tick / 2) % 2 ? 'Q' : 'q';
      const antenna = grid();
      stamp(antenna, 14, 4 + d, [`.${light}${light}.`, light.repeat(4), `.${light}${light}.`, '.ss.', '.ss.', '.ss.', '.ss.']);
      layers.push([antenna, 'o']);
    }

    layers.push([feetMask(o.walk), 'o']);
    layers.push([bodyMask('robot', f, tick), 'o']);

    const face = grid();
    stamp(face, 10, 15 + d, SCREEN);
    for (const x of [12 + fx, 18 + fx]) {
      if (o.blink) stamp(face, x, 19 + d, ['qq']);
      else stamp(face, x, 17 + d, ['qq', 'qq', 'qq']);
    }
    stamp(face, 14 + fx, 20 + d, ['q..q', '.qq.']);
    layers.push([face, null]);

    return { layers, hat: [13, 10 + d], glasses: [10 + fx, 17 + d] };
  },
};
