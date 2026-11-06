import { afterEach, describe, expect, it } from 'vitest';
import { isEmpty, toAccessory, type Creation } from './creations.ts';
import { SPECIES, catalog, render, setCreations } from './index.ts';

const hat: Creation = {
  id: 'custom-1',
  name: 'My cap',
  slot: 'hat',
  outline: true,
  rows: ['............', '....rrrr....', '...rrrrrr...', '..rrrrrrrrr.', '............', '............'],
};
const held: Creation = { id: 'custom-2', name: 'Flower', slot: 'hand', outline: true, rows: ['.mm.', 'mymm', '.mm.', '.g..', '.g..'] };
const shades: Creation = { id: 'custom-3', name: 'Mask', slot: 'face', outline: false, rows: ['nnnnnnnnnnnn', 'n..nnnnnn..n'] };

afterEach(() => setCreations([]));

describe('creations', () => {
  it('drops empty rows under a hat so it rests on the head', () => {
    expect(toAccessory(hat).rows).toHaveLength(4);
    expect(toAccessory(held).rows).toHaveLength(5);
    expect(isEmpty(['....', '....'])).toBe(true);
    expect(isEmpty(['..r.'])).toBe(false);
  });

  it('shows up in the menu and on every species, in every slot', () => {
    setCreations([hat, held, shades]);
    expect(catalog().accessories.map((a) => a.name)).toEqual(expect.arrayContaining(['My cap', 'Flower', 'Mask']));
    for (const sp of SPECIES) {
      for (const c of [hat, held, shades]) {
        const plain = render(sp.id).pixels.flat().join();
        const worn = render(sp.id, { accessory: c.id }).pixels.flat();
        expect(worn.join()).not.toBe(plain);
        expect(worn).not.toContain('#ff00ff');
      }
    }
  });

  it('is forgotten when deleted, without breaking the buddy that wore it', () => {
    setCreations([hat]);
    const worn = render('shroom', { accessory: hat.id }).pixels.flat().join();
    setCreations([]);
    expect(render('shroom', { accessory: hat.id }).pixels.flat().join()).not.toBe(worn);
    expect(catalog().accessories.map((a) => a.id)).not.toContain(hat.id);
  });

  it('centres a home-made hat on the head', () => {
    setCreations([{ ...hat, rows: ['....rrrr....'] }]);
    const top = render('robot', { accessory: hat.id }).pixels.findIndex((row) => row.includes('#e8454f'));
    const row = render('robot', { accessory: hat.id }).pixels[top];
    const xs = row.map((c, x) => (c === '#e8454f' ? x : -1)).filter((x) => x >= 0);
    expect((xs[0] + xs[xs.length - 1]) / 2).toBe(15.5);
  });
});
