import { grid, stamp, stampPair } from '../grid.ts';
import { bodyMask, feetMask, frameParams } from '../body.ts';
import type { Layer, Species } from '../types.ts';

// A lightning bolt on the screen while it charges.
const BOLT = ['..yy', '.yy.', 'yyyy', '.yy.', 'yy..'];

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

export const robot: Species = {
  id: 'robot',
  name: 'Robot',
  palette: 'sky',
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
      // A round lamp with a glint, on a short stem.
      const l = light;
      stamp(antenna, 14, 6 + d, [`.${l}${l}.`, `${l}w${l}${l}`, l.repeat(4), '.ss.', '.ss.']);
      layers.push([antenna, 'o']);
    }

    // Charging: a cable from its right bolt down to a plug on the floor.
    if (o.charging) {
      const cable = grid();
      stamp(cable, 28, 18 + d, ['nn', '.n']);
      for (let y = 20 + d; y < 26; y++) stamp(cable, 29, y, ['n']);
      layers.push([cable, null]);
      const plug = grid();
      stamp(plug, 28, 26, ['XXX', 'xXx']);
      layers.push([plug, 'o']);
    }

    layers.push([feetMask(o.walk), 'o']);
    layers.push([bodyMask('robot', f, tick), 'o']);

    const face = grid();
    stamp(face, 10, 15 + d, SCREEN);
    const charge = o.charge ?? 1;
    if (o.charging) {
      // A bolt that pulses, and a bar that fills up.
      stamp(face, 14, 16 + d, tick % 2 ? BOLT : BOLT.map((r) => r.replace(/y/g, 'Y')));
      const full = Math.round(charge * 8);
      stamp(face, 12, 21 + d, ['q'.repeat(full) + 'Q'.repeat(8 - full)]);
    } else {
      // Low battery: heavy eyelids and a little red bar in the corner.
      const low = charge < 0.25;
      for (const x of [12 + fx, 18 + fx]) {
        if (o.blink) stamp(face, x, 19 + d, ['qq']);
        else if (low) stamp(face, x, 18 + d, ['qq', 'qq']);
        else stamp(face, x, 17 + d, ['qq', 'qq', 'qq']);
      }
      stamp(face, 14 + fx, 20 + d, low ? ['....', 'qqqq'] : ['q..q', '.qq.']);
      if (low) stamp(face, 18, 15 + d, ['rr']);
    }
    layers.push([face, null]);

    return { layers, hat: [13, 10 + d], glasses: [10 + fx, 17 + d], bob: d };
  },
};
