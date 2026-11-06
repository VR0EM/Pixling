import type { Accessory } from './types.ts';

export const ACCESSORIES: Record<string, Accessory> = {
  feesthoed: {
    name: 'Feesthoedje',
    hat: true,
    rows: ['..yy..', '..yy..', '..mm..', '..tt..', '.mmmm.', '.tttt.', 'mmmmmm', 'tttttt'],
  },
  kroon: {
    name: 'Kroontje',
    hat: true,
    rows: ['y.yy.y', 'yyyyyy', 'yyrryy', 'YYYYYY'],
  },
  mijter: {
    name: 'Mijter',
    hat: true,
    rows: ['..rr..', '.rrrr.', 'rryyrr', 'ryyyyr', 'rryyrr', 'rryyrr', 'rrrrrr', 'yyyyyy', 'yyyyyy'],
  },
  zonnebril: {
    name: 'Zonnebril',
    face: true,
    noOutline: true,
    rows: ['nnnnnnnnnnnn', 'nwnnn..nwnnn', '.nnn....nnn.'],
  },
};
