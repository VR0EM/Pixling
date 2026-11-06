import { grid, set, stamp } from '../grid.ts';
import type { Species } from '../types.ts';

const POT = [
  'hhhhhhhhhhhhhhhh',
  'bbbbbbbbbbbbbbbb',
  '.ssssssssssssss',
  '.bbbbbbbbbbbbbb',
  '..bbbbbbbbbbbb',
  '..bbbbbbbbbbbs',
  '..bbbbbbbbbbbs',
  '...bbbbbbbbss',
  '...ssssssssss',
];

/** A bean plant in a pot, on two little legs. The palette colours the pot; the plant stays green. */
export const boontje: Species = {
  id: 'boontje',
  name: 'Boontje',
  palette: 'terracotta',
  build(o) {
    const droop = o.frame === 'B' ? 1 : 0;
    const fx = o.faceDx ?? 0;
    const plant = grid();
    const feet = grid();
    const pot = grid();

    stamp(plant, 15, 11, ['GG', 'GG', 'GG', 'GG', 'GG', 'GG', 'GG', 'GG']);
    stamp(plant, 14, 8, ['.gg.', 'gggg', '.GG.']);
    stamp(plant, 9, 12 + droop, ['.ggg..', 'gggggg', 'ggggGG', '.gggg.', '..gg..']);
    stamp(plant, 17, 11 + droop, ['..ggg.', 'gggggg', 'GGgggg', '.gggg.', '..gg..']);

    stamp(feet, 12, o.walk === 0 ? 26 : 27, ['ss', 'ss']);
    stamp(feet, 18, o.walk === 2 ? 26 : 27, ['ss', 'ss']);

    stamp(pot, 8, 18, POT);
    for (const x of [13 + fx, 18 + fx]) {
      if (!o.blink) set(pot, x, 21, 'e');
      set(pot, x, 22, 'e');
    }

    return {
      layers: [
        [plant, 'K'],
        [feet, 'o'],
        [pot, 'o'],
      ],
      hat: [13, 7],
      glasses: [10 + fx, 20],
      bob: 0,
    };
  },
};
