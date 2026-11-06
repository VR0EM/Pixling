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
export const sprout: Species = {
  id: 'sprout',
  name: 'Sprout',
  palette: 'terracotta',
  build(o, accessory) {
    // Thirsty, the leaves hang lower and the top bends over.
    const wilt = o.wilt ? 2 : 0;
    const droop = (o.frame === 'B' ? 1 : 0) + wilt;
    const fx = o.faceDx ?? 0;
    const growth = o.growth ?? 0;
    // Once it has grown, the stem is two pixels taller.
    const up = growth >= 1 ? 2 : 0;
    const plant = grid();
    const feet = grid();
    const pot = grid();

    stamp(plant, 15, 11 - up, Array(8 + up).fill('GG'));
    const top = 8 - up;
    stamp(plant, 14 + (wilt ? 1 : 0), top + wilt, wilt ? ['..gg', '.ggg', 'GG..'] : ['.gg.', 'gggg', '.GG.']);
    stamp(plant, 9, 12 - up + droop, ['.ggg..', 'gggggg', 'ggggGG', '.gggg.', '..gg..']);
    stamp(plant, 17, 11 - up + droop, ['..ggg.', 'gggggg', 'GGgggg', '.gggg.', '..gg..']);
    // A bud, and then a flower, on top (a hat takes its place).
    if (!accessory?.hat && !wilt) {
      if (growth === 2) stamp(plant, 15, top - 2, ['mm', 'GG']);
      if (growth >= 3) stamp(plant, 13, top - 5, ['.m..m.', 'mmmmmm', 'mmyymm', '.myym.', '..GG..']);
    }

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
      hat: [13, 7 - up],
      glasses: [10 + fx, 20],
      bob: 0,
    };
  },
};
